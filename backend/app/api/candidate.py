"""Candidate endpoints: finding and starting exams, the proctored exam loop and results."""

from __future__ import annotations

import time
from dataclasses import dataclass
from datetime import datetime, timedelta

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from ..core.db import get_session
from ..core.security import CurrentUser, require_candidate
from ..ml.detector import MATCH_THRESHOLD, encode_jpeg, match_score
from ..ml.runtime import MLUnavailable, runtime
from ..models import Attempt, BatchMember, Exam, ExamBatch, ProctorMessage, Violation, utcnow
from ..schemas import AnswersIn, CalibrateIn, FrameIn, HeartbeatIn, JoinIn, SubmitIn, VerifyIn, ViolationIn
from ..services import exams as svc
from ..services import live as live_video
from ..services.storage import decode_data_url, save_snapshot
from .deps import candidate_attempt

router = APIRouter(prefix="/api", tags=["candidate"])

MAX_VIOLATIONS_STORED = 500
MAX_SNAPSHOTS_STORED = 80
IDENTITY_ALERT_EVERY = 3  # notify the proctor after every 3rd consecutive failed face check
VERIFY_MIN_GAP_S = 2.0
HEARTBEAT_WRITE_EVERY = timedelta(seconds=10)
CONTEXT_TTL_S = 15.0


# ------------------------------------------------------------------------------------- helpers
@dataclass
class FrameContext:
    candidate_id: str
    exam_id: str
    settings: dict
    reference: list[float] | None
    calibration: dict
    expires: float


_contexts: dict[str, FrameContext] = {}


def _forget_context(attempt_id: str) -> None:
    _contexts.pop(attempt_id, None)


async def _context(db: AsyncSession, attempt_id: str, user: CurrentUser) -> FrameContext:
    ctx = _contexts.get(attempt_id)
    if ctx and ctx.expires > time.monotonic():
        if ctx.candidate_id != user.id:
            raise HTTPException(404, "Attempt not found")
        return ctx
    attempt = await candidate_attempt(db, attempt_id, user)
    settings = svc.exam_settings(attempt.exam)
    ctx = FrameContext(
        candidate_id=attempt.candidate_id,
        exam_id=attempt.exam_id,
        settings=settings,
        reference=attempt.candidate.face_embedding if settings.get("verify_identity") and attempt.candidate else None,
        calibration=attempt.calibration or {},
        expires=time.monotonic() + CONTEXT_TTL_S,
    )
    _contexts[attempt_id] = ctx
    return ctx


async def _start_attempt(db: AsyncSession, exam: Exam, user: CurrentUser) -> dict:
    existing = await db.scalar(select(Attempt).where(Attempt.exam_id == exam.id, Attempt.candidate_id == user.id))
    if existing:
        svc.finalize_if_expired(existing, exam)
        await db.commit()
        if existing.status != "in_progress":
            raise HTTPException(409, "You have already completed this exam")
        return {"attempt_id": existing.id, "resumed": True}

    if svc.exam_settings(exam).get("require_assignment") and not await svc.is_assigned(db, exam.id, user.id):
        raise HTTPException(403, "This exam is only open to students assigned by the proctor")
    err = svc.exam_window_error(exam)
    if err:
        raise HTTPException(400, err)
    now = utcnow()
    attempt = Attempt(
        exam_id=exam.id,
        candidate_id=user.id,
        started_at=now,
        deadline_at=svc.compute_deadline(exam, now),
        answers={},
        manual_scores={},
        calibration={},
        identity={},
    )
    db.add(attempt)
    await db.commit()
    return {"attempt_id": attempt.id, "resumed": False}


async def record_violation(
    db: AsyncSession,
    attempt: Attempt,
    *,
    type: str,
    severity: str,
    message: str,
    meta: dict | None = None,
    source: str = "ai",
    frame: bytes | None = None,
) -> None:
    if attempt.status != "in_progress" or (attempt.violation_count or 0) >= MAX_VIOLATIONS_STORED:
        return
    snapshot = None
    if frame and (attempt.violation_count or 0) < MAX_SNAPSHOTS_STORED:
        stamp = utcnow().strftime("%Y%m%dT%H%M%S%f")
        snapshot = await save_snapshot(f"{attempt.exam_id}/{attempt.id}/{stamp}-{type}.jpg", frame)
    db.add(
        Violation(
            attempt_id=attempt.id,
            type=type,
            severity=severity,
            source=source,
            message=message,
            snapshot_path=snapshot,
            meta=dict(list((meta or {}).items())[:20]),
        )
    )
    svc.add_risk(attempt, severity)
    limit = int(svc.exam_settings(attempt.exam).get("max_violations") or 0)
    if limit and attempt.violation_count >= limit:
        svc.finalize(attempt, attempt.exam, "terminated", f"Automatically terminated after {limit} violations")
        runtime.forget(attempt.id)
        _forget_context(attempt.id)


async def _deliver_messages(db: AsyncSession, attempt_id: str) -> list[dict]:
    pending = (
        await db.scalars(
            select(ProctorMessage).where(ProctorMessage.attempt_id == attempt_id, ProctorMessage.delivered_at.is_(None))
        )
    ).all()
    for m in pending:
        m.delivered_at = utcnow()
    return [{"id": m.id, "body": m.body, "created_at": svc.iso(m.created_at)} for m in pending]


async def _pulse(db: AsyncSession, attempt_id: str) -> dict:
    """Status, deadline handling, heartbeat timestamp and proctor messages — shared by frames and heartbeats."""
    row = (
        await db.execute(
            select(Attempt.status, Attempt.deadline_at, Attempt.last_heartbeat, Attempt.termination_reason).where(
                Attempt.id == attempt_id
            )
        )
    ).one()
    status, deadline, last_hb, reason = row
    now = utcnow()
    if status == "in_progress" and svc.aware(deadline) <= now:
        attempt = await db.get(Attempt, attempt_id)
        svc.finalize(attempt, attempt.exam, "submitted", "Time expired")
        status, reason = attempt.status, attempt.termination_reason
    messages: list[dict] = []
    if status == "in_progress":
        if last_hb is None or now - svc.aware(last_hb) > HEARTBEAT_WRITE_EVERY:
            await db.execute(update(Attempt).where(Attempt.id == attempt_id).values(last_heartbeat=now))
        messages = await _deliver_messages(db, attempt_id)
    else:
        runtime.forget(attempt_id)
        _forget_context(attempt_id)
    await db.commit()
    return {
        "status": status,
        "remaining_seconds": max(0, int((svc.aware(deadline) - now).total_seconds())) if status == "in_progress" else 0,
        "termination_reason": reason,
        "messages": messages,
        # An active "watch live" request from the proctor, or None (stop streaming).
        "live": live_video.request_for(attempt_id) if status == "in_progress" else None,
    }


def _result(attempt: Attempt) -> dict:
    show = svc.exam_settings(attempt.exam).get("show_results", True)
    data = svc.attempt_summary(attempt)
    if not show:
        data.update(score=None, max_score=None, percentage=None, passed=None)
    return data


# ------------------------------------------------------------------------------------- discovery
@router.get("/my/exams")
async def my_exams(user: CurrentUser = Depends(require_candidate), db: AsyncSession = Depends(get_session)):
    """Exams assigned to the candidate through batch membership."""
    exams = (
        await db.scalars(
            select(Exam)
            .join(ExamBatch, ExamBatch.exam_id == Exam.id)
            .join(BatchMember, BatchMember.batch_id == ExamBatch.batch_id)
            .where(BatchMember.candidate_id == user.id, Exam.status.in_(["published", "closed"]))
            .distinct()
        )
    ).all()
    attempts = {a.exam_id: a for a in (await db.scalars(select(Attempt).where(Attempt.candidate_id == user.id))).all()}
    out = []
    for e in exams:
        a = attempts.get(e.id)
        if a:
            svc.finalize_if_expired(a, e)
        s = svc.exam_summary(e)
        s.pop("access_code")
        out.append({**s, "open_error": svc.exam_window_error(e), "attempt": _result(a) if a else None})
    await db.commit()
    out.sort(key=lambda x: (x["attempt"] is not None, x["starts_at"] or "", x["title"]))
    return out


@router.get("/exams/lookup/{code}")
async def lookup(code: str, user: CurrentUser = Depends(require_candidate), db: AsyncSession = Depends(get_session)):
    exam = await db.scalar(select(Exam).where(Exam.access_code == code.strip().upper()))
    if not exam or exam.status == "draft":
        raise HTTPException(404, "No exam found with that code")
    existing = await db.scalar(select(Attempt).where(Attempt.exam_id == exam.id, Attempt.candidate_id == user.id))
    s = svc.exam_summary(exam)
    s.pop("access_code")
    return {**s, "open_error": svc.exam_window_error(exam), "existing_attempt": _result(existing) if existing else None}


@router.post("/exams/join")
async def join(payload: JoinIn, user: CurrentUser = Depends(require_candidate), db: AsyncSession = Depends(get_session)):
    exam = await db.scalar(select(Exam).where(Exam.access_code == payload.access_code))
    if not exam:
        raise HTTPException(404, "No exam found with that code")
    return await _start_attempt(db, exam, user)


@router.post("/exams/{exam_id}/start")
async def start_assigned(exam_id: str, user: CurrentUser = Depends(require_candidate), db: AsyncSession = Depends(get_session)):
    exam = await db.get(Exam, exam_id)
    if not exam or not await svc.is_assigned(db, exam_id, user.id):
        raise HTTPException(404, "Exam not found")
    return await _start_attempt(db, exam, user)


@router.get("/my/attempts")
async def my_attempts(user: CurrentUser = Depends(require_candidate), db: AsyncSession = Depends(get_session)):
    attempts = (
        await db.scalars(select(Attempt).where(Attempt.candidate_id == user.id).order_by(Attempt.started_at.desc()))
    ).all()
    for a in attempts:
        svc.finalize_if_expired(a, a.exam)
    await db.commit()
    return [_result(a) for a in attempts]


# ------------------------------------------------------------------------------------- the exam
@router.get("/attempts/{attempt_id}")
async def get_attempt(attempt_id: str, user: CurrentUser = Depends(require_candidate), db: AsyncSession = Depends(get_session)):
    attempt = await candidate_attempt(db, attempt_id, user)
    exam = attempt.exam
    svc.finalize_if_expired(attempt, exam)
    await db.commit()
    settings = svc.exam_settings(exam)
    candidate = attempt.candidate
    return {
        "attempt": _result(attempt),
        "answers": attempt.answers or {},
        "exam": {
            "id": exam.id,
            "title": exam.title,
            "description": exam.description,
            "duration_minutes": exam.duration_minutes,
            "settings": settings,
        },
        "identity_required": svc.identity_required(attempt),
        "identity_ok": svc.identity_ok(attempt),
        "has_reference_photo": bool(candidate and candidate.face_embedding),
        "questions": (
            [
                svc.question_for_candidate(q, attempt, bool(settings.get("shuffle_options")))
                for q in svc.question_order(attempt, exam)
            ]
            if attempt.status == "in_progress" and svc.identity_ok(attempt)
            else []
        ),
        "ml": {"ready": runtime.ready, "frame_interval_ms": runtime.next_frame_ms()},
    }


@router.get("/attempts/{attempt_id}/result")
async def attempt_result(
    attempt_id: str, user: CurrentUser = Depends(require_candidate), db: AsyncSession = Depends(get_session)
):
    attempt = await candidate_attempt(db, attempt_id, user)
    if attempt.status == "in_progress":
        raise HTTPException(409, "This attempt is still in progress")
    settings = svc.exam_settings(attempt.exam)
    out = _result(attempt)
    if settings.get("show_results"):
        reveal = bool(settings.get("reveal_answers"))
        out["breakdown"] = [
            {
                "id": q.id,
                "prompt": q.prompt,
                "type": q.type,
                "points": q.points,
                "options": q.options,
                "your_answer": (attempt.answers or {}).get(q.id),
                "correct": q.correct if reveal else None,
                "earned": (
                    (attempt.manual_scores or {}).get(q.id)
                    if q.type == "text"
                    else (q.points if svc.is_correct(q, (attempt.answers or {}).get(q.id)) else 0)
                ),
                "explanation": q.explanation if reveal else None,
            }
            for q in attempt.exam.questions
        ]
    return out


@router.put("/attempts/{attempt_id}/answers")
async def save_answers(
    attempt_id: str, payload: AnswersIn, user: CurrentUser = Depends(require_candidate), db: AsyncSession = Depends(get_session)
):
    attempt = await candidate_attempt(db, attempt_id, user)
    if svc.finalize_if_expired(attempt, attempt.exam) or attempt.status != "in_progress":
        await db.commit()
        raise HTTPException(409, "This attempt is no longer in progress")
    if not svc.identity_ok(attempt):
        raise HTTPException(403, "Verify your identity before answering")
    valid = {q.id for q in attempt.exam.questions}
    merged = dict(attempt.answers or {})
    for qid, value in payload.answers.items():
        if qid in valid:
            merged[qid] = value[:20000] if isinstance(value, str) else value
    attempt.answers = merged
    await db.commit()
    return {"ok": True, "answered": len(merged)}


async def _analyze_images(images: list[str], want_embedding: bool):
    results = []
    for data_url in images:
        data = decode_data_url(data_url)
        if not data:
            raise HTTPException(400, "Invalid image")
        try:
            results.append(await runtime.analyze(data, detect_objects=False, want_embedding=want_embedding))
        except MLUnavailable as exc:
            raise HTTPException(503, f"AI proctoring is unavailable: {exc}") from exc
        except ValueError as exc:
            raise HTTPException(400, str(exc)) from exc
    return results


@router.post("/attempts/{attempt_id}/check")
async def system_check(
    attempt_id: str, payload: FrameIn, user: CurrentUser = Depends(require_candidate), db: AsyncSession = Depends(get_session)
):
    """Pre-exam camera check: how many faces, is the image bright enough."""
    await _context(db, attempt_id, user)
    await db.commit()
    [(_, a)] = await _analyze_images([payload.image], want_embedding=False)
    return {
        "faces": a.faces,
        "brightness": round(a.brightness),
        "too_dark": a.brightness < 40,
        "face_box": a.face_box,
        "width": a.width,
        "height": a.height,
        "ok": a.faces == 1 and a.brightness >= 40,
    }


@router.post("/attempts/{attempt_id}/verify")
async def verify_identity(
    attempt_id: str, payload: VerifyIn, user: CurrentUser = Depends(require_candidate), db: AsyncSession = Depends(get_session)
):
    """Gate: the exam only opens once the live face matches the photo the proctor registered.

    No match means no questions. Retries are unlimited (a bad angle or light shouldn't lock a student out),
    the proctor is alerted after every third consecutive failure, and can approve manually from the live view.
    """
    attempt = await candidate_attempt(db, attempt_id, user)
    if attempt.status != "in_progress":
        raise HTTPException(409, "This attempt is no longer in progress")
    current = attempt.identity or {}
    if not svc.identity_required(attempt):
        attempt.identity = {"status": "skipped", "checked_at": svc.iso(utcnow())}
        await db.commit()
        return {**attempt.identity, "can_continue": True, "message": "No identity check needed for this exam"}
    if current.get("status") in svc.IDENTITY_PASSED:
        return {**current, "can_continue": True, "message": "Identity verified"}
    reference = attempt.candidate.face_embedding if attempt.candidate else None
    if not reference:
        attempt.identity = {**current, "status": "no_reference", "checked_at": svc.iso(utcnow())}
        await db.commit()
        return {
            **attempt.identity,
            "can_continue": False,
            "message": "Your teacher hasn't registered your photo yet, so this exam can't open. "
            "Ask them to add your photo, or to approve you from their live view.",
        }
    last = svc.aware(datetime.fromisoformat(current["checked_at"])) if current.get("checked_at") else None
    if last and (utcnow() - last).total_seconds() < VERIFY_MIN_GAP_S:
        raise HTTPException(429, "Hold on a second before trying again")

    await db.commit()  # release the connection while the models run
    analyses = await _analyze_images(payload.images, want_embedding=True)
    faces = [a.faces for _, a in analyses]
    scores = [match_score(reference, a.embedding) for _, a in analyses if a.faces == 1 and a.embedding]
    best = max((s for s in scores if s is not None), default=None)
    verified = best is not None and best >= MATCH_THRESHOLD
    fails = 0 if verified else int(current.get("fails", 0)) + 1
    attempt.identity = {
        "status": "verified" if verified else "retry",
        "score": best,
        "tries": int(current.get("tries", 0)) + 1,
        "fails": fails,
        "checked_at": svc.iso(utcnow()),
    }
    if verified:
        svc.start_clock(attempt, attempt.exam)
    elif fails % IDENTITY_ALERT_EVERY == 0:
        await record_violation(
            db,
            attempt,
            type="identity_unverified",
            severity="high",
            source="ai",
            message=f"Face did not match the registered photo ({fails} failed checks); the exam is still locked",
            meta={"match": best, "fails": fails},
            frame=encode_jpeg(analyses[-1][0], quality=80),
        )
    await db.commit()
    _forget_context(attempt.id)
    if verified:
        message = "Identity verified. Your exam timer starts now."
    elif not any(f == 1 for f in faces):
        message = "We need exactly one face in view. Sit alone, face the camera, and try again."
    else:
        message = "Your face doesn't match the registered photo. Remove glasses or caps, face the light, and try again."
    return {**attempt.identity, "faces": faces, "message": message, "can_continue": verified}


@router.post("/attempts/{attempt_id}/calibrate")
async def calibrate(
    attempt_id: str, payload: CalibrateIn, user: CurrentUser = Depends(require_candidate), db: AsyncSession = Depends(get_session)
):
    """Average the candidate's neutral head pose; deviations from it count as looking away."""
    attempt = await candidate_attempt(db, attempt_id, user)
    await db.commit()
    analyses = await _analyze_images(payload.images, want_embedding=False)
    poses = [(a.yaw, a.pitch) for _, a in analyses if a.faces == 1 and a.yaw is not None and a.pitch is not None]
    if len(poses) < max(2, len(payload.images) // 2):
        raise HTTPException(422, "We couldn't see your face clearly. Face the camera in good light and try again.")
    eyes = [(a.gaze, a.gaze_y) for _, a in analyses if a.faces == 1 and a.yaw is not None and a.blink <= 0.35]
    attempt.calibration = {
        "yaw": round(sum(p[0] for p in poses) / len(poses), 2),
        "pitch": round(sum(p[1] for p in poses) / len(poses), 2),
        "samples": len(poses),
    }
    if eyes:  # each student's own "looking at the screen" eye position
        attempt.calibration["gaze_x"] = round(sum(e[0] for e in eyes) / len(eyes), 3)
        attempt.calibration["gaze_y"] = round(sum(e[1] for e in eyes) / len(eyes), 3)
    await db.commit()
    runtime.forget(attempt.id)
    _forget_context(attempt.id)
    return {"ok": True, "calibration": attempt.calibration}


@router.post("/attempts/{attempt_id}/frames")
async def frame(
    attempt_id: str, payload: FrameIn, user: CurrentUser = Depends(require_candidate), db: AsyncSession = Depends(get_session)
):
    """Main proctoring loop: analyse a webcam frame, raise violations, deliver proctor messages."""
    ctx = await _context(db, attempt_id, user)
    pulse = await _pulse(db, attempt_id)
    base = {**pulse, "next_frame_ms": runtime.next_frame_ms()}
    if pulse["status"] != "in_progress":
        return base
    if not runtime.accept_frame(attempt_id):
        return {**base, "skipped": True}
    data = decode_data_url(payload.image)
    if not data:
        raise HTTPException(400, "Invalid image")

    detect_objects, want_identity = runtime.plan(attempt_id)
    detect_objects = detect_objects and bool(ctx.settings.get("detect_objects", True))
    want_identity = want_identity and ctx.reference is not None
    try:
        img, analysis = await runtime.analyze(data, detect_objects=detect_objects, want_embedding=want_identity)
    except MLUnavailable:
        return {**base, "analysis": None}
    except ValueError as exc:
        raise HTTPException(400, str(exc)) from exc

    hearing = bool(ctx.settings.get("detect_audio", True))
    events = runtime.process(
        attempt_id,
        ctx.calibration,
        img,
        analysis,
        payload.audio_level if hearing else 0.0,
        detect_objects,
        reference=ctx.reference if want_identity else None,
        voice=payload.voice if hearing else None,
    )
    if events:
        attempt = await db.get(Attempt, attempt_id)
        evidence = runtime.live[attempt_id].frame if attempt_id in runtime.live else None
        for ev in events:
            await record_violation(
                db, attempt, type=ev.type, severity=ev.severity, message=ev.message, meta=ev.meta, source="ai", frame=evidence
            )
        await db.commit()
        base["status"] = attempt.status
        if attempt.status != "in_progress":
            base["termination_reason"] = attempt.termination_reason
    live = runtime.live.get(attempt_id)
    return {
        **base,
        "analysis": live.analysis if live else None,
        "events": [{"type": e.type, "severity": e.severity, "message": e.message} for e in events],
    }


@router.post("/attempts/{attempt_id}/heartbeat")
async def heartbeat(
    attempt_id: str, payload: HeartbeatIn, user: CurrentUser = Depends(require_candidate), db: AsyncSession = Depends(get_session)
):
    """Keep-alive used while the camera loop is paused (e.g. during the system check)."""
    await _context(db, attempt_id, user)
    return {**await _pulse(db, attempt_id), "next_frame_ms": runtime.next_frame_ms()}


@router.post("/attempts/{attempt_id}/violations", status_code=201)
async def report_violation(
    attempt_id: str, payload: ViolationIn, user: CurrentUser = Depends(require_candidate), db: AsyncSession = Depends(get_session)
):
    """Browser-side events (tab switch, fullscreen exit, copy/paste...). Evidence is the last analysed frame."""
    attempt = await candidate_attempt(db, attempt_id, user)
    live = runtime.live.get(attempt_id)
    await record_violation(
        db,
        attempt,
        type=payload.type,
        severity=payload.severity,
        message=payload.message,
        meta=payload.meta,
        source="browser",
        frame=live.frame if live else None,
    )
    await db.commit()
    return {"status": attempt.status, "violation_count": attempt.violation_count}


async def _final_check(db: AsyncSession, attempt: Attempt, payload: SubmitIn) -> None:
    """Analyse the last frame before closing: catches a phone picked up seconds before submitting,
    and reports sightings that were seen once but not yet confirmed."""
    if not (payload.final_image and runtime.ready):
        return
    data = decode_data_url(payload.final_image)
    if not data:
        return
    settings = svc.exam_settings(attempt.exam)
    reference = attempt.candidate.face_embedding if settings.get("verify_identity") and attempt.candidate else None
    await db.commit()  # release the connection while the models run
    try:
        img, analysis = await runtime.analyze(
            data, detect_objects=bool(settings.get("detect_objects", True)), want_embedding=reference is not None
        )
    except (MLUnavailable, ValueError):
        return
    hearing = bool(settings.get("detect_audio", True))
    events = runtime.process(
        attempt.id,
        attempt.calibration,
        img,
        analysis,
        payload.audio_level if hearing else 0.0,
        bool(settings.get("detect_objects", True)),
        reference=reference,
        voice=payload.voice if hearing else None,
        final=True,
    )
    evidence = encode_jpeg(img, quality=80)
    for ev in events:
        await record_violation(
            db, attempt, type=ev.type, severity=ev.severity, message=ev.message, meta=ev.meta, source="ai", frame=evidence
        )


@router.post("/attempts/{attempt_id}/submit")
async def submit(
    attempt_id: str, payload: SubmitIn, user: CurrentUser = Depends(require_candidate), db: AsyncSession = Depends(get_session)
):
    attempt = await candidate_attempt(db, attempt_id, user)
    if attempt.status == "in_progress":
        if not svc.identity_ok(attempt):
            raise HTTPException(403, "Verify your identity before submitting")
        # Accept the final answers up to 30 s past the deadline (network latency on auto-submit).
        late = utcnow() > svc.aware(attempt.deadline_at) + timedelta(seconds=30)
        if payload.answers and not late:
            valid = {q.id for q in attempt.exam.questions}
            merged = dict(attempt.answers or {})
            merged.update({k: v for k, v in payload.answers.items() if k in valid})
            attempt.answers = merged
        await _final_check(db, attempt, payload)
        if attempt.status == "in_progress":  # the final check may have hit the violation limit
            svc.finalize(attempt, attempt.exam, "submitted")
        await db.commit()
        runtime.forget(attempt.id)
        _forget_context(attempt.id)
    return _result(attempt)
