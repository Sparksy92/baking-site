# TODO — clothing-ecommerce-baseline

## Completed — Security & Audit Fixes

- [x] **Stripe discount mismatch** — Fixed: use Stripe coupons for discounts so checkout total is correct
- [x] **Checkout rollback on Stripe failure** — Fixed: added `db.rollback()` before raising 502
- [x] **Email-in-URL PII leak** — Fixed: removed email from success URL, use sessionStorage only
- [x] **Order email case-sensitivity** — Fixed: added `COLLATE NOCASE` to order lookup query
- [x] **Order cancelled email** — Added: `send_order_cancelled()` in email_service, wired into webhook handler
- [x] **CI: `allow_failure: true` on storefront build** — Fixed: removed so broken builds fail the pipeline
- [x] **CSP header** — Added: Content-Security-Policy header in storefront middleware
- [x] **Soft deletes for products** — Fixed: products with orders are deactivated instead of hard deleted
- [x] **Admin order detail page** — Built: `/admin/orders/[id]` with status, tracking, notes, Stripe info
- [x] **Admin orders list: clickable rows + status tabs + search** — Built: color-coded badges, filter by status, search by name/email/order number
- [x] **SQLite backup script** — Added: `scripts/backup-db.sh` with retention, compression, crontab example

## Completed — Customer Accounts

- [x] **Customer accounts** — Full implementation:
  - DB migration `006_customer_accounts.sql`: `customers`, `customer_addresses` tables, `customer_id` FK on orders
  - API: register, login, logout, profile (GET/PATCH), change password, forgot/reset password
  - API: address CRUD (list, create, update, delete, default management)
  - API: order history (matches by customer_id + guest email)
  - Checkout: auto-links orders to logged-in customer, pre-fills contact + saved addresses
  - Storefront: login, register, forgot/reset password pages
  - Storefront: account dashboard with order history, addresses page, settings page
  - Header: account icon (User) — links to /account or /account/login
  - Password reset email via Resend
  - Separate customer JWT (72h lifetime, `_customer_token` cookie)

## Remaining — Tier 1 (should build next)

- [x] **Refund workflow** — Stripe Refund API, admin refund UI (full/partial), refund email, 8 tests
- [x] **Contact form backend** — `POST /api/contact`, Resend delivery, `CONTACT_EMAIL` env var, storefront form, 7 tests
- [x] **Canada Post shipping API** — Rate service, `/api/shipping/rates` endpoint, checkout integration with fallback, storefront rate picker, 7 tests
- [x] **Admin category management page** — Full CRUD API + admin UI (list, create, edit, delete, product unlinking), 14 tests

## Completed — Tier 2 (nice to have)

- [x] **Admin dashboard stats endpoint** — Server-side aggregation: revenue, orders, top products, low stock, customers, subscribers, 3 tests
- [x] **Admin image management** — List, reorder (PATCH sort_order), toggle primary, 7 tests
- [x] **Inventory low-stock alerts** — Email alert when stock drops below threshold on order create
- [x] **Product CSV import/export** — Export all products+variants, import with slug dedup, 6 tests
- [x] **Wishlist / favorites** — Add/remove/list with customer auth, storefront UI, 6 tests
- [x] **Product reviews** — Submit (1 per customer per product), moderation (approve/reject), public listing with summary, admin CRUD, 12 tests

---

## ~~Tier 3: Tax~~ — SKIPPED (no taxes charged for any province)

## Completed — Tier 4: Revenue Optimization

- [x] **Abandoned cart recovery** — Server-side cart persistence, timed email triggers (1h/24h/72h), one-click return link, admin stats, 12 tests
- [x] **Related / recommended products** — Manual picks, co-purchase rebuild, category fallback, admin CRUD, 6 tests
- [x] **Back-in-stock notifications** — Subscribe to OOS variant, auto-email on restock via variant update hook, 5 tests
- [x] **Automatic discounts** — Percentage/fixed/buy-X-get-Y, scoped to collection/category/product, evaluation engine, admin CRUD, 7 tests
- [x] **Variant-specific images** — `variant_id` column on product_images, included in product detail response

## Completed — Tier 5: Operational Tooling

- [x] **Packing slip / invoice** — Printable HTML with @media print, checkbox column for packing, 4 tests
- [x] **Partial fulfillment** — Multiple shipments per order, quantity validation, auto order status update, 6 tests
- [x] **Bulk order actions** — Batch status update (up to 100), CSV export with filters, 4 tests
- [x] **Staff roles & permissions** — 8 permissions, owner-only management, `require_permission()` factory, JWT integration, 7 tests
- [x] **Order editing** — Edit qty / remove / add items pre-fulfillment, auto stock + total recalculation, 5 tests

## Completed — Tier 6: Content & Marketing

- [x] **Blog / CMS pages** — Page + blog_post types, draft/published workflow, public + admin CRUD, 10 tests
- [x] **Customer segments** — Auto-segmentation rules (JSON), manual membership, admin CRUD, 8 tests
- [x] **Product tags** — Tag CRUD, add/remove from products, product count per tag, 8 tests
- [x] **Size guide** — Per-product → per-category → default fallback, JSON measurements, admin CRUD, 8 tests

## Completed — Tier 7: Differentiation & Growth

- [x] **Gift cards** — Auto-generated codes, balance tracking, admin adjust/deactivate, public balance check, 9 tests
- [x] **Loyalty / points program** — Earn on purchase, admin adjust, customer balance/history, configurable rules, stats, 8 tests
- [x] **Product bundles** — Percentage or fixed discount, calculated pricing, public listing + detail, admin CRUD, 8 tests

## Completed — Tier 8: Platform Hardening & Gaps

- [x] **Global exception handler + request ID** — `X-Request-Id` on every response, catch-all 500 handler, log correlation, 2 tests
- [x] **UTM capture on orders** — `utm_source/medium/campaign` on orders table + checkout schema, marketing attribution in reports
- [x] **SEO sitemap.xml** — Auto-generated from products, categories, collections, blog posts, 3 tests
- [x] **Server-side event log** — `events` table, public fire-and-forget tracking, admin conversion funnel + top products, 6 tests
- [x] **Admin reports with date-range** — Revenue, AOV, refunds, repeat %, daily breakdown, UTM attribution, top products, 2 tests
- [x] **Return/exchange workflow** — Customer self-serve request, admin approve/reject/receive, auto-restock, status machine, 7 tests
- [x] **Event webhook system** — Admin CRUD, HMAC signatures, delivery logging, 9 event types, 7 tests
- [x] **Social proof widgets** — "X people viewing" / "Y sold this week" on PDP, backend API + storefront component, 2 tests

### Deferred
- [ ] **Community pricing** — Member vs non-member pricing (needs segment integration)
- [ ] **Indigenous language support** — UI strings in Kanien'kéha/Mohawk (requires language consultant)
- [ ] **Cultural content protection** — Watermarked images, right-click prevention, EXIF copyright metadata
- [ ] **Multi-currency support** — Currently CAD only (future international expansion)
- [ ] **Keycloak OIDC integration** — Optional SSO (needs Keycloak instance)
- [ ] **Subscription / recurring orders** — Low priority for clothing
- [ ] **Playwright E2E in CI** — Needs headless browser in runner image
- [x] **Pre-orders + scheduled drop publishing** — `available_at` on products + variants, `allow_preorder` flag. Drop date badge + Pre-order/Coming Soon CTA on PDP. Admin UI in ProductForm. Migration `004_preorders.sql`. 5 tests.
- [ ] **Shipping zones + weight-tier rates** — Flat rate fine for now. Revisit when a client has mixed-weight catalog or ships to multiple regions.
- [x] **Recently viewed products** — `lib/recently-viewed.ts` (localStorage, max 8). `RecentlyViewed` component on PDP (below related) and cart page.
- [ ] **Guest checkout → account claiming** — Post-purchase prompt to link order to new/existing account.
- [x] **Customer LTV report** — `GET /admin/reports/ltv`. Ranked by total spend, AOV, first/last order, min_orders filter. Admin page `/admin/ltv` with summary cards + table. 4 tests.
- [ ] **Inventory stock adjustment UI** — Adjust stock from admin with reason log. Low priority at current client scale.

---

## Completed — Sprint: Admin UX + Store Credit + Express Checkout

### 1. Admin UI Progressive Disclosure
- [x] **Collapse admin nav into sections** — Core always visible. Marketing + Advanced collapsed by default. localStorage remembers open state per session.

### 2. Store Credit
- [x] **Migration** (`003_store_credit.sql`) — `store_credit_cents` on customers; `store_credit_transactions` ledger table
- [x] **API** — Issue, adjust, balance, history endpoints. Return resolution `store_credit` auto-issues credit on `refunded` transition.
- [x] **Checkout integration** — `use_store_credit` flag on `CheckoutRequest`; deducted before tax; `store_credit_applied_cents` returned in response.
- [x] **Admin UI** — `/admin/store-credit` page: lookup by customer ID, issue, adjust, transaction history table.
- [x] **Tests** — `tests/test_store_credit.py`: 11 tests covering issue, adjust, insufficient balance, balance/history, return resolution → credit issuance.

### 3. Apple Pay / Google Pay (Stripe Payment Request Button)
- [x] **`@stripe/stripe-js`** installed in storefront
- [x] **`NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`** added to `.env.example`
- [x] **`stripe_service.create_payment_intent()`** — new Stripe PaymentIntent flow (vs. Checkout Session redirect)
- [x] **`POST /api/checkout/payment-intent`** — creates order + returns `client_secret` for client-side confirmation
- [x] **`ExpressCheckout` component** — renders Payment Request Button only when browser supports Apple Pay or Google Pay. Shows nothing on unsupported browsers.
- [x] **PDP integration** — button appears below Add to Cart when item is in stock
- [x] **Checkout page integration** — express lane above the standard form with "or pay with card below" divider
- [x] **Tests** — `tests/test_express_checkout.py`: 6 tests covering client_secret response, order creation, stock decrement, OOS rejection, Stripe failure rollback, promo code with PI.

---

## Social Media Content Platform — Sprint Plan

> Branch: `fix/blog-ai-social-improvements` → future: `feature/social-platform`
> Goal: Blog-to-social pipeline. Write once, publish everywhere. Brand voice stays consistent.
> Architecture: Persona → Per-platform prompt → Blog publish triggers draft generation → Outbox → Approve → Publish

### Sprint 1 — Foundation: Persona + Platform Config (current)
- [ ] **Migration 031** — `brand_persona`, `social_platform_configs`, `social_posts` tables
- [ ] **Persona API** — CRUD `GET/POST/PATCH /api/admin/persona` (single active persona)
- [ ] **Persona admin UI** — Settings-style page: voice, audience, values, words to use/avoid
- [ ] **Platform config API** — `GET/PATCH /api/admin/social/platforms` — enable/disable, prompt, hashtags, auto-publish toggle
- [ ] **Platform admin UI** — Card per platform showing: status badge (active/pending/not configured), enable toggle, setup instructions, prompt editor, hashtag bank
- [ ] **Inject persona into all AI calls** — `ai_service.py` prepends active persona to every prompt
- [ ] **Per-platform prompt templates** — replace single generic prompt with platform-specific templates stored in DB
- [ ] **Tests** — `test_persona.py` (8 tests), `test_social_platforms.py` (6 tests), update `test_pages.py` for route order fixes

### Sprint 2 — Blog → Social Pipeline
- [ ] **Blog publish hook** — on `POST /api/admin/pages` or status → published, trigger social draft generation for all enabled platforms
- [ ] **AI generates platform-native drafts** — persona + platform prompt + blog content → one draft per enabled platform in `social_posts`
- [ ] **Inbound sync → draft** — fix `meta_service.py` so synced posts land as `status='draft'` not `'published'`
- [ ] **`meta_description` auto-fill** — when blank, populate from first sentence of AI output
- [ ] **Outbox API** — `GET /api/admin/social/outbox`, `PATCH /api/admin/social/outbox/{id}` (approve/reject/edit), `POST /api/admin/social/outbox/{id}/publish`
- [ ] **Outbox admin UI** — List of pending drafts per platform, preview, edit content, approve/reject, publish button
- [ ] **Auto-publish toggle** — if `auto_publish=true` for a platform, skip draft → publish immediately on blog post publish
- [ ] **Tests** — `test_outbox.py` (10 tests), `test_social_publish_pipeline.py` (8 tests)

### Sprint 3 — Outbound Publishing: Facebook + Instagram
- [ ] **Facebook outbound** — `POST /api/admin/social/outbox/{id}/publish` → Graph API `/{page_id}/feed`
- [ ] **Instagram outbound** — 2-step: create container → publish (Graph API requirement)
- [ ] **Image attach** — use blog `featured_image_url` for outbound posts, allow admin override
- [ ] **Publish result tracking** — store `platform_post_id`, update `status='published'`, log errors to `error_message`
- [ ] **Retry on failure** — mark as `failed`, surface in outbox UI with error message, allow manual retry
- [ ] **Tests** — `test_social_publish.py` (10 tests, all API calls mocked)

### Sprint 4 — Platform Expansion
- [ ] **LinkedIn integration** — OAuth app setup guide in admin, posting via LinkedIn API
- [ ] **TikTok integration** — pending app review; admin shows setup instructions + review status
- [ ] **X / Twitter** — optional, gated behind `X_API_KEY` env var; admin shows cost warning
- [ ] **Scheduling** — `scheduled_at` field on outbox, background worker publishes at correct time
- [ ] **Platform-native preview** — character counter, hashtag count, truncation warnings per platform
- [ ] **Hashtag bank** — per-platform, admin-managed, auto-appended to generated content
- [ ] **Tests** — `test_scheduling.py` (5 tests), `test_linkedin.py`, `test_tiktok.py`

### Sprint 5 — Intelligence Layer
- [ ] **Image prompt generation** — AI generates DALL-E prompt alongside blog content; admin can generate + attach image
- [ ] **Engagement pull from Meta** — likes, reach, comments stored against `social_posts`
- [ ] **Content calendar view** — admin UI calendar showing scheduled + published across all platforms
- [ ] **YouTube (Phase 3)** — video-only; requires AI video generation (Synthesia/HeyGen); deferred

### Platform Setup Checklist (per platform)
- [ ] **Facebook** — `META_PAGE_ACCESS_TOKEN` + `META_FACEBOOK_PAGE_ID` in env → enable in admin
- [ ] **Instagram** — `META_PAGE_ACCESS_TOKEN` + `META_INSTAGRAM_ACCOUNT_ID` in env → enable in admin
- [ ] **X / Twitter** — `X_API_KEY` + `X_API_SECRET` in env (requires $100/mo Basic plan at developer.twitter.com)
- [ ] **LinkedIn** — Register free app at developer.linkedin.com (needs Company Page, 1–2 week review) → `LINKEDIN_CLIENT_ID` + `LINKEDIN_CLIENT_SECRET`
- [ ] **TikTok** — Register at developers.tiktok.com, request Content Posting API (1–4 week review, submit now) → `TIKTOK_CLIENT_KEY` + `TIKTOK_CLIENT_SECRET`
- [ ] **YouTube** — Phase 3 only. YouTube Data API v3 (free) but video-only.

---

## Deploy Checklist (per brand fork)

When forking the baseline for a new brand, configure these per environment.
Email and Stripe gracefully degrade when unconfigured (emails skip, Stripe fails at checkout).

- [ ] Set `BRAND_NAME`, `BRAND_TAGLINE`, logo/favicon paths
- [ ] Generate `ADMIN_JWT_SECRET` and `CUSTOMER_JWT_SECRET` (`openssl rand -base64 32`)
- [ ] Set `POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_DB`, `POSTGRES_HOST`
- [ ] Create Stripe account → set `STRIPE_SECRET_KEY`, `STRIPE_PUBLISHABLE_KEY`
- [ ] Register Stripe webhook → set `STRIPE_WEBHOOK_SECRET` (point to production URL)
- [ ] Add sending domain in Resend → add DNS records (TXT/MX) → set `RESEND_API_KEY`, `EMAIL_FROM`
- [ ] Set `CONTACT_EMAIL` (inbox where contact form submissions are delivered)
- [ ] Set `STORE_DOMAIN`, `NEXT_PUBLIC_SITE_URL` to production URL
- [ ] Set `DEV_MODE=false`, `TAX_RATE` to applicable rate
- [ ] Review CSP policy in storefront middleware for production domain
- [ ] Verify PostgreSQL backup cron is active (managed by Ansible)
- [ ] Set `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` in storefront env (same `pk_live_` key as `STRIPE_PUBLISHABLE_KEY`)
- [ ] **Apple Pay domain verification** — Stripe Dashboard → Settings → Payment Methods → Apple Pay → Add domain → download `apple-developer-merchantid-domain-association` → place in `storefront/public/.well-known/`. Google Pay needs no extra setup.
