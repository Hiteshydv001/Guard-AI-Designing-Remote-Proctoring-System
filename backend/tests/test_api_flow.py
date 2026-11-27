"""End-to-end API flow: proctor builds a class and an exam, students take it, proctor reviews."""

from conftest import TINY_JPEG, as_user

PROF = as_user("user_prof")
OTHER_PROF = as_user("user_prof2")
SELF_SIGNED = as_user("user_self")


def test_full_flow(client, clerk):
    c = client
    assert c.get("/health").json()["status"] == "ok"
    assert c.get("/api/me").status_code == 401

    # --- roles
    assert c.put("/api/me", json={"role": "proctor", "name": "Prof X"}, headers=PROF).status_code == 200
    assert c.put("/api/me", json={"role": "proctor", "name": "Prof Y"}, headers=OTHER_PROF).status_code == 200
    assert (
        c.put("/api/me", json={"role": "candidate", "name": "Sam Self", "email": "sam@x.io"}, headers=SELF_SIGNED).status_code
        == 200
    )

    # --- batches + students
    batch = c.post("/api/batches", json={"name": "CS-A"}, headers=PROF).json()
    created = c.post(
        "/api/students", json={"name": "Alice Doe", "email": "Alice@X.io", "batch_ids": [batch["id"]]}, headers=PROF
    ).json()
    assert created["status"] == "created" and len(created["password"]) >= 12
    alice = as_user(created["id"])
    assert clerk.users[created["id"]].public_metadata["proctor_id"] == "user_prof"

    linked = c.post(
        "/api/students", json={"name": "ignored", "email": "sam@x.io", "batch_ids": [batch["id"]]}, headers=PROF
    ).json()
    assert linked["status"] == "linked"

    dup = c.post("/api/students", json={"name": "Dup", "email": "alice@x.io"}, headers=PROF).json()
    assert dup["status"] == "linked"  # existing profile, no second Clerk account

    imported = c.post(
        "/api/students/import",
        json={
            "rows": [
                {"name": "Bob B", "email": "bob@x.io"},
                {"name": "Bob B", "email": "bob@x.io"},
                {"name": "Cat C", "email": "cat@x.io"},
            ],
            "batch_ids": [batch["id"]],
        },
        headers=PROF,
    ).json()
    assert imported["created"] == 2 and imported["failed"] == 1
    bob_id = next(r["id"] for r in imported["results"] if r.get("email") == "bob@x.io" and r["status"] == "created")
    bob = as_user(bob_id)

    invite = c.post(
        "/api/students", json={"name": "Dan D", "email": "dan@x.io", "mode": "invite", "batch_ids": [batch["id"]]}, headers=PROF
    ).json()
    assert invite["status"] == "invited"
    assert [i["email"] for i in c.get("/api/invites", headers=PROF).json()] == ["dan@x.io"]
    dan_id = clerk.sign_up("dan@x.io", "Dan D")
    me = c.get("/api/me", headers=as_user(dan_id)).json()
    assert me["role"] == "candidate"  # invited student is onboarded automatically
    assert c.get("/api/invites", headers=PROF).json() == []

    roster = c.get("/api/students", headers=PROF).json()
    assert {s["email"] for s in roster} == {"alice@x.io", "sam@x.io", "bob@x.io", "cat@x.io", "dan@x.io"}
    assert c.get("/api/students", headers=OTHER_PROF).json() == []
    assert c.get(f"/api/students/{created['id']}", headers=OTHER_PROF).status_code == 404
    assert c.put("/api/me", json={"role": "proctor"}, headers=alice).status_code == 403  # managed students stay candidates

    pw = c.post(f"/api/students/{created['id']}/reset-password", headers=PROF).json()["password"]
    assert clerk.passwords[created["id"]] == pw
    assert c.post("/api/students/user_self/reset-password", headers=PROF).status_code == 403  # not created by PROF
    assert (
        c.post(f"/api/students/{created['id']}/photo", json={"image": TINY_JPEG}, headers=PROF).status_code == 503
    )  # models disabled in tests

    assert [b["member_count"] for b in c.get("/api/batches", headers=PROF).json()] == [5]

    # --- exam assigned to the batch, restricted to it
    exam = c.post(
        "/api/exams",
        headers=PROF,
        json={
            "title": "Algorithms",
            "duration_minutes": 20,
            "batch_ids": [batch["id"]],
            "settings": {
                "max_violations": 3,
                "require_assignment": True,
                "shuffle_options": True,
                "show_results": True,
                "reveal_answers": True,
                "pass_percentage": 50,
                "verify_identity": False,  # these students have no reference photos (see test_frames)
            },
            "questions": [
                {"type": "single", "prompt": "O(log n)?", "options": ["linear", "binary search"], "correct": [1], "points": 2},
                {"type": "multiple", "prompt": "Stable sorts", "options": ["merge", "quick", "insertion"], "correct": [0, 2]},
                {"type": "text", "prompt": "Explain DP", "points": 5, "explanation": "Overlapping subproblems"},
            ],
        },
    ).json()
    qids = [q["id"] for q in exam["questions"]]
    assert exam["batch_ids"] == [batch["id"]]
    assert c.post(f"/api/exams/{exam['id']}/status", json={"status": "published"}, headers=PROF).status_code == 200

    stranger = as_user("user_stranger")
    c.put("/api/me", json={"role": "candidate"}, headers=stranger)
    assert c.post("/api/exams/join", json={"access_code": exam["access_code"]}, headers=stranger).status_code == 403

    mine = c.get("/api/my/exams", headers=alice).json()
    assert [e["title"] for e in mine] == ["Algorithms"] and "access_code" not in mine[0]
    a_id = c.post(f"/api/exams/{exam['id']}/start", headers=alice).json()["attempt_id"]
    assert c.post(f"/api/exams/{exam['id']}/start", headers=alice).json() == {"attempt_id": a_id, "resumed": True}

    detail = c.get(f"/api/attempts/{a_id}", headers=alice).json()
    assert detail["identity_required"] is False and detail["identity_ok"] is True
    for q in detail["questions"]:
        assert "correct" not in q
        assert {o["id"] for o in q["options"]} == set(range(len(q["options"])))
    assert c.get(f"/api/attempts/{a_id}", headers=bob).status_code == 404

    # identity: no reference photo -> skipped
    assert c.post(f"/api/attempts/{a_id}/verify", json={"images": [TINY_JPEG]}, headers=alice).json()["status"] == "skipped"

    c.put(f"/api/attempts/{a_id}/answers", json={"answers": {qids[0]: [1], qids[1]: [2, 0]}}, headers=alice)
    hb = c.post(f"/api/attempts/{a_id}/heartbeat", json={}, headers=alice).json()
    assert hb["status"] == "in_progress" and hb["remaining_seconds"] > 1000

    r = c.post(
        f"/api/attempts/{a_id}/violations", json={"type": "tab_switch", "severity": "medium", "message": "Tab"}, headers=alice
    )
    assert r.status_code == 201 and r.json()["violation_count"] == 1

    assert c.post(f"/api/attempts/{a_id}/warn", json={"message": "Eyes on screen"}, headers=PROF).status_code == 200
    assert c.post(f"/api/attempts/{a_id}/warn", json={"message": "x"}, headers=OTHER_PROF).status_code == 404
    assert [m["body"] for m in c.post(f"/api/attempts/{a_id}/heartbeat", json={}, headers=alice).json()["messages"]] == [
        "Eyes on screen"
    ]

    live = c.get(f"/api/exams/{exam['id']}/attempts", headers=PROF).json()["attempts"]
    assert live[0]["candidate_name"] == "Alice Doe" and live[0]["status"] == "in_progress"

    res = c.post(f"/api/attempts/{a_id}/submit", json={"answers": {qids[2]: "memoisation"}}, headers=alice).json()
    assert res["status"] == "submitted" and res["score"] == 3 and res["max_score"] == 8 and res["passed"] is False

    graded = c.post(f"/api/attempts/{a_id}/grade", json={"scores": {qids[2]: 4}}, headers=PROF).json()
    assert graded["score"] == 7 and graded["passed"] is True

    result = c.get(f"/api/attempts/{a_id}/result", headers=alice).json()
    assert [b["earned"] for b in result["breakdown"]] == [2, 1, 4]
    assert result["breakdown"][2]["explanation"] == "Overlapping subproblems"

    # --- Bob is auto-terminated after 3 violations
    b_id = c.post(f"/api/exams/{exam['id']}/start", headers=bob).json()["attempt_id"]
    for _ in range(3):
        last = c.post(f"/api/attempts/{b_id}/violations", json={"type": "fullscreen_exit"}, headers=bob).json()
    assert last["status"] == "terminated"
    assert c.post(f"/api/exams/{exam['id']}/start", headers=bob).status_code == 409

    # --- review, analytics, export
    review = c.get(f"/api/attempts/{a_id}/review", headers=PROF).json()
    assert review["violations"][0]["source"] == "browser"

    stats = c.get(f"/api/exams/{exam['id']}/analytics", headers=PROF).json()
    assert stats["summary"]["attempts"] == 2 and stats["summary"]["terminated"] == 1
    assert stats["questions"][0]["correct_rate"] == 50.0
    assert stats["violations_by_type"][0] == {"type": "fullscreen_exit", "count": 3}

    csv_res = c.get(f"/api/exams/{exam['id']}/results.csv", headers=PROF)
    assert csv_res.status_code == 200 and "Alice Doe,alice@x.io,submitted,7.0,8.0,87.5,yes" in csv_res.text

    ov = c.get("/api/proctor/overview", headers=PROF).json()
    assert ov["student_count"] == 5 and ov["completed_attempts"] == 2 and len(ov["activity"]) == 14

    # --- editing rules, duplicate, delete
    edit = {"title": "Algorithms v2", "duration_minutes": 20, "questions": exam["questions"][:1], "batch_ids": [batch["id"]]}
    assert c.put(f"/api/exams/{exam['id']}", json=edit, headers=PROF).status_code == 409
    copy = c.post(f"/api/exams/{exam['id']}/duplicate", headers=PROF).json()
    assert copy["status"] == "draft" and len(copy["questions"]) == 3 and copy["access_code"] != exam["access_code"]

    assert c.delete(f"/api/students/{bob_id}", headers=PROF).status_code == 204
    assert bob_id not in clerk.users
    assert c.get("/api/me", headers=bob).status_code == 403  # deactivated

    assert c.delete(f"/api/exams/{exam['id']}", headers=PROF).status_code == 204
    assert c.delete(f"/api/batches/{batch['id']}", headers=PROF).status_code == 204
    assert [e["id"] for e in c.get("/api/exams", headers=PROF).json()] == [copy["id"]]
