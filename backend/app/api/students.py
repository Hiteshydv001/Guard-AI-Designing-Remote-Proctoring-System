"""Proctor-managed students: accounts (via Clerk), invitations, reference photos and batches."""

from __future__ import annotations

import logging
import secrets
import string

from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy import delete, func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from ..core.clerk import ClerkClient, get_clerk
from ..core.config import settings
from ..core.db import get_session
from ..core.security import CurrentUser, read_invitation_ticket, require_proctor
from ..ml.runtime import MLUnavailable, runtime
from ..models import Attempt, Batch, BatchMember, Exam, ExamBatch, Invite, Profile, RosterEntry, utcnow
from ..schemas import (
    BatchIn,
    MembersIn,
    PhotoIn,
    StudentCreateIn,
    StudentImportIn,
    StudentUpdateIn,
)
from ..services import exams as svc
from ..services.email import EmailError, render_invitation, send_email
from ..services.storage import decode_data_url, save_snapshot, signed_urls
from .deps import own_batches

router = APIRouter(prefix="/api", tags=["students"])
log = logging.getLogger("guardai.students")


def generate_password(length: int = 12) -> str:
    alphabet = string.ascii_letters + string.digits
    while True:
        pw = (
            "".join(secrets.choice(alphabet) for _ in range(length - 2))
            + secrets.choice("!@#$%&*")
            + secrets.choice(string.digits)
        )
        if any(c.islower() for c in pw) and any(c.isupper() for c in pw):
            return pw


def roster_filter(proctor_id: str):
    """Candidates on the proctor's roster. `created_by` alone never grants access: it only marks accounts
    the proctor may manage (rename / reset password / deactivate)."""
    on_roster = select(RosterEntry.candidate_id).where(RosterEntry.proctor_id == proctor_id)
    return (Profile.role == "candidate") & Profile.id.in_(on_roster)


async def add_to_roster(db: AsyncSession, proctor_id: str, candidate_id: str) -> None:
    if not await db.get(RosterEntry, (proctor_id, candidate_id)):
        db.add(RosterEntry(proctor_id=proctor_id, candidate_id=candidate_id))


async def _roster_student(db: AsyncSession, student_id: str, user: CurrentUser) -> Profile:
    student = await db.scalar(select(Profile).where(Profile.id == student_id, roster_filter(user.id)))
    if not student:
        raise HTTPException(404, "Student not found")
    return student


async def _set_memberships(db: AsyncSession, student_id: str, batch_ids: list[str], user: CurrentUser) -> None:
    await own_batches(db, batch_ids, user)
    mine = select(Batch.id).where(Batch.proctor_id == user.id)
    await db.execute(delete(BatchMember).where(BatchMember.candidate_id == student_id, BatchMember.batch_id.in_(mine)))
    for bid in set(batch_ids):
        db.add(BatchMember(batch_id=bid, candidate_id=student_id))


async def _students_out(db: AsyncSession, students: list[Profile], user: CurrentUser, request: Request) -> list[dict]:
    ids = [s.id for s in students]
    if not ids:
        return []
    batches: dict[str, list[dict]] = {}
    for sid, bid, name in (
        await db.execute(
            select(BatchMember.candidate_id, Batch.id, Batch.name)
            .join(Batch, Batch.id == BatchMember.batch_id)
            .where(BatchMember.candidate_id.in_(ids), Batch.proctor_id == user.id)
        )
    ).all():
        batches.setdefault(sid, []).append({"id": bid, "name": name})

    stats: dict[str, dict] = {}
    attempts = (
        await db.scalars(
            select(Attempt)
            .join(Exam, Exam.id == Attempt.exam_id)
            .where(Attempt.candidate_id.in_(ids), Exam.proctor_id == user.id)
        )
    ).all()
    for a in attempts:
        st = stats.setdefault(a.candidate_id, {"attempts": 0, "pcts": [], "flags": 0, "last": None})
        st["attempts"] += 1
        st["flags"] += a.violation_count or 0
        if (p := svc.percentage(a)) is not None:
            st["pcts"].append(p)
        if st["last"] is None or svc.aware(a.started_at) > st["last"]:
            st["last"] = svc.aware(a.started_at)

    photos = await signed_urls([s.photo_path for s in students if s.photo_path], str(request.base_url))
    out = []
    for s in students:
        st = stats.get(s.id, {"attempts": 0, "pcts": [], "flags": 0, "last": None})
        out.append(
            {
                "id": s.id,
                "name": s.name,
                "email": s.email,
                "managed": s.created_by == user.id,
                "active": s.active,
                "batches": sorted(batches.get(s.id, []), key=lambda b: b["name"]),
                "photo_url": photos.get(s.photo_path) if s.photo_path else None,
                "has_reference": bool(s.face_embedding),
                "attempts": st["attempts"],
                "average": round(sum(st["pcts"]) / len(st["pcts"]), 1) if st["pcts"] else None,
                "flags": st["flags"],
                "last_active": svc.iso(st["last"]),
                "created_at": svc.iso(s.created_at),
            }
        )
    return out


# ------------------------------------------------------------------------------------- students
@router.get("/students")
async def list_students(
    request: Request,
    q: str | None = None,
    batch_id: str | None = None,
    user: CurrentUser = Depends(require_proctor),
    db: AsyncSession = Depends(get_session),
):
    stmt = select(Profile).where(roster_filter(user.id))
    if q:
        like = f"%{q.lower()}%"
        stmt = stmt.where(or_(func.lower(Profile.name).like(like), func.lower(Profile.email).like(like)))
    if batch_id:
        stmt = stmt.where(Profile.id.in_(select(BatchMember.candidate_id).where(BatchMember.batch_id == batch_id)))
    students = list((await db.scalars(stmt.order_by(Profile.name))).all())
    return await _students_out(db, students, user, request)


INVITE_DAYS = 30


async def _send_invitation(
    db: AsyncSession,
    clerk: ClerkClient,
    user: CurrentUser,
    *,
    name: str,
    email: str,
    metadata: dict,
    batch_ids: list[str],
) -> tuple[str, str]:
    """Create the Clerk invitation and email it. Returns (clerk_invitation_id, "guard-ai" | "clerk").

    With Resend configured, Clerk only mints the sign-up link and we send the branded email; if that send
    fails (or Clerk returns no link) the invitation is re-issued with Clerk's own email so nobody is left
    without one.
    """
    redirect = f"{settings.frontend_url}/sign-up"
    if settings.branded_invites:
        inv = await clerk.create_invitation(
            email=email, metadata=metadata, redirect_url=redirect, notify=False, expires_in_days=INVITE_DAYS
        )
        if inv.url:
            profile = user.profile
            batch_names = (
                list((await db.scalars(select(Batch.name).where(Batch.id.in_(batch_ids)).order_by(Batch.name))).all())
                if batch_ids
                else []
            )
            message = render_invitation(
                student_name=name,
                student_email=email,
                teacher_name=(profile.name if profile and profile.name else None) or "Your teacher",
                teacher_email=profile.email if profile else None,
                batch_names=batch_names,
                accept_url=inv.url,
                expires_in_days=INVITE_DAYS,
            )
            try:
                await send_email(email, message, reply_to=profile.email if profile else None)
                return inv.id, "guard-ai"
            except EmailError as exc:
                log.warning("Branded invite to %s failed (%s); falling back to Clerk's email", email, exc)
        try:
            await clerk.revoke_invitation(inv.id)
        except HTTPException:
            log.warning("Could not revoke unsent invitation %s", inv.id)
    inv = await clerk.create_invitation(
        email=email, metadata=metadata, redirect_url=redirect, notify=True, expires_in_days=INVITE_DAYS
    )
    return inv.id, "clerk"


async def _create_one(
    db: AsyncSession,
    clerk: ClerkClient,
    user: CurrentUser,
    *,
    name: str,
    email: str,
    mode: str,
    password: str | None,
    batch_ids: list[str],
) -> dict:
    email = email.lower()
    existing = await db.scalar(select(Profile).where(func.lower(Profile.email) == email))
    if existing:
        if existing.role != "candidate":
            raise HTTPException(409, f"{email} is registered as a proctor")
        await add_to_roster(db, user.id, existing.id)
        for bid in batch_ids:
            if not await db.get(BatchMember, (bid, existing.id)):
                db.add(BatchMember(batch_id=bid, candidate_id=existing.id))
        return {"status": "linked", "id": existing.id, "email": email, "name": existing.name}

    metadata = {"role": "candidate", "proctor_id": user.id, "batch_ids": batch_ids}
    if mode == "invite":
        invite = await db.scalar(select(Invite).where(Invite.proctor_id == user.id, Invite.email == email))
        clerk_id, delivery = await _send_invitation(
            db, clerk, user, name=name, email=email, metadata=metadata, batch_ids=batch_ids
        )
        if invite:
            invite.status, invite.name, invite.batch_ids, invite.clerk_invitation_id = "pending", name, batch_ids, clerk_id
            invite.created_at = utcnow()
        else:
            db.add(Invite(proctor_id=user.id, email=email, name=name, batch_ids=batch_ids, clerk_invitation_id=clerk_id))
        return {"status": "invited", "email": email, "name": name, "delivery": delivery}

    password = password or generate_password()
    cu = await clerk.create_user(email=email, name=name, password=password, metadata=metadata)
    db.add(Profile(id=cu.id, role="candidate", name=name, email=email, created_by=user.id))
    await db.flush()
    await add_to_roster(db, user.id, cu.id)
    for bid in batch_ids:
        db.add(BatchMember(batch_id=bid, candidate_id=cu.id))
    return {"status": "created", "id": cu.id, "email": email, "name": name, "password": password}


@router.post("/students", status_code=201)
async def create_student(
    payload: StudentCreateIn,
    user: CurrentUser = Depends(require_proctor),
    db: AsyncSession = Depends(get_session),
    clerk: ClerkClient = Depends(get_clerk),
):
    await own_batches(db, payload.batch_ids, user)
    result = await _create_one(
        db,
        clerk,
        user,
        name=payload.name,
        email=payload.email,
        mode=payload.mode,
        password=payload.password,
        batch_ids=payload.batch_ids,
    )
    await db.commit()
    return result


@router.post("/students/import")
async def import_students(
    payload: StudentImportIn,
    user: CurrentUser = Depends(require_proctor),
    db: AsyncSession = Depends(get_session),
    clerk: ClerkClient = Depends(get_clerk),
):
    await own_batches(db, payload.batch_ids, user)
    results = []
    seen: set[str] = set()
    for row in payload.rows:
        if row.email in seen:
            results.append({"email": row.email, "name": row.name, "status": "skipped", "error": "Duplicate row"})
            continue
        seen.add(row.email)
        try:
            results.append(
                await _create_one(
                    db, clerk, user, name=row.name, email=row.email, mode=payload.mode, password=None, batch_ids=payload.batch_ids
                )
            )
            await db.commit()
        except HTTPException as exc:
            await db.rollback()
            results.append({"email": row.email, "name": row.name, "status": "error", "error": exc.detail})
    return {
        "results": results,
        "created": sum(1 for r in results if r["status"] == "created"),
        "invited": sum(1 for r in results if r["status"] == "invited"),
        "linked": sum(1 for r in results if r["status"] == "linked"),
        "failed": sum(1 for r in results if r["status"] in ("error", "skipped")),
    }


@router.get("/students/{student_id}")
async def get_student(
    student_id: str, request: Request, user: CurrentUser = Depends(require_proctor), db: AsyncSession = Depends(get_session)
):
    student = await _roster_student(db, student_id, user)
    [out] = await _students_out(db, [student], user, request)
    attempts = (
        await db.scalars(
            select(Attempt)
            .join(Exam, Exam.id == Attempt.exam_id)
            .where(Attempt.candidate_id == student.id, Exam.proctor_id == user.id)
            .order_by(Attempt.started_at.desc())
        )
    ).all()
    out["history"] = [svc.attempt_summary(a) for a in attempts]
    return out


@router.patch("/students/{student_id}")
async def update_student(
    student_id: str,
    payload: StudentUpdateIn,
    request: Request,
    user: CurrentUser = Depends(require_proctor),
    db: AsyncSession = Depends(get_session),
):
    student = await _roster_student(db, student_id, user)
    if payload.name is not None:
        if student.created_by != user.id:
            raise HTTPException(403, "You can only rename students you created")
        student.name = payload.name
    if payload.batch_ids is not None:
        await _set_memberships(db, student.id, payload.batch_ids, user)
    await db.commit()
    [out] = await _students_out(db, [student], user, request)
    return out


@router.post("/students/{student_id}/reset-password")
async def reset_password(
    student_id: str,
    user: CurrentUser = Depends(require_proctor),
    db: AsyncSession = Depends(get_session),
    clerk: ClerkClient = Depends(get_clerk),
):
    student = await _roster_student(db, student_id, user)
    if student.created_by != user.id:
        raise HTTPException(403, "You can only reset passwords for accounts you created")
    password = generate_password()
    await clerk.set_password(student.id, password)
    return {"password": password}


@router.delete("/students/{student_id}", status_code=204)
async def remove_student(
    student_id: str,
    user: CurrentUser = Depends(require_proctor),
    db: AsyncSession = Depends(get_session),
    clerk: ClerkClient = Depends(get_clerk),
):
    """Remove from your roster. Accounts you created are also deactivated (results are kept)."""
    student = await _roster_student(db, student_id, user)
    await _set_memberships(db, student.id, [], user)
    await db.execute(delete(RosterEntry).where(RosterEntry.proctor_id == user.id, RosterEntry.candidate_id == student.id))
    if student.created_by == user.id:
        try:
            await clerk.delete_user(student.id)
        except HTTPException as exc:
            if exc.status_code != 404:
                raise
        student.active = False
        student.created_by = None
        student.face_embedding = None
    await db.commit()


@router.post("/students/{student_id}/photo")
async def upload_photo(
    student_id: str,
    payload: PhotoIn,
    request: Request,
    user: CurrentUser = Depends(require_proctor),
    db: AsyncSession = Depends(get_session),
):
    """Register a reference photo used to verify the student's identity during exams."""
    student = await _roster_student(db, student_id, user)
    data = decode_data_url(payload.image)
    if not data:
        raise HTTPException(400, "Upload a JPEG or PNG image under 600 KB")
    try:
        img, analysis = await runtime.analyze(data, detect_objects=False, want_embedding=True)
    except MLUnavailable as exc:
        raise HTTPException(503, f"Face recognition is unavailable: {exc}") from exc
    except ValueError as exc:
        raise HTTPException(400, str(exc)) from exc
    if analysis.faces == 0:
        raise HTTPException(422, "No face found in this photo. Use a clear, front-facing photo.")
    if analysis.faces > 1:
        raise HTTPException(422, "This photo contains more than one face. Use a photo of the student alone.")
    x1, y1, x2, y2 = analysis.face_box or (0, 0, 0, 0)
    if (x2 - x1) < 60:
        raise HTTPException(422, "The face is too small. Use a closer, higher-resolution photo.")

    from ..ml.detector import encode_jpeg

    path = await save_snapshot(f"reference/{student.id}.jpg", encode_jpeg(img, quality=90))
    student.photo_path = path
    student.face_embedding = analysis.embedding
    student.photo_updated_at = utcnow()
    await db.commit()
    [out] = await _students_out(db, [student], user, request)
    return out


@router.delete("/students/{student_id}/photo", status_code=204)
async def delete_photo(student_id: str, user: CurrentUser = Depends(require_proctor), db: AsyncSession = Depends(get_session)):
    student = await _roster_student(db, student_id, user)
    student.photo_path = None
    student.face_embedding = None
    student.photo_updated_at = None
    await db.commit()


# ------------------------------------------------------------------------------------- invites
@router.get("/invites")
async def list_invites(user: CurrentUser = Depends(require_proctor), db: AsyncSession = Depends(get_session)):
    invites = (
        await db.scalars(
            select(Invite).where(Invite.proctor_id == user.id, Invite.status == "pending").order_by(Invite.created_at.desc())
        )
    ).all()
    return [
        {"id": i.id, "email": i.email, "name": i.name, "batch_ids": i.batch_ids, "created_at": svc.iso(i.created_at)}
        for i in invites
    ]


@router.get("/invites/ticket")
async def invite_ticket_status(ticket: str, db: AsyncSession = Depends(get_session)):
    """Public: lets the sign-up page explain a revoked, used or expired invitation link before Clerk does.

    The ticket is verified against the Clerk instance key, so only a genuine invitation link can be looked up.
    """
    claims = read_invitation_ticket(ticket[:4096])
    if not claims:
        return {"status": "invalid"}
    invite = await db.scalar(select(Invite).where(Invite.clerk_invitation_id == claims["sid"]))
    if not invite:
        return {"status": "unknown"}  # e.g. created from the Clerk dashboard; let Clerk handle it
    proctor = await db.get(Profile, invite.proctor_id)
    status = invite.status
    if status == "pending" and claims.get("exp") and claims["exp"] < utcnow().timestamp():
        status = "expired"
    return {
        "status": status,
        "email": invite.email,
        "teacher": (proctor.name if proctor and proctor.name else None) or "your teacher",
    }


@router.delete("/invites/{invite_id}", status_code=204)
async def revoke_invite(
    invite_id: str,
    user: CurrentUser = Depends(require_proctor),
    db: AsyncSession = Depends(get_session),
    clerk: ClerkClient = Depends(get_clerk),
):
    invite = await db.get(Invite, invite_id)
    if not invite or invite.proctor_id != user.id:
        raise HTTPException(404, "Invite not found")
    if invite.clerk_invitation_id and invite.status == "pending":
        try:
            await clerk.revoke_invitation(invite.clerk_invitation_id)
        except HTTPException as exc:
            # Usually "already accepted/expired". Either way the link no longer grants class access:
            # /api/me only honours invites that are still pending here.
            log.warning("Clerk did not revoke invitation %s: %s", invite.clerk_invitation_id, exc.detail)
    invite.status = "revoked"
    await db.commit()


# ------------------------------------------------------------------------------------- batches
async def _own_batch(db: AsyncSession, batch_id: str, user: CurrentUser) -> Batch:
    batch = await db.get(Batch, batch_id)
    if not batch or batch.proctor_id != user.id:
        raise HTTPException(404, "Batch not found")
    return batch


@router.get("/batches")
async def list_batches(user: CurrentUser = Depends(require_proctor), db: AsyncSession = Depends(get_session)):
    batches = (await db.scalars(select(Batch).where(Batch.proctor_id == user.id).order_by(Batch.name))).all()
    ids = [b.id for b in batches]
    members = (
        dict(
            (
                await db.execute(
                    select(BatchMember.batch_id, func.count()).where(BatchMember.batch_id.in_(ids)).group_by(BatchMember.batch_id)
                )
            ).all()
        )
        if ids
        else {}
    )
    exams = (
        dict(
            (
                await db.execute(
                    select(ExamBatch.batch_id, func.count()).where(ExamBatch.batch_id.in_(ids)).group_by(ExamBatch.batch_id)
                )
            ).all()
        )
        if ids
        else {}
    )
    return [
        {
            "id": b.id,
            "name": b.name,
            "description": b.description,
            "member_count": members.get(b.id, 0),
            "exam_count": exams.get(b.id, 0),
            "created_at": svc.iso(b.created_at),
        }
        for b in batches
    ]


@router.post("/batches", status_code=201)
async def create_batch(payload: BatchIn, user: CurrentUser = Depends(require_proctor), db: AsyncSession = Depends(get_session)):
    batch = Batch(proctor_id=user.id, name=payload.name.strip(), description=payload.description)
    db.add(batch)
    await db.commit()
    return {
        "id": batch.id,
        "name": batch.name,
        "description": batch.description,
        "member_count": 0,
        "exam_count": 0,
        "created_at": svc.iso(batch.created_at),
    }


@router.patch("/batches/{batch_id}")
async def update_batch(
    batch_id: str, payload: BatchIn, user: CurrentUser = Depends(require_proctor), db: AsyncSession = Depends(get_session)
):
    batch = await _own_batch(db, batch_id, user)
    batch.name, batch.description = payload.name.strip(), payload.description
    await db.commit()
    return {"id": batch.id, "name": batch.name, "description": batch.description}


@router.delete("/batches/{batch_id}", status_code=204)
async def delete_batch(batch_id: str, user: CurrentUser = Depends(require_proctor), db: AsyncSession = Depends(get_session)):
    batch = await _own_batch(db, batch_id, user)
    await db.execute(delete(BatchMember).where(BatchMember.batch_id == batch.id))
    await db.execute(delete(ExamBatch).where(ExamBatch.batch_id == batch.id))
    await db.delete(batch)
    await db.commit()


@router.post("/batches/{batch_id}/members")
async def add_members(
    batch_id: str, payload: MembersIn, user: CurrentUser = Depends(require_proctor), db: AsyncSession = Depends(get_session)
):
    batch = await _own_batch(db, batch_id, user)
    valid = set((await db.scalars(select(Profile.id).where(Profile.id.in_(payload.student_ids), roster_filter(user.id)))).all())
    if len(valid) != len(set(payload.student_ids)):
        raise HTTPException(400, "Some students are not on your roster")
    existing = set((await db.scalars(select(BatchMember.candidate_id).where(BatchMember.batch_id == batch.id))).all())
    for sid in valid - existing:
        db.add(BatchMember(batch_id=batch.id, candidate_id=sid))
    await db.commit()
    return {"added": len(valid - existing)}


@router.delete("/batches/{batch_id}/members/{student_id}", status_code=204)
async def remove_member(
    batch_id: str, student_id: str, user: CurrentUser = Depends(require_proctor), db: AsyncSession = Depends(get_session)
):
    batch = await _own_batch(db, batch_id, user)
    await db.execute(delete(BatchMember).where(BatchMember.batch_id == batch.id, BatchMember.candidate_id == student_id))
    await db.commit()
