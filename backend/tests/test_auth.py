from conftest import admin_headers, login, register


def test_seeded_demo_accounts_can_sign_in(client):
    for email, password, role in [
        ("student@mclears.ac", "Student@123", "student"),
        ("library@mclears.ac", "Officer@123", "officer"),
        ("admin@mclears.ac", "Admin@123", "admin"),
    ]:
        response = client.post("/api/auth/login", json={"email": email, "password": password})
        assert response.status_code == 200, response.text
        body = response.json()
        assert body["token_type"] == "bearer"
        assert body["user"]["role"] == role
        assert "passwordHash" not in body["user"]


def test_wrong_password_and_unknown_email_are_rejected(client):
    assert (
        client.post(
            "/api/auth/login", json={"email": "student@mclears.ac", "password": "nope"}
        ).status_code
        == 401
    )
    assert (
        client.post(
            "/api/auth/login", json={"email": "nobody@mclears.ac", "password": "Student@123"}
        ).status_code
        == 401
    )


def test_register_creates_student_and_issues_token(client):
    headers, user = register(client)
    assert user["role"] == "student"
    assert user["studentNumber"] == "2099/BSE/001"

    me = client.get("/api/auth/me", headers=headers)
    assert me.status_code == 200
    assert me.json()["email"] == "new.student@mclears.ac"

    bootstrap = client.get("/api/bootstrap", headers=headers)
    assert bootstrap.status_code == 200
    assert bootstrap.json()["me"]["id"] == user["id"]
    assert {item["title"] for item in bootstrap.json()["notifications"]} == {"Welcome to S-Clearance"}


def test_register_validates_uniqueness_and_password_strength(client):
    register(client)
    duplicate_email = client.post(
        "/api/auth/register",
        json={
            "name": "Another Student",
            "email": "new.student@mclears.ac",
            "studentNumber": "2099/BSE/999",
            "programme": "BSc",
            "faculty": "Computing",
            "yearOfStudy": "2",
            "phone": "+250 788 111 333",
            "password": "Test@1234",
        },
    )
    assert duplicate_email.status_code == 409

    duplicate_number = client.post(
        "/api/auth/register",
        json={
            "name": "Another Student",
            "email": "other@mclears.ac",
            "studentNumber": "2099/BSE/001",
            "programme": "BSc",
            "faculty": "Computing",
            "yearOfStudy": "2",
            "phone": "+250 788 111 333",
            "password": "Test@1234",
        },
    )
    assert duplicate_number.status_code == 409

    weak = client.post(
        "/api/auth/register",
        json={
            "name": "Weak Password",
            "email": "weak@mclears.ac",
            "studentNumber": "2099/BSE/777",
            "programme": "BSc",
            "faculty": "Computing",
            "yearOfStudy": "2",
            "phone": "+250 788 111 333",
            "password": "password",
        },
    )
    assert weak.status_code == 400
    assert "upper-case" in weak.json()["detail"]


def test_protected_routes_require_a_valid_token(client):
    assert client.get("/api/bootstrap").status_code == 401
    assert client.get("/api/requests").status_code == 401
    assert (
        client.get("/api/bootstrap", headers={"Authorization": "Bearer not-a-token"}).status_code
        == 401
    )


def test_profile_update_and_password_change(client):
    headers, user = register(client)

    response = client.patch(
        "/api/auth/profile",
        headers=headers,
        json={"name": "Updated Name", "phone": "+250 788 999 000", "yearOfStudy": "4"},
    )
    assert response.status_code == 200
    assert response.json()["name"] == "Updated Name"
    assert response.json()["yearOfStudy"] == "4"

    wrong_current = client.post(
        "/api/auth/change-password",
        headers=headers,
        json={"current": "wrong", "next": "NewPass@123"},
    )
    assert wrong_current.status_code == 400

    changed = client.post(
        "/api/auth/change-password",
        headers=headers,
        json={"current": "Test@1234", "next": "NewPass@123"},
    )
    assert changed.status_code == 200

    assert (
        client.post(
            "/api/auth/login",
            json={"email": "new.student@mclears.ac", "password": "Test@1234"},
        ).status_code
        == 401
    )
    assert (
        client.post(
            "/api/auth/login",
            json={"email": "new.student@mclears.ac", "password": "NewPass@123"},
        ).status_code
        == 200
    )


def test_deactivated_account_cannot_sign_in(client):
    admin = admin_headers(client)
    _, student = register(client)
    response = client.patch(f"/api/users/{student['id']}", headers=admin, json={"active": False})
    assert response.status_code == 200

    denied = client.post(
        "/api/auth/login",
        json={"email": "new.student@mclears.ac", "password": "Test@1234"},
    )
    assert denied.status_code == 403
    assert "deactivated" in denied.json()["detail"]
