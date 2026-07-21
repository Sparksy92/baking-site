"""
Image compliance checking service using GPT-4o Vision.

Checks images and videos for policy violations before posting.
Industry-leading feature: multimodal content moderation.
"""

import asyncio
import base64
import logging
from dataclasses import dataclass, field
from typing import Optional, List, Dict, Any
from datetime import datetime, timezone
from urllib.parse import urlparse
import httpx

from app.database import PostgresConnection
from app.config import get_settings
from app.services.ai_router import call_openai_vision

logger = logging.getLogger(__name__)


@dataclass
class ImageComplianceIssue:
    """A compliance issue detected in an image."""
    severity: str  # critical, warning, info
    category: str  # nudity, violence, copyright, text_overlay, etc.
    description: str
    confidence: float  # 0.0 to 1.0
    suggested_fix: str
    can_auto_fix: bool


@dataclass
class ImageComplianceResult:
    """Result of checking an image for compliance."""
    media_url: str
    media_type: str  # image, video
    status: str  # clean, warning, violation
    overall_severity: str
    issues: List[ImageComplianceIssue] = field(default_factory=list)
    ai_analysis: str = ""
    checked_at: datetime = field(default_factory=lambda: datetime.now(timezone.utc))
    
    # Safety scores (0.0 to 1.0, higher = more concerning)
    safety_scores: Dict[str, float] = field(default_factory=dict)


# Image category detection prompt for GPT-4o Vision
IMAGE_COMPLIANCE_PROMPT = """You are a content safety reviewer analyzing an image for social media compliance.

Analyze this image for the following policy violations. Return ONLY valid JSON in this exact format:
{
    "safe_for_work": true/false,
    "nudity_detected": true/false,
    "violence_detected": true/false,
    "hate_symbols": true/false,
    "text_overlay_readable": true/false,
    "copyright_concern": true/false,
    "quality_issues": ["blur", "dark", "overexposed"],
    "issues": [
        {
            "category": "nudity|violence|hate_symbol|copyright|text_unreadable|quality",
            "severity": "critical|warning|info",
            "description": "Brief explanation",
            "confidence": 0.95,
            "auto_fixable": true/false,
            "suggested_fix": "How to fix"
        }
    ],
    "safety_scores": {
        "nudity": 0.0,
        "violence": 0.0,
        "hate": 0.0,
        "spam": 0.0,
        "text_quality": 1.0
    },
    "analysis": "Brief overall assessment (2-3 sentences)"
}

Be strict but accurate. Only flag clear violations with confidence > 0.75.
For text_overlay_readable: check if text is legible at social media thumbnail sizes.
Important clarifications:
- Brand illustrations, sketches, cartoons, line art, and artwork of people are NOT violence.
- Violence requires actual depiction of real harm, weapons in threatening context, or blood/gore.
- Indigenous cultural art, portraits, and stylised brand mascots must NOT be flagged as violence.
- Confidence must genuinely reflect certainty — use <0.5 for ambiguous or artistic content.
"""


async def check_image_compliance(
    image_url: str,
    platform: str,
    db: PostgresConnection,
    content_id: Optional[int] = None
) -> ImageComplianceResult:
    """
    Check an image for compliance violations using GPT-4o Vision.
    
    Args:
        image_url: URL of the image to check
        platform: Target platform (instagram, facebook, etc.)
        db: Database connection
        content_id: Associated social post ID if known
    
    Returns:
        ImageComplianceResult with issues and safety scores
    """
    
    settings = get_settings()
    api_key = settings.openai_api_key or settings.openrouter_api_key
    
    if not api_key:
        logger.warning("Image compliance check skipped: no AI API key configured")
        return ImageComplianceResult(
            media_url=image_url,
            media_type='image',
            status='unchecked',
            overall_severity='info',
            ai_analysis="Image compliance checking requires OpenAI or OpenRouter API key"
        )
    
    try:
        # Download image
        image_bytes, mime_type = await _download_image(image_url)
        
        if not image_bytes:
            logger.warning(f"Could not download image: {image_url}")
            return ImageComplianceResult(
                media_url=image_url,
                media_type='image',
                status='warning',
                overall_severity='warning',
                issues=[ImageComplianceIssue(
                    severity='warning',
                    category='download_failed',
                    description='Could not download image for compliance check',
                    confidence=1.0,
                    suggested_fix='Verify image URL is accessible',
                    can_auto_fix=False
                )]
            )
        
        use_openrouter = not settings.openai_api_key and bool(settings.openrouter_api_key)
        
        # Call vision API
        response = await call_openai_vision(
            image_bytes=image_bytes,
            mime_type=mime_type,
            prompt=IMAGE_COMPLIANCE_PROMPT,
            api_key=api_key,
            max_tokens=500,
            use_openrouter=use_openrouter
        )
        
        # Parse JSON response
        import json
        try:
            # Clean up markdown fences if present
            cleaned = response.strip()
            if cleaned.startswith('```json'):
                cleaned = cleaned[7:]
            if cleaned.endswith('```'):
                cleaned = cleaned[:-3]
            cleaned = cleaned.strip()
            
            data = json.loads(cleaned)
        except json.JSONDecodeError as e:
            logger.warning(f"Failed to parse vision response: {e}")
            return ImageComplianceResult(
                media_url=image_url,
                media_type='image',
                status='warning',
                overall_severity='warning',
                ai_analysis=f"Could not parse AI response: {response[:200]}"
            )
        
        # Extract issues
        issues = []
        for issue_data in data.get('issues', []):
            issues.append(ImageComplianceIssue(
                severity=issue_data.get('severity', 'warning'),
                category=issue_data.get('category', 'other'),
                description=issue_data.get('description', 'Issue detected'),
                confidence=issue_data.get('confidence', 0.5),
                suggested_fix=issue_data.get('suggested_fix', 'Review image manually'),
                can_auto_fix=issue_data.get('auto_fixable', False)
            ))
        
        # Determine status — only count issues that meet the confidence threshold.
        # The AI prompt says >0.7 but we enforce it in code too to prevent false
        # positives (e.g. brand illustrations misclassified as violent content).
        CRITICAL_CONFIDENCE_MIN = 0.75
        WARNING_CONFIDENCE_MIN  = 0.60
        critical_count = len([i for i in issues if i.severity == 'critical' and i.confidence >= CRITICAL_CONFIDENCE_MIN])
        warning_count  = len([i for i in issues if i.severity == 'warning'  and i.confidence >= WARNING_CONFIDENCE_MIN])
        
        if critical_count > 0:
            status = 'violation'
            severity = 'critical'
        elif warning_count > 0:
            status = 'warning'
            severity = 'warning'
        else:
            status = 'clean'
            severity = 'clean'
        
        result = ImageComplianceResult(
            media_url=image_url,
            media_type='image',
            status=status,
            overall_severity=severity,
            issues=issues,
            ai_analysis=data.get('analysis', ''),
            safety_scores=data.get('safety_scores', {})
        )
        
        # Save to database
        await _save_image_compliance_check(result, content_id, db, platform)
        
        return result
        
    except Exception as e:
        logger.error(f"Image compliance check failed: {e}")
        return ImageComplianceResult(
            media_url=image_url,
            media_type='image',
            status='warning',
            overall_severity='warning',
            issues=[ImageComplianceIssue(
                severity='warning',
                category='check_failed',
                description=f'Compliance check failed: {str(e)}',
                confidence=1.0,
                suggested_fix='Manual review required',
                can_auto_fix=False
            )]
        )


async def _download_image(image_url: str) -> tuple[Optional[bytes], str]:
    """Download an image from URL."""
    try:
        async with httpx.AsyncClient() as client:
            resp = await client.get(image_url, timeout=30.0, follow_redirects=True)
            resp.raise_for_status()
            
            content_type = resp.headers.get('content-type', 'image/jpeg')
            # Normalize mime type
            if 'jpeg' in content_type or 'jpg' in content_type:
                mime_type = 'image/jpeg'
            elif 'png' in content_type:
                mime_type = 'image/png'
            elif 'gif' in content_type:
                mime_type = 'image/gif'
            elif 'webp' in content_type:
                mime_type = 'image/webp'
            else:
                mime_type = content_type
            
            return resp.content, mime_type
            
    except Exception as e:
        logger.warning(f"Failed to download image {image_url}: {e}")
        return None, 'image/jpeg'


async def _save_image_compliance_check(
    result: ImageComplianceResult,
    content_id: Optional[int],
    db: PostgresConnection,
    platform: str = 'unknown'
) -> None:
    """Save image compliance check to database."""
    
    import json
    
    issues_json = [
        {
            'severity': i.severity,
            'category': i.category,
            'description': i.description,
            'confidence': i.confidence,
            'suggested_fix': i.suggested_fix,
            'auto_fixable': i.can_auto_fix
        }
        for i in result.issues
    ]
    
    await db.execute("""
        INSERT INTO content_compliance_checks 
        (content_id, platform, media_url, media_type, status, severity, issues_json, ai_analysis, 
         safety_scores_json, checked_at, can_auto_fix)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    """, (
        content_id,
        platform,
        result.media_url,
        result.media_type,
        result.status,
        result.overall_severity,
        json.dumps(issues_json),
        result.ai_analysis,
        json.dumps(result.safety_scores),
        result.checked_at,
        any(i.can_auto_fix for i in result.issues)
    ))
    await db.commit()


async def check_full_post_compliance(
    content: str,
    image_url: Optional[str],
    video_url: Optional[str],
    platform: str,
    db: PostgresConnection,
    content_id: Optional[int] = None
) -> Dict[str, Any]:
    """
    Check complete post compliance: text + image + URLs.
    Industry-leading: comprehensive multimodal checking.
    """
    
    from app.services.content_compliance_service import check_content_compliance
    from app.services.url_compliance_service import check_url_safety
    
    results = {
        'text': None,
        'image': None,
        'video': None,
        'urls': [],
        'overall_status': 'clean',
        'overall_severity': 'clean',
        'can_publish': True,
        'blocking_issues': []
    }
    
    # Check text content
    text_check = await check_content_compliance(content, platform, db, content_id, use_ai=True)
    results['text'] = {
        'status': text_check.status,
        'severity': text_check.overall_severity,
        'issues_count': len(text_check.issues),
        'can_auto_fix': text_check.can_auto_fix
    }
    
    # Check image if present
    if image_url:
        image_check = await check_image_compliance(image_url, platform, db, content_id)
        results['image'] = {
            'status': image_check.status,
            'severity': image_check.overall_severity,
            'issues_count': len(image_check.issues),
            'safety_scores': image_check.safety_scores
        }
    
    # Check video if present (placeholder - would need frame extraction)
    if video_url:
        results['video'] = {
            'status': 'unchecked',
            'note': 'Video compliance requires frame-by-frame analysis'
        }
    
    # Check URLs in content
    urls = _extract_urls(content)
    for url in urls:
        url_check = await check_url_safety(url)
        results['urls'].append({
            'url': url,
            'safe': url_check['safe'],
            'category': url_check.get('category', 'unknown')
        })
    
    # Determine overall status
    all_severities = [results['text']['severity']]
    if results['image']:
        all_severities.append(results['image']['severity'])
    
    if 'critical' in all_severities:
        results['overall_status'] = 'violation'
        results['overall_severity'] = 'critical'
        results['can_publish'] = False
    elif 'warning' in all_severities:
        results['overall_status'] = 'warning'
        results['overall_severity'] = 'warning'
    
    # Collect blocking issues
    if results['text']['severity'] == 'critical':
        results['blocking_issues'].append('Text contains critical violations')
    if results.get('image', {}).get('severity') == 'critical':
        results['blocking_issues'].append('Image contains critical violations')
    
    for url_result in results['urls']:
        if not url_result['safe']:
            results['can_publish'] = False
            results['blocking_issues'].append(f"Unsafe URL detected: {url_result['url']}")
    
    return results


def _extract_urls(text: str) -> List[str]:
    """Extract URLs from text content."""
    import re
    
    url_pattern = r'https?://[^\s<>"{}|\\^`[\]]+'
    urls = re.findall(url_pattern, text)
    
    # Also check for www. domains without protocol
    www_pattern = r'www\.[^\s<>"{}|\\^`[\]]+\.[^\s<>"{}|\\^`[\]]+'
    www_matches = re.findall(www_pattern, text)
    urls.extend([f"https://{u}" for u in www_matches])
    
    return list(set(urls))  # Deduplicate


def _grade_from_rate(rate: float) -> str:
    """Map a compliance clean-rate (0.0–1.0) to a letter grade."""
    if rate >= 0.95:
        return 'A'
    if rate >= 0.80:
        return 'B'
    if rate >= 0.65:
        return 'C'
    if rate >= 0.50:
        return 'D'
    return 'F'


def _grade_from_score(score: int) -> str:
    """Map a 0-100 health score to a letter grade."""
    if score >= 95:
        return 'A+'
    if score >= 90:
        return 'A'
    if score >= 80:
        return 'B'
    if score >= 70:
        return 'C'
    if score >= 60:
        return 'D'
    return 'F'


def _build_platform_breakdown(platform_rows: list) -> dict:
    """Convert raw platform query rows to a grade-annotated breakdown dict."""
    by_platform: dict = {}
    for pr in platform_rows:
        plat_total = max(pr['posts'], 1)
        plat_grade = _grade_from_rate(pr['clean'] / plat_total)
        by_platform[pr['platform']] = {
            'grade': plat_grade,
            'posts': pr['posts'],
            'violations': pr['violations'],
            'warnings': pr['warnings'],
            'clean': pr['clean'],
        }
    return by_platform


def _build_recent_issues(recent_rows: list) -> list:
    """Convert raw recent-compliance rows to the issues-feed format."""
    import json as _json
    result = []
    for rr in recent_rows:
        try:
            issues_list = _json.loads(rr.get('issues_json') or '[]')
        except Exception:
            issues_list = []
        checked = rr.get('checked_at')
        result.append({
            'id': rr['id'],
            'platform': rr['platform'],
            'content_preview': (rr.get('content') or '')[:120],
            'status': rr['status'],
            'severity': rr['severity'],
            'checked_at': checked.isoformat() if hasattr(checked, 'isoformat') else str(checked or ''),
            'issues_count': len(issues_list),
        })
    return result


async def get_compliance_scorecard(
    days: int = 30,
    platform: Optional[str] = None,
    db: PostgresConnection = None
) -> Dict[str, Any]:
    """
    Get account compliance health scorecard.
    Industry-leading: comprehensive compliance analytics.
    """
    
    from datetime import timedelta
    
    cutoff_date = datetime.now(timezone.utc) - timedelta(days=days)
    
    # Base query
    where_clause = "WHERE checked_at >= ?"
    params = [cutoff_date]
    
    if platform:
        where_clause += " AND platform = ?"
        params.append(platform)
    
    # Get overall stats
    cursor = await db.execute(f"""
        SELECT 
            COUNT(*) as total_checks,
            SUM(CASE WHEN status = 'clean' THEN 1 ELSE 0 END) as clean_count,
            SUM(CASE WHEN status = 'warning' THEN 1 ELSE 0 END) as warning_count,
            SUM(CASE WHEN status = 'violation' THEN 1 ELSE 0 END) as violation_count,
            AVG(CASE WHEN status = 'clean' THEN 1.0 ELSE 0.0 END) as compliance_rate
        FROM content_compliance_checks
        {where_clause}
    """, params)
    
    row = await cursor.fetchone()
    
    # Get issue breakdown — PostgreSQL: jsonb_array_elements over issues_json cast to jsonb
    # Alias the main table so WHERE checked_at / platform refs work alongside the lateral join
    issues_where = where_clause.replace("WHERE ", "WHERE ccc.", 1)
    if platform:
        issues_where = issues_where.replace(" AND platform = ", " AND ccc.platform = ", 1)
    cursor = await db.execute(f"""
        SELECT 
            elem->>'category' AS category,
            COUNT(*) AS count
        FROM content_compliance_checks ccc,
        jsonb_array_elements(ccc.issues_json::jsonb) AS elem
        {issues_where}
        GROUP BY category
        ORDER BY count DESC
        LIMIT 10
    """, params)
    
    top_issues = [dict(r) for r in await cursor.fetchall()]

    # Get per-platform breakdown
    cursor = await db.execute(f"""
        SELECT
            platform,
            COUNT(*) AS posts,
            SUM(CASE WHEN status = 'violation' THEN 1 ELSE 0 END) AS violations,
            SUM(CASE WHEN status = 'warning'   THEN 1 ELSE 0 END) AS warnings,
            SUM(CASE WHEN status = 'clean'     THEN 1 ELSE 0 END) AS clean
        FROM content_compliance_checks
        {where_clause}
        GROUP BY platform
    """, params)
    platform_rows = [dict(r) for r in await cursor.fetchall()]
    by_platform = _build_platform_breakdown(platform_rows)

    # Get trend (compliance rate over time)
    cursor = await db.execute(f"""
        SELECT 
            DATE(checked_at) AS check_date,
            SUM(CASE WHEN status = 'violation' THEN 1 ELSE 0 END) AS violations,
            SUM(CASE WHEN status = 'warning'   THEN 1 ELSE 0 END) AS warnings,
            SUM(CASE WHEN status = 'clean'     THEN 1 ELSE 0 END) AS clean
        FROM content_compliance_checks
        {where_clause}
        GROUP BY DATE(checked_at)
        ORDER BY check_date DESC
        LIMIT 30
    """, params)
    trend_rows = [dict(r) for r in await cursor.fetchall()]
    trend_rows.reverse()
    trends = {
        'dates':      [r['check_date'].isoformat() if hasattr(r['check_date'], 'isoformat') else str(r['check_date']) for r in trend_rows],
        'violations': [r['violations'] for r in trend_rows],
        'warnings':   [r['warnings']   for r in trend_rows],
        'clean':      [r['clean']       for r in trend_rows],
    }

    # Get recent issues for the issues feed
    # where_clause already starts with WHERE, so extend with AND
    recent_where = where_clause.replace("WHERE ", "WHERE c.", 1) + " AND c.status != 'clean'"
    cursor = await db.execute(f"""
        SELECT c.id, c.platform, c.status, c.severity, c.checked_at, c.issues_json,
               sp.content
        FROM content_compliance_checks c
        LEFT JOIN social_posts sp ON sp.id = c.content_id
        {recent_where}
        ORDER BY c.checked_at DESC
        LIMIT 20
    """, params)
    recent_rows = [dict(r) for r in await cursor.fetchall()]
    recent_issues = _build_recent_issues(recent_rows)
    
    # Calculate health score (0-100)
    total = row['total_checks'] or 1
    clean_rate = (row['clean_count'] or 0) / total
    warning_rate = (row['warning_count'] or 0) / total
    violation_rate = (row['violation_count'] or 0) / total
    
    health_score = int(
        (clean_rate * 100) + 
        (warning_rate * 50) + 
        (violation_rate * 0)
    )
    
    grade = _grade_from_score(health_score)
    
    return {
        # Keys aligned with frontend ComplianceScorecard interface
        'overall_grade': grade,
        'overall_score': health_score,
        'period_days': days,
        'total_posts_checked': row['total_checks'] or 0,
        'violations_count': row['violation_count'] or 0,
        'warnings_count': row['warning_count'] or 0,
        'clean_count': row['clean_count'] or 0,
        'auto_fixes_applied': 0,  # future: query auto_fixed=TRUE
        'by_platform': by_platform,
        'trends': trends,
        'top_violations': [
            {'category': t.get('category', 'unknown'), 'count': t.get('count', 0), 'severity': 'warning'}
            for t in top_issues
        ],
        'recent_issues': recent_issues,
        'recommendations': _generate_recommendations(health_score, top_issues),
    }


def _generate_recommendations(health_score: int, top_issues: List[Dict]) -> List[str]:
    """Generate actionable recommendations based on scorecard data."""
    
    recommendations = []
    
    if health_score < 70:
        recommendations.append("Critical: Implement mandatory pre-publish compliance checks")
        recommendations.append("Review and update content guidelines with your team")
    elif health_score < 85:
        recommendations.append("Good progress: Focus on reducing top issue categories")
    
    if top_issues:
        top_category = top_issues[0].get('category', 'unknown')
        recommendations.append(f"Top issue: {top_category} - consider adding rule-based filters")
    
    if health_score >= 95:
        recommendations.append("Excellent! Your content is highly compliant. Maintain current practices.")
    
    return recommendations
