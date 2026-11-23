import json
import os
import shutil
import tempfile
from pathlib import Path

import pytest

TEST_ROOT = Path(__file__).resolve().parent
TEST_DB = TEST_ROOT / "test_mclears.db"
TEST_STORAGE = Path(tempfile.mkdtemp(prefix="mclears-test-storage-"))

# Configure the app before it is imported for the first time.
os.environ["DATABASE_URL"] = f"sqlite:///{TEST_DB.as_posix()}"
os.environ["STORAGE_DIR"] = str(TEST_STORAGE)
os.environ["APP_ENV"] = "development"
os.environ["AUTO_SEED"] = "false"
os.environ["PBKDF2_ITERATIONS"] = "1000"
os.environ["SECRET_KEY"] = "test-secret-key-0123456789abcdef"

from fastapi.testclient import TestClient  # noqa: E402

from app.database import engine  # noqa: E402
from app.main import app  # noqa: E402


def pytest_sessionfinish(session, exitstatus):
    engine.dispose()
    shutil.rmtree(TEST_STORAGE, ignore_errors=True)
    TEST_DB.unlink(missing_ok=True)


@pytest.fixture()
def client():
    with TestClient(app) as test_client:
        response = test_client.post("/api/dev/reset")
        assert response.status_code == 200, response.text
        yield test_client


def login(client: TestClient, email: str, password: str = "Student@123") -> dict[str, str]:
    response = client.post("/api/auth/login", json={"email": email, "password": password})
    assert response.status_code == 200, response.text
    return {"Authorization": "Bearer " + response.json()["access_token"]}


def admin_headers(client: TestClient) -> dict[str, str]:
    return login(client, "admin@mclears.ac", "Admin@123")


def officer_headers(client: TestClient, department: str) -> dict[str, str]:
    return login(client, f"{department}@mclears.ac", "Officer@123")


def register(
    client: TestClient,
    email: str = "new.student@mclears.ac",
    student_number: str = "2099/BSE/001",
    password: str = "Test@1234",
) -> tuple[dict[str, str], dict]:
    response = client.post(
        "/api/auth/register",
        json={
            "name": "Test Student",
            "email": email,
            "studentNumber": student_number,
            "programme": "BSc Software Engineering",
            "faculty": "Computing & IT",
            "yearOfStudy": "3",
            "phone": "+250 788 111 222",
            "password": password,
        },
    )
    assert response.status_code == 201, response.text
    body = response.json()
    return {"Authorization": "Bearer " + body["access_token"]}, body["user"]


def application_form(**overrides) -> dict:
    form = {
        "studentNumber": "2099/BSE/001",
        "programme": "BSc Software Engineering",
        "faculty": "Computing & IT",
        "yearOfStudy": "3",
        "phone": "+250 788 111 222",
        "notes": "Testing the workflow.",
        "reason": "Graduation",
    }
    form.update(overrides)
    return form


def submit_request(client: TestClient, headers: dict[str, str], files=None, **overrides):
    payload = json.dumps(application_form(**overrides))
    return client.post(
        "/api/requests",
        headers=headers,
        data={"payload": payload},
        files=files or [],
    )


def approve_all(client: TestClient, request_id: str, pay: bool = True, headers=None):
    student_headers = headers
    if pay:
        response = client.post(
            f"/api/requests/{request_id}/payment",
            headers=student_headers,
            json={"method": "Mobile Money", "details": {"phone": "+250 788 111 222"}},
        )
        assert response.status_code == 200, response.text
    for department in ["library", "finance", "academic", "ict"]:
        response = client.post(
            f"/api/requests/{request_id}/decisions",
            headers=officer_headers(client, department),
            json={"decision": "Approved", "comment": "Cleared."},
        )
        assert response.status_code == 200, response.text
