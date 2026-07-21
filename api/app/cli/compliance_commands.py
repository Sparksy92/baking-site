"""
CLI commands for policy compliance monitoring.

Usage:
    python -m app.cli.compliance_commands check-policies
    python -m app.cli.compliance_commands refresh-meta
    python -m app.cli.compliance_commands approve-policy-version --id 123 --notes "Looks good"
"""

import asyncio
import argparse
import sys
from typing import Optional

from app.database import db_connection
from app.services.policy_monitor_service import check_policy_source, approve_policy_version
from app.services.content_compliance_service import check_content_compliance, auto_fix_content


async def check_policies_cmd(source_id: Optional[int] = None) -> None:
    """Check all policy sources or a specific source for updates."""
    
    async with db_connection() as db:
        if source_id:
            # Check specific source
            print(f"Checking policy source {source_id}...")
            new_version = await check_policy_source(source_id, db)
            if new_version:
                print(f"✓ New version detected: ID {new_version}")
                print("  Status: pending_review (requires admin approval)")
            else:
                print("✓ No changes detected or check failed")
        else:
            # Check all active sources
            cursor = await db.execute(
                "SELECT id, platform, policy_type FROM policy_sources WHERE is_active = TRUE"
            )
            sources = await cursor.fetchall()
            
            print(f"Checking {len(sources)} policy sources...\n")
            
            new_count = 0
            for source in sources:
                print(f"  {source['platform']}/{source['policy_type']}... ", end="", flush=True)
                try:
                    new_version = await check_policy_source(source['id'], db)
                    if new_version:
                        print(f"CHANGED (ID: {new_version})")
                        new_count += 1
                    else:
                        print("no change")
                except Exception as e:
                    print(f"ERROR: {e}")
            
            print(f"\n✓ Check complete. {new_count} new version(s) pending review.")


async def refresh_meta_cmd() -> None:
    """Refresh all policy metadata (same as check-policies, included for compatibility)."""
    await check_policies_cmd()


async def approve_policy_version_cmd(version_id: int, notes: Optional[str] = None, admin_email: str = "cli") -> None:
    """Approve a pending policy version."""
    
    async with db_connection() as db:
        print(f"Approving policy version {version_id}...")
        
        success = await approve_policy_version(version_id, admin_email, notes, db)
        
        if success:
            print(f"✓ Version {version_id} approved and activated.")
            if notes:
                print(f"  Notes: {notes}")
        else:
            print(f"✗ Failed to approve version {version_id}")
            print("  Version may not exist or is not in 'pending_review' status.")
            sys.exit(1)


async def list_pending_cmd() -> None:
    """List all policy versions awaiting review."""
    
    async with db_connection() as db:
        cursor = await db.execute("""
            SELECT 
                pv.id, pv.version, pv.severity, pv.change_summary,
                pv.created_at, pv.is_manual_upload,
                ps.platform, ps.policy_type, ps.policy_name
            FROM policy_versions pv
            JOIN policy_sources ps ON pv.source_id = ps.id
            WHERE pv.status = 'pending_review'
            ORDER BY 
                CASE pv.severity 
                    WHEN 'critical' THEN 1 
                    WHEN 'warning' THEN 2 
                    ELSE 3 
                END,
                pv.created_at DESC
        """)
        
        rows = await cursor.fetchall()
        
        if not rows:
            print("No policy versions pending review.")
            return
        
        print(f"{len(rows)} version(s) pending review:\n")
        print(f"{'ID':<6} {'Platform':<12} {'Policy':<20} {'Version':<16} {'Severity':<10} {'Created':<20}")
        print("-" * 90)
        
        for row in rows:
            severity_emoji = {
                'critical': '🔴',
                'warning': '🟡',
                'info': '🟢'
            }.get(row['severity'], '⚪')
            
            manual = " [UPLOAD]" if row['is_manual_upload'] else ""
            print(f"{row['id']:<6} {row['platform']:<12} {row['policy_name']:<20} "
                  f"{row['version']:<16} {severity_emoji} {row['severity']:<8} "
                  f"{str(row['created_at'])[:19]}{manual}")
            
            if row['change_summary']:
                summary = row['change_summary'][:60] + "..." if len(row['change_summary']) > 60 else row['change_summary']
                print(f"       └─ {summary}")
            print()


async def list_sources_cmd() -> None:
    """List all configured policy sources."""
    
    async with db_connection() as db:
        cursor = await db.execute("""
            SELECT 
                ps.id, ps.platform, ps.policy_type, ps.policy_name,
                ps.source_url, ps.is_active, ps.fetch_cron,
                (SELECT COUNT(*) FROM policy_versions WHERE source_id = ps.id AND status = 'pending_review') as pending,
                (SELECT COUNT(*) FROM policy_versions WHERE source_id = ps.id AND status = 'active') as active
            FROM policy_sources ps
            ORDER BY ps.platform, ps.policy_type
        """)
        
        rows = await cursor.fetchall()
        
        print(f"{'ID':<4} {'Platform':<12} {'Type':<20} {'Active':<8} {'Pending':<8} {'Cron':<16}")
        print("-" * 80)
        
        for row in rows:
            status = "✓" if row['is_active'] else "✗"
            print(f"{row['id']:<4} {row['platform']:<12} {row['policy_type']:<20} "
                  f"{status:<8} {row['pending']:<8} {row['fetch_cron']:<16}")


async def check_content_cmd(post_id: int) -> None:
    """Check a social post for compliance against platform policies."""
    
    async with db_connection() as db:
        # Get post details
        cursor = await db.execute(
            "SELECT id, content, platform, compliance_status FROM social_posts WHERE id = ?",
            (post_id,)
        )
        post = await cursor.fetchone()
        
        if not post:
            print(f"✗ Post {post_id} not found")
            sys.exit(1)
        
        print(f"Checking compliance for post {post_id} ({post['platform']})...")
        
        result = await check_content_compliance(
            post['content'],
            post['platform'],
            db,
            content_id=post_id,
            use_ai=True
        )
        
        print(f"\nStatus: {result.status.upper()}")
        print(f"Severity: {result.overall_severity}")
        
        if result.issues:
            print(f"\nIssues found: {len(result.issues)}")
            for i, issue in enumerate(result.issues, 1):
                emoji = {'critical': '🔴', 'warning': '🟡', 'info': '🟢'}.get(issue.severity, '⚪')
                print(f"\n  {i}. {emoji} [{issue.severity.upper()}] {issue.category}")
                print(f"     {issue.description}")
                if issue.excerpt:
                    print(f"     Excerpt: \"{issue.excerpt[:60]}...\"")
                print(f"     Fix: {issue.suggested_fix}")
        else:
            print("\n✓ No compliance issues detected")
        
        print(f"\nCan auto-fix: {'Yes' if result.can_auto_fix else 'No'}")
        if result.ai_analysis:
            print(f"\nAI Analysis: {result.ai_analysis[:200]}...")


async def fix_content_cmd(post_id: int) -> None:
    """Auto-fix compliance issues in a social post."""
    
    async with db_connection() as db:
        # Get post details
        cursor = await db.execute(
            "SELECT id, content, platform, compliance_status FROM social_posts WHERE id = ?",
            (post_id,)
        )
        post = await cursor.fetchone()
        
        if not post:
            print(f"✗ Post {post_id} not found")
            sys.exit(1)
        
        print(f"Checking compliance for post {post_id}...")
        
        check = await check_content_compliance(
            post['content'],
            post['platform'],
            db,
            content_id=post_id,
            use_ai=True
        )
        
        if check.status == 'clean':
            print(f"✓ Post {post_id} is already compliant")
            return
        
        if not check.can_auto_fix:
            print(f"✗ Post has critical violations that require manual review")
            print(f"   Issues:")
            for issue in check.issues:
                if issue.severity == 'critical':
                    print(f"   - [{issue.category}] {issue.description}")
            sys.exit(1)
        
        print(f"Attempting auto-fix for {len(check.issues)} issue(s)...")
        
        fixed = await auto_fix_content(
            post['content'],
            post['platform'],
            check.issues,
            db,
            max_attempts=2
        )
        
        if fixed:
            # Update post content
            from datetime import datetime, timezone
            await db.execute(
                "UPDATE social_posts SET content = ?, updated_at = ? WHERE id = ?",
                (fixed, datetime.now(timezone.utc), post_id)
            )
            await db.commit()
            
            # Verify fix
            recheck = await check_content_compliance(
                fixed,
                post['platform'],
                db,
                use_ai=True
            )
            
            print(f"✓ Content auto-fixed successfully")
            print(f"  New status: {recheck.status}")
            print(f"  Remaining issues: {len(recheck.issues)}")
            if recheck.status != 'violation':
                print(f"  Ready to publish!")
        else:
            print(f"✗ Auto-fix could not resolve all issues")
            sys.exit(1)


async def list_violations_cmd(platform: Optional[str] = None, limit: int = 20) -> None:
    """List social posts with compliance violations."""
    
    async with db_connection() as db:
        where = "WHERE sp.compliance_status IN ('warning', 'violation')"
        params = []
        
        if platform:
            where += " AND sp.platform = ?"
            params.append(platform)
        
        cursor = await db.execute(f"""
            SELECT 
                sp.id, sp.platform, sp.content, sp.status as post_status,
                sp.compliance_status, sp.compliance_issues_count, sp.compliance_checked_at,
                ccc.severity, ccc.issues_json
            FROM social_posts sp
            LEFT JOIN content_compliance_checks ccc ON sp.id = ccc.content_id
            {where}
            ORDER BY 
                CASE ccc.severity WHEN 'critical' THEN 1 WHEN 'warning' THEN 2 ELSE 3 END,
                sp.compliance_checked_at DESC
            LIMIT ?
        """, params + [limit])
        
        rows = await cursor.fetchall()
        
        if not rows:
            print("No compliance violations found. All clear! ✓")
            return
        
        print(f"{len(rows)} post(s) with compliance issues:\n")
        print(f"{'ID':<6} {'Platform':<12} {'Status':<10} {'Issues':<8} {'Checked':<20}")
        print("-" * 70)
        
        import json
        
        for row in rows:
            emoji = {'violation': '🔴', 'warning': '🟡', 'clean': '🟢', 'unchecked': '⚪'}.get(
                row['compliance_status'], '⚪'
            )
            checked = str(row['compliance_checked_at'])[:16] if row['compliance_checked_at'] else 'Never'
            
            print(f"{row['id']:<6} {row['platform']:<12} {emoji} {row['compliance_status']:<8} "
                  f"{row['compliance_issues_count'] or 0:<8} {checked}")
            
            # Show content preview
            content = (row['content'] or '')[:50] + "..." if len(row['content'] or '') > 50 else (row['content'] or '')
            print(f"       └─ \"{content}\"")
            
            # Show issue categories if available
            if row['issues_json']:
                try:
                    issues = json.loads(row['issues_json'])
                    categories = [i.get('category', 'unknown') for i in issues[:3]]
                    if categories:
                        print(f"           Issues: {', '.join(categories)}")
                except:
                    pass
            print()


async def check_image_cmd(image_url: str, platform: str) -> None:
    """Check an image for compliance using GPT-4o Vision."""
    
    from app.services.image_compliance_service import check_image_compliance
    
    async with db_connection() as db:
        print(f"Checking image compliance for {platform}...")
        print(f"Image: {image_url}\n")
        
        result = await check_image_compliance(image_url, platform, db)
        
        print(f"Status: {result.status.upper()}")
        print(f"Severity: {result.overall_severity}")
        
        if result.safety_scores:
            print("\nSafety Scores (0.0 = safe, 1.0 = high risk):")
            for category, score in result.safety_scores.items():
                bar = '█' * int(score * 10) + '░' * (10 - int(score * 10))
                print(f"  {category:15} [{bar}] {score:.2f}")
        
        if result.issues:
            print(f"\nIssues found: {len(result.issues)}")
            for i, issue in enumerate(result.issues, 1):
                emoji = {'critical': '🔴', 'warning': '🟡', 'info': '🟢'}.get(issue.severity, '⚪')
                print(f"\n  {i}. {emoji} [{issue.severity.upper()}] {issue.category}")
                print(f"     {issue.description}")
                print(f"     Confidence: {issue.confidence:.0%}")
                print(f"     Fix: {issue.suggested_fix}")
        else:
            print("\n✓ No issues detected - image is compliant")
        
        if result.ai_analysis:
            print(f"\nAI Analysis: {result.ai_analysis}")


async def check_url_cmd(url: str) -> None:
    """Check URL safety."""
    
    from app.services.url_compliance_service import check_url_safety
    
    print(f"Checking URL safety: {url}\n")
    
    result = await check_url_safety(url)
    
    status_emoji = '✓' if result['safe'] else '✗'
    print(f"{status_emoji} Safe: {result['safe']}")
    print(f"  Category: {result['category']}")
    print(f"  Reason: {result['reason']}")
    
    if result['suggested_action']:
        print(f"  Action: {result['suggested_action']}")


async def scorecard_cmd(days: int = 30, platform: Optional[str] = None) -> None:
    """Show compliance health scorecard."""
    
    from app.services.image_compliance_service import get_compliance_scorecard
    
    async with db_connection() as db:
        print(f"Generating compliance scorecard ({days} days)...\n")
        
        scorecard = await get_compliance_scorecard(days=days, platform=platform, db=db)
        
        # Print header
        platform_str = f" [{platform}]" if platform else " [All Platforms]"
        print(f"{'='*50}")
        print(f"  COMPLIANCE SCORECARD{platform_str}")
        print(f"{'='*50}\n")
        
        # Health grade with color indicators
        grade = scorecard['grade']
        grade_emoji = {'A+': '🏆', 'A': '⭐', 'B': '👍', 'C': '⚠️', 'D': '🔶', 'F': '❌'}.get(grade, '❓')
        print(f"  Health Score: {scorecard['health_score']}/100 {grade_emoji} Grade: {grade}")
        print(f"  Compliance Rate: {scorecard['compliance_rate']:.1f}%\n")
        
        # Stats
        print(f"  Total Checks: {scorecard['total_checks']}")
        print(f"    ✓ Clean:      {scorecard['clean_count'] or 0}")
        print(f"    ⚠ Warning:    {scorecard['warning_count'] or 0}")
        print(f"    ✗ Violations: {scorecard['violation_count'] or 0}\n")
        
        # Top issues
        if scorecard['top_issues']:
            print("  Top Issue Categories:")
            for issue in scorecard['top_issues'][:5]:
                print(f"    - {issue['category']}: {issue['count']} occurrences")
            print()
        
        # Recommendations
        if scorecard['recommendations']:
            print("  Recommendations:")
            for rec in scorecard['recommendations']:
                print(f"    → {rec}")
            print()


def main():
    parser = argparse.ArgumentParser(
        description="Policy compliance monitoring CLI",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  # Policy monitoring
  python -m app.cli.compliance_commands check-policies
  python -m app.cli.compliance_commands check-policies --source 1
  python -m app.cli.compliance_commands list-pending
  python -m app.cli.compliance_commands approve-policy-version --id 123

  # Content compliance
  python -m app.cli.compliance_commands check-content --post 456
  python -m app.cli.compliance_commands fix-content --post 456
  python -m app.cli.compliance_commands list-violations
  python -m app.cli.compliance_commands list-violations --platform instagram

  # Advanced compliance (Industry-leading features)
  python -m app.cli.compliance_commands check-image --url https://example.com/image.jpg --platform instagram
  python -m app.cli.compliance_commands check-url --url https://example.com/suspicious
  python -m app.cli.compliance_commands scorecard
  python -m app.cli.compliance_commands scorecard --platform instagram --days 7
        """
    )
    
    subparsers = parser.add_subparsers(dest='command', help='Command to run')
    
    # check-policies
    check_parser = subparsers.add_parser('check-policies', help='Check policy sources for updates')
    check_parser.add_argument('--source', '-s', type=int, help='Check specific source ID only')
    
    # refresh-meta (alias for check-policies)
    subparsers.add_parser('refresh-meta', help='Refresh policy metadata (same as check-policies)')
    
    # approve-policy-version
    approve_parser = subparsers.add_parser('approve-policy-version', help='Approve a pending policy version')
    approve_parser.add_argument('--id', '-i', type=int, required=True, help='Version ID to approve')
    approve_parser.add_argument('--notes', '-n', type=str, help='Approval notes')
    
    # list-pending
    subparsers.add_parser('list-pending', help='List versions awaiting review')
    
    # list-sources
    subparsers.add_parser('list-sources', help='List configured policy sources')
    
    # Content compliance commands
    check_content_parser = subparsers.add_parser('check-content', help='Check social post for compliance')
    check_content_parser.add_argument('--post', '-p', type=int, required=True, help='Post ID to check')
    
    fix_content_parser = subparsers.add_parser('fix-content', help='Auto-fix compliance issues in a post')
    fix_content_parser.add_argument('--post', '-p', type=int, required=True, help='Post ID to fix')
    
    list_violations_parser = subparsers.add_parser('list-violations', help='List posts with compliance issues')
    list_violations_parser.add_argument('--platform', type=str, help='Filter by platform')
    list_violations_parser.add_argument('--limit', '-l', type=int, default=20, help='Max results')
    
    # Advanced compliance commands
    check_image_parser = subparsers.add_parser('check-image', help='Check image for compliance using Vision AI')
    check_image_parser.add_argument('--url', '-u', type=str, required=True, help='Image URL to check')
    check_image_parser.add_argument('--platform', type=str, default='instagram', help='Target platform')
    
    check_url_parser = subparsers.add_parser('check-url', help='Check URL safety')
    check_url_parser.add_argument('--url', '-u', type=str, required=True, help='URL to check')
    
    scorecard_parser = subparsers.add_parser('scorecard', help='Show compliance health scorecard')
    scorecard_parser.add_argument('--days', '-d', type=int, default=30, help='Period in days')
    scorecard_parser.add_argument('--platform', type=str, help='Filter by platform')
    
    args = parser.parse_args()
    
    if not args.command:
        parser.print_help()
        sys.exit(1)
    
    if args.command == 'check-policies':
        asyncio.run(check_policies_cmd(args.source))
    elif args.command == 'refresh-meta':
        asyncio.run(refresh_meta_cmd())
    elif args.command == 'approve-policy-version':
        asyncio.run(approve_policy_version_cmd(args.id, args.notes))
    elif args.command == 'list-pending':
        asyncio.run(list_pending_cmd())
    elif args.command == 'list-sources':
        asyncio.run(list_sources_cmd())
    elif args.command == 'check-content':
        asyncio.run(check_content_cmd(args.post))
    elif args.command == 'fix-content':
        asyncio.run(fix_content_cmd(args.post))
    elif args.command == 'list-violations':
        asyncio.run(list_violations_cmd(args.platform, args.limit))
    elif args.command == 'check-image':
        asyncio.run(check_image_cmd(args.url, args.platform))
    elif args.command == 'check-url':
        asyncio.run(check_url_cmd(args.url))
    elif args.command == 'scorecard':
        asyncio.run(scorecard_cmd(args.days, args.platform))


if __name__ == '__main__':
    main()
