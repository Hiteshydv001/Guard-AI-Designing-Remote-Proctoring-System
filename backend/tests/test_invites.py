"""Student invitations: branded email delivery, Clerk fallback, and revocation."""

import dataclasses

from conftest import as_user
from fastapi import HTTPException

from app.api import students as students_api
from app.core.config import settings
from app.services.email import EmailError, render_invitation

PROF = as_user("user_prof_invites")  # own proctor: the test database is shared across modules


def _setup(c):
    assert c.put("/api/me", json={"role": "proctor", "name": "Prof <X>", "email": "prof@x.io"}, headers=PROF).status_code == 200
    return c.post("/api/batches", json={"name": "CS-A"}, headers=PROF).json()


def _enable_branded(monkeypatch):
    branded = dataclasses.replace(settings, resend_api_key="re_test", email_from="Guard AI <invites@guard.test>")
    monkeypatch.setattr(students_api, "settings", branded)


def _invite(c, email, batch_ids=()):
    body = {"name": "Dan D", "email": email, "mode": "invite", "batch_ids": list(batch_ids)}
    res = c.post("/api/students", json=body, headers=PROF)
    assert res.status_code == 201, res.text
    return res.json()


def test_revoked_invite_never_joins_the_class(client, clerk, monkeypatch):
    _setup(client)
    _invite(client, "rev@x.io")
    invite_id = client.get("/api/invites", headers=PROF).json()[0]["id"]

    async def clerk_refuses(_):  # Clerk keeps the invitation redeemable
        raise HTTPException(400, "Clerk: something went wrong")

    monkeypatch.setattr(clerk, "revoke_invitation", clerk_refuses)
    assert client.delete(f"/api/invites/{invite_id}", headers=PROF).status_code == 204

    dan = clerk.sign_up("rev@x.io", "Rev R")  # still possible on Clerk's side, with candidate metadata
    me = client.get("/api/me", headers=as_user(dan)).json()
    assert me["role"] is None  # treated as a new, unaffiliated user
    assert client.get("/api/students", headers=PROF).json() == []


def test_branded_invite_email(client, clerk, monkeypatch):
    batch = _setup(client)
    sent = []

    async def fake_send(to, email, **kw):
        sent.append((to, email, kw))

    _enable_branded(monkeypatch)
    monkeypatch.setattr(students_api, "send_email", fake_send)

    res = _invite(client, "brand@x.io", [batch["id"]])
    assert res["delivery"] == "guard-ai"
    inv = list(clerk.invitations.values())[-1]
    assert inv["notify"] is False  # Clerk must not send its own email as well
    to, email, kw = sent[0]
    assert to == "brand@x.io" and kw["reply_to"] == "prof@x.io"
    assert "Prof &lt;X&gt;" in email.html and "<X>" not in email.html  # user input is escaped
    assert "https://clerk.test/accept?ticket=" in email.html and "CS-A" in email.html


def test_branded_invite_falls_back_to_clerk(client, clerk, monkeypatch):
    _setup(client)

    async def failing_send(*a, **kw):
        raise EmailError("domain not verified")

    _enable_branded(monkeypatch)
    monkeypatch.setattr(students_api, "send_email", failing_send)

    res = _invite(client, "fallback@x.io")
    assert res["delivery"] == "clerk"
    inv = list(clerk.invitations.values())[-1]  # the silent one was revoked, a Clerk-emailed one issued
    assert inv["notify"] is True


def test_render_invitation_plain_text():
    email = render_invitation(
        student_name="Dan D",
        student_email="dan@x.io",
        teacher_name="Prof X",
        teacher_email=None,
        batch_names=[],
        accept_url="https://example.test/a?b=1&c=2",
        expires_in_days=30,
    )
    assert email.subject == "Prof X invited you to Guard AI"
    assert "https://example.test/a?b=1&amp;c=2" in email.html
    assert "https://example.test/a?b=1&c=2" in email.text and "Hi Dan" in email.text


def test_ticket_status_reports_revoked_and_expired(client, clerk, monkeypatch):
    _setup(client)
    _invite(client, "ticket@x.io")
    clerk_id = list(clerk.invitations)[-1]
    claims = {"sid": clerk_id, "st": "invitation", "exp": 4102444800}
    monkeypatch.setattr(students_api, "read_invitation_ticket", lambda t: dict(claims))

    assert client.get("/api/invites/ticket?ticket=x").json()["status"] == "pending"
    claims["exp"] = 1
    assert client.get("/api/invites/ticket?ticket=x").json()["status"] == "expired"
    invite_id = client.get("/api/invites", headers=PROF).json()[0]["id"]
    client.delete(f"/api/invites/{invite_id}", headers=PROF)
    res = client.get("/api/invites/ticket?ticket=x").json()
    assert res == {"status": "revoked", "email": "ticket@x.io", "teacher": "Prof <X>"}

    monkeypatch.setattr(students_api, "read_invitation_ticket", lambda t: None)
    assert client.get("/api/invites/ticket?ticket=forged").json() == {"status": "invalid"}
