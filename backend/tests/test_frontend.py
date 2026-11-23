from fastapi import FastAPI
from fastapi.testclient import TestClient

from app.main import attach_frontend

INDEX = "<!doctype html><html><head><title>S-Clearance</title></head><body>app</body></html>"


def _app_with_build(tmp_path, monkeypatch) -> FastAPI:
    (tmp_path / "index.html").write_text(INDEX, encoding="utf-8")
    (tmp_path / "favicon.svg").write_text("<svg />", encoding="utf-8")
    assets = tmp_path / "assets"
    assets.mkdir()
    (assets / "index-abc123.js").write_text("console.log('mclears')", encoding="utf-8")

    monkeypatch.setattr("app.main.FRONTEND_DIR", tmp_path)
    monkeypatch.setattr("app.main.SERVE_FRONTEND", True)

    app = FastAPI()
    assert attach_frontend(app) is True
    return app


def test_root_and_client_routes_serve_the_spa(tmp_path, monkeypatch):
    client = TestClient(_app_with_build(tmp_path, monkeypatch))

    for path in ["/", "/login", "/verify", "/student/requests/req_123"]:
        response = client.get(path)
        assert response.status_code == 200, path
        assert "<title>S-Clearance</title>" in response.text


def test_built_assets_and_root_files_are_served(tmp_path, monkeypatch):
    client = TestClient(_app_with_build(tmp_path, monkeypatch))

    asset = client.get("/assets/index-abc123.js")
    assert asset.status_code == 200
    assert "mclears" in asset.text

    favicon = client.get("/favicon.svg")
    assert favicon.status_code == 200
    assert favicon.text == "<svg />"


def test_unknown_api_paths_stay_json(tmp_path, monkeypatch):
    client = TestClient(_app_with_build(tmp_path, monkeypatch))

    missing = client.get("/api/not-a-real-endpoint")
    assert missing.status_code == 404
    assert missing.json() == {"detail": "Not Found"}

    bare = client.get("/api")
    assert bare.status_code == 404
    assert bare.json() == {"detail": "Not Found"}


def test_path_traversal_cannot_escape_the_build(tmp_path, monkeypatch):
    client = TestClient(_app_with_build(tmp_path, monkeypatch))

    response = client.get("/..%2F..%2Fetc%2Fpasswd")
    assert response.status_code in {200, 404}
    if response.status_code == 200:
        assert "<title>S-Clearance</title>" in response.text


def test_disabled_when_no_build_is_present(tmp_path, monkeypatch):
    monkeypatch.setattr("app.main.FRONTEND_DIR", tmp_path)
    monkeypatch.setattr("app.main.SERVE_FRONTEND", True)

    app = FastAPI()
    assert attach_frontend(app) is False


def test_disabled_by_flag_even_with_a_build(tmp_path, monkeypatch):
    (tmp_path / "index.html").write_text(INDEX, encoding="utf-8")
    monkeypatch.setattr("app.main.FRONTEND_DIR", tmp_path)
    monkeypatch.setattr("app.main.SERVE_FRONTEND", False)

    app = FastAPI()
    assert attach_frontend(app) is False
