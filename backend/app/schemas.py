from __future__ import annotations

import re
from datetime import UTC, datetime
from typing import Literal

from pydantic import BaseModel, Field, field_validator, model_validator

Role = Literal["proctor", "candidate"]
QuestionType = Literal["single", "multiple", "text"]
Severity = Literal["low", "medium", "high"]

EMAIL_RE = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")


def _email(v: str) -> str:
    v = v.strip().lower()
    if not EMAIL_RE.match(v):
        raise ValueError("Enter a valid email address")
    return v


class ProfileIn(BaseModel):
    role: Role
    name: str | None = Field(default=None, max_length=200)
    email: str | None = Field(default=None, max_length=320)


class ProfileOut(BaseModel):
    id: str
    role: Role | None = None
    name: str | None = None
    email: str | None = None


# ------------------------------------------------------------------------------------- exams
class ExamSettings(BaseModel):
    max_violations: int = Field(default=0, ge=0, le=1000)
    require_fullscreen: bool = True
    detect_objects: bool = True
    detect_audio: bool = True
    shuffle_questions: bool = False
    shuffle_options: bool = False
    show_results: bool = True
    reveal_answers: bool = False
    pass_percentage: float = Field(default=40, ge=0, le=100)
    require_assignment: bool = False
    verify_identity: bool = True


class QuestionIn(BaseModel):
    id: str | None = None
    type: QuestionType = "single"
    prompt: str = Field(min_length=1, max_length=5000)
    options: list[str] = Field(default_factory=list, max_length=12)
    correct: list[int] = Field(default_factory=list)
    points: float = Field(default=1, ge=0, le=1000)
    explanation: str = Field(default="", max_length=5000)

    @model_validator(mode="after")
    def _check(self) -> QuestionIn:
        if self.type == "text":
            self.options, self.correct = [], []
            return self
        self.options = [o.strip() for o in self.options]
        if len(self.options) < 2 or any(not o for o in self.options):
            raise ValueError("Choice questions need at least 2 non-empty options")
        if not self.correct or any(i < 0 or i >= len(self.options) for i in self.correct):
            raise ValueError("Mark at least one valid correct option")
        if self.type == "single" and len(self.correct) != 1:
            raise ValueError("Single-choice questions need exactly one correct option")
        self.correct = sorted(set(self.correct))
        return self


class ExamIn(BaseModel):
    title: str = Field(min_length=1, max_length=200)
    description: str = Field(default="", max_length=5000)
    duration_minutes: int = Field(default=30, ge=1, le=600)
    starts_at: datetime | None = None
    ends_at: datetime | None = None
    settings: ExamSettings = Field(default_factory=ExamSettings)
    questions: list[QuestionIn] = Field(default_factory=list, max_length=300)
    batch_ids: list[str] = Field(default_factory=list, max_length=100)

    @field_validator("starts_at", "ends_at")
    @classmethod
    def _utc(cls, v: datetime | None) -> datetime | None:
        # Store UTC: SQLite drops offsets, so a "+05:30" time would otherwise be read back as UTC.
        return v.astimezone(UTC) if v and v.tzinfo else (v.replace(tzinfo=UTC) if v else v)

    @model_validator(mode="after")
    def _window(self) -> ExamIn:
        if self.starts_at and self.ends_at and self.ends_at <= self.starts_at:
            raise ValueError("ends_at must be after starts_at")
        return self


class StatusIn(BaseModel):
    status: Literal["draft", "published", "closed"]


class JoinIn(BaseModel):
    access_code: str = Field(min_length=4, max_length=12)

    @field_validator("access_code")
    @classmethod
    def _upper(cls, v: str) -> str:
        return v.strip().upper()


# ------------------------------------------------------------------------------------- attempts
class AnswersIn(BaseModel):
    answers: dict[str, list[int] | str] = Field(default_factory=dict)


class SubmitIn(AnswersIn):
    # Last webcam frame and audio, checked before the attempt closes so last-second cheating is recorded.
    final_image: str | None = Field(default=None, max_length=800_000)
    audio_level: float = Field(default=0, ge=0, le=1)
    voice: float | None = Field(default=None, ge=0, le=1)


class FrameIn(BaseModel):
    image: str = Field(min_length=100, max_length=800_000)  # JPEG data URL
    audio_level: float = Field(default=0, ge=0, le=1)
    # Share of the interval since the last frame that sounded like speech (browser voice detector).
    voice: float | None = Field(default=None, ge=0, le=1)


class PhotoIn(BaseModel):
    image: str = Field(min_length=100, max_length=2_000_000)  # JPEG/PNG data URL


class VerifyIn(BaseModel):
    images: list[str] = Field(min_length=1, max_length=4)


class CalibrateIn(BaseModel):
    images: list[str] = Field(min_length=2, max_length=6)


class HeartbeatIn(BaseModel):
    audio_level: float = Field(default=0, ge=0, le=1)


class ViolationIn(BaseModel):
    type: str = Field(min_length=1, max_length=40)
    severity: Severity = "medium"
    message: str = Field(default="", max_length=500)
    meta: dict = Field(default_factory=dict)


class WarnIn(BaseModel):
    message: str = Field(min_length=1, max_length=500)


class TerminateIn(BaseModel):
    reason: str = Field(default="Terminated by proctor", max_length=500)


class GradeIn(BaseModel):
    scores: dict[str, float]


# ------------------------------------------------------------------------------------- students
class StudentCreateIn(BaseModel):
    name: str = Field(min_length=1, max_length=200)
    email: str = Field(max_length=320)
    password: str | None = Field(default=None, min_length=8, max_length=128)
    mode: Literal["password", "invite"] = "password"
    batch_ids: list[str] = Field(default_factory=list, max_length=50)

    _v_email = field_validator("email")(lambda cls, v: _email(v))


class StudentImportRow(BaseModel):
    name: str = Field(min_length=1, max_length=200)
    email: str = Field(max_length=320)

    _v_email = field_validator("email")(lambda cls, v: _email(v))


class StudentImportIn(BaseModel):
    rows: list[StudentImportRow] = Field(min_length=1, max_length=200)
    mode: Literal["password", "invite"] = "password"
    batch_ids: list[str] = Field(default_factory=list, max_length=50)


class StudentUpdateIn(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=200)
    batch_ids: list[str] | None = None


class BatchIn(BaseModel):
    name: str = Field(min_length=1, max_length=120)
    description: str = Field(default="", max_length=2000)


class MembersIn(BaseModel):
    student_ids: list[str] = Field(min_length=1, max_length=500)


class ContactIn(BaseModel):
    firstName: str = Field(max_length=100)
    lastName: str = Field(default="", max_length=100)
    email: str = Field(max_length=320)
    subject: str = Field(max_length=200)
    message: str = Field(max_length=5000)
