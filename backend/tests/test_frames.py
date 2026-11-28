"""The /frames proctoring loop with the vision models stubbed out (fast, no weights needed)."""

import numpy as np
import pytest
from conftest import TINY_JPEG, as_user

from app.ml.detector import DetectedObject, FrameAnalysis
from app.ml.runtime import runtime


@pytest.fixture
def fake_vision(monkeypatch):
    script: list[FrameAnalysis] = []

    async def analyze(data, detect_objects=True, want_embedding=False):
        a = script.pop(0) if script else FrameAnalysis(width=64, height=48, faces=1, yaw=0, pitch=0, brightness=120)
        if want_embedding and a.faces and a.embedding is None:
            a.embedding = [1.0] + [0.0] * 127
        return np.full((48, 64, 3), 128, np.uint8), a

    monkeypatch.setattr(runtime, "ready", True)
    monkeypatch.setattr(runtime, "analyze", analyze)
    monkeypatch.setattr("app.ml.runtime.MIN_FRAME_GAP_S", 0.0)
    monkeypatch.setattr("app.api.candidate.VERIFY_MIN_GAP_S", 0.0)
    return script


def test_frames_raise_ai_violations_with_evidence(client, fake_vision):
    prof, stu = as_user("user_fp"), as_user("user_fs")
    client.put("/api/me", json={"role": "proctor", "name": "P"}, headers=prof)
    client.put("/api/me", json={"role": "candidate", "name": "Stu"}, headers=stu)
    exam = client.post(
        "/api/exams",
        headers=prof,
        json={
            "title": "Vision",
            "settings": {"verify_identity": False},
            "questions": [{"prompt": "q", "options": ["a", "b"], "correct": [0]}],
        },
    ).json()
    client.post(f"/api/exams/{exam['id']}/status", json={"status": "published"}, headers=prof)
    aid = client.post("/api/exams/join", json={"access_code": exam["access_code"]}, headers=stu).json()["attempt_id"]

    fake_vision += [FrameAnalysis(width=64, height=48, faces=1, yaw=y, pitch=0, brightness=120) for y in (1, -1, 0)]
    cal = client.post(f"/api/attempts/{aid}/calibrate", json={"images": [TINY_JPEG] * 3}, headers=stu).json()
    assert cal["ok"] and abs(cal["calibration"]["yaw"]) < 1

    phone = DetectedObject("cell phone", 0.7, (1, 1, 20, 20))
    fake_vision += [
        FrameAnalysis(width=64, height=48, faces=1, yaw=0, pitch=0, brightness=120, objects=[phone]),
        FrameAnalysis(width=64, height=48, faces=1, yaw=0, pitch=0, brightness=120),
        FrameAnalysis(width=64, height=48, faces=1, yaw=0, pitch=0, brightness=120, objects=[phone]),
    ]
    events = []
    for _ in range(3):
        r = client.post(f"/api/attempts/{aid}/frames", json={"image": TINY_JPEG}, headers=stu).json()
        assert r["status"] == "in_progress" and r["next_frame_ms"] >= 500
        events += [e["type"] for e in r.get("events", [])]
    assert events == ["phone_detected"]

    live = client.get(f"/api/exams/{exam['id']}/attempts", headers=prof).json()["attempts"][0]
    assert live["online"] and live["last_frame"].startswith("data:image/jpeg") and live["live"]["faces"] == 1

    review = client.get(f"/api/attempts/{aid}/review", headers=prof).json()
    v = review["violations"][0]
    assert v["type"] == "phone_detected" and v["source"] == "ai" and v["snapshot_url"]
    assert client.get(v["snapshot_url"].replace("http://testserver", "")).status_code == 200

    client.post(f"/api/attempts/{aid}/terminate", json={"reason": "test"}, headers=prof)
    r = client.post(f"/api/attempts/{aid}/frames", json={"image": TINY_JPEG}, headers=stu).json()
    assert r["status"] == "terminated" and r["termination_reason"] == "test"


def test_identity_verification(client, fake_vision, monkeypatch):
    prof, stu = as_user("user_ip"), as_user("user_is")
    client.put("/api/me", json={"role": "proctor"}, headers=prof)
    client.put("/api/me", json={"role": "candidate", "name": "Ivy"}, headers=stu)
    batch = client.post("/api/batches", json={"name": "B"}, headers=prof).json()
    client.post(f"/api/batches/{batch['id']}/members", json={"student_ids": ["user_is"]}, headers=prof)  # not on roster yet
    client.post("/api/students", json={"name": "Ivy", "email": "ivy@x.io"}, headers=prof)  # creates a new Clerk user
    # put the self-registered Ivy on the roster by email
    client.put("/api/me", json={"role": "candidate", "name": "Ivy", "email": "ivy2@x.io"}, headers=stu)
    client.post("/api/students", json={"name": "Ivy", "email": "ivy2@x.io", "batch_ids": [batch["id"]]}, headers=prof)

    ref = [0.0, 1.0] + [0.0] * 126
    fake_vision.append(FrameAnalysis(width=200, height=200, faces=1, face_box=(10, 10, 150, 150), embedding=ref))
    photo = client.post("/api/students/user_is/photo", json={"image": TINY_JPEG}, headers=prof)
    assert photo.status_code == 200 and photo.json()["has_reference"]

    fake_vision.append(FrameAnalysis(width=200, height=200, faces=2))
    assert client.post("/api/students/user_is/photo", json={"image": TINY_JPEG}, headers=prof).status_code == 422

    exam = client.post(
        "/api/exams", headers=prof, json={"title": "ID", "questions": [{"prompt": "q", "options": ["a", "b"], "correct": [0]}]}
    ).json()
    client.post(f"/api/exams/{exam['id']}/status", json={"status": "published"}, headers=prof)
    aid = client.post("/api/exams/join", json={"access_code": exam["access_code"]}, headers=stu).json()["attempt_id"]
    detail = client.get(f"/api/attempts/{aid}", headers=stu).json()
    assert detail["identity_required"] and not detail["identity_ok"] and detail["questions"] == []  # locked

    impostor = [1.0] + [0.0] * 127  # orthogonal to the reference -> similarity 0
    for _ in range(3):
        fake_vision.append(FrameAnalysis(width=64, height=48, faces=1, embedding=impostor))
        r = client.post(f"/api/attempts/{aid}/verify", json={"images": [TINY_JPEG]}, headers=stu).json()
    assert r["status"] == "retry" and not r["can_continue"] and r["fails"] == 3  # never lets an impostor in
    assert client.get(f"/api/attempts/{aid}", headers=stu).json()["questions"] == []
    assert client.put(f"/api/attempts/{aid}/answers", json={"answers": {}}, headers=stu).status_code == 403
    assert client.post(f"/api/attempts/{aid}/submit", json={"answers": {}}, headers=stu).status_code == 403

    review = client.get(f"/api/attempts/{aid}/review", headers=prof).json()
    assert review["violations"][-1]["type"] == "identity_unverified"  # proctor alerted after 3 failures
    assert review["attempt"]["reference_photo_url"]

    fake_vision.append(FrameAnalysis(width=64, height=48, faces=1, embedding=ref))
    r = client.post(f"/api/attempts/{aid}/verify", json={"images": [TINY_JPEG]}, headers=stu).json()
    assert r["status"] == "verified" and r["can_continue"]
    detail = client.get(f"/api/attempts/{aid}", headers=stu).json()
    assert detail["identity_ok"] and len(detail["questions"]) == 1  # unlocked


def test_no_reference_photo_blocks_until_proctor_approves(client, fake_vision):
    prof, stu = as_user("user_np"), as_user("user_ns")
    client.put("/api/me", json={"role": "proctor"}, headers=prof)
    client.put("/api/me", json={"role": "candidate", "name": "Nia"}, headers=stu)
    exam = client.post(
        "/api/exams",
        headers=prof,
        json={"title": "Strict", "questions": [{"prompt": "q", "options": ["a", "b"], "correct": [0]}]},
    ).json()
    client.post(f"/api/exams/{exam['id']}/status", json={"status": "published"}, headers=prof)
    aid = client.post("/api/exams/join", json={"access_code": exam["access_code"]}, headers=stu).json()["attempt_id"]

    r = client.post(f"/api/attempts/{aid}/verify", json={"images": [TINY_JPEG]}, headers=stu).json()
    assert r["status"] == "no_reference" and not r["can_continue"] and "photo" in r["message"]
    assert client.get(f"/api/attempts/{aid}", headers=stu).json()["questions"] == []

    client.post(f"/api/attempts/{aid}/approve-identity", headers=prof)
    assert len(client.get(f"/api/attempts/{aid}", headers=stu).json()["questions"]) == 1


def test_submit_checks_the_final_frame(client, fake_vision):
    prof, stu = as_user("user_sp"), as_user("user_ss")
    client.put("/api/me", json={"role": "proctor"}, headers=prof)
    client.put("/api/me", json={"role": "candidate", "name": "Sam"}, headers=stu)
    exam = client.post(
        "/api/exams",
        headers=prof,
        json={
            "title": "Last",
            "settings": {"verify_identity": False},
            "questions": [{"prompt": "q", "options": ["a", "b"], "correct": [0]}],
        },
    ).json()
    client.post(f"/api/exams/{exam['id']}/status", json={"status": "published"}, headers=prof)
    aid = client.post("/api/exams/join", json={"access_code": exam["access_code"]}, headers=stu).json()["attempt_id"]

    faint = DetectedObject("cell phone", 0.4, (1, 1, 20, 20))  # one low-confidence sighting: not yet confirmed
    fake_vision.append(FrameAnalysis(width=64, height=48, faces=1, yaw=0, pitch=0, brightness=120, objects=[faint]))
    r = client.post(f"/api/attempts/{aid}/submit", json={"answers": {}, "final_image": TINY_JPEG}, headers=stu)
    assert r.status_code == 200 and r.json()["status"] == "submitted"
    v = client.get(f"/api/attempts/{aid}/review", headers=prof).json()["violations"]
    assert [x["type"] for x in v] == ["phone_detected"] and "before submitting" in v[0]["message"] and v[0]["snapshot_url"]
