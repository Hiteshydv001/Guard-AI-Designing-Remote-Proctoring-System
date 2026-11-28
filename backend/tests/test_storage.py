"""Storage keys can never escape their bucket or the local upload directory."""

import asyncio
import os

import pytest
from conftest import as_user

from app.services import storage


def test_safe_key_strips_traversal_and_odd_characters():
    assert storage.safe_key("exam/attempt/2026-phone_detected.jpg") == "exam/attempt/2026-phone_detected.jpg"
    assert storage.safe_key("../../etc/passwd") == "etc/passwd"
    assert storage.safe_key("a/../../b\..\c d?.jpg") == "a/b/c_d_.jpg"
    with pytest.raises(ValueError):
        storage.safe_key("../..")


def test_local_snapshot_stays_inside_upload_dir():
    key = asyncio.run(storage.save_snapshot("x/../../../outside.jpg", b"\xff\xd8data"))
    root = os.path.realpath(storage.settings.local_upload_dir)
    assert key == "x/outside.jpg"
    assert os.path.realpath(os.path.join(root, key)).startswith(root)


def test_browser_violation_type_must_be_an_identifier(client):
    prof, stu = as_user("user_vp"), as_user("user_vs")
    client.put("/api/me", json={"role": "proctor"}, headers=prof)
    client.put("/api/me", json={"role": "candidate", "name": "V"}, headers=stu)
    exam = client.post(
        "/api/exams",
        headers=prof,
        json={
            "title": "T",
            "settings": {"verify_identity": False},
            "questions": [{"prompt": "q", "options": ["a", "b"], "correct": [0]}],
        },
    ).json()
    client.post(f"/api/exams/{exam['id']}/status", json={"status": "published"}, headers=prof)
    aid = client.post("/api/exams/join", json={"access_code": exam["access_code"]}, headers=stu).json()["attempt_id"]
    bad = client.post(f"/api/attempts/{aid}/violations", json={"type": "../../x", "message": "m"}, headers=stu)
    assert bad.status_code == 422
    ok = client.post(f"/api/attempts/{aid}/violations", json={"type": "tab_switch", "message": "m"}, headers=stu)
    assert ok.status_code == 201
