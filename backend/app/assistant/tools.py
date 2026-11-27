"""Tools the teacher assistant can call.

Every tool runs through the same route handlers as the REST API, as the signed-in proctor, so ownership
checks and validation are identical to clicking through the UI. Tools marked ``confirm`` (anything that
emails people, creates accounts, publishes, or deletes) never run from the model directly: they become a
pending action the teacher approves in the chat UI.

Each handler returns ``(for_model, card)``: a compact JSON-able result the model sees, and an optional UI
card. Secrets such as generated passwords go only into the card, never to the model provider.
"""

from __future__ import annotations

from collections.abc import Awaitable, Callable
from dataclasses import dataclass
from datetime import datetime
from typing import Any
from zoneinfo import ZoneInfo

from fastapi import HTTPException, Request
from sqlalchemy.ext.asyncio import AsyncSession

from ..api import exams as exams_api
from ..api import students as students_api
from ..core.clerk import ClerkClient
from ..core.security import CurrentUser
from ..schemas import BatchIn, ExamIn, MembersIn, StatusIn, StudentImportIn


@dataclass
class Ctx:
    user: CurrentUser
    db: AsyncSession
    clerk: ClerkClient
    request: Request
    tz: ZoneInfo


Result = tuple[Any, dict | None]


@dataclass
class Tool:
    name: str
    description: str
    parameters: dict
    run: Callable[[Ctx, dict], Awaitable[Result]]
    confirm: Callable[[dict], bool] | None = None  # returns True when this call needs the teacher's approval
    describe: Callable[[dict], dict] | None = None  # confirmation card content

    def spec(self) -> dict:
        return {
            "type": "function",
            "function": {"name": self.name, "description": self.description, "parameters": self.parameters},
        }


# ------------------------------------------------------------------------------------- helpers
def _obj(props: dict, required: list[str] | None = None) -> dict:
    return {"type": "object", "properties": props, "required": required or [], "additionalProperties": False}


STR = {"type": "string"}
INT = {"type": "integer"}
IDS = {"type": "array", "items": STR}


def _when(value: str | None, tz: ZoneInfo) -> str | None:
    """ISO datetime from the model; naive values are read in the teacher's timezone."""
    if not value:
        return None
    dt = datetime.fromisoformat(value.replace("Z", "+00:00"))
    return (dt if dt.tzinfo else dt.replace(tzinfo=tz)).isoformat()


def _exam_brief(e: dict) -> dict:
    keys = ("id", "title", "status", "question_count", "total_points", "duration_minutes", "starts_at", "ends_at", "access_code")
    out = {k: e.get(k) for k in keys}
    for k in ("attempt_count", "live_count", "batch_ids"):
        if k in e:
            out[k] = e[k]
    return out


def _exam_card(e: dict) -> dict:
    return {"type": "exam", "exam": _exam_brief(e)}


QUESTION = _obj(
    {
        "type": {"type": "string", "enum": ["single", "multiple", "text"], "description": "single/multiple choice or free text"},
        "prompt": STR,
        "options": {"type": "array", "items": STR, "description": "2-6 options for choice questions; empty for text"},
        "correct": {"type": "array", "items": INT, "description": "0-based indexes of correct options"},
        "points": {"type": "number"},
        "explanation": {"type": "string", "description": "Why the answer is correct (shown after the exam if enabled)"},
    },
    ["type", "prompt"],
)
SETTINGS = _obj(
    {
        "max_violations": {"type": "integer", "description": "Auto-terminate after this many flags; 0 = never"},
        "require_fullscreen": {"type": "boolean"},
        "detect_objects": {"type": "boolean", "description": "Phone/book/second-device detection"},
        "detect_audio": {"type": "boolean"},
        "shuffle_questions": {"type": "boolean"},
        "shuffle_options": {"type": "boolean"},
        "show_results": {"type": "boolean"},
        "reveal_answers": {"type": "boolean"},
        "pass_percentage": {"type": "number"},
        "require_assignment": {"type": "boolean", "description": "Only students in assigned batches may join"},
        "verify_identity": {"type": "boolean", "description": "Face ID check against the student's reference photo"},
    }
)


# ------------------------------------------------------------------------------------- read tools
async def get_overview(ctx: Ctx, _: dict) -> Result:
    data = await exams_api.overview(user=ctx.user, db=ctx.db)
    keys = ("exam_count", "published_count", "student_count", "active_attempts", "online_now")
    return {k: data.get(k) for k in keys}, None


async def list_exams(ctx: Ctx, args: dict) -> Result:
    exams = await exams_api.list_exams(user=ctx.user, db=ctx.db)
    if args.get("status"):
        exams = [e for e in exams if e["status"] == args["status"]]
    return [_exam_brief(e) for e in exams[:50]], None


async def get_exam(ctx: Ctx, args: dict) -> Result:
    e = await exams_api.get_exam(args["exam_id"], user=ctx.user, db=ctx.db)
    out = {**_exam_brief(e), "description": e["description"], "settings": e["settings"]}
    out["questions"] = [
        {k: q[k] for k in ("type", "prompt", "options", "correct", "points", "explanation")} for q in e["questions"]
    ]
    return out, _exam_card(e)


async def exam_results(ctx: Ctx, args: dict) -> Result:
    analytics = await exams_api.exam_analytics(args["exam_id"], user=ctx.user, db=ctx.db)
    data = await exams_api.exam_attempts(args["exam_id"], user=ctx.user, db=ctx.db)
    students = [
        {
            "name": a["candidate_name"] or a["candidate_email"],
            "status": a["status"],
            "percentage": a["percentage"],
            "passed": a["passed"],
            "flags": a["violation_count"],
            "risk": a["risk_score"],
        }
        for a in data["attempts"][:100]
    ]
    return {"exam": data["exam"]["title"], "summary": analytics["summary"], "students": students}, _exam_card(data["exam"])


async def list_students(ctx: Ctx, args: dict) -> Result:
    rows = await students_api.list_students(
        ctx.request, q=args.get("query"), batch_id=args.get("batch_id"), user=ctx.user, db=ctx.db
    )
    return [
        {
            "id": s["id"],
            "name": s["name"],
            "email": s["email"],
            "batches": [b["name"] for b in s["batches"]],
            "attempts": s["attempts"],
            "average": s["average"],
            "flags": s["flags"],
            "has_reference_photo": s["has_reference"],
        }
        for s in rows[:200]
    ], None


async def list_batches(ctx: Ctx, _: dict) -> Result:
    rows = await students_api.list_batches(user=ctx.user, db=ctx.db)
    return [{k: b[k] for k in ("id", "name", "description", "member_count", "exam_count")} for b in rows], None


async def list_invites(ctx: Ctx, _: dict) -> Result:
    rows = await students_api.list_invites(user=ctx.user, db=ctx.db)
    return [{k: i.get(k) for k in ("id", "email", "name", "created_at")} for i in rows], None


# ------------------------------------------------------------------------------------- write tools
def _exam_payload(args: dict, tz: ZoneInfo, base: dict | None = None) -> ExamIn:
    base = base or {}
    data = {
        "title": args.get("title", base.get("title")),
        "description": args.get("description", base.get("description", "")),
        "duration_minutes": args.get("duration_minutes", base.get("duration_minutes", 30)),
        "starts_at": _when(args["starts_at"], tz) if "starts_at" in args else base.get("starts_at"),
        "ends_at": _when(args["ends_at"], tz) if "ends_at" in args else base.get("ends_at"),
        "settings": {**base.get("settings", {}), **args.get("settings", {})},
        "questions": args.get("questions", base.get("questions", [])),
        "batch_ids": args.get("batch_ids", base.get("batch_ids", [])),
    }
    if "add_questions" in args:
        data["questions"] = [*data["questions"], *args["add_questions"]]
    return ExamIn.model_validate(data)


async def create_exam(ctx: Ctx, args: dict) -> Result:
    e = await exams_api.create_exam(_exam_payload(args, ctx.tz), user=ctx.user, db=ctx.db)
    return {"created": _exam_brief(e), "note": "Saved as a draft. Students can't see it until it is published."}, _exam_card(e)


async def update_exam(ctx: Ctx, args: dict) -> Result:
    exam_id = args.pop("exam_id")
    current = await exams_api.get_exam(exam_id, user=ctx.user, db=ctx.db)
    base = {
        **current,
        "questions": [
            {k: q[k] for k in ("type", "prompt", "options", "correct", "points", "explanation")} for q in current["questions"]
        ],
    }
    e = await exams_api.update_exam(exam_id, _exam_payload(args, ctx.tz, base), user=ctx.user, db=ctx.db)
    return {"updated": _exam_brief(e)}, _exam_card(e)


async def set_exam_status(ctx: Ctx, args: dict) -> Result:
    e = await exams_api.set_status(args["exam_id"], StatusIn(status=args["status"]), user=ctx.user, db=ctx.db)
    return {"exam": _exam_brief(e)}, _exam_card(e)


async def delete_exam(ctx: Ctx, args: dict) -> Result:
    await exams_api.delete_exam(args["exam_id"], user=ctx.user, db=ctx.db)
    return {"deleted": args["exam_id"]}, None


async def add_students(ctx: Ctx, args: dict) -> Result:
    mode = "invite" if args.get("mode", "invite") == "invite" else "password"
    payload = StudentImportIn(rows=args["students"], mode=mode, batch_ids=args.get("batch_ids", []))
    res = await students_api.import_students(payload, user=ctx.user, db=ctx.db, clerk=ctx.clerk)
    for_model = {k: res[k] for k in ("created", "invited", "linked", "failed") if k in res}
    for_model["results"] = [{k: r.get(k) for k in ("email", "status", "error")} for r in res["results"]]
    if mode == "password":
        for_model["note"] = "Passwords are shown to the teacher in the app only."
    return for_model, {"type": "students", "mode": mode, "results": res["results"]}


async def create_batch(ctx: Ctx, args: dict) -> Result:
    b = await students_api.create_batch(
        BatchIn(name=args["name"], description=args.get("description", "")), user=ctx.user, db=ctx.db
    )
    return {"id": b["id"], "name": b["name"]}, None


async def add_to_batch(ctx: Ctx, args: dict) -> Result:
    res = await students_api.add_members(args["batch_id"], MembersIn(student_ids=args["student_ids"]), user=ctx.user, db=ctx.db)
    return res, None


async def revoke_invite(ctx: Ctx, args: dict) -> Result:
    await students_api.revoke_invite(args["invite_id"], user=ctx.user, db=ctx.db, clerk=ctx.clerk)
    return {"revoked": args["invite_id"]}, None


# ------------------------------------------------------------------------------------- confirmation copy
def _describe_status(a: dict) -> dict:
    verb = {"published": "Publish", "closed": "Close", "draft": "Move back to draft"}[a["status"]]
    detail = {
        "published": "Students can see and join it right away (or when its window opens).",
        "closed": "No one can start or continue it after this.",
        "draft": "Students won't be able to see it.",
    }[a["status"]]
    return {
        "title": f"{verb} “{a.get('_title', 'this exam')}”?",
        "lines": [detail],
        "confirm_label": verb,
        "tone": "danger" if a["status"] == "closed" else "default",
    }


def _describe_students(a: dict) -> dict:
    invite = a.get("mode", "invite") == "invite"
    people = [f"{s.get('name', '')} <{s['email']}>" for s in a.get("students", [])]
    head = (
        f"Email an invitation to {len(people)} student{'s' if len(people) != 1 else ''}?"
        if invite
        else f"Create {len(people)} student account{'s' if len(people) != 1 else ''}?"
    )
    lines = people[:12] + ([f"…and {len(people) - 12} more"] if len(people) > 12 else [])
    if a.get("_batches"):
        lines.append("Batch: " + ", ".join(a["_batches"]))
    return {"title": head, "lines": lines, "confirm_label": "Send invites" if invite else "Create accounts", "tone": "default"}


TOOLS: list[Tool] = [
    Tool("get_overview", "Counts of the teacher's exams, students and live attempts.", _obj({}), get_overview),
    Tool(
        "list_exams",
        "List the teacher's exams (newest first) with ids, status, schedule and access codes.",
        _obj({"status": {"type": "string", "enum": ["draft", "published", "closed"]}}),
        list_exams,
    ),
    Tool("get_exam", "Full details of one exam including every question.", _obj({"exam_id": STR}, ["exam_id"]), get_exam),
    Tool(
        "exam_results",
        "Scores, pass rate, flags and per-student results for an exam.",
        _obj({"exam_id": STR}, ["exam_id"]),
        exam_results,
    ),
    Tool(
        "list_students",
        "Students on the teacher's roster, optionally filtered by a search query or batch id.",
        _obj({"query": STR, "batch_id": STR}),
        list_students,
    ),
    Tool("list_batches", "The teacher's batches (classes) with ids and member counts.", _obj({}), list_batches),
    Tool("list_invites", "Pending student invitations.", _obj({}), list_invites),
    Tool(
        "create_exam",
        "Create a new exam as a DRAFT with its questions. Write complete, accurate questions with correct answers.",
        _obj(
            {
                "title": STR,
                "description": {"type": "string", "description": "Instructions shown to students before starting"},
                "duration_minutes": INT,
                "starts_at": {"type": "string", "description": "ISO 8601 with timezone offset, optional"},
                "ends_at": {"type": "string", "description": "ISO 8601 with timezone offset, optional"},
                "questions": {"type": "array", "items": QUESTION},
                "batch_ids": {**IDS, "description": "Batch ids to assign the exam to"},
                "settings": SETTINGS,
            },
            ["title", "questions"],
        ),
        create_exam,
    ),
    Tool(
        "update_exam",
        "Change an exam. Only the fields given change. `questions` replaces all questions; `add_questions` appends. "
        "Exams that already have attempts can't be edited.",
        _obj(
            {
                "exam_id": STR,
                "title": STR,
                "description": STR,
                "duration_minutes": INT,
                "starts_at": STR,
                "ends_at": STR,
                "questions": {"type": "array", "items": {"type": "object"}, "description": "Same shape as create_exam"},
                "add_questions": {"type": "array", "items": {"type": "object"}, "description": "Same shape as create_exam"},
                "batch_ids": IDS,
                "settings": {"type": "object", "description": "Same keys as create_exam settings"},
            },
            ["exam_id"],
        ),
        update_exam,
    ),
    Tool(
        "set_exam_status",
        "Publish, close, or move an exam back to draft. The teacher confirms in the app.",
        _obj({"exam_id": STR, "status": {"type": "string", "enum": ["published", "closed", "draft"]}}, ["exam_id", "status"]),
        set_exam_status,
        confirm=lambda a: True,
        describe=_describe_status,
    ),
    Tool(
        "delete_exam",
        "Permanently delete an exam and its attempts. The teacher confirms in the app.",
        _obj({"exam_id": STR}, ["exam_id"]),
        delete_exam,
        confirm=lambda a: True,
        describe=lambda a: {
            "title": f"Delete “{a.get('_title', 'this exam')}”?",
            "lines": ["The exam, its questions and every attempt and evidence record are removed. This can't be undone."],
            "confirm_label": "Delete exam",
            "tone": "danger",
        },
    ),
    Tool(
        "add_students",
        "Add students. mode=invite emails each an invitation link (default); mode=account creates accounts with "
        "generated passwords the teacher shares. Existing students are just linked. The teacher confirms in the app.",
        _obj(
            {
                "students": {"type": "array", "items": _obj({"name": STR, "email": STR}, ["name", "email"])},
                "mode": {"type": "string", "enum": ["invite", "account"]},
                "batch_ids": IDS,
            },
            ["students"],
        ),
        add_students,
        confirm=lambda a: True,
        describe=_describe_students,
    ),
    Tool(
        "create_batch",
        "Create a batch (class/section) to group students.",
        _obj({"name": STR, "description": STR}, ["name"]),
        create_batch,
    ),
    Tool(
        "add_to_batch",
        "Add existing roster students (by id) to a batch.",
        _obj({"batch_id": STR, "student_ids": IDS}, ["batch_id", "student_ids"]),
        add_to_batch,
    ),
    Tool(
        "revoke_invite",
        "Withdraw a pending invitation. The teacher confirms in the app.",
        _obj({"invite_id": STR}, ["invite_id"]),
        revoke_invite,
        confirm=lambda a: True,
        describe=lambda a: {
            "title": f"Withdraw the invitation for {a.get('_email', 'this student')}?",
            "lines": ["Their link stops working and they won't join your class."],
            "confirm_label": "Withdraw",
            "tone": "danger",
        },
    ),
]
REGISTRY = {t.name: t for t in TOOLS}
SPECS = [t.spec() for t in TOOLS]


async def enrich_for_confirmation(ctx: Ctx, tool: Tool, args: dict) -> dict:
    """Look up names for the confirmation card (and fail early on ids the teacher doesn't own)."""
    shown = dict(args)
    if "exam_id" in args:
        shown["_title"] = (await exams_api.get_exam(args["exam_id"], user=ctx.user, db=ctx.db))["title"]
    if tool.name == "add_students" and args.get("batch_ids"):
        names = {b["id"]: b["name"] for b in await students_api.list_batches(user=ctx.user, db=ctx.db)}
        missing = [b for b in args["batch_ids"] if b not in names]
        if missing:
            raise HTTPException(404, f"Batch not found: {', '.join(missing)}")
        shown["_batches"] = [names[b] for b in args["batch_ids"]]
    if tool.name == "revoke_invite":
        invites = {i["id"]: i["email"] for i in await students_api.list_invites(user=ctx.user, db=ctx.db)}
        if args["invite_id"] not in invites:
            raise HTTPException(404, "Invite not found")
        shown["_email"] = invites[args["invite_id"]]
    return shown
