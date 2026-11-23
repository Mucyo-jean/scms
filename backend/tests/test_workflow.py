from conftest import (
    admin_headers,
    approve_all,
    login,
    officer_headers,
    register,
    submit_request,
)


def _new_request(client):
    headers, user = register(client)
    response = submit_request(client, headers)
    assert response.status_code == 201, response.text
    return headers, user, response.json()


def test_submission_creates_tasks_payment_and_reference(client):
    headers, user, request = _new_request(client)

    assert request["ref"].startswith("CLR-")
    assert len(request["tasks"]) == 4
    assert all(task["status"] == "Pending" for task in request["tasks"])
    assert [task["departmentId"] for task in request["tasks"]] == [
        "dep_lib",
        "dep_fin",
        "dep_aca",
        "dep_ict",
    ]
    assert request["payment"]["amount"] == 10000
    assert request["payment"]["status"] == "Unpaid"
    assert request["status"] == "In Progress"

    # The student and every department officer are notified.
    student_bootstrap = client.get("/api/bootstrap", headers=headers).json()
    assert any("submitted" in item["title"].lower() for item in student_bootstrap["notifications"])
    ict_bootstrap = client.get("/api/bootstrap", headers=officer_headers(client, "ict")).json()
    assert any(item["link"] == f"/officer/requests/{request['id']}" for item in ict_bootstrap["notifications"])

    # Audit trail records the submission.
    admin_bootstrap = client.get("/api/bootstrap", headers=admin_headers(client)).json()
    assert any(
        entry["action"] == "REQUEST_SUBMITTED" and entry["entityId"] == request["id"]
        for entry in admin_bootstrap["audit"]
    )


def test_student_cannot_have_two_open_requests(client):
    headers, _, request = _new_request(client)
    duplicate = submit_request(client, headers)
    assert duplicate.status_code == 409
    assert request["ref"] in duplicate.json()["detail"]


def test_submission_validation(client):
    headers, _ = register(client)
    invalid_reason = submit_request(client, headers, reason="Holiday")
    assert invalid_reason.status_code == 400

    invalid_phone = submit_request(client, headers, phone="12")
    assert invalid_phone.status_code == 400

    missing_field = submit_request(client, headers, programme="")
    assert missing_field.status_code == 400


def test_officers_only_see_and_decide_their_department(client):
    headers, _, request = _new_request(client)

    officer_view = client.get(
        f"/api/requests/{request['id']}", headers=officer_headers(client, "library")
    )
    assert officer_view.status_code == 200

    student_view = client.get(
        f"/api/requests/{request['id']}", headers=login(client, "alice@mclears.ac")
    )
    assert student_view.status_code == 403

    wrong_department = client.post(
        f"/api/requests/{request['id']}/decisions",
        headers=officer_headers(client, "library"),
        json={"decision": "Rejected", "comment": "Library issue"},
    )
    # Library is allowed to decide; this verifies task selection is scoped.
    assert wrong_department.status_code == 200
    assert [
        task["status"] for task in wrong_department.json()["tasks"] if task["departmentId"] == "dep_fin"
    ] == ["Pending"]


def test_finance_cannot_approve_before_payment(client):
    _, _, request = _new_request(client)
    response = client.post(
        f"/api/requests/{request['id']}/decisions",
        headers=officer_headers(client, "finance"),
        json={"decision": "Approved", "comment": ""},
    )
    assert response.status_code == 400
    assert "fee must be paid" in response.json()["detail"]

    paid = client.post(
        f"/api/requests/{request['id']}/payment",
        headers=login(client, "alice@mclears.ac"),
        json={"method": "Card", "details": {}},
    )
    assert paid.status_code == 403

    paid = client.post(
        f"/api/requests/{request['id']}/payment",
        headers=login(client, "claudine@mclears.ac"),
        json={"method": "Card", "details": {}},
    )
    assert paid.status_code == 403


def test_payment_decline_and_success(client):
    headers, _, request = _new_request(client)

    declined = client.post(
        f"/api/requests/{request['id']}/payment",
        headers=headers,
        json={"method": "Mobile Money", "details": {"phone": "0788 000 000"}},
    )
    assert declined.status_code == 402
    assert "declined" in declined.json()["detail"]

    paid = client.post(
        f"/api/requests/{request['id']}/payment",
        headers=headers,
        json={"method": "Mobile Money", "details": {"phone": "0788 111 222"}},
    )
    assert paid.status_code == 200
    assert paid.json()["status"] == "Paid"
    assert paid.json()["txRef"].startswith("SIM-")

    again = client.post(
        f"/api/requests/{request['id']}/payment",
        headers=headers,
        json={"method": "Card", "details": {}},
    )
    assert again.status_code == 409

    admin_audit = client.get("/api/bootstrap", headers=admin_headers(client)).json()["audit"]
    assert any(entry["action"] == "PAYMENT_FAILED" for entry in admin_audit)
    assert any(entry["action"] == "PAYMENT_COMPLETED" for entry in admin_audit)


def test_rejection_reason_required_and_resubmission_flow(client):
    headers, _, request = _new_request(client)

    no_reason = client.post(
        f"/api/requests/{request['id']}/decisions",
        headers=officer_headers(client, "ict"),
        json={"decision": "Rejected", "comment": "   "},
    )
    assert no_reason.status_code == 400

    rejected = client.post(
        f"/api/requests/{request['id']}/decisions",
        headers=officer_headers(client, "ict"),
        json={"decision": "Rejected", "comment": "Return the laptop charger."},
    )
    assert rejected.status_code == 200
    assert rejected.json()["status"] == "Requires Attention"

    decided_again = client.post(
        f"/api/requests/{request['id']}/decisions",
        headers=officer_headers(client, "ict"),
        json={"decision": "Approved", "comment": ""},
    )
    assert decided_again.status_code == 400

    short_note = client.post(
        f"/api/requests/{request['id']}/resubmit",
        headers=headers,
        json={"departmentId": "dep_ict", "note": "ok"},
    )
    assert short_note.status_code == 400

    wrong_department = client.post(
        f"/api/requests/{request['id']}/resubmit",
        headers=headers,
        json={"departmentId": "dep_lib", "note": "This was not rejected."},
    )
    assert wrong_department.status_code == 400

    resubmitted = client.post(
        f"/api/requests/{request['id']}/resubmit",
        headers=headers,
        json={"departmentId": "dep_ict", "note": "Charger returned to ICT on Monday."},
    )
    assert resubmitted.status_code == 200
    assert resubmitted.json()["status"] == "In Progress"
    ict_task = next(task for task in resubmitted.json()["tasks"] if task["departmentId"] == "dep_ict")
    assert ict_task["status"] == "Pending"
    assert ict_task["history"][-1]["status"] == "Resubmitted"
    assert ict_task["history"][-1]["note"] == "Charger returned to ICT on Monday."

    admin_audit = client.get("/api/bootstrap", headers=admin_headers(client)).json()["audit"]
    assert any(entry["action"] == "TASK_REJECTED" for entry in admin_audit)
    assert any(entry["action"] == "TASK_RESUBMITTED" for entry in admin_audit)


def test_all_approvals_issue_certificate_and_verify(client):
    headers, _, request = _new_request(client)
    approve_all(client, request["id"], headers=headers)

    final = client.get(f"/api/requests/{request['id']}", headers=headers)
    assert final.status_code == 200
    body = final.json()
    assert body["status"] == "Cleared"
    assert body["certificate"]["number"].startswith("MCL-CERT-")
    assert body["certificate"]["code"]

    verified = client.get(f"/api/verify/{body['certificate']['code']}")
    assert verified.status_code == 200
    assert verified.json()["studentName"] == "Test Student"
    assert verified.json()["studentNumber"] == "2099/BSE/001"

    by_number = client.get(f"/api/verify/{body['certificate']['number'].lower()}")
    assert by_number.status_code == 200

    assert client.get("/api/verify/NOPE-0000").status_code == 404

    admin_audit = client.get("/api/bootstrap", headers=admin_headers(client)).json()["audit"]
    assert any(entry["action"] == "CLEARANCE_COMPLETED" for entry in admin_audit)

    # A cleared student can start a new request.
    new_request = submit_request(client, headers, reason="Transfer")
    assert new_request.status_code == 201
    assert new_request.json()["ref"] != body["ref"]


def test_role_boundaries(client):
    headers, _, request = _new_request(client)
    student_decision = client.post(
        f"/api/requests/{request['id']}/decisions",
        headers=headers,
        json={"decision": "Approved", "comment": ""},
    )
    assert student_decision.status_code == 403

    admin_decision = client.post(
        f"/api/requests/{request['id']}/decisions",
        headers=admin_headers(client),
        json={"decision": "Approved", "comment": ""},
    )
    assert admin_decision.status_code == 403

    officer_submit = submit_request(client, officer_headers(client, "library"))
    assert officer_submit.status_code == 403

    user_list = client.get("/api/users", headers=headers)
    assert user_list.status_code == 403

    audit = client.get("/api/audit", headers=headers)
    assert audit.status_code == 403


def test_notifications_can_be_marked_read(client):
    headers, _, request = _new_request(client)
    notifications = client.get("/api/notifications", headers=headers).json()
    assert notifications
    assert all(not item["read"] for item in notifications)

    marked = client.post(f"/api/notifications/{notifications[0]['id']}/read", headers=headers)
    assert marked.status_code == 200
    refreshed = client.get("/api/notifications", headers=headers).json()
    target = next(item for item in refreshed if item["id"] == notifications[0]["id"])
    assert target["read"] is True

    all_read = client.post("/api/notifications/read-all", headers=headers)
    assert all_read.status_code == 200
    assert all(item["read"] for item in client.get("/api/notifications", headers=headers).json())

    other = login(client, "alice@mclears.ac")
    not_found = client.post(f"/api/notifications/{notifications[0]['id']}/read", headers=other)
    assert not_found.status_code == 404
