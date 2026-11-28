"""Proctor endpoints: exam CRUD, publishing, live monitoring, analytics and export."""

from __future__ import annotations

import csv
import io
from datetime import timedelta

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from sqlalchemy import delete, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from ..core.db import get_session
from ..core.security import CurrentUser, require_proctor
from ..ml.runtime import runtime
from ..models import Attempt, Exam, ExamBatch, ProctorMessage, Profile, Question, RosterEntry, Violation, utcnow
from ..schemas import ExamIn, StatusIn
from ..services import analytics
from ..services import exams as svc
from .deps import own_batches, own_exam

router = APIRouter(prefix="/api", tags=["exams"])


def _build_questions(payload: ExamIn) -> list[Question]:
    return [
        Question(
            position=i,
            type=q.type,
            prompt=q.prompt,
            options=q.options,
            correct=q.correct,
            points=q.points,
            explanation=q.explanation,
        )
        for i, q in enumerate(payload.questions)
    ]


async def _set_batches(db: AsyncSession, exam: Exam, batch_ids: list[str], user: CurrentUser) -> None:
    await own_batches(db, batch_ids, user)
    await db.execute(delete(ExamBatch).where(ExamBatch.exam_id == exam.id))
    for bid in set(batch_ids):
        db.add(ExamBatch(exam_id=exam.id, batch_id=bid))


async def _full(db: AsyncSession, exam: Exam) -> dict:
    return {
        **svc.exam_summary(exam, await svc.exam_batch_ids(db, exam.id)),
        "questions": [svc.question_full(q) for q in exam.questions],
    }


@router.get("/proctor/overview")
async def overview(user: CurrentUser = Depends(require_proctor), db: AsyncSession = Depends(get_session)):
    exams = (await db.scalars(select(Exam).where(Exam.proctor_id == user.id))).all()
    exam_ids = [e.id for e in exams]
    attempts = list((await db.scalars(select(Attempt).where(Attempt.exam_id.in_(exam_ids)))).all()) if exam_ids else []
    for a in attempts:
        svc.finalize_if_expired(a, a.exam)
    await db.commit()

    since = utcnow() - timedelta(days=14)
    violations = []
    recent = []
    if exam_ids:
        rows = (
            await db.execute(
                select(Violation, Attempt)
                .join(Attempt, Attempt.id == Violation.attempt_id)
                .where(Attempt.exam_id.in_(exam_ids), Violation.created_at >= since)
                .order_by(Violation.created_at.desc())
            )
        ).all()
        violations = [v for v, _ in rows]
        recent = [
            {
                **svc.violation_out(v),
                "candidate_name": a.candidate.name if a.candidate else None,
                "exam_title": a.exam.title,
                "exam_id": a.exam_id,
            }
            for v, a in rows[:12]
        ]

    students = await db.scalar(
        select(func.count(RosterEntry.candidate_id))
        .join(Profile, Profile.id == RosterEntry.candidate_id)
        .where(RosterEntry.proctor_id == user.id, Profile.active.is_(True))
    )
    finished = [a for a in attempts if a.status != "in_progress"]
    pcts = [p for p in (svc.percentage(a) for a in finished) if p is not None]
    live = [a for a in attempts if a.status == "in_progress"]
    upcoming = sorted(
        (e for e in exams if e.status == "published" and e.starts_at and svc.aware(e.starts_at) > utcnow()),
        key=lambda e: svc.aware(e.starts_at),
    )[:5]
    return {
        "exam_count": len(exams),
        "published_count": sum(1 for e in exams if e.status == "published"),
        "student_count": students or 0,
        "active_attempts": len(live),
        "online_now": sum(1 for a in live if svc.is_online(a, runtime.live.get(a.id).at if a.id in runtime.live else None)),
        "completed_attempts": len(finished),
        "average_score": round(sum(pcts) / len(pcts), 1) if pcts else None,
        "alerts_24h": sum(1 for v in violations if svc.aware(v.created_at) >= utcnow() - timedelta(hours=24)),
        "recent_violations": recent,
        "activity": analytics.activity_series(attempts, violations),
        "violations_by_type": analytics.exam_analytics(Exam(questions=[], settings={}), [], violations)["violations_by_type"],
        "live_exams": [
            {**svc.exam_summary(e), "live_count": sum(1 for a in live if a.exam_id == e.id)}
            for e in exams
            if any(a.exam_id == e.id for a in live)
        ],
        "upcoming": [svc.exam_summary(e) for e in upcoming],
        "ml": runtime.status(),
    }


@router.get("/exams")
async def list_exams(user: CurrentUser = Depends(require_proctor), db: AsyncSession = Depends(get_session)):
    exams = (await db.scalars(select(Exam).where(Exam.proctor_id == user.id).order_by(Exam.created_at.desc()))).all()
    ids = [e.id for e in exams]
    counts, live, batches = {}, {}, {}
    if ids:
        for exam_id, status, n in (
            await db.execute(
                select(Attempt.exam_id, Attempt.status, func.count(Attempt.id))
                .where(Attempt.exam_id.in_(ids))
                .group_by(Attempt.exam_id, Attempt.status)
            )
        ).all():
            counts[exam_id] = counts.get(exam_id, 0) + n
            if status == "in_progress":
                live[exam_id] = n
        for exam_id, batch_id in (
            await db.execute(select(ExamBatch.exam_id, ExamBatch.batch_id).where(ExamBatch.exam_id.in_(ids)))
        ).all():
            batches.setdefault(exam_id, []).append(batch_id)
    return [
        {**svc.exam_summary(e, batches.get(e.id)), "attempt_count": counts.get(e.id, 0), "live_count": live.get(e.id, 0)}
        for e in exams
    ]


@router.post("/exams", status_code=201)
async def create_exam(payload: ExamIn, user: CurrentUser = Depends(require_proctor), db: AsyncSession = Depends(get_session)):
    exam = Exam(
        proctor_id=user.id,
        title=payload.title,
        description=payload.description,
        duration_minutes=payload.duration_minutes,
        starts_at=payload.starts_at,
        ends_at=payload.ends_at,
        settings=payload.settings.model_dump(),
        questions=_build_questions(payload),
    )
    db.add(exam)
    await db.flush()
    await _set_batches(db, exam, payload.batch_ids, user)
    await db.commit()
    await db.refresh(exam)
    return await _full(db, exam)


@router.post("/exams/{exam_id}/duplicate", status_code=201)
async def duplicate_exam(exam_id: str, user: CurrentUser = Depends(require_proctor), db: AsyncSession = Depends(get_session)):
    src = await own_exam(db, exam_id, user)
    copy = Exam(
        proctor_id=user.id,
        title=f"{src.title} (copy)"[:200],
        description=src.description,
        duration_minutes=src.duration_minutes,
        settings=dict(src.settings or {}),
        questions=[
            Question(
                position=q.position,
                type=q.type,
                prompt=q.prompt,
                options=list(q.options),
                correct=list(q.correct),
                points=q.points,
                explanation=q.explanation,
            )
            for q in src.questions
        ],
    )
    db.add(copy)
    await db.flush()
    for bid in await svc.exam_batch_ids(db, src.id):
        db.add(ExamBatch(exam_id=copy.id, batch_id=bid))
    await db.commit()
    await db.refresh(copy)
    return await _full(db, copy)


@router.get("/exams/{exam_id}")
async def get_exam(exam_id: str, user: CurrentUser = Depends(require_proctor), db: AsyncSession = Depends(get_session)):
    return await _full(db, await own_exam(db, exam_id, user))


@router.put("/exams/{exam_id}")
async def update_exam(
    exam_id: str, payload: ExamIn, user: CurrentUser = Depends(require_proctor), db: AsyncSession = Depends(get_session)
):
    exam = await own_exam(db, exam_id, user)
    started = await db.scalar(select(func.count(Attempt.id)).where(Attempt.exam_id == exam.id))
    exam.title = payload.title
    exam.description = payload.description
    exam.duration_minutes = payload.duration_minutes
    exam.starts_at = payload.starts_at
    exam.ends_at = payload.ends_at
    exam.settings = payload.settings.model_dump()

    if started:
        # Candidates already hold question ids; only allow in-place edits of existing questions.
        by_id = {q.id: q for q in exam.questions}
        if len(payload.questions) != len(by_id) or any(q.id not in by_id for q in payload.questions):
            raise HTTPException(409, "Questions can't be added or removed after candidates have started")
        for i, q in enumerate(payload.questions):
            t = by_id[q.id]
            t.position, t.type, t.prompt, t.explanation = i, q.type, q.prompt, q.explanation
            t.options, t.correct, t.points = q.options, q.correct, q.points
    else:
        exam.questions = _build_questions(payload)

    await _set_batches(db, exam, payload.batch_ids, user)
    await db.commit()
    await db.refresh(exam)
    return await _full(db, exam)


@router.post("/exams/{exam_id}/status")
async def set_status(
    exam_id: str, payload: StatusIn, user: CurrentUser = Depends(require_proctor), db: AsyncSession = Depends(get_session)
):
    exam = await own_exam(db, exam_id, user)
    if payload.status == "published" and not exam.questions:
        raise HTTPException(400, "Add at least one question before publishing")
    exam.status = payload.status
    await db.commit()
    return svc.exam_summary(exam, await svc.exam_batch_ids(db, exam.id))


@router.delete("/exams/{exam_id}", status_code=204)
async def delete_exam(exam_id: str, user: CurrentUser = Depends(require_proctor), db: AsyncSession = Depends(get_session)):
    exam = await own_exam(db, exam_id, user)
    attempt_ids = (await db.scalars(select(Attempt.id).where(Attempt.exam_id == exam.id))).all()
    if attempt_ids:
        await db.execute(delete(Violation).where(Violation.attempt_id.in_(attempt_ids)))
        await db.execute(delete(ProctorMessage).where(ProctorMessage.attempt_id.in_(attempt_ids)))
        await db.execute(delete(Attempt).where(Attempt.id.in_(attempt_ids)))
        for aid in attempt_ids:
            runtime.forget(aid)
    await db.execute(delete(ExamBatch).where(ExamBatch.exam_id == exam.id))
    await db.delete(exam)
    await db.commit()


@router.get("/exams/{exam_id}/attempts")
async def exam_attempts(exam_id: str, user: CurrentUser = Depends(require_proctor), db: AsyncSession = Depends(get_session)):
    exam = await own_exam(db, exam_id, user)
    attempts = (await db.scalars(select(Attempt).where(Attempt.exam_id == exam.id).order_by(Attempt.started_at.desc()))).all()
    for a in attempts:
        svc.finalize_if_expired(a, exam)
    await db.commit()
    return {
        "exam": svc.exam_summary(exam, await svc.exam_batch_ids(db, exam.id)),
        "attempts": [svc.attempt_summary(a, runtime.live.get(a.id) if a.status == "in_progress" else None) for a in attempts],
    }


@router.get("/exams/{exam_id}/analytics")
async def exam_analytics(exam_id: str, user: CurrentUser = Depends(require_proctor), db: AsyncSession = Depends(get_session)):
    exam = await own_exam(db, exam_id, user)
    attempts = list((await db.scalars(select(Attempt).where(Attempt.exam_id == exam.id))).all())
    violations = list(
        (
            await db.scalars(
                select(Violation).join(Attempt, Attempt.id == Violation.attempt_id).where(Attempt.exam_id == exam.id)
            )
        ).all()
    )
    return analytics.exam_analytics(exam, attempts, violations)


@router.get("/exams/{exam_id}/results.csv")
async def export_results(exam_id: str, user: CurrentUser = Depends(require_proctor), db: AsyncSession = Depends(get_session)):
    exam = await own_exam(db, exam_id, user)
    attempts = (await db.scalars(select(Attempt).where(Attempt.exam_id == exam.id).order_by(Attempt.started_at))).all()
    buf = io.StringIO()
    writer = csv.writer(buf)
    writer.writerow(
        [
            "Name",
            "Email",
            "Status",
            "Score",
            "Max score",
            "Percentage",
            "Passed",
            "AI flags",
            "Risk score",
            "Started",
            "Submitted",
            "Ended reason",
        ]
    )
    for a in attempts:
        writer.writerow(
            [
                a.candidate.name if a.candidate else "",
                a.candidate.email if a.candidate else "",
                a.status,
                a.score if a.score is not None else "",
                a.max_score if a.max_score is not None else "",
                svc.percentage(a) if svc.percentage(a) is not None else "",
                {True: "yes", False: "no", None: ""}[svc.passed(a)],
                a.violation_count,
                round(a.risk_score or 0),
                svc.iso(a.started_at) or "",
                svc.iso(a.submitted_at) or "",
                a.termination_reason or "",
            ]
        )
    filename = "".join(c if c.isalnum() else "-" for c in exam.title.lower()).strip("-")[:60] or "exam"
    return StreamingResponse(
        iter([buf.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": f'attachment; filename="{filename}-results.csv"'},
    )
