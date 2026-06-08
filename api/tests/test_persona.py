"""Brand persona API tests.

Sprint 1 — tests written before implementation (TDD).
All tests are marked xfail until the persona API endpoints are built.
"""
import pytest
from httpx import AsyncClient


pytestmark = pytest.mark.asyncio


@pytest.mark.xfail(reason="Persona API not yet implemented — Sprint 1")
async def test_get_persona_returns_default(admin_client: AsyncClient):
    """GET /api/admin/persona returns a default persona on first call."""
    resp = await admin_client.get("/api/admin/persona")
    assert resp.status_code == 200
    data = resp.json()
    assert "voice" in data
    assert "audience" in data
    assert "values_text" in data
    assert "words_to_use" in data
    assert "words_to_avoid" in data


@pytest.mark.xfail(reason="Persona API not yet implemented — Sprint 1")
async def test_update_persona(admin_client: AsyncClient):
    """PATCH /api/admin/persona persists changes."""
    resp = await admin_client.patch("/api/admin/persona", json={
        "voice": "Bold and direct. We speak for the land.",
        "audience": "Indigenous youth aged 18–35 who value culture and authenticity.",
        "values_text": "Land, community, sovereignty, resilience.",
        "words_to_use": "authentic, sovereign, rooted, community",
        "words_to_avoid": "exotic, tribal, primitive, discount",
    })
    assert resp.status_code == 200

    resp = await admin_client.get("/api/admin/persona")
    assert resp.json()["voice"] == "Bold and direct. We speak for the land."


@pytest.mark.xfail(reason="Persona API not yet implemented — Sprint 1")
async def test_persona_requires_auth(client: AsyncClient):
    """Persona endpoints reject unauthenticated requests."""
    assert (await client.get("/api/admin/persona")).status_code == 401
    assert (await client.patch("/api/admin/persona", json={})).status_code == 401


@pytest.mark.xfail(reason="Persona API not yet implemented — Sprint 1")
async def test_persona_injected_into_ai_prompt(admin_client: AsyncClient, monkeypatch):
    """AI generation call includes persona voice in the system prompt."""
    captured = {}

    async def mock_openai(prompt, api_key, system_prompt):
        captured["system_prompt"] = system_prompt
        return "Generated content."

    monkeypatch.setattr("app.services.ai_service._generate_with_openai", mock_openai)
    monkeypatch.setenv("OPENAI_API_KEY", "sk-test-fake")

    await admin_client.patch("/api/admin/persona", json={
        "voice": "UNIQUE_VOICE_MARKER_XYZ",
    })

    await admin_client.post("/api/admin/pages/generate-ai", json={"prompt": "Test prompt"})
    assert "UNIQUE_VOICE_MARKER_XYZ" in captured.get("system_prompt", "")


@pytest.mark.xfail(reason="Persona API not yet implemented — Sprint 1")
async def test_persona_words_to_avoid_in_prompt(admin_client: AsyncClient, monkeypatch):
    """Words to avoid are explicitly listed in the AI system prompt."""
    captured = {}

    async def mock_openai(prompt, api_key, system_prompt):
        captured["system_prompt"] = system_prompt
        return "Generated content."

    monkeypatch.setattr("app.services.ai_service._generate_with_openai", mock_openai)
    monkeypatch.setenv("OPENAI_API_KEY", "sk-test-fake")

    await admin_client.patch("/api/admin/persona", json={"words_to_avoid": "cheap, discount, exotic"})
    await admin_client.post("/api/admin/pages/generate-ai", json={"prompt": "Test"})
    assert "cheap" in captured.get("system_prompt", "")
    assert "discount" in captured.get("system_prompt", "")


@pytest.mark.xfail(reason="Persona API not yet implemented — Sprint 1")
async def test_only_one_active_persona(admin_client: AsyncClient):
    """Only one persona can be active at a time."""
    await admin_client.patch("/api/admin/persona", json={"voice": "Voice A"})
    await admin_client.patch("/api/admin/persona", json={"voice": "Voice B"})

    resp = await admin_client.get("/api/admin/persona")
    assert resp.json()["voice"] == "Voice B"


@pytest.mark.xfail(reason="Persona API not yet implemented — Sprint 1")
async def test_persona_partial_update(admin_client: AsyncClient):
    """PATCH only updates provided fields, leaves others unchanged."""
    await admin_client.patch("/api/admin/persona", json={
        "voice": "Original voice",
        "audience": "Original audience",
    })
    await admin_client.patch("/api/admin/persona", json={"voice": "Updated voice"})

    resp = await admin_client.get("/api/admin/persona")
    assert resp.json()["voice"] == "Updated voice"
    assert resp.json()["audience"] == "Original audience"


@pytest.mark.xfail(reason="Persona API not yet implemented — Sprint 1")
async def test_empty_persona_does_not_crash_ai(admin_client: AsyncClient, monkeypatch):
    """AI generation works even if no persona fields are set (graceful degradation)."""
    async def mock_openai(prompt, api_key, system_prompt):
        return "Generated content."

    monkeypatch.setattr("app.services.ai_service._generate_with_openai", mock_openai)
    monkeypatch.setenv("OPENAI_API_KEY", "sk-test-fake")

    resp = await admin_client.post("/api/admin/pages/generate-ai", json={"prompt": "Test"})
    assert resp.status_code == 200
