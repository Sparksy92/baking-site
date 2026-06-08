# AI Agent Integration Guide

**For:** Developers building AI agents that interact with the Social Media Platform  
**Version:** 2.0  
**Last Updated:** June 2026

---

## Quick Start

### 1. Get API Key

Your admin creates a key for you:

```bash
# Admin does this
curl -X POST https://yourdomain.com/api/admin/social/agents/keys \
  -H "Authorization: Bearer $ADMIN_JWT" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "My AI Agent",
    "scopes": ["read:engagement", "write:replies", "write:drafts", "read:metrics"],
    "rate_limit_rpm": 100
  }'

# Response includes:
# {
#   "key_id": 5,
#   "api_key": "sk_live_abc123...",  <-- GIVE THIS TO YOUR AGENT
#   "scopes": [...]
# }
```

**⚠️ The API key is shown ONCE. Save it securely.**

### 2. Health Check

```python
import requests

API_KEY = "sk_live_abc123..."
BASE_URL = "https://yourdomain.com/agent/v1"

# Test connectivity (no auth required)
response = requests.get(f"{BASE_URL}/health")
assert response.json()["status"] == "ok"
```

### 3. Authenticate Requests

```python
headers = {
    "Authorization": f"Bearer {API_KEY}",
    "Content-Type": "application/json",
}

# All subsequent requests include this header
response = requests.get(
    f"{BASE_URL}/dashboard",
    headers=headers
)
```

---

## Agent Capabilities

### Read Operations (Always Allowed with Scope)

```python
# Get platform status brief
GET /agent/v1/dashboard
→ {
    "current_status": "healthy",
    "health_score": 85,
    "priority_actions": ["pending_agent_approvals: 3"],
    "recommendation": "Review 3 drafts awaiting approval"
}

# See unreplied comments
GET /agent/v1/engagement/unreplied?limit=10
→ [{
    "id": 123,
    "platform": "instagram",
    "content": "Love this product!",
    "sentiment_label": "positive"
}]

# Get brand persona
GET /agent/v1/persona
→ {
    "brand_voice": "Bold, confident, streetwear aesthetic",
    "target_audience": "18-35 urban fashion enthusiasts"
}

# Get product catalog
GET /agent/v1/products
→ [{
    "id": 45,
    "name": "Vintage Denim Jacket",
    "price": 89.99,
    "image_url": "..."
}]

# Check content pipeline
GET /agent/v1/outbox/status
→ {
    "scheduled_posts": 5,
    "pending_approvals": 3,
    "failed_posts": 0
}
```

### Write Operations (Human Approval Required)

```python
# Submit a content draft
POST /agent/v1/drafts/social
{
    "platform": "instagram",
    "content": "New drop! 🔥 The Vintage Denim Jacket is back...",
    "image_url": "https://...",
    "scheduled_at": "2024-01-20T14:00:00Z",  # optional
    "context": {
        "product_ids": [45],
        "hashtags": ["#streetwear", "#vintage"]
    }
}
→ {"submission_id": 89, "status": "pending", "message": "Awaiting admin approval"}

# Generate reply draft
POST /agent/v1/engagement/reply-draft
{
    "engagement_event_id": 123,
    "engagement_content": "Love this product!",
    "platform": "instagram"
}
→ {"suggested_reply": "Thank you! 🙏 Which color is your favorite?"}
```

---

## Best Practices

### 1. Always Check Status First

```python
def agent_workflow():
    # Step 1: Check what's needed
    dashboard = get_dashboard()
    
    if dashboard["priority_actions"]:
        # Handle urgent items first
        handle_priority_actions(dashboard["priority_actions"])
    
    # Step 2: Check sentiment
    if dashboard["sentiment"] < -0.2:
        # Negative trend - maybe pause new content
        generate_mood_lifting_content()
    
    # Step 3: Create new content
    generate_and_submit_drafts()
```

### 2. Respect Rate Limits

Default: 100 requests/minute per key

```python
import time
from collections import deque

class RateLimiter:
    def __init__(self, rpm=100):
        self.window = 60  # seconds
        self.max_requests = rpm
        self.requests = deque()
    
    def check(self):
        now = time.time()
        # Remove old requests
        while self.requests and self.requests[0] < now - self.window:
            self.requests.popleft()
        
        if len(self.requests) >= self.max_requests:
            sleep_time = self.window - (now - self.requests[0])
            time.sleep(max(0, sleep_time))
        
        self.requests.append(now)
```

### 3. Handle Errors Gracefully

```python
HTTP 429 → Rate limited, back off and retry
HTTP 403 → Scope not permitted, check API key scopes
HTTP 401 → Invalid/expired API key, admin needs to regenerate
HTTP 502 → Platform API issue (Meta/LinkedIn down), retry later
HTTP 500 → Server error, log and alert admin
```

### 4. Log Everything

```python
import logging

logger = logging.getLogger("ai_agent")

def log_action(action, payload, response):
    logger.info(f"Action: {action}")
    logger.info(f"Payload: {json.dumps(payload)}")
    logger.info(f"Response: {json.dumps(response)}")
    
# This helps debugging and audit trails
```

---

## Example Agent Workflows

### Workflow A: Daily Content Creator

```python
def daily_content_creator():
    """Agent that creates 2 posts per day"""
    
    # 1. Check platform health
    status = get_dashboard()
    if status["health_score"] < 50:
        logger.warning("Platform unhealthy, skipping content creation")
        return
    
    # 2. Get brand persona
    persona = get_persona()
    
    # 3. Get products to feature
    products = get_products(limit=5)
    featured = random.choice(products)
    
    # 4. Generate content
    content = generate_with_llm(
        f"Create Instagram caption for {featured['name']}.",
        context={
            "brand_voice": persona['brand_voice'],
            "price": featured['price'],
            "product_name": featured['name']
        }
    )
    
    # 5. Submit for approval
    submit_draft(
        platform="instagram",
        content=content,
        image_url=featured['image_url'],
        context={"product_ids": [featured['id']]}
    )
    
    logger.info(f"Submitted draft for {featured['name']}")
```

### Workflow B: Engagement Responder

```python
def engagement_responder():
    """Agent that replies to positive comments"""
    
    # 1. Get unreplied positive comments
    unreplied = get_unreplied_engagement(limit=20)
    positive = [u for u in unreplied if u['sentiment_label'] == 'positive']
    
    # 2. Generate replies
    for comment in positive[:5]:  # Max 5 per run
        reply = generate_reply(
            comment_text=comment['content'],
            platform=comment['platform'],
            context=get_persona()
        )
        
        # 3. Submit reply draft
        submit_reply_draft(
            engagement_event_id=comment['id'],
            suggested_reply=reply
        )
    
    logger.info(f"Generated {len(positive)} reply drafts")
```

### Workflow C: Crisis Monitor

```python
def crisis_monitor():
    """Agent that monitors for viral negativity"""
    
    dashboard = get_dashboard()
    
    # Check for crisis alerts
    if dashboard.get("active_crisis_alerts", 0) > 0:
        # Alert admin immediately
        send_alert_to_admin(
            message=f"🚨 {dashboard['active_crisis_alerts']} crisis alerts active",
            dashboard=dashboard
        )
    
    # Check sentiment trend
    if dashboard.get("sentiment", 0) < -0.3:
        send_alert_to_admin(
            message="📉 Negative sentiment trend detected",
            recommendation="Consider pausing new posts, focus on response strategy"
        )
```

---

## Response Schema Reference

### Dashboard Response

```json
{
  "current_status": "healthy",
  "health_score": 85,
  "priority_actions": ["pending_agent_approvals: 3"],
  "platform_performance": {
    "instagram": {
      "posts": 5,
      "engagement": 342
    }
  },
  "content_backlog": {
    "drafts_ready": 2,
    "scheduled": 5,
    "needs_approval": 3
  },
  "sentiment": 0.4,
  "recommendation": "Review 3 drafts awaiting approval"
}
```

### Engagement Event

```json
{
  "id": 123,
  "platform": "instagram",
  "platform_post_id": "17841400000000000_123456789",
  "event_type": "comment",
  "content": "Love this jacket!",
  "from_handle": "fashionfan_22",
  "sentiment_score": 0.8,
  "sentiment_label": "positive",
  "replied_at": null,
  "created_at": "2024-01-15T10:30:00Z"
}
```

### Product

```json
{
  "id": 45,
  "name": "Vintage Denim Jacket",
  "price": 89.99,
  "image_url": "https://yourdomain.com/media/products/jacket.jpg",
  "description": "Classic vintage wash denim jacket...",
  "category": "Outerwear"
}
```

### Brand Persona

```json
{
  "brand_name": "Turtle Island Supply",
  "brand_voice": "Bold, confident, streetwear aesthetic",
  "target_audience": "18-35 urban fashion enthusiasts",
  "key_messaging": ["Authentic", "Sustainable", "Community"],
  "tone_examples": {
    "casual": "Check out our latest drop! 🔥",
    "formal": "Introducing our new sustainable collection..."
  }
}
```

---

## Testing Your Agent

### 1. Mock Server

```python
# Use a test key with limited scopes
TEST_KEY = "sk_test_..."

# Point to staging if available
BASE_URL = "https://staging.yourdomain.com/agent/v1"
```

### 2. Test Scenarios

```python
def test_suite():
    # Test 1: Health check
    assert get_health()["status"] == "ok"
    
    # Test 2: Get dashboard
    dashboard = get_dashboard()
    assert "health_score" in dashboard
    
    # Test 3: Submit draft
    result = submit_draft(
        platform="instagram",
        content="Test post [DELETE ME]",
    )
    assert result["status"] == "pending"
    
    # Cleanup: Tell admin to delete test draft
    
    print("All tests passed!")
```

### 3. Load Testing

```bash
# Test rate limits
for i in {1..110}; do
  curl -H "Authorization: Bearer $API_KEY" \
    https://yourdomain.com/agent/v1/health
done

# Should see 429 after 100 requests
```

---

## Troubleshooting

### 401 Unauthorized

```
Cause: Invalid API key
Fix: Check key with admin, regenerate if needed
```

### 403 Forbidden

```
Cause: Scope not permitted
Fix: Check key scopes, request additional scopes from admin

Example: Key with only "read:engagement" trying to POST /drafts
→ Need "write:drafts" scope
```

### 429 Too Many Requests

```
Cause: Rate limit exceeded
Fix: Implement backoff, reduce request frequency

Retry-After header shows seconds to wait
```

### 400 Bad Request

```
Cause: Invalid payload
Fix: Check field names, types, required fields

Example: "platform" must be "instagram", "facebook", or "linkedin"
```

---

## SDK Example (Python)

```python
# pip install social-platform-agent-sdk

from social_platform import AgentClient

client = AgentClient(
    api_key="sk_live_abc123...",
    base_url="https://yourdomain.com/agent/v1"
)

# Check status
dashboard = client.get_dashboard()
print(f"Health: {dashboard['health_score']}/100")

# Get unreplied comments
comments = client.get_unreplied_engagement(limit=5)
for comment in comments:
    reply = generate_reply(comment)  # Your LLM logic
    client.submit_reply_draft(comment['id'], reply)

# Submit content draft
client.submit_draft(
    platform="instagram",
    content="New drop! 🔥",
    image_url="https://...",
    context={"product_ids": [45]}
)
```

---

## Security Guidelines

**DO:**
- ✅ Store API keys in environment variables
- ✅ Use HTTPS only
- ✅ Implement rate limiting
- ✅ Log all actions for debugging
- ✅ Validate responses before using
- ✅ Handle errors gracefully

**DON'T:**
- ❌ Hardcode API keys in source code
- ❌ Share keys across different agents
- ❌ Ignore rate limits (429s)
- ❌ Expose raw API responses to users
- ❌ Store user data from comments
- ❌ Attempt to bypass approval workflow

---

## Contact & Support

- **API Issues:** Check response codes and error messages
- **Scope Requests:** Contact admin to add scopes to your key
- **Rate Limit Increases:** Contact admin for higher limits
- **Feature Requests:** Submit via admin panel

---

## Changelog

### v2.0 (June 2026)
- Added dashboard endpoint for agents
- Added health check endpoint
- Expanded engagement reply capabilities
- Added product catalog access

### v1.0 (May 2026)
- Initial agent API release
- Basic content draft submission
- Engagement monitoring
