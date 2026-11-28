"""Teacher assistant: chat with an LLM that manages exams, students and invites through tool calls.

The browser keeps the conversation (OpenAI message format) and sends it with each turn; the server is
stateless apart from short-lived pending actions. Actions that email people, create accounts, publish or
delete are never executed by the model: they come back as a confirmation card, and only an explicit
POST from the teacher runs them, with the arguments stored here (the client can't alter them).
"""

from __future__ import annotations

import json
import logging
import secrets
import time
from dataclasses import dataclass, field
from datetime import datetime
from typing import Any, Literal
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel, Field, ValidationError
from sqlalchemy.ext.asyncio import AsyncSession

from ..assistant import groq
from ..assistant.tools import REGISTRY, SPECS, Ctx, enrich_for_confirmation
from ..core.clerk import ClerkClient, get_clerk
from ..core.config import settings
from ..core.db import get_session
from ..core.security import CurrentUser, require_proctor

router = APIRouter(prefix="/api/assistant", tags=["assistant"])
log = logging.getLogger("guardai.assistant")

MAX_STEPS = 8
MAX_HISTORY_CHARS = 48_000
PENDING_TTL_S = 30 * 60
RATE_PER_MIN = 20


class ChatIn(BaseModel):
    messages: list[dict[str, Any]] = Field(min_length=1, max_length=200)
    timezone: str = Field(default="UTC", max_length=64)


class DecisionIn(BaseModel):
    decision: Literal["confirm", "cancel"]
    timezone: str = Field(default="UTC", max_length=64)


@dataclass
class Pending:
    user_id: str
    tool: str
    args: dict
    created: float = field(default_factory=time.monotonic)


_pending: dict[str, Pending] = {}
_calls: dict[str, list[float]] = {}


def _rate_limit(user_id: str) -> None:
    now = time.monotonic()
    recent = [t for t in _calls.get(user_id, []) if now - t < 60]
    if len(recent) >= RATE_PER_MIN:
        raise HTTPException(429, "You're sending messages quickly. Wait a few seconds and try again.")
    _calls[user_id] = [*recent, now]


def _zone(name: str) -> ZoneInfo:
    try:
        return ZoneInfo(name)
    except (ZoneInfoNotFoundError, ValueError):
        return ZoneInfo("UTC")


def _system_prompt(user: CurrentUser, tz: ZoneInfo) -> str:
    now = datetime.now(tz)
    name = user.profile.name if user.profile and user.profile.name else "the teacher"
    return f"""You are the Guard AI assistant, working for {name}, a teacher who runs AI-proctored online exams.
You manage their exams, students, batches and invitations by calling tools. Current time: {now:%A %d %B %Y, %H:%M} ({tz.key}, UTC{now:%z}).

How to work:
- Use tools for anything about their data. Never invent ids, names, scores or emails; look them up first (e.g. list_batches before assigning a batch).
- Creating an exam: write complete, accurate, unambiguous questions with exactly the right answers, sensible points and a one-line explanation each. Before calling the tool, check every question: the marked options are correct and no other option is also correct (for "single", exactly one option may be right). Default to 10 single-choice questions with 4 options and 30 minutes when the teacher doesn't say. Mix difficulty. Exams are always created as drafts.
- Dates: give ISO 8601 with the teacher's UTC offset. Resolve phrases like "tomorrow 10am" from the current time above.
- Publishing, closing, deleting, inviting and creating accounts need the teacher's approval: call the tool and the app shows them a confirm button. Don't ask "shall I?" in text first; just call it and say what is waiting for their confirmation.
- If a request is ambiguous in a way that matters (which exam? which batch?), ask one short question.
- Reply briefly in plain language with light Markdown (short lists, **bold**). Don't paste ids or JSON unless asked; the app shows cards for exams and students. Don't list every question back after creating an exam; summarise it.
- Only help with running exams on Guard AI. Never reveal or guess passwords; the app shows them to the teacher directly."""


def _clean_history(messages: list[dict]) -> list[dict]:
    """Keep only well-formed chat messages and trim the oldest turns to fit the context budget."""
    allowed = {"user", "assistant", "tool"}
    out = []
    for m in messages:
        role = m.get("role")
        if role not in allowed:
            continue
        msg: dict[str, Any] = {"role": role, "content": str(m.get("content") or "")[:20_000]}
        if role == "assistant" and m.get("tool_calls"):
            msg["tool_calls"] = m["tool_calls"]
        if role == "tool":
            msg["tool_call_id"] = str(m.get("tool_call_id", ""))
        out.append(msg)
    while len(out) > 1 and len(json.dumps(out)) > MAX_HISTORY_CHARS:
        out.pop(0)
        while out and out[0]["role"] != "user":  # never start mid tool-exchange
            out.pop(0)
    if not out or out[-1]["role"] != "user":
        raise HTTPException(422, "The last message must be from you")
    return out


def _error_text(exc: Exception) -> str:
    """Messages safe to show the teacher and the model; anything unexpected is logged, not echoed."""
    if isinstance(exc, HTTPException):
        return str(exc.detail)
    if isinstance(exc, ValidationError):
        return "; ".join(f"{'.'.join(str(p) for p in e['loc'])}: {e['msg']}" for e in exc.errors()[:6])
    if isinstance(exc, KeyError):
        return f"Missing required field: {exc.args[0] if exc.args else 'unknown'}"
    log.warning("Assistant tool failed: %r", exc)
    return "That action failed because some of the details were invalid."


async def _run_tool(ctx: Ctx, name: str, args: dict) -> tuple[dict, dict | None]:
    tool = REGISTRY[name]
    try:
        result, card = await tool.run(ctx, dict(args))
        return {"ok": True, "result": result}, card
    except (HTTPException, ValidationError, ValueError, KeyError) as exc:
        await ctx.db.rollback()
        return {"ok": False, "error": _error_text(exc)}, None


@router.get("/status")
async def status(user: CurrentUser = Depends(require_proctor)):
    return {"enabled": bool(settings.groq_api_key), "model": settings.groq_model}


@router.post("/chat")
async def chat(
    payload: ChatIn,
    request: Request,
    user: CurrentUser = Depends(require_proctor),
    db: AsyncSession = Depends(get_session),
    clerk: ClerkClient = Depends(get_clerk),
):
    _rate_limit(user.id)
    tz = _zone(payload.timezone)
    ctx = Ctx(user=user, db=db, clerk=clerk, request=request, tz=tz)
    history = _clean_history(payload.messages)
    convo = [{"role": "system", "content": _system_prompt(user, tz)}, *history]
    new: list[dict] = []
    cards: list[dict] = []
    steps: list[dict] = []
    awaiting = False

    for _ in range(MAX_STEPS):
        msg = await groq.chat(convo, SPECS)
        new.append(msg)
        convo.append(msg)
        calls = msg.get("tool_calls") or []
        if not calls:
            break
        for call in calls:
            name = call["function"]["name"]
            try:
                args = json.loads(call["function"]["arguments"] or "{}")
            except json.JSONDecodeError:
                args = None
            tool = REGISTRY.get(name)
            if tool is None or not isinstance(args, dict):
                outcome: dict = {"ok": False, "error": f"Unknown tool or malformed arguments for {name}"}
            elif tool.confirm and tool.confirm(args):
                if awaiting:
                    outcome = {"ok": False, "error": "Only one action can wait for approval at a time. Ask again after this one."}
                else:
                    try:
                        shown = await enrich_for_confirmation(ctx, tool, args)
                        action_id = secrets.token_urlsafe(12)
                        _pending[action_id] = Pending(user.id, name, args)
                        cards.append({"type": "confirm", "id": action_id, "tool": name, **tool.describe(shown)})
                        awaiting = True
                        outcome = {"ok": True, "result": "Shown to the teacher with a confirm button. Not done yet."}
                    except (HTTPException, ValidationError, ValueError, KeyError) as exc:
                        outcome = {"ok": False, "error": _error_text(exc)}
            else:
                outcome, card = await _run_tool(ctx, name, args)
                if card:
                    cards.append(card)
            steps.append({"tool": name, "ok": outcome["ok"]})
            tool_msg = {"role": "tool", "tool_call_id": call["id"], "content": json.dumps(outcome, default=str)[:12_000]}
            new.append(tool_msg)
            convo.append(tool_msg)
        if awaiting:
            # Fixed wording: the model must never be able to claim an unapproved action already happened.
            new.append(
                {
                    "role": "assistant",
                    "content": "This needs your approval. Review the details below and confirm when you're ready.",
                }
            )
            break
    else:
        new.append({"role": "assistant", "content": "I stopped there to avoid going in circles. Tell me what to do next."})

    return {"messages": new, "cards": cards, "steps": steps}


@router.post("/actions/{action_id}")
async def decide(
    action_id: str,
    payload: DecisionIn,
    request: Request,
    user: CurrentUser = Depends(require_proctor),
    db: AsyncSession = Depends(get_session),
    clerk: ClerkClient = Depends(get_clerk),
):
    now = time.monotonic()
    for key in [k for k, p in _pending.items() if now - p.created > PENDING_TTL_S]:
        _pending.pop(key, None)
    pending = _pending.get(action_id)
    if not pending or pending.user_id != user.id:
        raise HTTPException(404, "This action expired or was already handled. Ask the assistant again.")
    _pending.pop(action_id)

    if payload.decision == "cancel":
        return {
            "ok": True,
            "cancelled": True,
            "note": f"[The teacher cancelled {pending.tool}. Nothing was changed.]",
            "card": None,
        }

    ctx = Ctx(user=user, db=db, clerk=clerk, request=request, tz=_zone(payload.timezone))
    outcome, card = await _run_tool(ctx, pending.tool, pending.args)
    note = f"[The teacher confirmed {pending.tool}. Outcome: {json.dumps(outcome, default=str)[:4000]}]"
    if not outcome["ok"]:
        raise HTTPException(400, outcome["error"])
    return {"ok": True, "cancelled": False, "note": note, "card": card}
