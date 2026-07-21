"""
Compliance API routes for policy monitoring.

Endpoints for:
- Listing policy sources and versions
- Checking for updates
- Approving/rejecting/rolling back versions
- Manual upload fallback
- Notifications
"""

from typing import Optional, Annotated
from pydantic import BaseModel
from fastapi import APIRouter, Depends, HTTPException, status

from app.database import PostgresConnection, get_db
from app.auth import require_admin
from app.services.policy_monitor_service import (
    check_policy_source,
    approve_policy_version,
    reject_policy_version,
    rollback_policy_version,
    manual_upload_policy,
)
from app.services.content_compliance_service import (
    check_content_compliance,
    auto_fix_content,
    get_content_compliance_history,
    bulk_recheck_on_policy_change,
)

router = APIRouter(prefix="/compliance", tags=["compliance"])

_RESPONSES = {400: {"description": "Bad Request"}, 404: {"description": "Not Found"}}


# ==================== List Policies ====================

@router.get("/policies", responses=_RESPONSES)
async def list_policies(
    db: Annotated[PostgresConnection, Depends(get_db)],
    user: Annotated[dict, Depends(require_admin)],
    platform: Optional[str] = None,
):
    """List all policy sources with their current active version and pending count."""
    
    where = "WHERE 1=1"
    params = []
    if platform:
        params.append(platform)
        where += f" AND ps.platform = ${len(params)}"
    
    cursor = await db.execute(f"""
        SELECT 
            ps.id, ps.platform, ps.policy_type, ps.policy_name, ps.source_url,
            ps.is_active, ps.fetch_cron,
            pv_active.id as active_version_id,
            pv_active.version as active_version,
            pv_active.approved_at as active_approved_at,
            pv_pending.id as pending_version_id,
            pv_pending.version as pending_version,
            pv_pending.severity as pending_severity,
            pv_pending.created_at as pending_created_at,
            (SELECT COUNT(*) FROM policy_versions WHERE source_id = ps.id AND status = 'pending_review') as pending_count,
            (SELECT COUNT(*) FROM policy_versions WHERE source_id = ps.id AND status = 'failed_fetch') as failed_count
        FROM policy_sources ps
        LEFT JOIN policy_versions pv_active ON pv_active.source_id = ps.id AND pv_active.status = 'active'
        LEFT JOIN policy_versions pv_pending ON pv_pending.source_id = ps.id AND pv_pending.status = 'pending_review'
        {where}
        ORDER BY ps.platform, ps.policy_type
    """, params)
    
    rows = await cursor.fetchall()
    return {"policies": [dict(r) for r in rows]}


@router.get("/policies/{source_id}/versions", responses=_RESPONSES)
async def list_policy_versions(
    db: Annotated[PostgresConnection, Depends(get_db)],
    user: Annotated[dict, Depends(require_admin)],
    source_id: int,
    status: Optional[str] = None,
    limit: int = 50,
):
    """List all versions for a specific policy source."""
    
    # Verify source exists
    cursor = await db.execute(
        "SELECT 1 FROM policy_sources WHERE id = $1",
        (source_id,)
    )
    if not await cursor.fetchone():
        raise HTTPException(status_code=404, detail="Policy source not found")

    params: list = [source_id]
    where = "WHERE pv.source_id = $1"
    if status:
        params.append(status)
        where += f" AND pv.status = ${len(params)}"
    params.append(limit)

    cursor = await db.execute(f"""
        SELECT 
            pv.*,
            ps.platform, ps.policy_type, ps.policy_name, ps.source_url
        FROM policy_versions pv
        JOIN policy_sources ps ON pv.source_id = ps.id
        {where}
        ORDER BY pv.created_at DESC
        LIMIT ${len(params)}
    """, params)
    
    rows = await cursor.fetchall()
    return {"versions": [dict(r) for r in rows]}


@router.get("/versions/{version_id}", responses=_RESPONSES)
async def get_version_details(
    db: Annotated[PostgresConnection, Depends(get_db)],
    user: Annotated[dict, Depends(require_admin)],
    version_id: int,
):
    """Get detailed view of a policy version including diff HTML."""
    
    cursor = await db.execute("""
        SELECT 
            pv.*,
            ps.platform, ps.policy_type, ps.policy_name,
            pv_prev.content_text as previous_content_text
        FROM policy_versions pv
        JOIN policy_sources ps ON pv.source_id = ps.id
        LEFT JOIN policy_versions pv_prev ON pv.previous_hash = pv_prev.content_hash
        WHERE pv.id = $1
    """, (version_id,))
    
    row = await cursor.fetchone()
    if not row:
        raise HTTPException(status_code=404, detail="Policy version not found")
    
    result = dict(row)
    
    # Generate fresh diff HTML if we have previous content
    if result.get('previous_content_text'):
        from app.services.policy_monitor_service import _generate_diff_html
        result['diff_html'] = _generate_diff_html(
            result['previous_content_text'],
            result['content_text']
        )
    
    # Get audit log
    cursor = await db.execute("""
        SELECT * FROM policy_audit_log 
        WHERE policy_version_id = $1 
        ORDER BY performed_at DESC
    """, (version_id,))
    result['audit_log'] = [dict(r) for r in await cursor.fetchall()]
    
    return result


# ==================== Check & Update ====================

@router.post("/policies/{source_id}/check", responses=_RESPONSES)
async def check_policy_now(
    db: Annotated[PostgresConnection, Depends(get_db)],
    user: Annotated[dict, Depends(require_admin)],
    source_id: int,
):
    """Manually trigger a policy check for a source."""
    
    # Verify source exists
    cursor = await db.execute(
        "SELECT platform, policy_type FROM policy_sources WHERE id = $1",
        (source_id,)
    )
    source = await cursor.fetchone()
    if not source:
        raise HTTPException(status_code=404, detail="Policy source not found")
    
    # Run check
    new_version_id = await check_policy_source(source_id, db)
    
    if new_version_id:
        return {
            "checked": True,
            "changed": True,
            "new_version_id": new_version_id,
            "message": f"New version detected for {dict(source)['platform']} {dict(source)['policy_type']}"
        }
    
    return {
        "checked": True,
        "changed": False,
        "message": "No changes detected"
    }


@router.post("/check-all", responses=_RESPONSES)
async def check_all_policies(
    db: Annotated[PostgresConnection, Depends(get_db)],
    user: Annotated[dict, Depends(require_admin)],
):
    """Check all active policy sources for updates."""
    
    cursor = await db.execute(
        "SELECT id FROM policy_sources WHERE is_active = TRUE"
    )
    sources = await cursor.fetchall()
    
    results = {
        "checked": len(sources),
        "new_versions": [],
        "failed": []
    }
    
    for source in sources:
        try:
            new_id = await check_policy_source(source['id'], db)
            if new_id:
                results["new_versions"].append(new_id)
        except Exception as e:
            results["failed"].append({"source_id": source['id'], "error": str(e)})
    
    return results


# ==================== Approval Workflow ====================

class ApproveRequest(BaseModel):
    notes: Optional[str] = None


@router.post("/versions/{version_id}/approve", responses=_RESPONSES)
async def approve_version(
    db: Annotated[PostgresConnection, Depends(get_db)],
    user: Annotated[dict, Depends(require_admin)],
    version_id: int,
    body: ApproveRequest,
):
    """Approve a pending policy version, making it active."""
    
    success = await approve_policy_version(
        version_id, 
        user.get('sub', 'admin'),
        body.notes,
        db
    )
    
    if not success:
        raise HTTPException(
            status_code=400,
            detail="Version not found or not in pending_review status"
        )
    
    return {"approved": True, "version_id": version_id}


class RejectRequest(BaseModel):
    reason: str


@router.post("/versions/{version_id}/reject", responses=_RESPONSES)
async def reject_version(
    db: Annotated[PostgresConnection, Depends(get_db)],
    user: Annotated[dict, Depends(require_admin)],
    version_id: int,
    body: RejectRequest,
):
    """Reject a pending policy version."""
    
    if not body.reason or len(body.reason) < 10:
        raise HTTPException(
            status_code=400,
            detail="Rejection reason required (min 10 characters)"
        )
    
    success = await reject_policy_version(
        version_id,
        user.get('sub', 'admin'),
        body.reason,
        db
    )
    
    if not success:
        raise HTTPException(
            status_code=400,
            detail="Version not found or not in pending_review status"
        )
    
    return {"rejected": True, "version_id": version_id}


class RollbackRequest(BaseModel):
    reason: str


@router.post("/versions/{version_id}/rollback", responses=_RESPONSES)
async def rollback_version(
    db: Annotated[PostgresConnection, Depends(get_db)],
    user: Annotated[dict, Depends(require_admin)],
    version_id: int,
    body: RollbackRequest,
):
    """Rollback to a previous (archived) version, making it active again."""
    
    if not body.reason or len(body.reason) < 10:
        raise HTTPException(
            status_code=400,
            detail="Rollback reason required (min 10 characters)"
        )
    
    success = await rollback_policy_version(
        version_id,
        user.get('sub', 'admin'),
        body.reason,
        db
    )
    
    if not success:
        raise HTTPException(
            status_code=400,
            detail="Version not found or not available for rollback"
        )
    
    return {"rolled_back": True, "version_id": version_id}


# ==================== Manual Upload ====================

class ManualUploadRequest(BaseModel):
    source_id: int
    content_text: str
    content_html: Optional[str] = None
    notes: Optional[str] = None


@router.post("/upload", responses=_RESPONSES)
async def upload_policy_manual(
    db: Annotated[PostgresConnection, Depends(get_db)],
    user: Annotated[dict, Depends(require_admin)],
    body: ManualUploadRequest,
):
    """Manually upload a policy version when automated fetching is blocked."""
    
    if len(body.content_text) < 100:
        raise HTTPException(
            status_code=400,
            detail="Content too short (min 100 characters)"
        )
    
    try:
        version_id = await manual_upload_policy(
            body.source_id,
            body.content_text,
            body.content_html,
            user.get('sub', 'admin'),
            body.notes,
            db
        )
        
        return {
            "uploaded": True,
            "version_id": version_id,
            "status": "pending_review"
        }
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


# ==================== Notifications ====================

@router.get("/notifications", responses=_RESPONSES)
async def get_notifications(
    db: Annotated[PostgresConnection, Depends(get_db)],
    user: Annotated[dict, Depends(require_admin)],
    unread_only: bool = True,
):
    """Get policy notifications for the current admin."""
    
    params: list = [user.get('sub', 'admin')]
    where = "WHERE pn.admin_email = $1"
    if unread_only:
        where += " AND pn.is_read = FALSE"
    
    cursor = await db.execute(f"""
        SELECT 
            pn.*,
            ps.platform, ps.policy_type, ps.policy_name,
            pv.version, pv.severity, pv.change_summary
        FROM policy_notifications pn
        JOIN policy_versions pv ON pn.policy_version_id = pv.id
        JOIN policy_sources ps ON pv.source_id = ps.id
        {where}
        ORDER BY pn.created_at DESC
    """, params)
    
    rows = await cursor.fetchall()
    return {"notifications": [dict(r) for r in rows]}


@router.post("/notifications/{notification_id}/read", responses=_RESPONSES)
async def mark_notification_read(
    db: Annotated[PostgresConnection, Depends(get_db)],
    user: Annotated[dict, Depends(require_admin)],
    notification_id: int,
):
    """Mark a notification as read."""
    
    from datetime import datetime, timezone
    
    await db.execute(
        """UPDATE policy_notifications 
           SET is_read = TRUE, read_at = $1 
           WHERE id = $2 AND admin_email = $3""",
        (datetime.now(timezone.utc), notification_id, user.get('sub', 'admin'))
    )
    await db.commit()
    
    return {"marked_read": True}


@router.post("/notifications/read-all", responses=_RESPONSES)
async def mark_all_notifications_read(
    db: Annotated[PostgresConnection, Depends(get_db)],
    user: Annotated[dict, Depends(require_admin)],
):
    """Mark all notifications as read for the current admin."""
    
    from datetime import datetime, timezone
    
    await db.execute(
        """UPDATE policy_notifications 
           SET is_read = TRUE, read_at = $1 
           WHERE admin_email = $2 AND is_read = FALSE""",
        (datetime.now(timezone.utc), user.get('sub', 'admin'))
    )
    await db.commit()
    
    return {"marked_read": True, "count": 0}  # TODO: return actual count


# ==================== Refresh Meta ====================

@router.post("/refresh-meta", responses=_RESPONSES)
async def refresh_policy_meta(
    db: Annotated[PostgresConnection, Depends(get_db)],
    user: Annotated[dict, Depends(require_admin)],
):
    """Refresh policy source metadata (re-check all sources for updates)."""
    
    # This is essentially the same as check-all, included for CLI compatibility
    return await check_all_policies(db, user)


# ==================== Content Compliance ====================

class CheckContentRequest(BaseModel):
    content: str
    platform: str
    content_id: Optional[int] = None  # If already saved
    use_ai: bool = True


@router.post("/check-content", responses=_RESPONSES)
async def check_content(
    db: Annotated[PostgresConnection, Depends(get_db)],
    user: Annotated[dict, Depends(require_admin)],
    body: CheckContentRequest,
):
    """Check content against active platform policies."""
    
    if not body.content or len(body.content) < 5:
        raise HTTPException(status_code=400, detail="Content required (min 5 chars)")
    
    if body.platform not in ['facebook', 'instagram', 'x', 'linkedin', 'tiktok', 'youtube', 'pinterest', 'threads']:
        raise HTTPException(status_code=400, detail="Invalid platform")
    
    result = await check_content_compliance(
        body.content,
        body.platform,
        db,
        content_id=body.content_id,
        use_ai=body.use_ai
    )
    
    return {
        "status": result.status,
        "severity": result.overall_severity,
        "issues": [
            {
                "severity": i.severity,
                "category": i.category,
                "description": i.description,
                "excerpt": i.excerpt,
                "suggested_fix": i.suggested_fix,
                "auto_fixable": i.auto_fixable
            }
            for i in result.issues
        ],
        "can_auto_fix": result.can_auto_fix,
        "ai_analysis": result.ai_analysis,
        "checked_at": result.checked_at.isoformat()
    }


@router.post("/fix-content", responses=_RESPONSES)
async def fix_content(
    db: Annotated[PostgresConnection, Depends(get_db)],
    user: Annotated[dict, Depends(require_admin)],
    body: CheckContentRequest,
):
    """Auto-fix compliance issues in content."""
    
    # First check
    check = await check_content_compliance(
        body.content,
        body.platform,
        db,
        content_id=body.content_id,
        use_ai=True
    )
    
    if check.status == 'clean':
        return {
            "fixed": False,
            "reason": "Content is already compliant",
            "original": body.content,
            "fixed_content": None
        }
    
    if not check.can_auto_fix:
        return {
            "fixed": False,
            "reason": "Content has critical violations that require manual review",
            "issues": [
                {
                    "severity": i.severity,
                    "category": i.category,
                    "description": i.description
                }
                for i in check.issues if i.severity == 'critical'
            ],
            "original": body.content,
            "fixed_content": None
        }
    
    # Attempt auto-fix
    fixed = await auto_fix_content(
        body.content,
        body.platform,
        check.issues,
        db,
        max_attempts=2
    )
    
    if fixed:
        # Re-check the fixed content
        recheck = await check_content_compliance(
            fixed,
            body.platform,
            db,
            use_ai=True
        )
        
        return {
            "fixed": True,
            "original": body.content,
            "fixed_content": fixed,
            "new_status": recheck.status,
            "remaining_issues": len(recheck.issues),
            "can_publish": recheck.status != 'violation'
        }
    
    return {
        "fixed": False,
        "reason": "Auto-fix could not resolve all issues",
        "original": body.content,
        "fixed_content": None
    }


@router.get("/content/{content_id}/compliance", responses=_RESPONSES)
async def get_content_compliance(
    db: Annotated[PostgresConnection, Depends(get_db)],
    user: Annotated[dict, Depends(require_admin)],
    content_id: int,
):
    """Get compliance history for a specific post."""
    
    # Get current post status
    cursor = await db.execute(
        "SELECT id, content, platform, compliance_status FROM social_posts WHERE id = $1",
        (content_id,)
    )
    post = await cursor.fetchone()
    
    if not post:
        raise HTTPException(status_code=404, detail="Content not found")
    
    # Get check history
    history = await get_content_compliance_history(content_id, db)
    
    return {
        "post": dict(post),
        "check_history": history,
        "check_count": len(history)
    }


@router.post("/recheck-on-policy-change/{policy_version_id}", responses=_RESPONSES)
async def recheck_after_policy_change(
    db: Annotated[PostgresConnection, Depends(get_db)],
    user: Annotated[dict, Depends(require_admin)],
    policy_version_id: int,
):
    """Re-check all pending posts after a policy change. Auto-fixes if possible."""
    
    results = await bulk_recheck_on_policy_change(policy_version_id, db)
    
    return {
        "rechecked": results['total'],
        "clean": results['clean'],
        "warning": results['warning'],
        "violation": results['violation'],
        "auto_fixed": results['fixed'],
        "message": f"Rechecked {results['total']} posts. {results['fixed']} auto-fixed."
    }


@router.get("/violations", responses=_RESPONSES)
async def list_violations(
    db: Annotated[PostgresConnection, Depends(get_db)],
    user: Annotated[dict, Depends(require_admin)],
    platform: Optional[str] = None,
    severity: Optional[str] = None,
    limit: int = 50,
):
    """List all content with compliance violations or warnings."""
    
    where = "WHERE sp.compliance_status IN ('warning', 'violation')"
    params = []
    
    if platform:
        params.append(platform)
        where += f" AND sp.platform = ${len(params)}"

    if severity:
        params.append(severity)
        where += f" AND ccc.severity = ${len(params)}"
    
    cursor = await db.execute(f"""
        SELECT 
            sp.id, sp.platform, sp.content, sp.status as post_status,
            sp.compliance_status, sp.compliance_checked_at,
            ccc.severity, ccc.issues_json, ccc.checked_at,
            ccc.can_auto_fix, ccc.auto_fixed
        FROM social_posts sp
        LEFT JOIN content_compliance_checks ccc ON sp.id = ccc.content_id
        {where}
        ORDER BY 
            CASE ccc.severity WHEN 'critical' THEN 1 WHEN 'warning' THEN 2 ELSE 3 END,
            ccc.checked_at DESC
        LIMIT ${len(params) + 1}
    """, params + [limit])

    rows = await cursor.fetchall()
    import json
    
    results = []
    for row in rows:
        data = dict(row)
        try:
            data['issues'] = json.loads(data.get('issues_json', '[]'))
        except:
            data['issues'] = []
        del data['issues_json']
        results.append(data)
    
    return {"violations": results, "count": len(results)}


# ==================== Advanced Compliance Features ====================

class FullCheckRequest(BaseModel):
    content: str
    platform: str
    image_url: Optional[str] = None
    video_url: Optional[str] = None
    content_id: Optional[int] = None


@router.post("/check-full-post", responses=_RESPONSES)
async def check_full_post(
    db: Annotated[PostgresConnection, Depends(get_db)],
    user: Annotated[dict, Depends(require_admin)],
    body: FullCheckRequest,
):
    """
    Comprehensive post compliance check: text + image + URLs.
    Industry-leading: multimodal content safety verification.
    """
    from app.services.image_compliance_service import check_full_post_compliance
    
    result = await check_full_post_compliance(
        content=body.content,
        image_url=body.image_url,
        video_url=body.video_url,
        platform=body.platform,
        db=db,
        content_id=body.content_id
    )
    
    return result


@router.get("/scorecard", responses=_RESPONSES)
async def get_compliance_scorecard(
    db: Annotated[PostgresConnection, Depends(get_db)],
    user: Annotated[dict, Depends(require_admin)],
    days: int = 30,
    platform: Optional[str] = None,
):
    """
    Get account compliance health scorecard.
    Industry-leading: comprehensive compliance analytics dashboard.
    """
    from app.services.image_compliance_service import get_compliance_scorecard
    
    scorecard = await get_compliance_scorecard(
        days=days,
        platform=platform,
        db=db
    )
    
    return scorecard


@router.post("/check-image", responses=_RESPONSES)
async def check_image_compliance_endpoint(
    db: Annotated[PostgresConnection, Depends(get_db)],
    user: Annotated[dict, Depends(require_admin)],
    image_url: str,
    platform: str,
    content_id: Optional[int] = None,
):
    """
    Check an image for compliance violations using GPT-4o Vision.
    Detects: nudity, violence, hate symbols, copyright concerns.
    """
    from app.services.image_compliance_service import check_image_compliance
    
    result = await check_image_compliance(
        image_url=image_url,
        platform=platform,
        db=db,
        content_id=content_id
    )
    
    return {
        "media_url": result.media_url,
        "status": result.status,
        "severity": result.overall_severity,
        "issues": [
            {
                "category": i.category,
                "severity": i.severity,
                "description": i.description,
                "confidence": i.confidence,
                "suggested_fix": i.suggested_fix
            }
            for i in result.issues
        ],
        "safety_scores": result.safety_scores,
        "ai_analysis": result.ai_analysis,
        "checked_at": result.checked_at.isoformat()
    }


@router.post("/check-url", responses=_RESPONSES)
async def check_url_compliance_endpoint(
    user: Annotated[dict, Depends(require_admin)],
    url: str,
):
    """
    Check if a URL is safe to include in social content.
    Validates against blocklists and suspicious patterns.
    """
    from app.services.url_compliance_service import check_url_safety
    
    result = await check_url_safety(url)
    
    return result
