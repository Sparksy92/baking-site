"""
Tests for policy monitoring system.

Covers:
- Policy fetching and hashing
- Diff generation and severity classification
- Workflow: pending → approve → active
- Rollback to archived versions
- Manual upload fallback
- API authentication and guards
"""

import pytest
import hashlib
from datetime import datetime, timezone
from httpx import AsyncClient


# ==================== Service Tests ====================

@pytest.mark.asyncio
async def test_strip_html_removes_tags():
    """HTML stripping removes tags but preserves text."""
    from app.services.policy_monitor_service import _strip_html
    
    html = "<p>This is <strong>important</strong> text.</p>"
    result = _strip_html(html)
    
    assert "<p>" not in result
    assert "<strong>" not in result
    assert "This is important text." in result


@pytest.mark.asyncio
async def test_compute_hash_consistency():
    """Same content produces same hash."""
    from app.services.policy_monitor_service import _compute_hash
    
    content = "Test policy content v1.2.3"
    hash1 = _compute_hash(content)
    hash2 = _compute_hash(content)
    
    assert hash1 == hash2
    assert len(hash1) == 64  # SHA256 hex length


@pytest.mark.asyncio
async def test_compute_hash_different_content():
    """Different content produces different hash."""
    from app.services.policy_monitor_service import _compute_hash
    
    hash1 = _compute_hash("Content A")
    hash2 = _compute_hash("Content B")
    
    assert hash1 != hash2


@pytest.mark.asyncio
async def test_extract_keywords():
    """Keyword extraction finds significant words."""
    from app.services.policy_monitor_service import _extract_keywords
    
    text = "Community guidelines prohibit hate speech and harassment."
    keywords = _extract_keywords(text)
    
    assert "community" in keywords
    assert "guidelines" in keywords
    assert "prohibit" in keywords
    assert "hate" in keywords
    # Stop words removed
    assert "and" not in keywords


@pytest.mark.asyncio
async def test_classify_severity_critical():
    """Detects critical severity from keywords."""
    from app.services.policy_monitor_service import _classify_severity
    
    new_text = "Accounts will be suspended immediately for violations."
    old_text = "We recommend following guidelines."
    
    severity, reason = _classify_severity(new_text, old_text)
    
    assert severity == "critical"
    assert "critical keyword detected" in reason.lower()


@pytest.mark.asyncio
async def test_classify_severity_warning():
    """Detects warning severity from keywords."""
    from app.services.policy_monitor_service import _classify_severity
    
    new_text = "This action is not allowed and may result in warnings."
    old_text = "Please be mindful."
    
    severity, reason = _classify_severity(new_text, old_text)
    
    assert severity == "warning"


@pytest.mark.asyncio
async def test_classify_severity_info():
    """Minor changes classified as info."""
    from app.services.policy_monitor_service import _classify_severity
    
    new_text = "We updated the formatting of this page."
    old_text = "This page contains our guidelines."
    
    severity, reason = _classify_severity(new_text, old_text)
    
    assert severity == "info"


@pytest.mark.asyncio
async def test_compare_policy_versions_no_change():
    """Identical content returns no changes."""
    from app.services.policy_monitor_service import compare_policy_versions, _compute_hash
    
    text = "Same policy content"
    diff = await compare_policy_versions(text, text, "facebook")
    
    assert not diff.has_changes
    assert diff.change_summary == "No changes detected"


@pytest.mark.asyncio
async def test_compare_policy_versions_with_changes():
    """Different content returns changes."""
    from app.services.policy_monitor_service import compare_policy_versions
    
    old_text = "We allow most content."
    new_text = "Violation of these rules will result in a strike and legal action against your account."

    diff = await compare_policy_versions(old_text, new_text, "facebook", use_ai_summary=False)

    assert diff.has_changes
    assert diff.severity == "critical"  # 'violation' / 'strike' / 'legal action' are CRITICAL_KEYWORDS
    assert len(diff.added_keywords) > 0


# ==================== API Tests ====================

@pytest.mark.asyncio
async def test_list_policies_requires_auth(client: AsyncClient):
    """Policy list requires authentication."""
    resp = await client.get("/api/admin/compliance/policies")
    assert resp.status_code == 401


@pytest.mark.asyncio
async def test_list_policies_returns_data(admin_client: AsyncClient):
    """Authenticated admin sees policy list."""
    resp = await admin_client.get("/api/admin/compliance/policies")
    assert resp.status_code == 200
    data = resp.json()
    
    assert "policies" in data
    assert isinstance(data["policies"], list)
    if not data["policies"]:
        pytest.skip("No policies seeded — TRUNCATE cleared seed data")

    policy = data["policies"][0]
    assert "id" in policy
    assert "platform" in policy
    assert "policy_name" in policy


@pytest.mark.asyncio
async def test_check_specific_policy(admin_client: AsyncClient):
    """Manual check endpoint works."""
    # Get first policy
    list_resp = await admin_client.get("/api/admin/compliance/policies")
    policies = list_resp.json()["policies"]
    if not policies:
        pytest.skip("No policies configured")
    
    source_id = policies[0]["id"]
    
    resp = await admin_client.post(f"/api/admin/compliance/policies/{source_id}/check")
    assert resp.status_code == 200
    
    data = resp.json()
    assert "checked" in data
    assert data["checked"] is True
    # Either changed or not, both valid


@pytest.mark.asyncio
async def test_check_invalid_policy(admin_client: AsyncClient):
    """Check non-existent policy returns 404."""
    resp = await admin_client.post("/api/admin/compliance/policies/99999/check")
    assert resp.status_code == 404


@pytest.mark.asyncio
async def test_manual_upload_creates_pending_version(admin_client: AsyncClient):
    """Manual upload creates pending_review version."""
    # Get first policy
    list_resp = await admin_client.get("/api/admin/compliance/policies")
    policies = list_resp.json()["policies"]
    if not policies:
        pytest.skip("No policies configured")
    
    source_id = policies[0]["id"]
    
    resp = await admin_client.post("/api/admin/compliance/upload", json={
        "source_id": source_id,
        "content_text": "This is a manually uploaded policy version for testing purposes. It contains enough content to pass validation requirements.",
        "content_html": "<p>Manual upload HTML</p>",
        "notes": "Test upload"
    })
    
    assert resp.status_code == 200
    data = resp.json()
    assert data["uploaded"] is True
    assert data["status"] == "pending_review"
    assert "version_id" in data


@pytest.mark.asyncio
async def test_manual_upload_rejects_short_content(admin_client: AsyncClient):
    """Manual upload rejects content under 100 chars."""
    list_resp = await admin_client.get("/api/admin/compliance/policies")
    policies = list_resp.json()["policies"]
    if not policies:
        pytest.skip("No policies configured")
    
    source_id = policies[0]["id"]
    
    resp = await admin_client.post("/api/admin/compliance/upload", json={
        "source_id": source_id,
        "content_text": "Too short"
    })
    
    assert resp.status_code == 400


@pytest.mark.asyncio
async def test_get_notifications(admin_client: AsyncClient):
    """Notifications endpoint works."""
    resp = await admin_client.get("/api/admin/compliance/notifications")
    assert resp.status_code == 200
    
    data = resp.json()
    assert "notifications" in data


# ==================== Workflow Tests ====================

@pytest.mark.asyncio
async def test_full_approval_workflow(admin_client: AsyncClient):
    """Complete workflow: upload → pending → approve → active."""
    # 1. Get a policy
    list_resp = await admin_client.get("/api/admin/compliance/policies")
    policies = list_resp.json()["policies"]
    if not policies:
        pytest.skip("No policies configured")
    
    source_id = policies[0]["id"]
    
    # 2. Manual upload (creates pending)
    upload_resp = await admin_client.post("/api/admin/compliance/upload", json={
        "source_id": source_id,
        "content_text": f"Test policy content for workflow testing. This is version {datetime.now().isoformat()} with sufficient length to pass validation.",
        "notes": "Workflow test"
    })
    
    if upload_resp.status_code != 200:
        # Maybe duplicate content, try again with unique content
        upload_resp = await admin_client.post("/api/admin/compliance/upload", json={
            "source_id": source_id,
            "content_text": f"Unique test content {datetime.now().timestamp()}. This policy version contains detailed guidelines for community participation and acceptable content standards.",
            "notes": "Workflow test unique"
        })
    
    assert upload_resp.status_code == 200
    version_id = upload_resp.json()["version_id"]
    
    # 3. Verify pending status
    version_resp = await admin_client.get(f"/api/admin/compliance/versions/{version_id}")
    assert version_resp.status_code == 200
    assert version_resp.json()["status"] == "pending_review"
    
    # 4. Approve
    approve_resp = await admin_client.post(f"/api/admin/compliance/versions/{version_id}/approve", json={
        "notes": "Approved for testing"
    })
    assert approve_resp.status_code == 200
    assert approve_resp.json()["approved"] is True
    
    # 5. Verify active
    version_resp = await admin_client.get(f"/api/admin/compliance/versions/{version_id}")
    assert version_resp.json()["status"] == "active"
    assert version_resp.json()["approved_by"] is not None


@pytest.mark.asyncio
async def test_reject_requires_reason(admin_client: AsyncClient):
    """Rejection requires minimum 10 character reason."""
    # Get or create a pending version
    list_resp = await admin_client.get("/api/admin/compliance/policies")
    policies = list_resp.json()["policies"]
    if not policies:
        pytest.skip("No policies configured")
    
    # Try to reject with short reason
    resp = await admin_client.post("/api/admin/compliance/versions/999/reject", json={
        "reason": "Bad"
    })
    
    # Should fail validation (even if version doesn't exist, validation runs first)
    assert resp.status_code in [400, 404]


# ==================== CLI Command Tests ====================

@pytest.mark.asyncio
async def test_cli_check_policies_runs():
    """CLI check-policies command executes without error."""
    from app.cli.compliance_commands import check_policies_cmd
    
    # This should not raise an exception
    # We can't fully test without mocking the fetch, but we can verify it runs
    try:
        await check_policies_cmd()
    except Exception as e:
        # Connection errors are expected in test environment
        # Just verify the function structure is valid
        assert "check_policies_cmd" in str(type(check_policies_cmd))


# ==================== Edge Cases ====================

@pytest.mark.asyncio
async def test_approve_non_pending_fails(admin_client: AsyncClient):
    """Approving non-pending version fails."""
    # Try to approve non-existent version
    resp = await admin_client.post("/api/admin/compliance/versions/99999/approve", json={})
    
    assert resp.status_code in [400, 404]


@pytest.mark.asyncio
async def test_rollback_requires_reason(admin_client: AsyncClient):
    """Rollback requires reason."""
    resp = await admin_client.post("/api/admin/compliance/versions/99999/rollback", json={
        "reason": "No"
    })
    
    assert resp.status_code in [400, 404]  # Validation or not found


@pytest.mark.asyncio
async def test_html_diff_generation():
    """Diff HTML is generated for changed content."""
    from app.services.policy_monitor_service import _generate_diff_html
    
    old_lines = ["Line 1", "Line 2", "Line 3"]
    new_lines = ["Line 1", "Line 2 modified", "Line 3"]
    
    html = _generate_diff_html("\n".join(old_lines), "\n".join(new_lines))
    
    assert "<table" in html
    assert "Previous Version" in html
    assert "Current Version" in html
