"""Teacher assistant: tool execution, confirmation gating and ownership, with a scripted model."""

import json

import pytest
from conftest import as_user

from app.api import assistant as assistant_api

PROF = as_user("user_prof_assistant")
OTHER = as_user("user_prof_assistant2")


def _call(name, args, cid="c1"):
    return {
        "role": "assistant",
        "content": "",
        "tool_calls": [{"id": cid, "type": "function", "function": {"name": name, "arguments": json.dumps(args)}}],
    }


class Script:
    """Replays assistant turns; records every conversation it was shown."""

    def __init__(self, *turns):
        self.turns = list(turns)
        self.seen: list[list[dict]] = []

    async def __call__(self, messages, tools, **kw):
        self.seen.append(list(messages))
        turn = self.turns.pop(0)
        return turn(messages) if callable(turn) else turn


@pytest.fixture
def model(monkeypatch):
    def install(*turns):
        script = Script(*turns)
        monkeypatch.setattr(assistant_api.groq, "chat", script)
        return script

    return install


def _chat(client, text, headers=PROF, history=()):
    res = client.post(
        "/api/assistant/chat",
        json={"messages": [*history, {"role": "user", "content": text}], "timezone": "Asia/Kolkata"},
        headers=headers,
    )
    assert res.status_code == 200, res.text
    return res.json()


QUESTIONS = [
    {
        "type": "single",
        "prompt": "2 + 2 = ?",
        "options": ["3", "4", "5"],
        "correct": [1],
        "points": 1,
        "explanation": "Basic sum.",
    },
    {"type": "multiple", "prompt": "Primes?", "options": ["2", "4", "5"], "correct": [0, 2]},
]


def test_assistant_creates_draft_exam_directly(client, model):
    for h in (PROF, OTHER):
        assert client.put("/api/me", json={"role": "proctor", "name": "Asha"}, headers=h).status_code == 200
    model(
        _call(
            "create_exam",
            {"title": "Maths quiz", "duration_minutes": 20, "starts_at": "2030-01-05T10:00:00", "questions": QUESTIONS},
        ),
        {"role": "assistant", "content": "Created **Maths quiz** as a draft."},
    )
    out = _chat(client, "make a 2 question maths quiz")
    assert out["steps"] == [{"tool": "create_exam", "ok": True}]
    (card,) = out["cards"]
    assert card["type"] == "exam" and card["exam"]["status"] == "draft" and card["exam"]["question_count"] == 2
    assert card["exam"]["starts_at"].startswith("2030-01-05T04:30")  # naive time read as Asia/Kolkata
    assert out["messages"][-1]["content"].startswith("Created")


def test_publish_needs_confirmation_and_cancel_changes_nothing(client, model):
    exam = client.post("/api/exams", json={"title": "Draft one", "questions": QUESTIONS}, headers=PROF).json()
    model(
        _call("set_exam_status", {"exam_id": exam["id"], "status": "published"}),
        {"role": "assistant", "content": "Confirm below."},
    )
    out = _chat(client, "publish it")
    (card,) = out["cards"]
    assert "approval" in out["messages"][-1]["content"]  # fixed text, not the model's
    assert card["type"] == "confirm" and "Draft one" in card["title"]
    assert client.get(f"/api/exams/{exam['id']}", headers=PROF).json()["status"] == "draft"  # not run yet

    assert client.post(f"/api/assistant/actions/{card['id']}", json={"decision": "cancel"}, headers=PROF).json()["cancelled"]
    assert client.post(f"/api/assistant/actions/{card['id']}", json={"decision": "confirm"}, headers=PROF).status_code == 404
    assert client.get(f"/api/exams/{exam['id']}", headers=PROF).json()["status"] == "draft"


def test_confirmed_action_runs_once_and_only_for_its_owner(client, model):
    exam = client.post("/api/exams", json={"title": "Go live", "questions": QUESTIONS}, headers=PROF).json()
    model(
        _call("set_exam_status", {"exam_id": exam["id"], "status": "published"}),
        {"role": "assistant", "content": "Confirm below."},
    )
    card = _chat(client, "publish Go live")["cards"][0]

    assert client.post(f"/api/assistant/actions/{card['id']}", json={"decision": "confirm"}, headers=OTHER).status_code == 404
    res = client.post(f"/api/assistant/actions/{card['id']}", json={"decision": "confirm"}, headers=PROF).json()
    assert res["card"]["exam"]["status"] == "published" and "confirmed set_exam_status" in res["note"]
    assert client.post(f"/api/assistant/actions/{card['id']}", json={"decision": "confirm"}, headers=PROF).status_code == 404


def test_other_teachers_exam_is_not_reachable(client, model):
    exam = client.post("/api/exams", json={"title": "Private", "questions": QUESTIONS}, headers=PROF).json()
    model(
        _call("get_exam", {"exam_id": exam["id"]}),
        _call("set_exam_status", {"exam_id": exam["id"], "status": "closed"}, cid="c2"),
        {"role": "assistant", "content": "Not found."},
    )
    out = _chat(client, "show me that exam", headers=OTHER)
    assert out["steps"] == [{"tool": "get_exam", "ok": False}, {"tool": "set_exam_status", "ok": False}]
    assert out["cards"] == []


def test_invites_wait_for_approval_and_passwords_never_reach_the_model(client, model):
    model(
        _call("add_students", {"students": [{"name": "Kim Lee", "email": "kim@x.io"}], "mode": "account"}),
        {"role": "assistant", "content": "Confirm below."},
    )
    card = _chat(client, "create an account for Kim Lee kim@x.io")["cards"][0]
    assert card["type"] == "confirm" and "kim@x.io" in " ".join(card["lines"])
    assert client.get("/api/students?q=kim", headers=PROF).json() == []

    res = client.post(f"/api/assistant/actions/{card['id']}", json={"decision": "confirm"}, headers=PROF).json()
    (row,) = res["card"]["results"]
    assert row["status"] == "created" and len(row["password"]) >= 12
    assert row["password"] not in res["note"]  # the note goes back to the model


def test_tool_errors_are_reported_to_the_model(client, model):
    script = model(
        _call(
            "create_exam", {"title": "Bad", "questions": [{"type": "single", "prompt": "?", "options": ["a"], "correct": [5]}]}
        ),
        lambda messages: {"role": "assistant", "content": "That failed: " + messages[-1]["content"][:40]},
    )
    out = _chat(client, "make a broken exam")
    assert out["steps"] == [{"tool": "create_exam", "ok": False}]
    assert json.loads(script.seen[-1][-1]["content"])["ok"] is False


def test_history_must_end_with_user(client, model):
    model({"role": "assistant", "content": "hi"})
    res = client.post("/api/assistant/chat", json={"messages": [{"role": "assistant", "content": "x"}]}, headers=PROF)
    assert res.status_code == 422
    assert (
        client.post(
            "/api/assistant/chat", json={"messages": [{"role": "user", "content": "hi"}]}, headers=as_user("nobody")
        ).status_code
        == 403
    )
