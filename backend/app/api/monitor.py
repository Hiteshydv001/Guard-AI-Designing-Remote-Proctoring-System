"""Proctor actions on a single attempt: review evidence, warn, terminate, grade, approve identity."""

from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from ..core.db import get_session
from ..core.security import CurrentUser, require_proctor
from ..ml.runtime import runtime
from ..models import ProctorMessage, Violation, utcnow
from ..schemas import GradeIn, TerminateIn, WarnIn
from ..services import exams as svc
from ..services.storage import signed_urls
from .deps import own_attempt

router = APIRouter(prefix="/api/attempts", tags=["monitor"])


@router.get("/{attempt_id}/review")
async def review_attempt(
    attempt_id: str, request: Request, user: CurrentUser = Depends(require_proctor), db: AsyncSession = Depends(get_session)
):
    attempt = await own_attempt(db, attempt_id, user)
    exam = attempt.exam
    svc.finalize_if_expired(attempt, exam)
    await db.commit()
    violations = (
        await db.scalars(select(Violation).where(Violation.attempt_id == attempt.id).order_by(Violation.created_at.asc()))
    ).all()
    candidate = attempt.candidate
    urls = await signed_urls(
        [v.snapshot_path for v in violations if v.snapshot_path]
        + ([candidate.photo_path] if candidate and candidate.photo_path else []),
        str(request.base_url),
    )
    live = runtime.live.get(attempt.id) if attempt.status == "in_progress" else None
    return {
        "attempt": {
            **svc.attempt_summary(attempt, live),
            "answers": attempt.answers,
            "manual_scores": attempt.manual_scores,
            "reference_photo_url": urls.get(candidate.photo_path) if candidate and candidate.photo_path else None,
        },
        "exam": svc.exam_summary(exam),
        "questions": [svc.question_full(q) for q in exam.questions],
        "violations": [svc.violation_out(v, urls.get(v.snapshot_path)) for v in violations],
    }


@router.post("/{attempt_id}/warn")
async def warn(
    attempt_id: str, payload: WarnIn, user: CurrentUser = Depends(require_proctor), db: AsyncSession = Depends(get_session)
):
    attempt = await own_attempt(db, attempt_id, user)
    if attempt.status != "in_progress":
        raise HTTPException(400, "Attempt is not in progress")
    db.add(ProctorMessage(attempt_id=attempt.id, body=payload.message))
    await db.commit()
    return {"ok": True}


@router.post("/{attempt_id}/terminate")
async def terminate(
    attempt_id: str, payload: TerminateIn, user: CurrentUser = Depends(require_proctor), db: AsyncSession = Depends(get_session)
):
    attempt = await own_attempt(db, attempt_id, user)
    if attempt.status != "in_progress":
        raise HTTPException(400, "Attempt is not in progress")
    svc.finalize(attempt, attempt.exam, "terminated", payload.reason)
    await db.commit()
    runtime.forget(attempt.id)
    return svc.attempt_summary(attempt)


@router.post("/{attempt_id}/approve-identity")
async def approve_identity(
    attempt_id: str, user: CurrentUser = Depends(require_proctor), db: AsyncSession = Depends(get_session)
):
    """Manual override after the proctor has checked the candidate on camera."""
    attempt = await own_attempt(db, attempt_id, user)
    if not svc.identity_ok(attempt):
        svc.start_clock(attempt, attempt.exam)
    attempt.identity = {**(attempt.identity or {}), "status": "approved", "approved_at": svc.iso(utcnow())}
    await db.commit()
    return svc.attempt_summary(attempt)


@router.post("/{attempt_id}/grade")
async def grade_attempt(
    attempt_id: str, payload: GradeIn, user: CurrentUser = Depends(require_proctor), db: AsyncSession = Depends(get_session)
):
    attempt = await own_attempt(db, attempt_id, user)
    text_qs = {q.id: q for q in attempt.exam.questions if q.type == "text"}
    manual = dict(attempt.manual_scores or {})
    for qid, pts in payload.scores.items():
        if qid not in text_qs:
            raise HTTPException(400, "Only written-answer questions can be graded manually")
        manual[qid] = max(0.0, min(float(pts), text_qs[qid].points))
    attempt.manual_scores = manual
    if attempt.status != "in_progress":
        attempt.score, attempt.max_score = svc.grade(attempt.exam.questions, attempt.answers or {}, manual)
    await db.commit()
    return svc.attempt_summary(attempt)
