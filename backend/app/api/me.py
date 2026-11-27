"""Profile bootstrap: role selection and automatic onboarding of invited / teacher-created students."""

from __future__ import annotations

import logging

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from ..core.clerk import ClerkClient, get_clerk
from ..core.db import get_session
from ..core.security import CurrentUser, current_user
from ..models import Batch, BatchMember, Invite, Profile, RosterEntry
from ..schemas import ProfileIn, ProfileOut

router = APIRouter(prefix="/api", tags=["me"])
log = logging.getLogger("guardai.me")


def _out(p: Profile | None, user_id: str) -> ProfileOut:
    if p is None:
        return ProfileOut(id=user_id)
    return ProfileOut(id=p.id, role=p.role, name=p.name, email=p.email)


async def _adopt_invite(db: AsyncSession, user_id: str, clerk: ClerkClient) -> Profile | None:
    """First sign-in of an invited student: create their candidate profile, roster and batch memberships.

    Only a *pending* invite in our own database links a student to a proctor. Clerk metadata is never
    trusted for this: an invitation revoked here may still be redeemable on Clerk's side.
    """
    if not clerk.configured:
        return None
    try:
        cu = await clerk.get_user(user_id)
    except HTTPException as exc:
        log.warning("Could not load Clerk user %s: %s", user_id, exc.detail)
        return None
    if not cu.email:
        return None
    invites = (await db.scalars(select(Invite).where(Invite.email == cu.email.lower(), Invite.status == "pending"))).all()
    if not invites:
        return None

    profile = Profile(
        id=user_id,
        role="candidate",
        name=cu.full_name or invites[0].name,
        email=cu.email.lower(),
        created_by=None,  # the student created and owns this account; proctors get roster access only
    )
    db.add(profile)
    await db.flush()
    for inv in invites:
        db.add(RosterEntry(proctor_id=inv.proctor_id, candidate_id=user_id))
        if inv.batch_ids:
            own = (
                await db.scalars(select(Batch.id).where(Batch.id.in_(inv.batch_ids), Batch.proctor_id == inv.proctor_id))
            ).all()
            for bid in own:
                if not await db.get(BatchMember, (bid, user_id)):
                    db.add(BatchMember(batch_id=bid, candidate_id=user_id))
        inv.status = "accepted"
    await db.commit()
    return profile


@router.get("/me", response_model=ProfileOut)
async def get_me(
    user: CurrentUser = Depends(current_user),
    db: AsyncSession = Depends(get_session),
    clerk: ClerkClient = Depends(get_clerk),
):
    profile = user.profile or await _adopt_invite(db, user.id, clerk)
    return _out(profile, user.id)


@router.put("/me", response_model=ProfileOut)
async def put_me(payload: ProfileIn, user: CurrentUser = Depends(current_user), db: AsyncSession = Depends(get_session)):
    profile = user.profile or Profile(id=user.id)
    if profile.created_by and payload.role != "candidate":
        raise HTTPException(403, "Accounts created by a proctor can only be candidates")
    profile.role = payload.role
    if payload.name is not None:
        profile.name = payload.name
    if payload.email is not None:
        profile.email = payload.email.lower()
    db.add(profile)
    await db.commit()
    return _out(profile, user.id)
