from conftest import admin_headers, login, register, submit_request


def _staff_payload(**overrides):
    payload = {
        "role": "officer",
        "name": "New Officer",
        "email": "new.officer@mclears.ac",
        "departmentId": "dep_lib",
        "password": "Officer@123",
    }
    payload.update(overrides)
    return payload


def test_only_admins_can_manage_users_and_departments(client):
    student_headers, _ = register(client)
    assert client.post("/api/users", headers=student_headers, json=_staff_payload()).status_code == 403
    assert (
        client.post(
            "/api/departments",
            headers=student_headers,
            json={"code": "HST", "name": "Hostel"},
        ).status_code
        == 403
    )


def test_admin_creates_officer_who_can_review(client):
    admin = admin_headers(client)
    created = client.post("/api/users", headers=admin, json=_staff_payload())
    assert created.status_code == 201, created.text
    officer = created.json()
    assert officer["role"] == "officer"
    assert officer["departmentId"] == "dep_lib"

    officer_headers = login(client, "new.officer@mclears.ac", "Officer@123")
    queue = client.get("/api/bootstrap", headers=officer_headers)
    assert queue.status_code == 200
    assert queue.json()["me"]["id"] == officer["id"]

    audit = client.get("/api/audit", headers=admin).json()
    assert any(entry["action"] == "USER_CREATED" for entry in audit)


def test_admin_user_validation(client):
    admin = admin_headers(client)
    assert (
        client.post("/api/users", headers=admin, json=_staff_payload(email="student@mclears.ac")).status_code
        == 409
    )
    assert (
        client.post("/api/users", headers=admin, json=_staff_payload(departmentId=None)).status_code
        == 400
    )
    assert (
        client.post(
            "/api/users",
            headers=admin,
            json=_staff_payload(email="weak@mclears.ac", password="weak"),
        ).status_code
        == 400
    )
    invalid_role = client.post(
        "/api/users",
        headers=admin,
        json=_staff_payload(email="other@mclears.ac", role="student"),
    )
    assert invalid_role.status_code == 400


def test_admin_can_reset_password_move_and_deactivate_staff(client):
    admin = admin_headers(client)
    officer = client.post("/api/users", headers=admin, json=_staff_payload()).json()

    reset = client.patch(f"/api/users/{officer['id']}", headers=admin, json={"password": "Reset@1234"})
    assert reset.status_code == 200
    assert (
        client.post(
            "/api/auth/login",
            json={"email": "new.officer@mclears.ac", "password": "Officer@123"},
        ).status_code
        == 401
    )
    assert (
        client.post(
            "/api/auth/login",
            json={"email": "new.officer@mclears.ac", "password": "Reset@1234"},
        ).status_code
        == 200
    )

    moved = client.patch(
        f"/api/users/{officer['id']}", headers=admin, json={"departmentId": "dep_ict"}
    )
    assert moved.status_code == 200
    assert moved.json()["departmentId"] == "dep_ict"

    deactivated = client.patch(f"/api/users/{officer['id']}", headers=admin, json={"active": False})
    assert deactivated.status_code == 200
    assert deactivated.json()["active"] is False

    denied = client.post(
        "/api/auth/login",
        json={"email": "new.officer@mclears.ac", "password": "Reset@1234"},
    )
    assert denied.status_code == 403

    own_account = client.get("/api/auth/me", headers=admin).json()
    self_deactivate = client.patch(
        f"/api/users/{own_account['id']}", headers=admin, json={"active": False}
    )
    assert self_deactivate.status_code == 400


def test_department_crud_and_effect_on_new_requests(client):
    admin = admin_headers(client)
    created = client.post(
        "/api/departments",
        headers=admin,
        json={
            "code": "HST",
            "name": "Hostel",
            "description": "Hostel property and keys.",
            "requiresPayment": True,
            "fee": 2500,
        },
    )
    assert created.status_code == 201, created.text
    department = created.json()
    assert department["fee"] == 2500

    duplicate = client.post(
        "/api/departments", headers=admin, json={"code": "HST", "name": "Duplicate"}
    )
    assert duplicate.status_code == 409

    bad_code = client.post(
        "/api/departments", headers=admin, json={"code": "H", "name": "Too short"}
    )
    assert bad_code.status_code == 400

    updated = client.patch(
        f"/api/departments/{department['id']}",
        headers=admin,
        json={"code": "HST", "name": "Student Hostel", "requiresPayment": False, "fee": 9999},
    )
    assert updated.status_code == 200
    assert updated.json()["name"] == "Student Hostel"
    assert updated.json()["fee"] == 0

    student_headers, _ = register(client)
    submitted = submit_request(client, student_headers)
    assert submitted.status_code == 201
    assert len(submitted.json()["tasks"]) == 5
    assert submitted.json()["payment"]["amount"] == 10000

    deactivated = client.patch(
        f"/api/departments/{department['id']}",
        headers=admin,
        json={"code": "HST", "name": "Student Hostel", "active": False},
    )
    assert deactivated.status_code == 200
    assert deactivated.json()["active"] is False

    # The deactivated department is excluded from new requests, so its task
    # cannot be reviewed by an officer of that department.
    other_headers, _ = register(
        client, email="second.student@mclears.ac", student_number="2099/BSE/002"
    )
    second = submit_request(client, other_headers)
    assert second.status_code == 201
    assert len(second.json()["tasks"]) == 4


def test_officer_without_department_on_request_cannot_decide(client):
    admin = admin_headers(client)
    created = client.post(
        "/api/departments",
        headers=admin,
        json={"code": "HST", "name": "Hostel"},
    ).json()
    client.post(
        "/api/users",
        headers=admin,
        json=_staff_payload(
            email="hostel@mclears.ac", name="Hostel Officer", departmentId=created["id"]
        ),
    )
    client.patch(
        f"/api/departments/{created['id']}",
        headers=admin,
        json={"code": "HST", "name": "Hostel", "active": False},
    )
    student_headers, _ = register(client, email="third.student@mclears.ac", student_number="2099/BSE/003")
    submitted = submit_request(client, student_headers)
    assert submitted.status_code == 201

    hostel_headers = login(client, "hostel@mclears.ac", "Officer@123")
    denied = client.post(
        f"/api/requests/{submitted.json()['id']}/decisions",
        headers=hostel_headers,
        json={"decision": "Approved", "comment": ""},
    )
    assert denied.status_code == 403
