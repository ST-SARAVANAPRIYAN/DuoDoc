"""
Tests for Document Library, Custom Folders, and Management Lifecycle
"""

import os
import pytest
from fastapi.testclient import TestClient
from backend.app import app

client = TestClient(app)


@pytest.fixture
def auth_headers():
    login_res = client.post("/api/auth/login", json={"username": "saravana", "password": "password123"})
    assert login_res.status_code == 200, f"Login failed: {login_res.text}"
    token = login_res.json()["access_token"]
    return {"Authorization": f"Bearer {token}"}


def test_auth_and_profile(auth_headers):
    me_res = client.get("/api/auth/me", headers=auth_headers)
    assert me_res.status_code == 200
    data = me_res.json()
    assert data["user"]["username"] == "saravana"
    assert data["user"]["role"] == "user"


def test_folder_crud_lifecycle(auth_headers):
    # 1. List folders
    res = client.get("/api/library/folders", headers=auth_headers)
    assert res.status_code == 200
    initial_folders = res.json()["folders"]
    assert isinstance(initial_folders, list)

    # 2. Create custom folder
    folder_name = "Automated Test Category"
    create_res = client.post("/api/library/folders", headers=auth_headers, json={
        "name": folder_name,
        "color": "#ff5c8a",
        "icon": "folder",
        "description": "Category for automated management testing."
    })
    assert create_res.status_code == 200
    created = create_res.json()
    folder_id = created["id"]
    assert created["name"] == folder_name

    # 3. Verify folder appears in list
    res2 = client.get("/api/library/folders", headers=auth_headers)
    assert any(f["id"] == folder_id for f in res2.json()["folders"])

    # 4. Delete folder
    del_res = client.delete(f"/api/library/folders/{folder_id}", headers=auth_headers)
    assert del_res.status_code == 200

    # 5. Confirm deletion
    res3 = client.get("/api/library/folders", headers=auth_headers)
    assert not any(f["id"] == folder_id for f in res3.json()["folders"])


def test_document_management_lifecycle(auth_headers):
    # 1. Create a dedicated folder
    f_res = client.post("/api/library/folders", headers=headers_or_fallback(auth_headers), json={
        "name": "Deliverables Archive",
        "color": "#06b6d4",
        "icon": "layers",
        "description": "Project deliverables archive."
    })
    assert f_res.status_code == 200
    target_folder_id = f_res.json()["id"]

    # 2. Upload document into the folder
    test_file_path = "docs/final.pdf"
    assert os.path.exists(test_file_path), "Test file docs/final.pdf must exist"

    with open(test_file_path, "rb") as f:
        up_res = client.post(
            "/api/library/upload",
            headers=auth_headers,
            files={"file": ("project_presentation_test.pdf", f, "application/pdf")},
            data={"folder_id": target_folder_id, "title": "Final Presentation Slides Test"}
        )
    assert up_res.status_code == 200, f"Upload failed: {up_res.text}"
    doc_info = up_res.json()
    doc_id = doc_info["document_id"]
    assert doc_id.startswith("doc_")
    assert doc_info["page_count"] >= 1

    # 3. Verify document appears in library and is filtered by folder
    docs_res = client.get(f"/api/library/documents?folder_id={target_folder_id}", headers=auth_headers)
    assert docs_res.status_code == 200
    folder_docs = docs_res.json()["documents"]
    assert any(d["document_id"] == doc_id for d in folder_docs)

    # 4. Move document to uncategorized
    move_res = client.post(f"/api/library/documents/{doc_id}/move", headers=auth_headers, json={"folder_id": None})
    assert move_res.status_code == 200

    # 5. Update document title and tags
    upd_res = client.put(f"/api/library/documents/{doc_id}", headers=auth_headers, json={
        "title": "Renamed Presentation Document",
        "tags": ["presentation", "test", "verified"]
    })
    assert upd_res.status_code == 200

    # 6. Verify search filter finds the updated document
    search_res = client.get("/api/library/documents?search=Renamed", headers=auth_headers)
    assert search_res.status_code == 200
    s_docs = search_res.json()["documents"]
    assert any(d["document_id"] == doc_id for d in s_docs)

    # 7. Delete document and confirm cleanup
    del_doc = client.delete(f"/api/library/documents/{doc_id}", headers=auth_headers)
    assert del_doc.status_code == 200

    chk_del = client.get(f"/api/library/documents?search={doc_id}", headers=auth_headers)
    assert len(chk_del.json()["documents"]) == 0

    # 8. Clean up test folder
    client.delete(f"/api/library/folders/{target_folder_id}", headers=auth_headers)


def test_create_blank_document(auth_headers):
    # Test creation of a fresh blank document
    create_res = client.post(
        "/api/library/create-blank",
        headers=auth_headers,
        json={"title": "Interactive Research Note", "filename": "Research_Note.docx"}
    )
    assert create_res.status_code == 200, f"Create blank failed: {create_res.text}"
    data = create_res.json()
    doc_id = data["document_id"]
    assert doc_id.startswith("doc_")
    assert data["page_count"] == 1
    assert data["filename"] == "Interactive Research Note.docx"

    # Verify document is in library search
    search_res = client.get("/api/library/documents?search=Interactive", headers=auth_headers)
    assert search_res.status_code == 200
    assert any(d["document_id"] == doc_id for d in search_res.json()["documents"])

    # Verify document AST can be fetched
    doc_res = client.get(f"/api/documents/{doc_id}")
    assert doc_res.status_code == 200
    assert doc_res.json()["document_id"] == doc_id

    # Clean up test document
    del_res = client.delete(f"/api/library/documents/{doc_id}", headers=auth_headers)
    assert del_res.status_code == 200


def headers_or_fallback(auth_headers):
    return auth_headers
