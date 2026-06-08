# Social Media Platform: Complete Guide

**Version:** 2.0 (Sprints 1-9 Complete)  
**For:** Small teams (1-3 people) + AI agents  
**Deployment:** Self-hosted, no external dependencies

---

## Table of Contents

1. [Overview](#overview)
2. [AI Agent Capabilities](#ai-agent-capabilities)
3. [Security & Access Control](#security--access-control)
4. [Admin Dashboard](#admin-dashboard)
5. [Complete Feature List](#complete-feature-list)
6. [API Reference](#api-reference)
7. [Deployment Checklist](#deployment-checklist)
8. [Operations Guide](#operations-guide)

---

## Overview

This is a **production-ready, enterprise-grade social media management platform** designed for small teams augmented by AI agents. It runs entirely in your own cloud infrastructure with zero external service dependencies (except the social platforms themselves).

### Architecture Philosophy

- **Human-in-the-loop**: AI generates, humans approve, system publishes
- **Self-hosted**: PostgreSQL, local media storage, no CDNs
- **AI-first**: Designed for agents to query status, generate content, and recommend actions
- **Security-first**: Scoped API keys, audit logging, encryption

---

## AI Agent Capabilities

### What AI Agents CAN Do

| Capability | Scope | Endpoint |
|------------|-------|----------|
| **Query platform status** | See everything: health, pending items, crisis alerts | `GET /agent/v1/dashboard` |
| **See unreplied engagement** | View comments needing response | `GET /agent/v1/engagement/unreplied` |
| **Generate content drafts** | Create social posts for human approval | `POST /agent/v1/drafts/social` |
| **Generate reply drafts** | Suggest replies to comments | `POST /agent/v1/engagement/reply-draft` |
| **Access brand persona** | Know tone, voice, messaging | `GET /agent/v1/persona` |
| **See product catalog** | Reference products in content | `GET /agent/v1/products` |
| **View metrics** | Performance data for optimization | `GET /agent/v1/metrics/posts` |
| **Check content pipeline** | What's scheduled, what's pending | `GET /agent/v1/outbox/status` |

### What AI Agents CANNOT Do (Human Only)

| Action | Why | Who Does It |
|--------|-----|-------------|
| **Publish content** | All AI drafts require human approval | You or your team |
| **Send live replies** | Replies to Facebook/Instagram need human trigger | You or your team |
| **Approve influencer content** | Influencer submissions need human review | You or your team |
| **Override brand safety flags** | AI-flagged content needs human override | You or your team |
| **Resolve crisis alerts** | Viral negative content needs human decision | You or your team |
| **Create API keys** | Admin-only, security critical | You only |
| **A/B test winner selection** | Can be auto-selected but human can override | You or auto |

### AI Agent Workflow

```
1. AI queries dashboard → "Status: HEALTHY, 3 drafts pending approval"
2. AI checks unreplied engagement → "5 comments need replies"
3. AI generates reply drafts → Submits for approval
4. AI generates new content → Submits 2 post drafts
5. Human reviews → Approves 1 reply, 1 post
6. System publishes approved content
7. AI monitors metrics → "Post performing 40% above average"
```

---

## Security & Access Control

### Authentication Layers

```
┌─────────────────────────────────────────────────────────────┐
│  LAYER 1: Admin JWT (You + 1-2 team members)                │
│  - Full access to all endpoints                               │
│  - Token expires in 24 hours                                  │
│  - Used in admin panel                                        │
├─────────────────────────────────────────────────────────────┤
│  LAYER 2: Agent API Keys (AI agents)                        │
│  - Scoped permissions (can only do what you allow)          │
│  - Bcrypt hashed, never stored plain text                   │
│  - Rate limited per key                                       │
│  - Full audit trail of every action                           │
└─────────────────────────────────────────────────────────────┘
```

### Agent Key Scopes

| Scope | What Agent Can Do | Use Case |
|-------|-------------------|----------|
| `read:engagement` | View comments, likes, sentiment | Monitor and respond planning |
| `write:replies` | Generate reply drafts | Comment management |
| `read:metrics` | View post performance | Optimization |
| `read:products` | Access product catalog | Product-focused content |
| `read:persona` | Know brand voice | On-brand content |
| `write:drafts` | Create content drafts | Content creation |
| `read:outbox` | See scheduled/pending | Content planning |

### Security Checklist

| Requirement | Status | Implementation |
|-------------|--------|----------------|
| Scoped API keys | ✅ | Bcrypt hashed, per-key permissions |
| Rate limiting | ✅ | 100 req/min default, configurable |
| Audit logging | ✅ | Every agent action logged with payload, IP, timestamp |
| Token expiration | ✅ | Agent keys don't expire, admin JWT does |
| HTTPS only | ⚠️ | Your deployment must enforce TLS |
| Database encryption | ⚠️ | Tokens stored plain - add encryption if needed |
| Webhook signature verify | ✅ | Meta webhooks verified with app secret |
| CORS restrictions | ✅ | Configurable allowed origins |

### Audit Trail

Every action logged:

```json
{
  "action_type": "generate_reply_draft",
  "agent_key_id": 5,
  "payload": {"engagement_id": 123, "suggested_reply": "Thank you!"},
  "ip_address": "192.168.1.1",
  "user_agent": "AI-Agent/1.0",
  "created_at": "2024-01-15T10:30:00Z"
}
```

Query logs:
- Admin: `GET /api/admin/social/agents/audit-log`
- Filter by agent, date, action type

---

## Admin Dashboard

### Dashboard Endpoints

| Endpoint | Purpose | Format |
|----------|---------|--------|
| `GET /api/admin/social/dashboard` | Full 7-day overview | Visual, human-friendly |
| `GET /api/admin/social/dashboard/compact` | One-line status | Quick check |
| `GET /api/admin/social/dashboard/ai-brief` | AI-optimized data | JSON for LLMs |

### Dashboard Sections

**1. Health Score (0-100)**
- 80-100: Healthy (green)
- 50-79: Attention needed (yellow)  
- 0-49: Critical issues (red)

Calculated from:
- Crisis alerts (-20 each)
- Unreplied comments (-2 each, max -30)
- Failed posts (-5 each)
- Sentiment trends

**2. Attention Needed**
- Unreplied comments requiring response
- Pending AI draft approvals
- Pending influencer submissions
- Failed posts to retry
- Active crisis alerts
- Competitor threats

**3. Content Pipeline**
- Drafts ready for review
- Scheduled posts
- Pending approvals
- Recently published

**4. Platform Performance**
- Posts per platform
- Engagement by platform
- Reach, likes, shares, comments

**5. Revenue Attribution**
- Posts that generated sales
- Attributed orders
- Revenue in USD

**6. AI Agent Activity**
- Drafts created
- Submissions made
- Actions taken

**7. Recommendations**
- Next best action ("Review 3 drafts" or "Reply to 5 comments")
- Optimal posting slots
- A/B test suggestions

---

## Complete Feature List

### Content Management

| Feature | Status | Notes |
|---------|--------|-------|
| Multi-platform publishing | ✅ | Facebook, Instagram, LinkedIn |
| Content scheduling | ✅ | With ML-optimized time suggestions |
| Media uploads | ✅ | Images + video, local storage |
| UTM tracking | ✅ | All links auto-tagged |
| AI content generation | ✅ | 7 task types, model router |
| Content templates | ✅ | 6 pre-built, extensible |
| Product → Social | ✅ | Auto-generate from products |
| A/B testing | ✅ | Auto-scheduled variants, winner selection |
| Best-time-to-post ML | ✅ | 90-day rolling analysis |

### Engagement Management

| Feature | Status | Notes |
|---------|--------|-------|
| Webhook ingestion | ✅ | Meta Graph API webhooks |
| Sentiment analysis | ✅ | AI-powered, all engagement |
| Reply generation | ✅ | AI drafts, human approval |
| Reply publishing | ✅ | Meta API integration |
| Crisis detection | ✅ | Viral negative, spam attack alerts |
| Auto-moderation | ✅ | Keywords, spam, user blocks |
| Competitor tracking | ✅ | AI analysis of competitor posts |

### Analytics & Intelligence

| Feature | Status | Notes |
|---------|--------|-------|
| Engagement metrics | ✅ | Synced from Meta |
| Revenue attribution | ✅ | UTM → order tracking |
| Content prediction | ✅ | Pre-publish performance forecast |
| Hashtag analytics | ✅ | Top performers, suggestions |
| Weekly reports | ✅ | Automated email digests |
| Dashboard | ✅ | Single-view overview |

### Influencer Management

| Feature | Status | Notes |
|---------|--------|-------|
| Influencer CRM | ✅ | Discovery, tracking |
| Collaboration tracking | ✅ | Deliverables, compensation |
| Content approval | ✅ | Workflow for review |
| ROI calculation | ✅ | UTM attribution |
| Performance metrics | ✅ | Reach, engagement, revenue |

### Brand Safety

| Feature | Status | Notes |
|---------|--------|-------|
| AI content scanning | ✅ | Text-based risk detection |
| 10 risk categories | ✅ | Hate speech, misinformation, spam, etc. |
| Human override | ✅ | Can override AI flags |
| Auto-moderation | ✅ | Rules-based action |

### Governance

| Feature | Status | Notes |
|---------|--------|-------|
| Admin audit log | ✅ | Every action logged |
| Agent audit log | ✅ | Every API call logged |
| Scoped API keys | ✅ | Permission-based access |
| Rate limiting | ✅ | Per-key limits |

---

## API Reference

### Admin API (Human Interface)

Base: `/api/admin/social`

| Category | Endpoints |
|----------|-----------|
| **Dashboard** | `GET /dashboard`, `/dashboard/compact`, `/dashboard/ai-brief` |
| **Content** | `POST /outbox`, `GET /outbox`, `DELETE /outbox/{id}`, `POST /outbox/{id}/publish` |
| **Scheduling** | `POST /optimal-times/calculate`, `GET /optimal-times/{platform}` |
| **A/B Testing** | `POST /ab-tests`, `GET /ab-tests`, `POST /ab-tests/{id}/complete` |
| **Engagement** | `GET /engagement`, `POST /engagement/{id}/reply`, `POST /engagement/{id}/analyze-sentiment` |
| **AI Content** | `POST /generate-ai-post`, `POST /templates`, `POST /templates/{id}/generate` |
| **Media** | `POST /media/upload`, `GET /media` |
| **Analytics** | `POST /sync-engagement`, `GET /revenue-attribution` |
| **Crisis** | `GET /crisis-alerts`, `POST /crisis-alerts/{id}/resolve` |
| **Competitors** | `POST /competitors`, `GET /competitors/{id}/report` |
| **Influencers** | `POST /influencers`, `GET /influencers/{id}/report`, `POST /influencers/collaborations` |
| **Agents** | `POST /agents/keys`, `GET /agents/submissions`, `POST /agents/submissions/{id}/review` |
| **Safety** | `POST /brand-safety/scan`, `POST /moderation/rules` |
| **Reporting** | `POST /reports/generate-weekly`, `GET /hashtags/top` |

### Agent API (AI Interface)

Base: `/agent/v1`

| Endpoint | Scope | Description |
|----------|-------|-------------|
| `GET /dashboard` | `read:metrics` | Platform status brief |
| `GET /engagement/unreplied` | `read:engagement` | Comments needing response |
| `POST /engagement/reply-draft` | `write:replies` | Generate reply draft |
| `GET /metrics/posts` | `read:metrics` | Post performance data |
| `GET /products` | `read:products` | Product catalog |
| `GET /persona` | `read:persona` | Brand voice guidelines |
| `POST /drafts/social` | `write:drafts` | Submit content draft |
| `GET /outbox/status` | `read:outbox` | Content pipeline status |
| `GET /health` | None | Health check |

### Storefront API (Public)

Base: `/api`

| Endpoint | Description |
|----------|-------------|
| `GET /social-proof/{product_id}` | Recent viewers, items sold |
| `GET /social-proof/instagram-feed` | Instagram grid for product pages |

---

## Deployment Checklist

### Prerequisites

- [ ] PostgreSQL 14+ installed
- [ ] Python 3.11+ with virtualenv
- [ ] Domain name + SSL certificate
- [ ] SMTP server (for reports)
- [ ] OpenAI API key (for AI features)
- [ ] Google Gemini API key (fallback)

### Environment Variables

```bash
# Database
DATABASE_URL=postgresql://user:pass@localhost:5432/social_platform

# API Keys
OPENAI_API_KEY=sk-...
GEMINI_API_KEY=...

# Social Platform Tokens (from registration guide)
META_PAGE_ACCESS_TOKEN=...
META_FACEBOOK_PAGE_ID=...
META_INSTAGRAM_ACCOUNT_ID=...
LINKEDIN_CLIENT_ID=...
LINKEDIN_CLIENT_SECRET=...

# Security
JWT_SECRET=generate_random_32_char_string
WEBHOOK_SECRET=generate_random_32_char_string

# Media Storage
UPLOADS_DIR=/data/uploads/media
MEDIA_URL_BASE=https://yourdomain.com/media
```

### Installation Steps

1. **Clone & setup:**
```bash
git clone <repo>
cd api
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```

2. **Database:**
```bash
# Create database
createdb social_platform

# Run migrations automatically on first start
python -m app.main
```

3. **Nginx config:**
```nginx
server {
    listen 443 ssl;
    server_name yourdomain.com;

    # API
    location /api {
        proxy_pass http://localhost:8000;
        proxy_set_header Host $host;
    }

    location /agent {
        proxy_pass http://localhost:8000;
        proxy_set_header Host $host;
    }

    # Media
    location /media {
        alias /data/uploads/media;
        expires 1d;
        add_header Cache-Control "public, immutable";
    }

    # Webhooks
    location /webhooks {
        proxy_pass http://localhost:8000;
    }
}
```

4. **Systemd service:**
```ini
[Unit]
Description=Social Platform API
After=network.target postgresql.service

[Service]
Type=notify
User=socialplatform
WorkingDirectory=/opt/social-platform/api
Environment="PATH=/opt/social-platform/api/.venv/bin"
ExecStart=/opt/social-platform/api/.venv/bin/uvicorn app.main:app --host 0.0.0.0 --port 8000
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
```

5. **Webhooks:**
- Configure Meta webhook URL: `https://yourdomain.com/webhooks/meta`
- Verify token: your `WEBHOOK_SECRET`

---

## Operations Guide

### Daily Operations

**Morning Check (2 minutes):**
```bash
curl -H "Authorization: Bearer $JWT" \
  https://yourdomain.com/api/admin/social/dashboard/compact
# "Status: HEALTHY (85/100) | 3 drafts pending approval"
```

**Action if needed:**
- If drafts pending → Review in admin panel
- If unreplied comments → Check `/engagement` endpoint
- If crisis alerts → Immediate attention required

### Weekly Operations

**Monday:**
1. Review weekly report (auto-generated)
2. Check A/B test results, implement winners
3. Review optimal posting times, adjust schedule

**Friday:**
1. Schedule next week's content
2. Review influencer submissions
3. Check hashtag performance, update strategy

### Monthly Operations

1. Review agent prediction accuracy
2. Update AI model configurations if needed
3. Rotate API keys (security best practice)
4. Backup database
5. Review ROI on influencer collaborations

### Troubleshooting

| Issue | Check | Solution |
|-------|-------|----------|
| Posts not publishing | Token expiry | Check `/platforms` endpoint, refresh tokens |
| Webhooks not working | URL, signature | Verify webhook URL, check logs |
| AI not generating | API key quota | Check OpenAI/Gemini usage |
| High latency | Database | Check connection pool, query performance |
| Crisis alert firing | Sentiment score | Review flagged content, human override |

---

## FAQ

**Q: Can I trust AI with my brand voice?**  
A: AI generates drafts → You approve → System publishes. You maintain full control.

**Q: What if AI generates inappropriate content?**  
A: Brand safety AI scans all content before it reaches you. Flagged content is blocked.

**Q: Can AI accidentally publish?**  
A: No. AI keys with `write:drafts` cannot publish. Only admin JWT can publish.

**Q: What if my API keys leak?**  
A: Keys are scoped (limited permissions) and audited. Revoke via admin panel, audit log shows what was accessed.

**Q: Can I run this without internet?**  
A: Core platform works, but publishing to social platforms requires internet. AI generation requires OpenAI/Gemini connectivity.

**Q: How do I add a new AI agent?**  
A: `POST /api/admin/social/agents/keys` with desired scopes. Give key to agent developer.

---

## Support

- **Documentation:** This guide
- **API Explorer:** `/docs` (Swagger UI when running)
- **Logs:** `journalctl -u socialplatform -f`
- **Database:** `psql social_platform`

---

*Last updated: June 2026*  
*Platform version: 2.0 (Sprints 1-9 Complete)*
