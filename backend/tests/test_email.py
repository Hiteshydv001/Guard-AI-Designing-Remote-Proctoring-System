"""Email providers: Brevo (no domain needed) and Resend, chosen from settings; requests built exactly."""

import asyncio
import dataclasses

import httpx
import pytest

from app.services import email as mail

MSG = mail.Email(subject="Hi", html="<p>Hi</p>", text="Hi")


def test_parse_sender():
    assert mail.parse_sender("Guard AI <invites@x.com>") == ("Guard AI", "invites@x.com")
    assert mail.parse_sender('"Guard AI" <a@b.co>') == ("Guard AI", "a@b.co")
    assert mail.parse_sender("me@gmail.com") == (None, "me@gmail.com")


@pytest.fixture
def capture(monkeypatch):
    sent = []

    async def fake_post(url, headers, payload):
        sent.append((url, headers, payload))
        return httpx.Response(201, json={"messageId": "m1"})

    monkeypatch.setattr(mail, "_post", fake_post)
    return sent


def _with(monkeypatch, **kw):
    monkeypatch.setattr(mail, "settings", dataclasses.replace(mail.settings, **kw))


def test_brevo_request(monkeypatch, capture):
    _with(monkeypatch, brevo_api_key="xkeysib-test", resend_api_key="re_test", email_from="Guard AI <me@gmail.com>")
    asyncio.run(mail.send_email("stu@x.io", MSG, reply_to="prof@x.io"))
    url, headers, payload = capture[0]
    assert url == mail.BREVO_URL and headers["api-key"] == "xkeysib-test"  # Brevo wins when both are set
    assert payload["sender"] == {"name": "Guard AI", "email": "me@gmail.com"}
    assert payload["to"] == [{"email": "stu@x.io"}] and payload["replyTo"] == {"email": "prof@x.io"}
    assert payload["htmlContent"] == MSG.html and payload["textContent"] == MSG.text


def test_resend_request(monkeypatch, capture):
    _with(monkeypatch, brevo_api_key="", resend_api_key="re_test", email_from="Guard AI <invites@guard.test>")
    asyncio.run(mail.send_email("stu@x.io", MSG))
    url, headers, payload = capture[0]
    assert url == mail.RESEND_URL and headers["Authorization"] == "Bearer re_test"
    assert payload["from"] == "Guard AI <invites@guard.test>" and payload["to"] == ["stu@x.io"]


def test_rejection_and_missing_provider(monkeypatch):
    async def refuse(url, headers, payload):
        return httpx.Response(401, json={"message": "Key not found"})

    monkeypatch.setattr(mail, "_post", refuse)
    _with(monkeypatch, brevo_api_key="bad", email_from="me@gmail.com")
    with pytest.raises(mail.EmailError, match="brevo rejected"):
        asyncio.run(mail.send_email("stu@x.io", MSG))
    _with(monkeypatch, brevo_api_key="", resend_api_key="")
    with pytest.raises(mail.EmailError, match="No email provider"):
        asyncio.run(mail.send_email("stu@x.io", MSG))
