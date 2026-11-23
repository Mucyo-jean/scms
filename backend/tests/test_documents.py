import json

from conftest import admin_headers, login, officer_headers, register, submit_request

PDF = ("receipt.pdf", b"%PDF-1.4\n% test document\n", "application/pdf")


def _submitted(client, files=None):
    headers, user = register(client)
    response = submit_request(client, headers, files=files)
    assert response.status_code == 201, response.text
    return headers, user, response.json()


def test_upload_and_download_with_access_control(client):
    headers, user, request = _submitted(client, files=[("files", PDF)])
    assert len(request["documents"]) == 1
    document = request["documents"][0]
    assert document["name"] == "receipt.pdf"
    assert document["size"] == len(PDF[1])
    assert document["hasFile"] is True

    owner = client.get(document["url"], headers=headers)
    assert owner.status_code == 200
    assert owner.content == PDF[1]
    # PDFs are streamed as octet-stream so browsers do not intercept the fetch.
    assert owner.headers["content-type"] == "application/octet-stream"
    assert "receipt.pdf" in owner.headers["content-disposition"]

    assert client.get(document["url"]).status_code == 401
    other_student = login(client, "alice@mclears.ac")
    assert client.get(document["url"], headers=other_student).status_code == 403
    assert client.get(document["url"], headers=officer_headers(client, "library")).status_code == 200
    assert client.get(document["url"], headers=admin_headers(client)).status_code == 200


def test_invalid_file_type_size_and_count_are_rejected(client):
    headers, _ = register(client)

    wrong_type = submit_request(
        client, headers, files=[("files", ("notes.txt", b"hello", "text/plain"))]
    )
    assert wrong_type.status_code == 400
    assert "PDF" in wrong_type.json()["detail"]

    oversized = submit_request(
        client,
        headers,
        files=[("files", ("big.pdf", b"x" * (2 * 1024 * 1024 + 1), "application/pdf"))],
    )
    assert oversized.status_code == 400
    assert "2 MB" in oversized.json()["detail"]

    too_many = submit_request(
        client,
        headers,
        files=[("files", (f"doc{i}.pdf", b"%PDF-1.4", "application/pdf")) for i in range(6)],
    )
    assert too_many.status_code == 400
    assert "at most 5" in too_many.json()["detail"]

    # A failed submission must not leave a half-created request behind.
    bootstrap = client.get("/api/bootstrap", headers=headers).json()
    assert bootstrap["requests"] == []


def test_add_documents_and_respect_total_limit(client):
    headers, _, request = _submitted(
        client, files=[("files", (f"doc{i}.pdf", b"%PDF-1.4", "application/pdf")) for i in range(4)]
    )
    assert len(request["documents"]) == 4

    added = client.post(
        f"/api/requests/{request['id']}/documents",
        headers=headers,
        files=[("files", ("fifth.pdf", b"%PDF-1.4", "application/pdf"))],
    )
    assert added.status_code == 200
    assert len(added.json()["documents"]) == 5

    sixth = client.post(
        f"/api/requests/{request['id']}/documents",
        headers=headers,
        files=[("files", ("sixth.pdf", b"%PDF-1.4", "application/pdf"))],
    )
    assert sixth.status_code == 400

    other = login(client, "alice@mclears.ac")
    not_owner = client.post(
        f"/api/requests/{request['id']}/documents",
        headers=other,
        files=[("files", ("other.pdf", b"%PDF-1.4", "application/pdf"))],
    )
    assert not_owner.status_code == 403


def test_seeded_demo_document_has_no_file(client):
    headers = login(client, "alice@mclears.ac")
    request = client.get("/api/requests/req_seed_a", headers=headers).json()
    document = request["documents"][0]
    assert document["hasFile"] is False
    assert document["url"] is None
    response = client.get(f"/api/documents/{document['id']}", headers=headers)
    assert response.status_code == 404
    assert "seeded" in response.json()["detail"]


def test_malformed_payload_is_rejected(client):
    headers, _ = register(client)
    response = client.post(
        "/api/requests",
        headers=headers,
        data={"payload": json.dumps({"reason": "Graduation"})},
    )
    assert response.status_code == 400
