"""
Content compliance checking service.

Checks generated social posts against active platform policies.
Supports both manual flagging and auto-regeneration workflows.
"""

import re
from dataclasses import dataclass, field
from typing import Optional, List
from datetime import datetime, timezone

from app.database import PostgresConnection
from app.services.ai_service import generate_with_config, get_model_config, AITaskType

import logging

logger = logging.getLogger(__name__)


@dataclass
class ComplianceIssue:
    """A single compliance issue found in content."""
    severity: str  # critical, warning, info
    category: str  # hate_speech, harassment, violence, misinformation, etc.
    policy_reference: str  # which policy rule triggered
    description: str  # human-readable explanation
    excerpt: str  # the problematic text snippet
    suggested_fix: str  # how to fix it
    auto_fixable: bool  # can AI automatically fix this?


@dataclass
class ComplianceCheckResult:
    """Result of checking content against policies."""
    content_id: Optional[int]  # social_posts.id if saved
    platform: str
    status: str  # clean, warning, violation
    overall_severity: str  # critical, warning, info, clean
    issues: List[ComplianceIssue] = field(default_factory=list)
    ai_analysis: str = ""  # LLM-generated assessment
    checked_at: datetime = field(default_factory=lambda: datetime.now(timezone.utc))
    policy_version_id: Optional[int] = None  # which policy version was checked against
    
    # For auto-regeneration
    can_auto_fix: bool = False
    suggested_replacement: Optional[str] = None
    fix_attempts: int = 0
    max_fix_attempts: int = 2


# Policy violation patterns (rule-based pre-filtering)
POLICY_PATTERNS = {
    'hate_speech': {
        'patterns': [
            r'\b(hate|hating|hatred)\b',
            r'\b(kill all|death to)\b',
            r'\b(inferior race|superior race)\b',
        ],
        'severity': 'critical',
        'platforms': ['facebook', 'instagram', 'x', 'linkedin', 'tiktok', 'youtube', 'threads']
    },
    'harassment': {
        'patterns': [
            r'\b(stupid|idiot|moron|dumb)\b.*\b(people|person|group)\b',
            r'\b(go kill yourself|kys)\b',
            r'\b(ugly|fat|disgusting)\b.*\b(person|people|women|men)\b',
        ],
        'severity': 'critical',
        'platforms': ['facebook', 'instagram', 'x', 'linkedin', 'tiktok', 'youtube', 'threads']
    },
    'violence': {
        'patterns': [
            # Require explicit violent context — avoid false positives on
            # figurative use: "fight against", "fight for", "cyber attack",
            # "attack the problem", "shoot your shot", "heart attack" etc.
            r'\b(beat up|punch|stab)\b',
            r'\bshoot\b(?!\s+(for|your\s+shot|the\s+moon|a\s+photo|footage|content|video))',
            r'\bfight\b\s+\b(someone|him|her|them|you)\b',
            r'\b(weapon|gun|knife)\b.*\b(use|get|buy|carry|bring)\b',
        ],
        'severity': 'critical',
        'platforms': ['facebook', 'instagram', 'x', 'linkedin', 'tiktok', 'youtube', 'threads']
    },
    'misinformation_health': {
        'patterns': [
            r'\b(cure|cures|cured)\b.*\b(cancer|diabetes|disease)\b',
            r'\b(vaccine|vaccines)\b.*\b(cause|causes|harm|kills)\b',
            r'\b(natural remedy|cures all|miracle cure)\b',
        ],
        'severity': 'critical',
        'platforms': ['facebook', 'instagram', 'youtube']
    },
    'misinformation_election': {
        'patterns': [
            r'\b(rigged|stolen)\b.*\b(election|vote|voting)\b',
            r'\b(fraud|fake)\b.*\b(ballot|ballots|votes)\b',
        ],
        'severity': 'warning',
        'platforms': ['facebook', 'instagram', 'x']
    },
    'spam': {
        'patterns': [
            r'(click\s*link|link\s*in\s*bio)\b.*\b(dm|message)\b',
            r'\b(free money|make money fast|earn \$\d+.*daily)\b',
            r'\b(100% guaranteed|no risk|act now|limited time)\b',
        ],
        'severity': 'warning',
        'platforms': ['facebook', 'instagram', 'x', 'linkedin', 'tiktok']
    },
    'self_harm': {
        'patterns': [
            r'\b(suicide|self.?harm|cutting|end my life)\b',
        ],
        'severity': 'critical',
        'platforms': ['facebook', 'instagram', 'x', 'tiktok', 'threads']
    },
    'copyright': {
        'patterns': [
            r'\b(full movie|full album|download free|pirated)\b',
            r'\b(leaked|unreleased)\b.*\b(song|album|movie|episode)\b',
        ],
        'severity': 'warning',
        'platforms': ['facebook', 'instagram', 'youtube', 'tiktok']
    },
    'sexual_content': {
        'patterns': [
            r'\b(nude|naked|sex|porn)\b',
            r'\b(onlyfans|adult content|nsfw)\b',
        ],
        'severity': 'critical',
        'platforms': ['facebook', 'instagram', 'linkedin', 'tiktok', 'youtube', 'threads']
    },
    'dangerous_organizations': {
        'patterns': [
            r'\b(terrorist|terrorism|isis|al-qaeda)\b',
            r'\b(join our movement|overthrow|revolution now)\b',
        ],
        'severity': 'critical',
        'platforms': ['facebook', 'instagram', 'x', 'linkedin', 'tiktok', 'youtube', 'threads']
    },
    'bullying': {
        'patterns': [
            r'\b(loser|lame|pathetic|worthless)\b.*\b(person|you|they)\b',
        ],
        'severity': 'warning',
        'platforms': ['facebook', 'instagram', 'x', 'tiktok', 'threads']
    },
    'profanity': {
        'patterns': [
            # f*ck variations including leetspeak
            r'\b(f+u+c+k+[a-z]*|f+u+k+|f+u+c+|f+k+|f+u+q+|f+[\*\-_]*c+k+|f+[\*\-_]*k)\b',
            # s*it variations
            r'\b(s+h+[i1e3]+t+|s+h+[i1]+t+|s+h+[e3]+t+|s+[\*\-_]+t)\b',
            # b*tch variations
            r'\b(b+[i1e3]+t+c+h+|b+[i1]+c+h+|b+[i1e3]+c+h+|b+[\*\-_]+t+c+h+)\b',
            # a*s variations (careful with false positives)
            r'\b(a+s+s+h+o+l+e+|a+s+s+w+[i1]+p+e+|a+s+s+h+a+t+|a+s+s+\b)',  # ass as standalone word
            r'\b(d+a+m+n+|d+[i1]+c+k+|d+[i1]+k+|c+u+n+t+|c+u+m+)\b',
            r'\b(p+[i1]+s+s+|p+r+[i1]+c+k+|w+h+o+r+e+|s+l+u+t+|b+a+s+t+a+r+d+)\b',
            r'\b(b+[o0]+l+l+[o0]+c+k+s*|n+u+t+s+a+c+k+)\b',
        ],
        'severity': 'warning',  # warning allows publishing, critical blocks
        'platforms': ['facebook', 'instagram', 'x', 'linkedin', 'tiktok', 'youtube', 'threads']
    }
}


def _rule_based_check(content: str, platform: str) -> List[ComplianceIssue]:
    """Pre-screen content with rule-based patterns."""
    issues = []
    content_lower = content.lower()
    
    # False positive words to exclude (scunthorpe problem protection)
    FALSE_POSITIVE_WORDS = {
        'scunthorpe', 'sussex', 'arsenal', 'bass', 'grass', 'class', 'pass', 'mass',
        'assassin', 'assassinate', 'assassination', 'passenger', 'passage', 'passable',
        'analysis', 'analytical', 'analyze', 'assistant', 'assistance', 'associate',
        'assume', 'assumption', 'assure', 'assessment', 'assign', 'assignment',
        'assist', 'asset', 'assemble', 'assembly', 'assert', 'assertion',
        'bassist', 'compass', 'encompass', 'glass', 'embassy', 'harass', 'harassment',
        'casserole', 'cassette', 'classic', 'classify', 'classroom', 'sassy',
        'docume', 'documer', 'document', 'documentation',  # protect "document"
    }
    
    for category, config in POLICY_PATTERNS.items():
        if platform not in config['platforms']:
            continue
            
        for pattern in config['patterns']:
            matches = re.finditer(pattern, content_lower, re.IGNORECASE)
            for match in matches:
                # Extract the matched word for false positive check
                matched_word = match.group(0).lower().strip()
                
                # Check against false positives for profanity category
                if category == 'profanity':
                    # Check if the matched word is a false positive
                    is_false_positive = any(
                        fp in matched_word or matched_word in fp 
                        for fp in FALSE_POSITIVE_WORDS
                    )
                    # Also check if it's part of a longer legitimate word
                    word_start = max(0, match.start() - 1)
                    word_end = min(len(content), match.end() + 1)
                    surrounding = content_lower[word_start:word_end]
                    if is_false_positive or surrounding in FALSE_POSITIVE_WORDS:
                        continue  # Skip this match
                
                excerpt = content[max(0, match.start()-30):min(len(content), match.end()+30)]
                issues.append(ComplianceIssue(
                    severity=config['severity'],
                    category=category,
                    policy_reference=f"{platform}_{category}",
                    description=f"Detected potential {category.replace('_', ' ')}",
                    excerpt=excerpt,
                    suggested_fix="Remove or rephrase flagged content",
                    auto_fixable=config['severity'] != 'critical'  # Critical needs manual review
                ))
    
    return issues


async def _check_urls_in_content(content: str, platform: str) -> List[ComplianceIssue]:
    """Check for unsafe URLs in content."""
    import re
    from app.services.url_compliance_service import check_url_safety
    
    issues = []
    
    # Extract URLs from content
    url_pattern = r'https?://[^\s<>"{}|\\^`\[\]]+[^\s<>"{}|\\^`\[\]).,;!?\'"]'
    urls = re.findall(url_pattern, content)
    
    for url in urls:
        result = await check_url_safety(url)
        if not result['is_safe']:
            issues.append(ComplianceIssue(
                severity='critical',
                category='unsafe_url',
                policy_reference=f"{platform}_url_safety",
                description=f"Unsafe URL detected: {result.get('threats', ['Unknown threat'])[0] if result.get('threats') else 'URL flagged as unsafe'}",
                excerpt=url,
                suggested_fix='Remove unsafe URL or replace with trusted source',
                auto_fixable=False
            ))
    
    return issues


async def _ai_compliance_check(
    content: str, 
    platform: str, 
    active_policy_text: Optional[str]
) -> tuple[List[ComplianceIssue], str]:
    """Use LLM to check content against policy."""
    
    system_prompt = f"""You are a content compliance reviewer for {platform}. 
Analyze the provided social media post for policy violations.

Respond ONLY with a JSON object in this format:
{{
    "status": "clean|warning|violation",
    "severity": "critical|warning|info",
    "issues": [
        {{
            "category": "hate_speech|harassment|violence|misinformation|spam|self_harm|copyright|sexual_content|dangerous_org|bullying|other",
            "description": "Brief explanation of the issue",
            "excerpt": "The problematic text",
            "suggested_fix": "How to fix it",
            "auto_fixable": true|false
        }}
    ],
    "analysis": "Brief overall assessment"
}}

Be strict but fair. Flag actual violations, not borderline content."""

    policy_context = f"\n\nActive {platform} policy excerpt:\n{active_policy_text[:2000]}" if active_policy_text else ""
    
    prompt = f"""Post to review:
\"\"\"
{content}
\"\"\"
{policy_context}

Analyze for compliance. Return JSON only."""

    try:
        config = await get_model_config(AITaskType.MODERATION)
        result = await generate_with_config(prompt, system_prompt, config)
        
        # Parse JSON response
        import json
        # Extract JSON if wrapped in markdown
        json_match = re.search(r'```json\s*(\{.*?\})\s*```', result, re.DOTALL)
        if json_match:
            result = json_match.group(1)
        
        data = json.loads(result)
        
        issues = []
        for issue_data in data.get('issues', []):
            issues.append(ComplianceIssue(
                severity=data.get('severity', 'warning'),
                category=issue_data.get('category', 'other'),
                policy_reference=f"{platform}_{issue_data.get('category', 'other')}",
                description=issue_data.get('description', 'Policy violation detected'),
                excerpt=issue_data.get('excerpt', ''),
                suggested_fix=issue_data.get('suggested_fix', 'Review and revise content'),
                auto_fixable=issue_data.get('auto_fixable', False)
            ))
        
        return issues, data.get('analysis', 'Content reviewed')
        
    except Exception as e:
        logger.warning(f"AI compliance check failed: {e}")
        return [], f"AI check failed: {str(e)}"


async def check_content_compliance(
    content: str,
    platform: str,
    db: PostgresConnection,
    content_id: Optional[int] = None,
    use_ai: bool = True,
    hashtags: Optional[List[str]] = None,
    image_url: Optional[str] = None
) -> ComplianceCheckResult:
    """
    Check content against active platform policies.
    Returns compliance status with issues and suggested fixes.
    """
    
    # Get active policy for platform
    cursor = await db.execute("""
        SELECT pv.id, pv.content_text 
        FROM policy_versions pv
        JOIN policy_sources ps ON pv.source_id = ps.id
        WHERE ps.platform = ? AND pv.status = 'active'
        ORDER BY pv.approved_at DESC
        LIMIT 1
    """, (platform,))
    
    policy_row = await cursor.fetchone()
    active_policy_text = policy_row['content_text'] if policy_row else None
    policy_version_id = policy_row['id'] if policy_row else None
    
    # Build full text to check (content + hashtags)
    full_text = content
    if hashtags:
        hashtag_text = ' '.join([f'#{tag}' for tag in hashtags])
        full_text = f"{content}\n{hashtag_text}"
    
    # Check URLs in content for safety
    url_issues = await _check_urls_in_content(content, platform)
    
    # Rule-based pre-check on full text (content + hashtags)
    rule_issues = _rule_based_check(full_text, platform)
    rule_issues.extend(url_issues)
    
    # AI check if enabled and no critical rule violations
    ai_issues = []
    ai_analysis = ""
    if use_ai and len([i for i in rule_issues if i.severity == 'critical']) == 0:
        # Use full_text (content + hashtags) for AI check, not just content
        ai_issues, ai_analysis = await _ai_compliance_check(full_text, platform, active_policy_text)
    
    # Combine issues (rule-based takes precedence for duplicates)
    all_issues = rule_issues.copy()
    ai_categories = {i.category for i in rule_issues}
    for issue in ai_issues:
        if issue.category not in ai_categories:
            all_issues.append(issue)
    
    # Check for image compliance if image_url provided
    if image_url:
        from app.services.image_compliance_service import check_image_compliance
        image_result = await check_image_compliance(image_url, platform, db)
        if image_result.status == 'violation':
            first_issue = image_result.issues[0].description if image_result.issues else 'Image violates platform policy'
            all_issues.append(ComplianceIssue(
                severity='critical',
                category='image_violation',
                policy_reference=f"{platform}_image",
                description=first_issue,
                excerpt='Image content',
                suggested_fix='Replace with compliant image or remove',
                auto_fixable=False
            ))
    
    # Determine overall status
    critical_count = len([i for i in all_issues if i.severity == 'critical'])
    warning_count = len([i for i in all_issues if i.severity == 'warning'])
    
    if critical_count > 0:
        overall_status = 'violation'
        overall_severity = 'critical'
    elif warning_count > 0:
        overall_status = 'warning'
        overall_severity = 'warning'
    elif len(all_issues) > 0:
        overall_status = 'warning'
        overall_severity = 'info'
    else:
        overall_status = 'clean'
        overall_severity = 'clean'
    
    # Check if auto-fixable
    auto_fixable_issues = [i for i in all_issues if i.auto_fixable]
    can_auto_fix = len(auto_fixable_issues) > 0 and critical_count == 0
    
    result = ComplianceCheckResult(
        content_id=content_id,
        platform=platform,
        status=overall_status,
        overall_severity=overall_severity,
        issues=all_issues,
        ai_analysis=ai_analysis,
        policy_version_id=policy_version_id,
        can_auto_fix=can_auto_fix,
        fix_attempts=0
    )
    
    # Save check result to database
    await _save_compliance_check(result, db)
    
    return result


async def _save_compliance_check(result: ComplianceCheckResult, db: PostgresConnection) -> None:
    """Save compliance check result to audit log."""
    
    issues_json = [
        {
            'severity': i.severity,
            'category': i.category,
            'description': i.description,
            'excerpt': i.excerpt,
            'suggested_fix': i.suggested_fix,
            'auto_fixable': i.auto_fixable
        }
        for i in result.issues
    ]
    
    import json
    
    await db.execute("""
        INSERT INTO content_compliance_checks 
        (content_id, platform, status, severity, issues_json, ai_analysis, 
         policy_version_id, checked_at, can_auto_fix)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    """, (
        result.content_id,
        result.platform,
        result.status,
        result.overall_severity,
        json.dumps(issues_json),
        result.ai_analysis,
        result.policy_version_id,
        result.checked_at,
        result.can_auto_fix
    ))
    await db.commit()


async def auto_fix_content(
    content: str,
    platform: str,
    issues: List[ComplianceIssue],
    db: PostgresConnection,
    max_attempts: int = 2
) -> Optional[str]:
    """
    Attempt to automatically fix compliance issues.
    Returns fixed content or None if unable to fix.
    """
    
    # Only attempt to fix auto-fixable issues
    fixable_issues = [i for i in issues if i.auto_fixable]
    if not fixable_issues:
        return None
    
    current_content = content
    
    for attempt in range(max_attempts):
        # Check current state
        check_result = await check_content_compliance(
            current_content, platform, db, use_ai=True
        )
        
        if check_result.status == 'clean':
            logger.info(f"Content fixed after {attempt + 1} attempts")
            return current_content
        
        # Get remaining fixable issues
        remaining_fixable = [i for i in check_result.issues if i.auto_fixable]
        if not remaining_fixable:
            break
        
        # Generate fix
        system_prompt = f"""You are editing a {platform} post to fix compliance issues.
Rewrite the post to address the violations while keeping the original meaning, tone, and intent.

Rules:
1. Maintain the original message and call-to-action
2. Remove or rephrase flagged content
3. Keep hashtags, mentions, and links if they're not the problem
4. Return ONLY the fixed post text, no explanations"""

        issues_text = "\n".join([
            f"- {i.category}: {i.description}\n  Excerpt: '{i.excerpt}'\n  Fix: {i.suggested_fix}"
            for i in remaining_fixable
        ])
        
        prompt = f"""Original post:
"{current_content}"

Issues to fix:
{issues_text}

Rewrite this post to fix all issues. Return only the new post text:"""

        try:
            config = await get_model_config(AITaskType.SOCIAL_CAPTION)
            fixed = await generate_with_config(prompt, system_prompt, config)
            
            # Clean up response
            fixed = fixed.strip().strip('"')
            
            if fixed and len(fixed) > 10:
                current_content = fixed
            else:
                break
                
        except Exception as e:
            logger.error(f"Auto-fix attempt {attempt + 1} failed: {e}")
            break
    
    # Final check
    final_check = await check_content_compliance(current_content, platform, db, use_ai=True)
    
    if final_check.status == 'clean' or len([i for i in final_check.issues if i.severity == 'critical']) == 0:
        return current_content
    
    return None  # Could not fully fix


async def get_content_compliance_history(
    content_id: int,
    db: PostgresConnection
) -> List[dict]:
    """Get compliance check history for a piece of content."""
    
    cursor = await db.execute("""
        SELECT * FROM content_compliance_checks
        WHERE content_id = ?
        ORDER BY checked_at DESC
    """, (content_id,))
    
    rows = await cursor.fetchall()
    return [dict(r) for r in rows]


async def bulk_recheck_on_policy_change(
    policy_version_id: int,
    db: PostgresConnection
) -> dict:
    """
    Re-check all pending/scheduled social posts when a policy changes.
    Called after policy approval.
    """
    
    # Get posts that need re-checking
    cursor = await db.execute("""
        SELECT sp.id, sp.platform, sp.content
        FROM social_posts sp
        WHERE sp.status IN ('draft', 'approved', 'scheduled')
        AND sp.platform IN (
            SELECT ps.platform FROM policy_versions pv
            JOIN policy_sources ps ON pv.source_id = ps.id
            WHERE pv.id = ?
        )
    """, (policy_version_id,))
    
    posts = await cursor.fetchall()
    
    results = {
        'total': len(posts),
        'clean': 0,
        'warning': 0,
        'violation': 0,
        'fixed': 0
    }
    
    for post in posts:
        # Check compliance
        check = await check_content_compliance(
            post['content'], 
            post['platform'], 
            db, 
            content_id=post['id'],
            use_ai=True
        )
        
        results[check.status] += 1
        
        # Auto-fix if possible
        if check.can_auto_fix and check.status != 'clean':
            fixed_content = await auto_fix_content(
                post['content'],
                post['platform'],
                check.issues,
                db
            )
            
            if fixed_content:
                # Update the post with fixed content
                await db.execute(
                    "UPDATE social_posts SET content = ?, updated_at = ? WHERE id = ?",
                    (fixed_content, datetime.now(timezone.utc), post['id'])
                )
                await db.commit()
                results['fixed'] += 1
                results['violation'] -= 1  # Moved to clean
                results['clean'] += 1
    
    return results
