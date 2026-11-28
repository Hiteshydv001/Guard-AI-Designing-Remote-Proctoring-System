"""Live video signaling endpoints (see services/live.py for the protocol)."""

from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession

from ..core.db import get_session
from ..core.security import CurrentUser, require_candidate, require_proctor
from ..services import live
from .deps import candidate_attempt, own_attempt

router = APIRouter(prefix="/api/attempts", tags=["live"])

SDP_MAX = 60_000


class OfferIn(BaseModel):
    session_id: str = Field(max_length=64)
    sdp: str = Field(min_length=20, max_length=SDP_MAX)


class AnswerIn(OfferIn):
    version: int = Field(ge=1)


GONE = "This live session has ended"


# ---------------------------------------------------------------------------------- proctor
@router.post("/{attempt_id}/live")
async def start_watching(attempt_id: str, user: CurrentUser = Depends(require_proctor), db: AsyncSession = Depends(get_session)):
    attempt = await own_attempt(db, attempt_id, user)
    if attempt.status != "in_progress":
        raise HTTPException(409, "This attempt is not in progress")
    session = await live.start(attempt_id, user.id)
    return {"session_id": session.id, "ice_servers": session.ice_servers}


@router.get("/{attempt_id}/live")
async def poll_offer(
    attempt_id: str, session_id: str, user: CurrentUser = Depends(require_proctor), db: AsyncSession = Depends(get_session)
):
    attempt = await own_attempt(db, attempt_id, user)
    session = live.proctor_poll(attempt_id, session_id)
    if not session or attempt.status != "in_progress":
        live.stop(attempt_id, session_id)
        return {"active": False, "reason": "ended" if attempt.status == "in_progress" else attempt.status}
    return {"active": True, "offer": session.offer, "version": session.version, "answered": session.answer is not None}


@router.post("/{attempt_id}/live/answer", status_code=204)
async def send_answer(
    attempt_id: str, payload: AnswerIn, user: CurrentUser = Depends(require_proctor), db: AsyncSession = Depends(get_session)
):
    await own_attempt(db, attempt_id, user)
    if not live.set_answer(attempt_id, payload.session_id, payload.version, payload.sdp):
        raise HTTPException(409, GONE)


@router.delete("/{attempt_id}/live", status_code=204)
async def stop_watching(
    attempt_id: str,
    session_id: str | None = None,
    user: CurrentUser = Depends(require_proctor),
    db: AsyncSession = Depends(get_session),
):
    await own_attempt(db, attempt_id, user)
    live.stop(attempt_id, session_id)


# ---------------------------------------------------------------------------------- candidate
@router.post("/{attempt_id}/live/offer", status_code=204)
async def send_offer(
    attempt_id: str, payload: OfferIn, user: CurrentUser = Depends(require_candidate), db: AsyncSession = Depends(get_session)
):
    attempt = await candidate_attempt(db, attempt_id, user)
    if attempt.status != "in_progress" or not live.set_offer(attempt_id, payload.session_id, payload.sdp):
        raise HTTPException(409, GONE)


@router.get("/{attempt_id}/live/answer")
async def poll_answer(
    attempt_id: str, session_id: str, user: CurrentUser = Depends(require_candidate), db: AsyncSession = Depends(get_session)
):
    await candidate_attempt(db, attempt_id, user)
    session = live.get(attempt_id, session_id)
    if not session:
        return {"active": False, "answer": None, "version": 0}
    return {"active": True, "answer": session.answer, "version": session.version}
