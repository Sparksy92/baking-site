"""
URL compliance checking service.

Validates URLs against platform blocklists and safety databases.
Industry-leading feature: pre-publish URL safety verification.
"""

import asyncio
import logging
from typing import Dict, Any, Optional, Set
from urllib.parse import urlparse
import hashlib

import httpx

logger = logging.getLogger(__name__)


# Known malicious/spam domain patterns (simplified blocklist)
# In production, this would connect to:
# - Google Safe Browsing API
# - PhishTank
# - Meta ThreatExchange
# - Platform-specific blocklists
SUSPICIOUS_PATTERNS = [
    'bit.ly', 'tinyurl', 't.co', 'goo.gl',  # URL shorteners (require expansion)
    'phishing', 'malware', 'scam',
    'free-money', 'get-rich', 'earn-cash',
    'adult', 'xxx', 'porn',
    'darkweb', 'onion',
]

# Domains that require additional scrutiny
HIGH_RISK_TLDS = {'.tk', '.ml', '.ga', '.cf', '.top', '.xyz'}

# Known safe domains (reduce false positives)
TRUSTED_DOMAINS = {
    'google.com', 'youtube.com', 'youtu.be',
    'facebook.com', 'fb.me', 'instagram.com',
    'twitter.com', 'x.com', 't.co',
    'linkedin.com', 'tiktok.com',
    'shopify.com', 'shopifypreview.com',
    'badasselder.com', 'turtleislandsupply.com',
}


async def check_url_safety(url: str) -> Dict[str, Any]:
    """
    Check if a URL is safe to include in social content.
    
    Returns:
        Dict with 'safe' (bool), 'category', 'reason', 'suggested_action'
    """
    
    try:
        parsed = urlparse(url)
        domain = parsed.netloc.lower()
        
        # Remove www prefix for comparison
        if domain.startswith('www.'):
            domain = domain[4:]
        
        # Check trusted domains first
        if any(domain.endswith(d) or domain == d for d in TRUSTED_DOMAINS):
            return {
                'safe': True,
                'category': 'trusted',
                'reason': 'Known safe domain',
                'suggested_action': None
            }
        
        # Check suspicious patterns
        for pattern in SUSPICIOUS_PATTERNS:
            if pattern in domain or pattern in url.lower():
                return {
                    'safe': False,
                    'category': 'suspicious_pattern',
                    'reason': f"Contains suspicious pattern: {pattern}",
                    'suggested_action': 'Remove or replace URL'
                }
        
        # Check high-risk TLDs
        tld = '.' + domain.split('.')[-1] if '.' in domain else ''
        if tld in HIGH_RISK_TLDS:
            return {
                'safe': False,
                'category': 'high_risk_tld',
                'reason': f"High-risk domain extension: {tld}",
                'suggested_action': 'Verify URL legitimacy or remove'
            }
        
        # Check for URL shorteners that need expansion
        shortener_domains = ['bit.ly', 'tinyurl.com', 't.co', 'goo.gl', 'ow.ly', 'buff.ly']
        if any(domain.endswith(s) or domain == s for s in shortener_domains):
            expanded = await _expand_shortened_url(url)
            if expanded and expanded != url:
                # Recursively check the expanded URL
                return await check_url_safety(expanded)
            
            return {
                'safe': False,
                'category': 'url_shortener',
                'reason': 'URL shortener detected - cannot verify destination',
                'suggested_action': 'Replace with direct URL'
            }
        
        # Check if URL is reachable (optional, can be slow)
        # reachable = await _check_url_reachable(url)
        
        return {
            'safe': True,
            'category': 'unknown',
            'reason': 'URL passed basic safety checks',
            'suggested_action': None
        }
        
    except Exception as e:
        logger.warning(f"URL safety check failed for {url}: {e}")
        return {
            'safe': False,
            'category': 'check_failed',
            'reason': f'Could not verify URL: {str(e)}',
            'suggested_action': 'Manual review required'
        }


async def _expand_shortened_url(short_url: str) -> Optional[str]:
    """Expand a shortened URL by following redirects."""
    try:
        async with httpx.AsyncClient(follow_redirects=True, timeout=10.0) as client:
            resp = await client.head(short_url)
            return str(resp.url)
    except Exception as e:
        logger.debug(f"Could not expand URL {short_url}: {e}")
        return None


async def _check_url_reachable(url: str) -> bool:
    """Check if URL returns a successful HTTP response."""
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            resp = await client.head(url, follow_redirects=True)
            return resp.status_code < 400
    except Exception:
        return False


async def check_google_safe_browsing(url: str, api_key: str) -> Dict[str, Any]:
    """
    Check URL against Google Safe Browsing API.
    Requires GOOGLE_SAFE_BROWSING_API_KEY environment variable.
    """
    
    try:
        endpoint = "https://safebrowsing.googleapis.com/v4/threatMatches:find"
        
        payload = {
            "client": {
                "clientId": "badasselder-web",
                "clientVersion": "1.0.0"
            },
            "threatInfo": {
                "threatTypes": [
                    "MALWARE", "SOCIAL_ENGINEERING", "UNWANTED_SOFTWARE", "POTENTIALLY_HARMFUL_APPLICATION"
                ],
                "platformTypes": ["ANY_PLATFORM"],
                "threatEntryTypes": ["URL"],
                "threatEntries": [{"url": url}]
            }
        }
        
        async with httpx.AsyncClient() as client:
            resp = await client.post(
                f"{endpoint}?key={api_key}",
                json=payload,
                timeout=10.0
            )
            resp.raise_for_status()
            data = resp.json()
            
            if data.get('matches'):
                threats = [m.get('threatType', 'UNKNOWN') for m in data['matches']]
                return {
                    'safe': False,
                    'category': 'google_safe_browsing',
                    'reason': f"Threats detected: {', '.join(threats)}",
                    'suggested_action': 'Remove URL immediately',
                    'threats': threats
                }
            
            return {
                'safe': True,
                'category': 'verified',
                'reason': 'Passed Google Safe Browsing check',
                'suggested_action': None
            }
            
    except Exception as e:
        logger.warning(f"Google Safe Browsing check failed: {e}")
        return {
            'safe': True,  # Fail open - don't block if API is down
            'category': 'check_failed',
            'reason': 'Could not verify with Google Safe Browsing',
            'suggested_action': None
        }


def normalize_url(url: str) -> str:
    """Normalize URL for consistent checking."""
    # Add scheme if missing
    if not url.startswith(('http://', 'https://')):
        url = 'https://' + url
    
    # Convert to lowercase
    url = url.lower()
    
    # Remove trailing slash
    url = url.rstrip('/')
    
    return url


async def batch_check_urls(urls: list[str]) -> list[Dict[str, Any]]:
    """Check multiple URLs concurrently."""
    tasks = [check_url_safety(url) for url in urls]
    return await asyncio.gather(*tasks)
