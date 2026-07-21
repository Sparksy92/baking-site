"""Tests for the unified media library admin endpoints."""
import io
import pytest
from httpx import AsyncClient


# ── helpers ────────────────────────────────────────────────────────────────────

def _small_png() -> bytes:
    """Minimal valid 1×1 white PNG (67 bytes)."""
    import base64
    return base64.b64decode(
        "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwADhQGAWjR9awAAAABJRU5ErkJggg=="
    )


# ── upload ─────────────────────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_upload_image(admin_client: AsyncClient, monkeypatch, tmp_path):
    from app.routes.admin import media as media_module
    from app.services import ai_service

    monkeypatch.setattr(media_module, "UPLOAD_DIR", str(tmp_path))
    async def _mock_meta(image_bytes, mime_type):
        return {"filename_slug": "badasselder-test-hoodie", "alt_text": "A test hoodie from BadAss Elder"}
    monkeypatch.setattr(media_module, "generate_image_metadata", _mock_meta)

    resp = await admin_client.post(
        "/api/admin/media/upload",
        files={"file": ("test.png", io.BytesIO(_small_png()), "image/png")},
    )
    assert resp.status_code == 200
    data = resp.json()
    assert "badasselder-test-hoodie" in data["filename"]
    assert data["alt_text"] == "A test hoodie from BadAss Elder"
    assert data["ai_generated_alt"] is True
    assert data["file_type"] == "image"


@pytest.mark.asyncio
async def test_upload_rejects_unsupported_type(admin_client: AsyncClient):
    resp = await admin_client.post(
        "/api/admin/media/upload",
        files={"file": ("script.exe", io.BytesIO(b"MZ"), "application/octet-stream")},
    )
    assert resp.status_code == 415


@pytest.mark.asyncio
async def test_upload_requires_auth(client: AsyncClient):
    resp = await client.post(
        "/api/admin/media/upload",
        files={"file": ("test.png", io.BytesIO(_small_png()), "image/png")},
    )
    assert resp.status_code == 401


# ── list ───────────────────────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_list_media_empty(admin_client: AsyncClient):
    resp = await admin_client.get("/api/admin/media")
    assert resp.status_code == 200
    data = resp.json()
    assert "items" in data
    assert "total" in data
    assert "pages" in data


@pytest.mark.asyncio
async def test_list_media_requires_auth(client: AsyncClient):
    assert (await client.get("/api/admin/media")).status_code == 401


# ── patch alt text ─────────────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_patch_alt_text(admin_client: AsyncClient, monkeypatch, tmp_path):
    from app.routes.admin import media as media_module
    from app.services import ai_service

    monkeypatch.setattr(media_module, "UPLOAD_DIR", str(tmp_path))
    async def _mock_meta(image_bytes, mime_type):
        return {"filename_slug": "elder-test", "alt_text": "Original AI alt"}
    monkeypatch.setattr(media_module, "generate_image_metadata", _mock_meta)

    upload = await admin_client.post(
        "/api/admin/media/upload",
        files={"file": ("img.png", io.BytesIO(_small_png()), "image/png")},
    )
    media_id = upload.json()["id"]

    resp = await admin_client.patch(f"/api/admin/media/{media_id}", json={"alt_text": "Manually edited alt"})
    assert resp.status_code == 200
    data = resp.json()
    assert data["alt_text"] == "Manually edited alt"
    assert data["ai_generated_alt"] is False


# ── delete ─────────────────────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_delete_media(admin_client: AsyncClient, monkeypatch, tmp_path):
    from app.routes.admin import media as media_module
    from app.services import ai_service

    monkeypatch.setattr(media_module, "UPLOAD_DIR", str(tmp_path))
    async def _mock_meta(image_bytes, mime_type):
        return {"filename_slug": "elder-delete-test", "alt_text": ""}
    monkeypatch.setattr(media_module, "generate_image_metadata", _mock_meta)

    upload = await admin_client.post(
        "/api/admin/media/upload",
        files={"file": ("del.png", io.BytesIO(_small_png()), "image/png")},
    )
    media_id = upload.json()["id"]

    resp = await admin_client.delete(f"/api/admin/media/{media_id}")
    assert resp.status_code == 200
    assert resp.json()["deleted"] is True

    resp2 = await admin_client.delete(f"/api/admin/media/{media_id}")
    assert resp2.status_code == 404


@pytest.mark.asyncio
async def test_delete_requires_auth(client: AsyncClient):
    assert (await client.delete("/api/admin/media/999")).status_code == 401


# ── vision AI fallback ─────────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_upload_fallback_when_no_openai_key(admin_client: AsyncClient, monkeypatch, tmp_path):
    """When generate_image_metadata returns empty strings the upload still succeeds."""
    from app.routes.admin import media as media_module
    from app.services import ai_service

    monkeypatch.setattr(media_module, "UPLOAD_DIR", str(tmp_path))
    async def _no_ai(image_bytes, mime_type):
        return {"filename_slug": "", "alt_text": ""}
    monkeypatch.setattr(media_module, "generate_image_metadata", _no_ai)

    resp = await admin_client.post(
        "/api/admin/media/upload",
        files={"file": ("fallback.png", io.BytesIO(_small_png()), "image/png")},
    )
    assert resp.status_code == 200
    data = resp.json()
    # filename falls back to uuid8.ext when slug is empty
    assert data["filename"].endswith(".png")
    assert len(data["filename"]) > 4
    assert data["alt_text"] == ""
    assert data["ai_generated_alt"] is False


# ── tags patch ────────────────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_patch_tags(admin_client: AsyncClient, monkeypatch, tmp_path):
    from app.routes.admin import media as media_module
    from app.services import ai_service

    monkeypatch.setattr(media_module, "UPLOAD_DIR", str(tmp_path))
    async def _mock(image_bytes, mime_type):
        return {"filename_slug": "elder-tag-test", "alt_text": ""}
    monkeypatch.setattr(media_module, "generate_image_metadata", _mock)

    upload = await admin_client.post(
        "/api/admin/media/upload",
        files={"file": ("tag.png", io.BytesIO(_small_png()), "image/png")},
    )
    media_id = upload.json()["id"]

    resp = await admin_client.patch(f"/api/admin/media/{media_id}", json={"tags": ["hoodie", "resilience"]})
    assert resp.status_code == 200
    import json
    stored = json.loads(resp.json()["tags"])
    assert "hoodie" in stored
    assert "resilience" in stored


@pytest.mark.asyncio
async def test_patch_nonexistent_media(admin_client: AsyncClient):
    resp = await admin_client.patch("/api/admin/media/999999", json={"alt_text": "ghost"})
    assert resp.status_code == 404


@pytest.mark.asyncio
async def test_patch_empty_body_rejected(admin_client: AsyncClient, monkeypatch, tmp_path):
    from app.routes.admin import media as media_module
    from app.services import ai_service

    monkeypatch.setattr(media_module, "UPLOAD_DIR", str(tmp_path))
    async def _mock(image_bytes, mime_type):
        return {"filename_slug": "empty-patch", "alt_text": ""}
    monkeypatch.setattr(media_module, "generate_image_metadata", _mock)

    upload = await admin_client.post(
        "/api/admin/media/upload",
        files={"file": ("ep.png", io.BytesIO(_small_png()), "image/png")},
    )
    media_id = upload.json()["id"]
    resp = await admin_client.patch(f"/api/admin/media/{media_id}", json={})
    assert resp.status_code == 400


# ── list / search / pagination ────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_list_media_pagination_shape(admin_client: AsyncClient):
    resp = await admin_client.get("/api/admin/media?page=1&per_page=5")
    assert resp.status_code == 200
    data = resp.json()
    assert "items" in data
    assert "total" in data
    assert "page" in data
    assert "per_page" in data
    assert "pages" in data
    assert data["per_page"] == 5


@pytest.mark.asyncio
async def test_list_media_search(admin_client: AsyncClient, monkeypatch, tmp_path):
    from app.routes.admin import media as media_module
    from app.services import ai_service

    monkeypatch.setattr(media_module, "UPLOAD_DIR", str(tmp_path))
    async def _mock(image_bytes, mime_type):
        return {"filename_slug": "badasselder-unique-search-term", "alt_text": "unique search alt"}
    monkeypatch.setattr(media_module, "generate_image_metadata", _mock)

    await admin_client.post(
        "/api/admin/media/upload",
        files={"file": ("search.png", io.BytesIO(_small_png()), "image/png")},
    )

    resp = await admin_client.get("/api/admin/media?search=unique-search-term")
    assert resp.status_code == 200
    slugs = [i["filename"] for i in resp.json()["items"]]
    assert any("unique-search-term" in s for s in slugs)

    resp_nomatch = await admin_client.get("/api/admin/media?search=zzz-no-match-xyz")
    assert resp_nomatch.json()["total"] == 0


@pytest.mark.asyncio
async def test_list_media_type_filter(admin_client: AsyncClient, monkeypatch, tmp_path):
    from app.routes.admin import media as media_module
    from app.services import ai_service

    monkeypatch.setattr(media_module, "UPLOAD_DIR", str(tmp_path))
    async def _mock(image_bytes, mime_type):
        return {"filename_slug": "filter-test-image", "alt_text": ""}
    monkeypatch.setattr(media_module, "generate_image_metadata", _mock)

    await admin_client.post(
        "/api/admin/media/upload",
        files={"file": ("filter.png", io.BytesIO(_small_png()), "image/png")},
    )

    resp = await admin_client.get("/api/admin/media?file_type=image")
    assert resp.status_code == 200
    assert all(i["file_type"] == "image" for i in resp.json()["items"])

    resp_video = await admin_client.get("/api/admin/media?file_type=video")
    assert resp_video.status_code == 200
    assert all(i["file_type"] == "video" for i in resp_video.json()["items"])
