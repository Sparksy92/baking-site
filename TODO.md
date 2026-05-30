# TODO — clothing-ecommerce-baseline

## Completed (feature/audit-fixes branch)

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

## Completed (feature/customer-accounts branch)

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
- [ ] Playwright E2E in CI (needs headless browser in runner)

## Completed — Tier 6: Content & Marketing

- [x] **Blog / CMS pages** — Page + blog_post types, draft/published workflow, public + admin CRUD, 10 tests
- [x] **Customer segments** — Auto-segmentation rules (JSON), manual membership, admin CRUD, 8 tests
- [x] **Product tags** — Tag CRUD, add/remove from products, product count per tag, 8 tests
- [x] **Size guide** — Per-product → per-category → default fallback, JSON measurements, admin CRUD, 8 tests
- [ ] **Social proof widgets** — "X people viewing" / "Y sold this week" on PDP (storefront-only, deferred)

## Completed — Tier 7: Differentiation & Growth

- [x] **Gift cards** — Auto-generated codes, balance tracking, admin adjust/deactivate, public balance check, 9 tests
- [x] **Loyalty / points program** — Earn on purchase, admin adjust, customer balance/history, configurable rules, stats, 8 tests
- [x] **Product bundles** — Percentage or fixed discount, calculated pricing, public listing + detail, admin CRUD, 8 tests
- [ ] **Community pricing** — Member vs non-member pricing (deferred — needs segment integration)
- [ ] **Indigenous language support** — UI strings in Kanien'kéha/Mohawk (deferred — requires language consultant)
- [ ] **Cultural content protection** — Watermarked images, download prevention (deferred — storefront-only)
- [ ] **Multi-currency support** — Currently CAD only (deferred — future international expansion)
- [ ] **Keycloak OIDC integration** — Optional SSO (deferred — needs Keycloak instance)
- [ ] **Subscription / recurring orders** — Low priority for clothing

## Remaining — Tier 8: Platform Hardening & Gaps

### Operations & Reliability
- [ ] **Global exception handler + request ID** — Catch-all 500 handler with correlation ID in `X-Request-Id` header for log tracing
- [ ] **Return/exchange workflow** — Customer self-serve return request, admin approve/deny, auto restock on receipt

### Analytics & Attribution
- [ ] **Server-side event log** — Lightweight `events` table tracking `product_viewed`, `add_to_cart`, `checkout_started`, `checkout_completed` for conversion funnel
- [ ] **UTM capture on orders** — Store `utm_source`, `utm_medium`, `utm_campaign` from checkout for marketing attribution
- [ ] **Admin reports with date-range** — Extend dashboard: filter by date, refund totals, repeat customer %, conversion rate

### SEO & Marketing
- [ ] **SEO sitemap.xml** — Auto-generated from products, categories, collections, blog posts
- [ ] **Event webhook system** — Admin-configurable outbound webhooks (`customer.created`, `order.completed`, `newsletter.subscribed`) for Mailchimp/Klaviyo/etc.

### Previously Deferred
- [ ] **Social proof widgets** — "X people viewing" / "Y sold this week" on PDP (storefront-only)
- [ ] **Community pricing** — Member vs non-member pricing (needs segment integration)
- [ ] **Indigenous language support** — UI strings in Kanien'kéha/Mohawk (requires language consultant)
- [ ] **Cultural content protection** — Watermarked images, right-click prevention, EXIF copyright metadata
- [ ] **Multi-currency support** — Currently CAD only (future international expansion)
- [ ] **Keycloak OIDC integration** — Optional SSO (needs Keycloak instance)
- [ ] **Subscription / recurring orders** — Low priority for clothing
- [ ] Playwright E2E in CI (needs headless browser in runner)

---

## Deploy Checklist (per brand fork)

When forking the baseline for a new brand, these env vars must be configured per environment.
Email and Stripe gracefully degrade when unconfigured (emails skip, Stripe fails at checkout).

- [ ] Set `BRAND_NAME`, `BRAND_TAGLINE`, logo/favicon paths
- [ ] Generate `ADMIN_JWT_SECRET` and `CUSTOMER_JWT_SECRET` (`openssl rand -base64 32`)
- [ ] Create Stripe account → set `STRIPE_SECRET_KEY`, `STRIPE_PUBLISHABLE_KEY`
- [ ] Register Stripe webhook → set `STRIPE_WEBHOOK_SECRET` (point to production URL)
- [ ] Add sending domain in Resend → add DNS records (TXT/MX) → set `RESEND_API_KEY`, `EMAIL_FROM`
- [ ] Set `CONTACT_EMAIL` (inbox where contact form submissions are delivered)
- [ ] Set `STORE_DOMAIN`, `NEXT_PUBLIC_SITE_URL` to production URL
- [ ] Set `DEV_MODE=false`, `TAX_RATE` to applicable rate
- [ ] Set up crontab for `scripts/backup-db.sh`
- [ ] Review CSP policy in storefront middleware for production domain
