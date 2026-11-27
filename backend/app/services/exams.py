"""Domain logic: timing, grading, risk scoring, access rules and serializers."""

from __future__ import annotations

import random
from datetime import UTC, datetime, timedelta

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from ..models import DEFAULT_EXAM_SETTINGS, Attempt, BatchMember, Exam, ExamBatch, Question, Violation, utcnow

SEVERITY_WEIGHT = {"low": 1, "medium": 3, "high": 6}
ONLINE_WINDOW = timedelta(seconds=20)


def aware(dt: datetime | None) -> datetime | None:
    """SQLite returns naive datetimes; treat them as UTC."""
    if dt is None:
        return None
    return dt if dt.tzinfo else dt.replace(tzinfo=UTC)


def iso(dt: datetime | None) -> str | None:
    dt = aware(dt)
    return dt.isoformat() if dt else None


def exam_settings(exam: Exam) -> dict:
    return {**DEFAULT_EXAM_SETTINGS, **(exam.settings or {})}


# ------------------------------------------------------------------------------------- timing
def compute_deadline(exam: Exam, started: datetime) -> datetime:
    deadline = started + timedelta(minutes=exam.duration_minutes)
    ends = aware(exam.ends_at)
    return min(deadline, ends) if ends else deadline


IDENTITY_PASSED = ("verified", "approved")


def identity_required(attempt: Attempt) -> bool:
    return bool(exam_settings(attempt.exam).get("verify_identity"))


def identity_ok(attempt: Attempt) -> bool:
    """Questions, answers and submission stay locked until the face matched (or the proctor approved)."""
    return not identity_required(attempt) or (attempt.identity or {}).get("status") in IDENTITY_PASSED


def start_clock(attempt: Attempt, exam: Exam) -> None:
    """The exam timer starts when the questions unlock, not when the student opened the join link."""
    if attempt.status == "in_progress" and not attempt.answers:
        now = utcnow()
        attempt.started_at = now
        attempt.deadline_at = compute_deadline(exam, now)


def exam_window_error(exam: Exam, now: datetime | None = None) -> str | None:
    now = now or utcnow()
    if exam.status != "published":
        return "This exam is not open for attempts"
    starts, ends = aware(exam.starts_at), aware(exam.ends_at)
    if starts and now < starts:
        return f"This exam opens at {starts.isoformat()}"
    if ends and now >= ends:
        return "This exam has already ended"
    return None


def remaining_seconds(attempt: Attempt, now: datetime | None = None) -> int:
    now = now or utcnow()
    return max(0, int((aware(attempt.deadline_at) - now).total_seconds()))


# ------------------------------------------------------------------------------------- grading
def is_correct(q: Question, given) -> bool:
    if q.type == "text" or not isinstance(given, list):
        return False
    picked = sorted({int(i) for i in given if isinstance(i, int) and not isinstance(i, bool)})
    return picked == sorted(q.correct)


def grade(questions: list[Question], answers: dict, manual: dict) -> tuple[float, float]:
    score = total = 0.0
    for q in questions:
        total += q.points
        if q.type == "text":
            if q.id in manual:
                score += max(0.0, min(float(manual[q.id]), q.points))
        elif is_correct(q, answers.get(q.id)):
            score += q.points
    return round(score, 2), round(total, 2)


def percentage(attempt: Attempt) -> float | None:
    if attempt.score is None or not attempt.max_score:
        return None
    return round(100 * attempt.score / attempt.max_score, 1)


def passed(attempt: Attempt) -> bool | None:
    pct = percentage(attempt)
    if pct is None:
        return None
    return pct >= float(exam_settings(attempt.exam).get("pass_percentage", 40))


def finalize(attempt: Attempt, exam: Exam, status: str = "submitted", reason: str | None = None) -> None:
    if attempt.status != "in_progress":
        return
    attempt.status = status
    attempt.submitted_at = utcnow()
    attempt.termination_reason = reason
    attempt.score, attempt.max_score = grade(exam.questions, attempt.answers or {}, attempt.manual_scores or {})


def finalize_if_expired(attempt: Attempt, exam: Exam) -> bool:
    if attempt.status == "in_progress" and remaining_seconds(attempt) <= 0:
        finalize(attempt, exam, "submitted", "Time expired")
        return True
    return False


def add_risk(attempt: Attempt, severity: str) -> None:
    attempt.violation_count = (attempt.violation_count or 0) + 1
    attempt.risk_score = min(100.0, (attempt.risk_score or 0) + SEVERITY_WEIGHT.get(severity, 3))


# ------------------------------------------------------------------------------------- access
async def exam_batch_ids(db: AsyncSession, exam_id: str) -> list[str]:
    return list((await db.scalars(select(ExamBatch.batch_id).where(ExamBatch.exam_id == exam_id))).all())


async def is_assigned(db: AsyncSession, exam_id: str, candidate_id: str) -> bool:
    row = await db.scalar(
        select(ExamBatch.batch_id)
        .join(BatchMember, BatchMember.batch_id == ExamBatch.batch_id)
        .where(ExamBatch.exam_id == exam_id, BatchMember.candidate_id == candidate_id)
        .limit(1)
    )
    return row is not None


# ------------------------------------------------------------------------------------- serializers
def question_order(attempt: Attempt, exam: Exam) -> list[Question]:
    qs = list(exam.questions)
    if exam_settings(exam).get("shuffle_questions"):
        random.Random(attempt.id).shuffle(qs)  # stable per attempt
    return qs


def question_for_candidate(q: Question, attempt: Attempt, shuffle_options: bool) -> dict:
    options = [{"id": i, "text": t} for i, t in enumerate(q.options)]
    if shuffle_options and q.type != "text":
        random.Random(f"{attempt.id}:{q.id}").shuffle(options)
    return {"id": q.id, "type": q.type, "prompt": q.prompt, "options": options, "points": q.points}


def question_full(q: Question) -> dict:
    return {
        "id": q.id,
        "type": q.type,
        "prompt": q.prompt,
        "options": q.options,
        "correct": q.correct,
        "points": q.points,
        "explanation": q.explanation or "",
        "position": q.position,
    }


def exam_summary(exam: Exam, batch_ids: list[str] | None = None) -> dict:
    return {
        "id": exam.id,
        "title": exam.title,
        "description": exam.description,
        "duration_minutes": exam.duration_minutes,
        "starts_at": iso(exam.starts_at),
        "ends_at": iso(exam.ends_at),
        "status": exam.status,
        "access_code": exam.access_code,
        "settings": exam_settings(exam),
        "question_count": len(exam.questions),
        "total_points": round(sum(q.points for q in exam.questions), 2),
        "created_at": iso(exam.created_at),
        "batch_ids": batch_ids or [],
    }


def is_online(attempt: Attempt, live_at: float | None = None) -> bool:
    if attempt.status != "in_progress":
        return False
    if live_at:
        return datetime.now(UTC).timestamp() - live_at < ONLINE_WINDOW.total_seconds()
    hb = aware(attempt.last_heartbeat)
    return hb is not None and utcnow() - hb < ONLINE_WINDOW


def attempt_summary(attempt: Attempt, live=None) -> dict:
    data = {
        "id": attempt.id,
        "exam_id": attempt.exam_id,
        "exam_title": attempt.exam.title if attempt.exam else None,
        "candidate_id": attempt.candidate_id,
        "candidate_name": attempt.candidate.name if attempt.candidate else None,
        "candidate_email": attempt.candidate.email if attempt.candidate else None,
        "status": attempt.status,
        "started_at": iso(attempt.started_at),
        "deadline_at": iso(attempt.deadline_at),
        "submitted_at": iso(attempt.submitted_at),
        "score": attempt.score,
        "max_score": attempt.max_score,
        "percentage": percentage(attempt),
        "passed": passed(attempt),
        "risk_score": attempt.risk_score,
        "violation_count": attempt.violation_count,
        "termination_reason": attempt.termination_reason,
        "online": is_online(attempt, live.at if live else None),
        "remaining_seconds": remaining_seconds(attempt) if attempt.status == "in_progress" else 0,
        "answered": len([v for v in (attempt.answers or {}).values() if v not in (None, "", [])]),
        "calibrated": bool(attempt.calibration),
        "identity": attempt.identity or {},
    }
    if live is not None:
        data["last_frame"] = live.thumb
        data["live"] = live.analysis
    return data


def violation_out(v: Violation, snapshot_url: str | None = None) -> dict:
    return {
        "id": v.id,
        "attempt_id": v.attempt_id,
        "type": v.type,
        "severity": v.severity,
        "source": v.source,
        "message": v.message,
        "meta": v.meta or {},
        "snapshot_url": snapshot_url,
        "created_at": iso(v.created_at),
    }
