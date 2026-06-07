# Security Architecture

**Platform:** Social Media Management System  
**Classification:** Internal Use (Small Team + AI Agents)  
**Threat Model:** External attacker, insider threat (limited), AI agent compromise

---

## Security Principles

1. **Zero-Trust Architecture**: Verify every request, every time
2. **Defense in Depth**: Multiple security layers
3. **Least Privilege**: Agents get minimum required access
4. **Audit Everything**: All actions logged, immutable
5. **Human-in-the-Loop**: Critical actions require human approval

---

## Authentication & Authorization

### Layer 1: Admin JWT

```
┌─────────────────────────────────────────┐
│  ADMIN JWT                              │
│  ├── Audience: Human admins             │
│  ├── Scope: Full platform access        │
│  ├── Expiry: 24 hours                   │
│  ├── Storage: HTTP-only cookie          │
│  └── Rotation: On each login            │
└─────────────────────────────────────────┘
```

**Use Cases:**
- Admin panel access
- Publishing content
- Creating API keys
- Financial operations (revenue tracking)

**Security Measures:**
- Signed with HS256 + strong secret (32+ chars)
- Contains user ID, email, roles
- Verified on every request
- Rate limited per IP

### Layer 2: Agent API Keys

```
┌─────────────────────────────────────────┐
│  AGENT API KEY                          │
│  ├── Audience: AI agents                │
│  ├── Scope: Limited by key scopes       │
│  ├── Expiry: None (manual rotation)     │
│  ├── Storage: Bearer token header       │
│  └── Rate Limit: Per-key configurable   │
└─────────────────────────────────────────┘
```

**Key Format:** `sk_live_{16_char_random}`

**Storage:**
- Plain key shown ONCE on creation
- Stored in DB as bcrypt hash
- No recovery possible (must regenerate)

**Scope Enforcement:**
```python
@require_agent_scope("write:drafts")
def submit_draft():
    # Only executes if key has this scope
```

**Rate Limiting:**
- Default: 100 req/min per key
- Configurable per key (50-1000)
- Redis-backed sliding window
- Returns 429 with Retry-After header

---

## Access Control Matrix

| Action | Admin JWT | Agent Key (write:drafts) | Agent Key (read:engagement) |
|--------|-----------|------------------------|----------------------------|
| Publish post | ✅ | ❌ | ❌ |
| Create draft | ✅ | ✅ | ❌ |
| View engagement | ✅ | ❌ | ✅ |
| Send live reply | ✅ | ❌ | ❌ |
| Generate reply draft | ✅ | ✅ | ❌ |
| View metrics | ✅ | ✅ | ✅ |
| Create API keys | ✅ | ❌ | ❌ |
| Revoke keys | ✅ | ❌ | ❌ |
| Delete content | ✅ | ❌ | ❌ |

**Critical Principle:** AI agents can NEVER publish directly. Human approval required for all live actions.

---

## Data Protection

### Database

**PostgreSQL Security:**
- SSL/TLS connection enforced
- Row-level security not needed (single-tenant)
- Backup encryption at rest
- Connection pooling with limits

**Sensitive Fields:**

| Field | Storage | Encryption |
|-------|---------|------------|
| Agent API keys | bcrypt hash | At-rest (DB native) |
| Admin passwords | bcrypt hash | At-rest |
| Meta access tokens | Plain text | ⚠️ **Should add AES-256** |
| LinkedIn tokens | Plain text | ⚠️ **Should add AES-256** |
| Webhook payloads | JSON | At-rest |
| Audit logs | Plain text | At-rest, append-only |

**Recommendation:** Encrypt social platform tokens at application layer before DB storage.

### Media Storage

```
/data/uploads/media/
├── products/           # Product images
├── blog/              # Blog featured images
└── social/            # Social media uploads
    ├── 2024/
    │   ├── 01/
    │   └── 02/
    └── pending/       # Unapproved uploads
```

**Security:**
- Files stored with UUID names (no original filenames)
- Nginx serves with `X-Content-Type-Options: nosniff`
- No execution permissions (static only)
- Quota enforcement (per-user, per-agent)

---

## Audit & Logging

### Three-Layer Audit System

```
┌──────────────────────────────────────────────────────────┐
│  LAYER 1: Application Audit                               │
│  - Every API request logged                               │
│  - Method, URL, status, timing                            │
│  - Stored: logs/app.log                                    │
├──────────────────────────────────────────────────────────┤
│  LAYER 2: Admin Audit Log                                 │
│  - Table: admin_audit_log                                 │
│  - Who, what, when, before/after values                  │
│  - Immutable (no updates/deletes)                         │
├──────────────────────────────────────────────────────────┤
│  LAYER 3: Agent Audit Log                                 │
│  - Table: agent_audit_log                                 │
│  - Every agent action with payload snapshot               │
│  - IP, user agent, timestamp                              │
│  - Used for incident response                             │
└──────────────────────────────────────────────────────────┘
```

### Admin Audit Log Schema

```sql
CREATE TABLE admin_audit_log (
    id SERIAL PRIMARY KEY,
    admin_email TEXT NOT NULL,
    action_type TEXT NOT NULL,      -- 'publish_post', 'approve_agent_draft'
    entity_type TEXT,               -- 'social_post', 'agent_submission'
    entity_id INTEGER,
    old_values JSONB,               -- Before state
    new_values JSONB,               -- After state
    ip_address TEXT,
    user_agent TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

### Agent Audit Log Schema

```sql
CREATE TABLE agent_audit_log (
    id SERIAL PRIMARY KEY,
    agent_key_id INTEGER,
    action_type TEXT NOT NULL,      -- 'generate_draft', 'submit_reply'
    request_payload JSONB,          -- What was sent
    response_status INTEGER,        -- HTTP status
    duration_ms INTEGER,            -- Response time
    ip_address TEXT,
    user_agent TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

### Log Retention

| Log Type | Retention | Storage |
|----------|-----------|---------|
| Application logs | 30 days | Rotated files |
| Admin audit | 2 years | PostgreSQL |
| Agent audit | 2 years | PostgreSQL |
| Webhook payloads | 90 days | PostgreSQL |

---

## Webhook Security

### Meta (Facebook/Instagram) Webhooks

```
Meta Server → POST /webhooks/meta
                 ├── Signature: X-Hub-Signature-256
                 ├── Payload: JSON
                 └── Response: 200 OK or 500 Retry
```

**Verification:**
```python
def verify_meta_webhook(payload: bytes, signature: str) -> bool:
    expected = hmac.new(
        WEBHOOK_SECRET.encode(),
        payload,
        hashlib.sha256
    ).hexdigest()
    return hmac.compare_digest(f"sha256={expected}", signature)
```

**Protections:**
- ✅ Signature verification (HMAC-SHA256)
- ⚠️ **Missing:** Timestamp validation (5-min window)
- ✅ Replay protection via idempotency (event_id unique constraint)
- ✅ Rate limiting per IP
- ✅ Payload size limits (1MB)

### LinkedIn Webhooks

Similar structure, OAuth2 token validation.

---

## Network Security

### Infrastructure

```
Internet
    ↓
Cloud Firewall (allow 443 only)
    ↓
Nginx (reverse proxy)
    ├── Rate limiting (per IP)
    ├── SSL termination
    ├── WAF rules (if enabled)
    └── Static file serving
    ↓
FastAPI Application
    ├── Auth middleware
    ├── Scope validation
    └── Audit logging
    ↓
PostgreSQL (internal network only)
```

### Required Firewall Rules

| Port | Source | Destination | Purpose |
|------|--------|-------------|---------|
| 443 | Any | Load Balancer | HTTPS traffic |
| 8000 | Internal | App Server | Direct app access (dev only) |
| 5432 | App Server | Database | PostgreSQL (internal) |
| 6379 | App Server | Redis | Rate limiting (optional) |

**Blocked by default:**
- All outbound except social platform APIs
- SSH (use VPN/bastion host)
- Database direct external access

---

## AI Agent Security

### Threat Model

| Threat | Likelihood | Impact | Mitigation |
|--------|-----------|--------|------------|
| API key leak | Medium | High | Scoped keys, rate limits, audit logs |
| Malicious agent | Low | Medium | Human approval required for publish |
| Prompt injection | Medium | Low | Brand safety AI scans output |
| Agent impersonation | Low | High | Unique keys, audit trail |
| Rate limit abuse | Low | Low | Per-key limits, auto-revoke |

### Agent Key Security

**Generation:**
```python
import secrets

api_key = f"sk_live_{secrets.token_urlsafe(24)}"
# Example: sk_live_aBcD1234xYz...
```

**Storage (Agent Side):**
```bash
# Environment variable only
export SOCIAL_PLATFORM_API_KEY="sk_live_..."

# Never:
# - Hardcode in source
# - Store in git
# - Log to console
# - Send over unencrypted channel
```

**Rotation Policy:**
- Recommended: 90 days
- Immediate rotation if:
  - Suspected compromise
  - Agent developer leaves
  - Unusual activity detected

**Revocation:**
```sql
-- Instant revocation
UPDATE agent_api_keys 
SET is_active = FALSE 
WHERE key_hash = 'bcrypt_hash_of_key';
```

---

## Incident Response

### Detection

**Automated alerts:**
- Rate limit exceeded > 5x in 1 hour → Alert
- Failed auth > 10x from same IP → Block + Alert
- Unusual agent activity pattern → Alert
- Crisis alert triggered → Immediate page

**Monitoring:**
- Dashboard: `/api/admin/social/dashboard`
- Logs: `journalctl -u socialplatform -f`
- Audit: Query `admin_audit_log` and `agent_audit_log`

### Response Playbook

**Scenario 1: API Key Leaked**
```
1. Revoke key immediately: UPDATE agent_api_keys SET is_active = FALSE
2. Check audit log for actions taken with key
3. Assess impact (what did agent access?)
4. Generate new key with same scopes
5. Update agent configuration
6. Post-incident review
```

**Scenario 2: Suspicious Agent Activity**
```
1. Pause agent key (is_active = FALSE)
2. Review last 100 actions in agent_audit_log
3. Check if any content was approved/published
4. If malicious content approved:
   - Unpublish if possible
   - Post apology/retraction if needed
5. Investigate agent code for compromise
6. Rotate key before re-enabling
```

**Scenario 3: Database Breach**
```
1. Rotate all social platform tokens immediately
2. Force password reset for all admins
3. Revoke all agent keys
4. Audit all actions in last 24 hours
5. Check for data exfiltration in logs
6. Incident report to stakeholders
```

---

## Compliance & Best Practices

### GDPR Considerations

**Data collected:**
- User comments from social platforms (public data)
- Engagement metrics
- No PII stored beyond what's public

**Actions:**
- ✅ Data retention limits (90 days for engagement events)
- ✅ Right to deletion (can delete specific engagements)
- ⚠️ **Missing:** Data processing agreement

### Security Checklist (Pre-Production)

| Check | Status | Notes |
|-------|--------|-------|
| HTTPS only | ✅ | Force TLS 1.3 |
| Strong JWT secret | ✅ | 32+ random chars |
| API key hashing | ✅ | bcrypt with salt |
| Rate limiting | ✅ | Per-key and per-IP |
| Input validation | ✅ | Pydantic models |
| SQL injection protection | ✅ | Parameterized queries |
| XSS protection | ✅ | FastAPI auto-escaping |
| CSRF protection | N/A | Stateless JWT |
| Webhook signature verify | ✅ | HMAC-SHA256 |
| Audit logging | ✅ | All layers |
| Database encryption at rest | ✅ | PostgreSQL native |
| Token encryption | ⚠️ | Should add app-layer |
| Backup encryption | ⚠️ | Enable if not done |
| Penetration testing | ❌ | Schedule for post-launch |
| Security headers | ✅ | HSTS, CSP, etc. |

---

## Recommendations

### Immediate (Do Now)

1. **Encrypt social platform tokens**
   ```python
   # Before storing
   encrypted_token = aes_encrypt(token, APP_ENCRYPTION_KEY)
   
   # Before using
   token = aes_decrypt(encrypted_token, APP_ENCRYPTION_KEY)
   ```

2. **Add webhook timestamp validation**
   ```python
   timestamp = int(headers['X-Hub-Timestamp'])
   if abs(time.time() - timestamp) > 300:  # 5 min
       raise SecurityError("Webhook too old")
   ```

3. **Enable automated backups**
   ```bash
   # Daily pg_dump with encryption
   pg_dump social_platform | gpg -c > backup_$(date +%Y%m%d).sql.gpg
   ```

### Short-term (This Month)

1. Set up log aggregation (ELK or similar)
2. Configure automated alerting (PagerDuty/Slack)
3. Document incident response procedures
4. Schedule penetration test

### Long-term (This Quarter)

1. SOC 2 readiness assessment
2. Implement WAF rules
3. Add DDoS protection (if needed)
4. Multi-region backup strategy

---

## Security Contacts

| Role | Responsibility |
|------|----------------|
| Admin (You) | Key generation, rotation, incident response |
| Agent Developer | Secure key storage, rate limit compliance |
| Infrastructure | SSL certs, firewall, backups |

---

**Document Version:** 1.0  
**Last Review:** June 2026  
**Next Review:** September 2026
