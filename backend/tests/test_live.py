"""Live video signaling: request -> offer -> answer -> hang up, with ownership, reconnects and timeouts."""

import pytest
from conftest import as_user

from app.services import live

PROF, OTHER = as_user("user_lp"), as_user("user_lp2")
STU, STU2 = as_user("user_ls"), as_user("user_ls2")
OFFER = "v=0\r\no=- 1 2 IN IP4 127.0.0.1\r\ns=offer\r\n"
ANSWER = "v=0\r\no=- 3 4 IN IP4 127.0.0.1\r\ns=answer\r\n"


@pytest.fixture
def attempt(client):
    for h, role in ((PROF, "proctor"), (OTHER, "proctor"), (STU, "candidate"), (STU2, "candidate")):
        client.put("/api/me", json={"role": role, "name": "N"}, headers=h)
    exam = client.post(
        "/api/exams",
        headers=PROF,
        json={
            "title": "Live",
            "settings": {"verify_identity": False},
            "questions": [{"prompt": "q", "options": ["a", "b"], "correct": [0]}],
        },
    ).json()
    client.post(f"/api/exams/{exam['id']}/status", json={"status": "published"}, headers=PROF)
    return client.post("/api/exams/join", json={"access_code": exam["access_code"]}, headers=STU).json()["attempt_id"]


def pulse(client, aid):
    return client.post(f"/api/attempts/{aid}/heartbeat", json={}, headers=STU).json()


def test_full_handshake_and_hang_up(client, attempt):
    aid = attempt
    assert pulse(client, aid)["live"] is None

    started = client.post(f"/api/attempts/{aid}/live", headers=PROF).json()
    sid = started["session_id"]
    assert any("stun:" in u for s in started["ice_servers"] for u in s["urls"])
    req = pulse(client, aid)["live"]
    assert req["session_id"] == sid and req["ice_servers"]

    assert client.get(f"/api/attempts/{aid}/live?session_id={sid}", headers=PROF).json() == {
        "active": True,
        "offer": None,
        "version": 0,
        "answered": False,
    }
    assert client.post(f"/api/attempts/{aid}/live/offer", json={"session_id": sid, "sdp": OFFER}, headers=STU).status_code == 204
    polled = client.get(f"/api/attempts/{aid}/live?session_id={sid}", headers=PROF).json()
    assert polled["offer"] == OFFER and polled["version"] == 1

    body = {"session_id": sid, "version": 1, "sdp": ANSWER}
    assert client.post(f"/api/attempts/{aid}/live/answer", json=body, headers=PROF).status_code == 204
    got = client.get(f"/api/attempts/{aid}/live/answer?session_id={sid}", headers=STU).json()
    assert got == {"active": True, "answer": ANSWER, "version": 1}

    assert client.delete(f"/api/attempts/{aid}/live?session_id={sid}", headers=PROF).status_code == 204
    assert pulse(client, aid)["live"] is None
    assert client.get(f"/api/attempts/{aid}/live/answer?session_id={sid}", headers=STU).json()["active"] is False


def test_only_the_exam_owner_and_the_candidate_can_signal(client, attempt):
    aid = attempt
    assert client.post(f"/api/attempts/{aid}/live", headers=OTHER).status_code == 404
    sid = client.post(f"/api/attempts/{aid}/live", headers=PROF).json()["session_id"]
    assert client.get(f"/api/attempts/{aid}/live?session_id={sid}", headers=OTHER).status_code == 404
    assert client.post(f"/api/attempts/{aid}/live/offer", json={"session_id": sid, "sdp": OFFER}, headers=STU2).status_code == 404
    assert client.get(f"/api/attempts/{aid}/live/answer?session_id={sid}", headers=STU2).status_code == 404
    assert client.post(f"/api/attempts/{aid}/live", headers=STU).status_code == 403  # candidates can't start a watch


def test_reconnect_needs_a_fresh_answer_and_stale_answers_are_refused(client, attempt):
    aid = attempt
    sid = client.post(f"/api/attempts/{aid}/live", headers=PROF).json()["session_id"]
    client.post(f"/api/attempts/{aid}/live/offer", json={"session_id": sid, "sdp": OFFER}, headers=STU)
    client.post(f"/api/attempts/{aid}/live/answer", json={"session_id": sid, "version": 1, "sdp": ANSWER}, headers=PROF)
    # candidate's connection dropped: it re-offers, the old answer is cleared
    client.post(f"/api/attempts/{aid}/live/offer", json={"session_id": sid, "sdp": OFFER + "a=x\r\n"}, headers=STU)
    assert client.get(f"/api/attempts/{aid}/live/answer?session_id={sid}", headers=STU).json() == {
        "active": True,
        "answer": None,
        "version": 2,
    }
    stale = {"session_id": sid, "version": 1, "sdp": ANSWER}
    assert client.post(f"/api/attempts/{aid}/live/answer", json=stale, headers=PROF).status_code == 409


def test_new_watch_replaces_old_and_wrong_session_is_refused(client, attempt):
    aid = attempt
    old = client.post(f"/api/attempts/{aid}/live", headers=PROF).json()["session_id"]
    new = client.post(f"/api/attempts/{aid}/live", headers=PROF).json()["session_id"]
    assert old != new and pulse(client, aid)["live"]["session_id"] == new
    assert client.post(f"/api/attempts/{aid}/live/offer", json={"session_id": old, "sdp": OFFER}, headers=STU).status_code == 409
    assert client.get(f"/api/attempts/{aid}/live?session_id={old}", headers=PROF).json()["active"] is False


def test_session_ends_when_the_viewer_disappears(client, attempt, monkeypatch):
    aid = attempt
    sid = client.post(f"/api/attempts/{aid}/live", headers=PROF).json()["session_id"]
    clock = [live.time.monotonic()]
    monkeypatch.setattr(live.time, "monotonic", lambda: clock[0])
    clock[0] += live.PROCTOR_TIMEOUT_S + 1  # proctor closed the tab without saying goodbye
    assert pulse(client, aid)["live"] is None
    assert client.get(f"/api/attempts/{aid}/live?session_id={sid}", headers=PROF).json()["active"] is False


def test_finished_attempt_cannot_be_watched(client, attempt):
    aid = attempt
    sid = client.post(f"/api/attempts/{aid}/live", headers=PROF).json()["session_id"]
    client.post(f"/api/attempts/{aid}/submit", json={"answers": {}, "final_image": None}, headers=STU)
    assert client.get(f"/api/attempts/{aid}/live?session_id={sid}", headers=PROF).json() == {
        "active": False,
        "reason": "submitted",
    }
    assert client.post(f"/api/attempts/{aid}/live", headers=PROF).status_code == 409
