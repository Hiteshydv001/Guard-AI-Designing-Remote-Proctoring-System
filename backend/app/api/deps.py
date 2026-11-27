from __future__ import annotations

from fastapi import HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from ..core.security import CurrentUser
from ..models import Attempt, Batch, Exam


async def own_exam(db: AsyncSession, exam_id: str, user: CurrentUser) -> Exam:
    exam = await db.get(Exam, exam_id)
    if not exam or exam.proctor_id != user.id:
        raise HTTPException(404, "Exam not found")
    return exam


async def own_attempt(db: AsyncSession, attempt_id: str, user: CurrentUser) -> Attempt:
    attempt = await db.get(Attempt, attempt_id)
    if not attempt or attempt.exam.proctor_id != user.id:
        raise HTTPException(404, "Attempt not found")
    return attempt


async def own_batches(db: AsyncSession, batch_ids: list[str], user: CurrentUser) -> list[Batch]:
    if not batch_ids:
        return []
    batches = (await db.scalars(select(Batch).where(Batch.id.in_(set(batch_ids)), Batch.proctor_id == user.id))).all()
    if len(batches) != len(set(batch_ids)):
        raise HTTPException(400, "Unknown batch")
    return list(batches)


async def candidate_attempt(db: AsyncSession, attempt_id: str, user: CurrentUser) -> Attempt:
    attempt = await db.get(Attempt, attempt_id)
    if not attempt or attempt.candidate_id != user.id:
        raise HTTPException(404, "Attempt not found")
    return attempt
