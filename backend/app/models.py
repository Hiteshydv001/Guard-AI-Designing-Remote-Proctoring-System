from __future__ import annotations

import secrets
import string
import uuid
from datetime import UTC, datetime

from sqlalchemy import JSON, Boolean, DateTime, Float, ForeignKey, Integer, String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .core.db import Base


def utcnow() -> datetime:
    return datetime.now(UTC)


def new_id() -> str:
    return str(uuid.uuid4())


def new_access_code() -> str:
    alphabet = (string.ascii_uppercase + string.digits).translate(str.maketrans("", "", "O0I1"))
    return "".join(secrets.choice(alphabet) for _ in range(6))


DEFAULT_EXAM_SETTINGS = {
    "max_violations": 0,  # 0 = never auto-terminate
    "require_fullscreen": True,
    "detect_objects": True,  # phones / books / extra devices (YOLOX on the server)
    "detect_audio": True,
    "shuffle_questions": False,
    "shuffle_options": False,
    "show_results": True,  # show score right after submit
    "reveal_answers": False,  # show correct answers in the candidate's result
    "pass_percentage": 40,
    "require_assignment": False,  # only members of assigned batches may take it
    "verify_identity": True,  # match the candidate's face against their reference photo
}


class Profile(Base):
    __tablename__ = "profiles"

    id: Mapped[str] = mapped_column(String(64), primary_key=True)  # Clerk user id
    email: Mapped[str | None] = mapped_column(String(320), index=True)
    name: Mapped[str | None] = mapped_column(String(200))
    role: Mapped[str | None] = mapped_column(String(20))  # "proctor" | "candidate"
    created_by: Mapped[str | None] = mapped_column(String(64), index=True)  # proctor who created the account
    active: Mapped[bool] = mapped_column(Boolean, default=True)
    # Identity verification: reference photo (private storage path) + its SFace embedding.
    photo_path: Mapped[str | None] = mapped_column(Text)
    face_embedding: Mapped[list | None] = mapped_column(JSON)
    photo_updated_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)


class RosterEntry(Base):
    """A student on a proctor's roster (created, invited-and-joined, or linked by email)."""

    __tablename__ = "roster_entries"

    proctor_id: Mapped[str] = mapped_column(ForeignKey("profiles.id", ondelete="CASCADE"), primary_key=True)
    candidate_id: Mapped[str] = mapped_column(ForeignKey("profiles.id", ondelete="CASCADE"), primary_key=True, index=True)
    added_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)


class Batch(Base):
    """A class / cohort of students owned by a proctor."""

    __tablename__ = "batches"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_id)
    proctor_id: Mapped[str] = mapped_column(ForeignKey("profiles.id"), index=True)
    name: Mapped[str] = mapped_column(String(120))
    description: Mapped[str] = mapped_column(Text, default="")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)


class BatchMember(Base):
    __tablename__ = "batch_members"

    batch_id: Mapped[str] = mapped_column(ForeignKey("batches.id", ondelete="CASCADE"), primary_key=True)
    candidate_id: Mapped[str] = mapped_column(ForeignKey("profiles.id", ondelete="CASCADE"), primary_key=True, index=True)
    added_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)


class Invite(Base):
    """Email invitation sent through Clerk; turned into a profile on first sign-in."""

    __tablename__ = "invites"
    __table_args__ = (UniqueConstraint("proctor_id", "email", name="uq_invite_proctor_email"),)

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_id)
    proctor_id: Mapped[str] = mapped_column(ForeignKey("profiles.id"), index=True)
    email: Mapped[str] = mapped_column(String(320), index=True)
    name: Mapped[str | None] = mapped_column(String(200))
    batch_ids: Mapped[list] = mapped_column(JSON, default=list)
    clerk_invitation_id: Mapped[str | None] = mapped_column(String(64))
    status: Mapped[str] = mapped_column(String(20), default="pending")  # pending | accepted | revoked
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)


class Exam(Base):
    __tablename__ = "exams"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_id)
    proctor_id: Mapped[str] = mapped_column(ForeignKey("profiles.id"), index=True)
    title: Mapped[str] = mapped_column(String(200))
    description: Mapped[str] = mapped_column(Text, default="")
    duration_minutes: Mapped[int] = mapped_column(Integer, default=30)
    starts_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    ends_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    access_code: Mapped[str] = mapped_column(String(12), unique=True, index=True, default=new_access_code)
    status: Mapped[str] = mapped_column(String(20), default="draft")  # draft | published | closed
    settings: Mapped[dict] = mapped_column(JSON, default=lambda: dict(DEFAULT_EXAM_SETTINGS))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)

    questions: Mapped[list[Question]] = relationship(
        back_populates="exam", cascade="all, delete-orphan", order_by="Question.position", lazy="selectin"
    )


class ExamBatch(Base):
    __tablename__ = "exam_batches"

    exam_id: Mapped[str] = mapped_column(ForeignKey("exams.id", ondelete="CASCADE"), primary_key=True)
    batch_id: Mapped[str] = mapped_column(ForeignKey("batches.id", ondelete="CASCADE"), primary_key=True, index=True)


class Question(Base):
    __tablename__ = "questions"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_id)
    exam_id: Mapped[str] = mapped_column(ForeignKey("exams.id", ondelete="CASCADE"), index=True)
    position: Mapped[int] = mapped_column(Integer, default=0)
    type: Mapped[str] = mapped_column(String(20), default="single")  # single | multiple | text
    prompt: Mapped[str] = mapped_column(Text)
    options: Mapped[list] = mapped_column(JSON, default=list)  # list[str]
    correct: Mapped[list] = mapped_column(JSON, default=list)  # list[int] option indexes
    points: Mapped[float] = mapped_column(Float, default=1)
    explanation: Mapped[str] = mapped_column(Text, default="")

    exam: Mapped[Exam] = relationship(back_populates="questions", lazy="selectin")


class Attempt(Base):
    __tablename__ = "attempts"
    __table_args__ = (UniqueConstraint("exam_id", "candidate_id", name="uq_attempt_exam_candidate"),)

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_id)
    exam_id: Mapped[str] = mapped_column(ForeignKey("exams.id", ondelete="CASCADE"), index=True)
    candidate_id: Mapped[str] = mapped_column(ForeignKey("profiles.id"), index=True)
    status: Mapped[str] = mapped_column(String(20), default="in_progress")  # in_progress | submitted | terminated
    started_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    deadline_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    submitted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    answers: Mapped[dict] = mapped_column(JSON, default=dict)  # question_id -> list[int] | str
    manual_scores: Mapped[dict] = mapped_column(JSON, default=dict)  # question_id -> float (text questions)
    score: Mapped[float | None] = mapped_column(Float)
    max_score: Mapped[float | None] = mapped_column(Float)
    risk_score: Mapped[float] = mapped_column(Float, default=0)
    violation_count: Mapped[int] = mapped_column(Integer, default=0)
    last_heartbeat: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    calibration: Mapped[dict] = mapped_column(JSON, default=dict)  # neutral head pose {yaw, pitch}
    # {status: verified | failed | skipped, score, tries, checked_at}
    identity: Mapped[dict] = mapped_column(JSON, default=dict)
    termination_reason: Mapped[str | None] = mapped_column(Text)

    exam: Mapped[Exam] = relationship(lazy="selectin")
    candidate: Mapped[Profile] = relationship(lazy="selectin")


class Violation(Base):
    __tablename__ = "violations"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_id)
    attempt_id: Mapped[str] = mapped_column(ForeignKey("attempts.id", ondelete="CASCADE"), index=True)
    type: Mapped[str] = mapped_column(String(40))
    severity: Mapped[str] = mapped_column(String(10), default="medium")  # low | medium | high
    source: Mapped[str] = mapped_column(String(10), default="ai")  # ai | browser
    message: Mapped[str] = mapped_column(Text, default="")
    snapshot_path: Mapped[str | None] = mapped_column(Text)
    meta: Mapped[dict] = mapped_column(JSON, default=dict)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, index=True)


class ProctorMessage(Base):
    """Warnings a proctor sends to a candidate; delivered on the candidate's next frame/heartbeat."""

    __tablename__ = "proctor_messages"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_id)
    attempt_id: Mapped[str] = mapped_column(ForeignKey("attempts.id", ondelete="CASCADE"), index=True)
    body: Mapped[str] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    delivered_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
