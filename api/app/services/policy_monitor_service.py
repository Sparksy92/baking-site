"""
Policy monitoring service for social platform compliance.

Fetches policy pages, detects changes, classifies severity, generates diffs.
Supports both automated fetching and manual upload fallback.
"""

import hashlib
import re
import html
from datetime import datetime, timezone
from typing import Optional
from dataclasses import dataclass

import httpx
from app.database import db_connection, PostgresConnection
from app.services.ai_service import generate_with_config, get_model_config, AITaskType

import logging

logger = logging.getLogger(__name__)

# Critical keywords that auto-flag severity
CRITICAL_KEYWORDS = [
    "account suspended", "will be banned", "permanently banned", "prohibited",
    "mandatory", "required", "must comply", "immediate action", "enforcement",
    "strike", "violation", "penalty", "fine", "legal action", "content removed"
]

WARNING_KEYWORDS = [
    "should not", "not allowed", "restricted", "limited", "may result in",
    "could lead to", "warning", "temporary", "review required"
]


@dataclass
class PolicyFetchResult:
    """Result of fetching a policy page."""
    success: bool
    content_text: Optional[str] = None
    content_html: Optional[str] = None
    error: Optional[str] = None
    status_code: Optional[int] = None


@dataclass
class PolicyDiff:
    """Result of comparing two policy versions."""
    has_changes: bool
    change_summary: str
    added_keywords: list[str]
    removed_keywords: list[str]
    severity: str  # critical, warning, info
    severity_reason: str
    diff_html: str  # side-by-side diff for UI


def _strip_html(html_content: str) -> str:
    """Remove HTML tags and normalize whitespace."""
    if not html_content:
        return ""
    # Remove scripts and styles
    text = re.sub(r'<script[^>]*>.*?</script>', ' ', html_content, flags=re.DOTALL | re.IGNORECASE)
    text = re.sub(r'<style[^>]*>.*?</style>', ' ', text, flags=re.DOTALL | re.IGNORECASE)
    # Remove HTML tags
    text = re.sub(r'<[^>]+>', ' ', text)
    # Decode HTML entities
    text = html.unescape(text)
    # Normalize whitespace
    text = re.sub(r'\s+', ' ', text).strip()
    return text


def _compute_hash(content: str) -> str:
    """Compute SHA256 hash of content."""
    return hashlib.sha256(content.encode('utf-8')).hexdigest()


def _extract_keywords(text: str) -> set[str]:
    """Extract significant keywords from text."""
    # Lowercase, extract words 4+ chars
    words = re.findall(r'\b[a-z]{4,}\b', text.lower())
    # Filter common stop words
    stop_words = {
        'this', 'that', 'with', 'from', 'your', 'have', 'will', 'been',
        'them', 'they', 'their', 'about', 'which', 'when', 'what', 'just',
        'more', 'some', 'than', 'into', 'also', 'very', 'like', 'made',
        'page', 'help', 'content', 'policy', 'policies'
    }
    return set(w for w in words if w not in stop_words)


def _classify_severity(added_text: str, removed_text: str) -> tuple[str, str]:
    """Classify change severity based on keywords."""
    added_lower = added_text.lower()
    removed_lower = removed_text.lower()
    
    # Check for critical keywords in additions
    for keyword in CRITICAL_KEYWORDS:
        if keyword in added_lower:
            return "critical", f"Critical keyword detected: '{keyword}'"
    
    # Check for critical keywords in removals (policy relaxed = warning, not critical)
    critical_removed = any(kw in removed_lower for kw in CRITICAL_KEYWORDS)
    if critical_removed:
        return "warning", "Restrictive language removed (policy may be relaxed)"
    
    # Check for warning keywords
    for keyword in WARNING_KEYWORDS:
        if keyword in added_lower:
            return "warning", f"Warning keyword detected: '{keyword}'"
    
    return "info", "Minor changes or clarifications"


def _generate_diff_html(old_text: str, new_text: str) -> str:
    """Generate HTML side-by-side diff."""
    import difflib
    
    old_lines = old_text.split('\n') if old_text else []
    new_lines = new_text.split('\n') if new_text else []
    
    diff = difflib.HtmlDiff(wrapcolumn=80)
    return diff.make_table(old_lines, new_lines, 
                          fromdesc="Previous Version", 
                          todesc="Current Version",
                          context=True, numlines=3)


async def fetch_policy_page(url: str, timeout: int = 30) -> PolicyFetchResult:
    """Fetch a policy page and extract text."""
    # Note: Meta/Instagram return HTTP 400 when Accept: text/html is sent
    # (they fingerprint it as a bot). Omitting Accept entirely gets 200.
    headers = {
        'User-Agent': 'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)',
    }
    
    try:
        async with httpx.AsyncClient(timeout=timeout, follow_redirects=True) as client:
            response = await client.get(url, headers=headers)
            
            if response.status_code != 200:
                return PolicyFetchResult(
                    success=False,
                    error=f"HTTP {response.status_code}",
                    status_code=response.status_code
                )
            
            content_html = response.text
            content_text = _strip_html(content_html)
            
            if len(content_text) < 100:
                return PolicyFetchResult(
                    success=False,
                    error="Content too short, may be blocked or require JavaScript",
                    status_code=response.status_code
                )
            
            return PolicyFetchResult(
                success=True,
                content_text=content_text,
                content_html=content_html,
                status_code=response.status_code
            )
            
    except httpx.TimeoutException:
        return PolicyFetchResult(success=False, error="Request timeout")
    except httpx.ConnectError:
        return PolicyFetchResult(success=False, error="Connection error")
    except Exception as e:
        return PolicyFetchResult(success=False, error=str(e))


async def generate_change_summary(old_text: str, new_text: str, platform: str) -> str:
    """Use AI to generate a human-readable change summary."""
    try:
        # Truncate for token limits
        old_trunc = old_text[:2000] if old_text else "(first version)"
        new_trunc = new_text[:4000]
        
        system_prompt = f"""You are a policy analyst for {platform}. Summarize policy changes concisely.
Focus on what changed, why it matters, and any action required. 3-5 bullet points max."""
        
        prompt = f"""Previous policy:
{old_trunc}

New policy:
{new_trunc}

Provide a brief summary of key changes (3-5 bullet points):
-"""
        
        config = await get_model_config(AITaskType.SOCIAL_CAPTION)
        result = await generate_with_config(prompt, system_prompt, config)
        return result.strip()
    except Exception as e:
        logger.warning(f"AI summary generation failed: {e}")
        return "Policy content has changed. Manual review recommended."


async def compare_policy_versions(
    old_text: str, 
    new_text: str, 
    platform: str,
    use_ai_summary: bool = True
) -> PolicyDiff:
    """Compare two policy versions and generate diff report."""
    
    # Compute hashes
    old_hash = _compute_hash(old_text) if old_text else ""
    new_hash = _compute_hash(new_text)
    
    # Check if actually different
    if old_hash == new_hash:
        return PolicyDiff(
            has_changes=False,
            change_summary="No changes detected",
            added_keywords=[],
            removed_keywords=[],
            severity="info",
            severity_reason="Content unchanged",
            diff_html=""
        )
    
    # Extract keywords
    old_keywords = _extract_keywords(old_text)
    new_keywords = _extract_keywords(new_text)
    added_keywords = list(new_keywords - old_keywords)
    removed_keywords = list(old_keywords - new_keywords)
    
    # Classify severity
    severity, severity_reason = _classify_severity(new_text, old_text)
    
    # Generate summary
    if use_ai_summary:
        change_summary = await generate_change_summary(old_text, new_text, platform)
    else:
        # Fallback rule-based summary
        if added_keywords:
            change_summary = f"Added topics: {', '.join(added_keywords[:5])}. "
        if removed_keywords:
            change_summary += f"Removed topics: {', '.join(removed_keywords[:5])}."
        if not added_keywords and not removed_keywords:
            change_summary = "Restructured content with similar topics."
    
    # Generate HTML diff
    diff_html = _generate_diff_html(old_text, new_text)
    
    return PolicyDiff(
        has_changes=True,
        change_summary=change_summary,
        added_keywords=added_keywords,
        removed_keywords=removed_keywords,
        severity=severity,
        severity_reason=severity_reason,
        diff_html=diff_html
    )


async def check_policy_source(source_id: int, db: PostgresConnection) -> Optional[int]:
    """Check a policy source for changes. Returns new version ID if changed, None if same/failed."""
    
    # Get source info
    cursor = await db.execute(
        "SELECT * FROM policy_sources WHERE id = $1 AND is_active = TRUE",
        (source_id,)
    )
    source = await cursor.fetchone()
    if not source:
        logger.warning(f"Policy source {source_id} not found or inactive")
        return None
    
    source = dict(source)
    platform = source['platform']
    policy_type = source['policy_type']
    
    # Fetch current content
    fetch_result = await fetch_policy_page(source['source_url'])
    now = datetime.now(timezone.utc)
    
    # Get active version for comparison
    cursor = await db.execute(
        """SELECT id, content_text, content_hash FROM policy_versions 
           WHERE source_id = $1 AND status = 'active' 
           ORDER BY created_at DESC LIMIT 1""",
        (source_id,)
    )
    active_version = await cursor.fetchone()
    
    if not fetch_result.success:
        # Log failure
        await db.execute(
            """INSERT INTO policy_versions 
               (source_id, version, content_text, content_hash, status, 
                fetched_at, last_checked_at, fetch_attempts, fetch_error)
               VALUES ($1, $2, $3, $4, 'failed_fetch', $5, $6, 1, $7)""",
            (source_id, now.strftime("%Y-%m-%d-failed"), "", "", now, now, fetch_result.error)
        )
        await db.commit()
        logger.error(f"Failed to fetch {platform} {policy_type}: {fetch_result.error}")
        return None
    
    new_hash = _compute_hash(fetch_result.content_text)
    
    # If we have an active version, compare
    if active_version:
        active = dict(active_version)
        if active['content_hash'] == new_hash:
            # No change - just update last_checked_at
            await db.execute(
                "UPDATE policy_versions SET last_checked_at = $1 WHERE id = $2",
                (now, active['id'])
            )
            await db.commit()
            logger.info(f"No changes for {platform} {policy_type}")
            return None
        
        # Content changed - compare versions
        diff = await compare_policy_versions(
            active['content_text'], 
            fetch_result.content_text,
            platform
        )
        
        # Generate version string (date-based with revision)
        version_base = now.strftime("%Y-%m-%d")
        cursor = await db.execute(
            "SELECT COUNT(*) FROM policy_versions WHERE version LIKE $1",
            (f"{version_base}%",)
        )
        revision = (await cursor.fetchone())[0] + 1
        version = f"{version_base}-r{revision}"

        added_kw = diff.added_keywords
        removed_kw = diff.removed_keywords

        # Insert new pending version
        cursor = await db.execute(
            """INSERT INTO policy_versions 
               (source_id, version, content_text, content_html, content_hash, previous_hash,
                status, severity, severity_reason, change_summary, 
                added_keywords, removed_keywords,
                fetched_at, last_checked_at, fetch_attempts, created_at)
               VALUES ($1, $2, $3, $4, $5, $6, 'pending_review', $7, $8, $9, $10, $11, $12, $13, 1, $14)""",
            (source_id, version, fetch_result.content_text, fetch_result.content_html,
             new_hash, active['content_hash'],
             diff.severity, diff.severity_reason, diff.change_summary,
             added_kw, removed_kw,
             now, now, now)
        )
        new_version_id = cursor.lastrowid
        await db.commit()
        
        # Create notification for all admins
        await create_policy_notification(db, new_version_id, platform, policy_type, diff.severity)
        
        logger.info(f"New policy version detected for {platform} {policy_type}: {version} ({diff.severity})")
        return new_version_id
    
    else:
        # First version ever - create as pending_review
        version = now.strftime("%Y-%m-%d") + "-r1"
        
        cursor = await db.execute(
            """INSERT INTO policy_versions 
               (source_id, version, content_text, content_html, content_hash,
                status, severity, severity_reason, change_summary,
                fetched_at, last_checked_at, fetch_attempts, created_at)
               VALUES ($1, $2, $3, $4, $5, 'pending_review', 'info', 'First version', 'Initial policy capture',
                       $6, $7, 1, $8)""",
            (source_id, version, fetch_result.content_text, fetch_result.content_html,
             new_hash, now, now, now)
        )
        new_version_id = cursor.lastrowid
        await db.commit()
        
        await create_policy_notification(db, new_version_id, platform, policy_type, 'info')
        
        logger.info(f"Initial policy version created for {platform} {policy_type}: {version}")
        return new_version_id


async def create_policy_notification(
    db: PostgresConnection, 
    version_id: int, 
    platform: str, 
    policy_type: str,
    severity: str
) -> None:
    """Create in-app notification for admins about policy change."""
    
    # Get all admin emails (simplified - in production query admin_users table)
    cursor = await db.execute("SELECT DISTINCT username FROM admin_users WHERE is_active = TRUE")
    admins = await cursor.fetchall()
    
    policy_name = policy_type.replace('_', ' ').title()
    message = f"{platform.title()} {policy_name} has been updated and requires review."
    
    for admin in admins:
        await db.execute(
            """INSERT INTO policy_notifications 
               (policy_version_id, admin_email, message, severity)
               VALUES ($1, $2, $3, $4)""",
            (version_id, admin['username'], message, severity)
        )
    
    await db.commit()


async def approve_policy_version(
    version_id: int,
    admin_email: str,
    notes: Optional[str],
    db: PostgresConnection
) -> bool:
    """Approve a pending policy version, archive previous active."""
    
    # Get version info
    cursor = await db.execute(
        "SELECT source_id, status FROM policy_versions WHERE id = $1",
        (version_id,)
    )
    version = await cursor.fetchone()
    if not version or dict(version)['status'] != 'pending_review':
        return False
    
    version = dict(version)
    now = datetime.now(timezone.utc)
    
    # Archive current active version
    await db.execute(
        """UPDATE policy_versions 
           SET status = 'archived', archived_at = $1, purge_after = $2
           WHERE source_id = $3 AND status = 'active'""",
        (now, now + __import__('datetime').timedelta(days=730), version['source_id'])
    )

    # Activate new version
    await db.execute(
        """UPDATE policy_versions 
           SET status = 'active', approved_by = $1, approved_at = $2, approved_notes = $3, updated_at = $4
           WHERE id = $5""",
        (admin_email, now, notes or '', now, version_id)
    )

    # Log audit
    await db.execute(
        """INSERT INTO policy_audit_log 
           (policy_version_id, action, performed_by, notes, previous_status, new_status)
           VALUES ($1, 'approved', $2, $3, 'pending_review', 'active')""",
        (version_id, admin_email, notes or '')
    )
    
    await db.commit()
    logger.info(f"Policy version {version_id} approved by {admin_email}")
    return True


async def reject_policy_version(
    version_id: int,
    admin_email: str,
    reason: str,
    db: PostgresConnection
) -> bool:
    """Reject a pending policy version."""
    
    cursor = await db.execute(
        "SELECT status FROM policy_versions WHERE id = $1",
        (version_id,)
    )
    version = await cursor.fetchone()
    if not version or dict(version)['status'] != 'pending_review':
        return False
    
    now = datetime.now(timezone.utc)
    
    await db.execute(
        """UPDATE policy_versions 
           SET status = 'rejected', rejected_by = $1, rejected_at = $2, rejection_reason = $3, updated_at = $4
           WHERE id = $5""",
        (admin_email, now, reason, now, version_id)
    )

    await db.execute(
        """INSERT INTO policy_audit_log 
           (policy_version_id, action, performed_by, notes, previous_status, new_status)
           VALUES ($1, 'rejected', $2, $3, 'pending_review', 'rejected')""",
        (version_id, admin_email, reason)
    )
    
    await db.commit()
    logger.info(f"Policy version {version_id} rejected by {admin_email}: {reason}")
    return True


async def rollback_policy_version(
    version_id: int,
    admin_email: str,
    reason: str,
    db: PostgresConnection
) -> bool:
    """Rollback to previous version, archive current active."""
    
    # Get the version to rollback to
    cursor = await db.execute(
        """SELECT source_id, status, content_text, content_hash FROM policy_versions 
           WHERE id = $1""",
        (version_id,)
    )
    target = await cursor.fetchone()
    if not target:
        return False
    
    target = dict(target)
    if target['status'] not in ('archived', 'rejected'):
        # Can only rollback to previously active/archived versions
        return False
    
    now = datetime.now(timezone.utc)
    source_id = target['source_id']
    
    # Archive current active
    await db.execute(
        """UPDATE policy_versions 
           SET status = 'archived', archived_at = $1, purge_after = $2
           WHERE source_id = $3 AND status = 'active'""",
        (now, now + __import__('datetime').timedelta(days=730), source_id)
    )

    # Reactivate target version with new version string
    version = now.strftime("%Y-%m-%d") + "-rollback-r1"
    cursor = await db.execute(
        """INSERT INTO policy_versions 
           (source_id, version, content_text, content_hash, status, 
            is_manual_upload, uploaded_by, approved_by, approved_at, approved_notes, created_at)
           VALUES ($1, $2, $3, $4, 'active', TRUE, $5, $6, $7, $8, $9)""",
        (source_id, version, target['content_text'], target['content_hash'],
         admin_email, admin_email, now, f"Rollback from archived version {version_id}: {reason}", now)
    )
    _ = cursor.lastrowid

    await db.execute(
        """INSERT INTO policy_audit_log 
           (policy_version_id, action, performed_by, notes, previous_status, new_status)
           VALUES ($1, 'rollback', $2, $3, 'archived', 'active')""",
        (version_id, admin_email, reason)
    )
    
    await db.commit()
    logger.info(f"Policy rolled back to version {version_id} by {admin_email}")
    return True


async def manual_upload_policy(
    source_id: int,
    content_text: str,
    content_html: Optional[str],
    uploaded_by: str,
    notes: Optional[str],
    db: PostgresConnection
) -> int:
    """Manually upload a policy version (fallback when fetch is blocked)."""
    
    # Get source info
    cursor = await db.execute(
        "SELECT platform, policy_type FROM policy_sources WHERE id = $1",
        (source_id,)
    )
    source = await cursor.fetchone()
    if not source:
        raise ValueError(f"Policy source {source_id} not found")
    
    source = dict(source)
    now = datetime.now(timezone.utc)
    
    # Compare with active version if exists
    cursor = await db.execute(
        """SELECT content_text, content_hash FROM policy_versions 
           WHERE source_id = $1 AND status = 'active' 
           ORDER BY created_at DESC LIMIT 1""",
        (source_id,)
    )
    active = await cursor.fetchone()
    
    new_hash = _compute_hash(content_text)
    
    if active and dict(active)['content_hash'] == new_hash:
        raise ValueError("Uploaded content matches current active version (no changes)")
    
    # Generate diff if we have previous
    if active:
        diff = await compare_policy_versions(
            dict(active)['content_text'],
            content_text,
            source['platform']
        )
        previous_hash = dict(active)['content_hash']
        severity = diff.severity
        change_summary = diff.change_summary
        added_keywords = diff.added_keywords
        removed_keywords = diff.removed_keywords
    else:
        previous_hash = None
        severity = 'info'
        change_summary = notes or 'Manual upload - initial version'
        added_keywords = []
        removed_keywords = []
    
    # Create version string
    version_base = now.strftime("%Y-%m-%d")
    cursor = await db.execute(
        "SELECT COUNT(*) FROM policy_versions WHERE version LIKE $1",
        (f"{version_base}%",)
    )
    revision = (await cursor.fetchone())[0] + 1
    version = f"{version_base}-manual-r{revision}"

    # Insert as pending_review
    cursor = await db.execute(
        """INSERT INTO policy_versions 
           (source_id, version, content_text, content_html, content_hash, previous_hash,
            status, severity, severity_reason, change_summary, 
            added_keywords, removed_keywords,
            is_manual_upload, uploaded_by, fetched_at, last_checked_at, created_at)
           VALUES ($1, $2, $3, $4, $5, $6, 'pending_review', $7, $8, $9, $10, $11, TRUE, $12, $13, $14, $15)""",
        (source_id, version, content_text, content_html, new_hash, previous_hash,
         severity, 'Manual upload' if not active else severity, change_summary,
         added_keywords, removed_keywords,
         uploaded_by, now, now, now)
    )
    new_version_id = cursor.lastrowid
    
    # Create notification
    await create_policy_notification(db, new_version_id, source['platform'], source['policy_type'], severity)
    
    # Log audit
    await db.execute(
        """INSERT INTO policy_audit_log 
           (policy_version_id, action, performed_by, notes, previous_status, new_status)
           VALUES ($1, 'manual_upload', $2, $3, NULL, 'pending_review')""",
        (new_version_id, uploaded_by, notes or 'Manual policy upload')
    )
    
    await db.commit()
    logger.info(f"Manual policy upload for {source['platform']} {source['policy_type']}: {version}")
    return new_version_id
