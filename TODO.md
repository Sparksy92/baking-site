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

## Remaining — Tier 2 (nice to have)

- [x] **Admin dashboard stats endpoint** — Server-side aggregation: revenue, orders, top products, low stock, customers, subscribers, 3 tests
- [x] **Admin image management** — List, reorder (PATCH sort_order), toggle primary, 7 tests
- [x] **Inventory low-stock alerts** — Email alert when stock drops below threshold on order create
- [x] **Product CSV import/export** — Export all products+variants, import with slug dedup, 6 tests
- [x] **Wishlist / favorites** — Add/remove/list with customer auth, storefront UI, 6 tests
- [x] **Product reviews** — Submit (1 per customer per product), moderation (approve/reject), public listing with summary, admin CRUD, 12 tests
- [ ] Playwright E2E in CI (needs headless browser in runner)

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

## Remaining — Tier 3 (future differentiation)

- [ ] **Gift cards** — Adds a revenue channel
- [ ] **Loyalty / points program** — Requires customer accounts (now available)
- [ ] **Product bundles** — Upsell/cross-sell capability
- [ ] **Abandoned cart emails** — Capture email pre-checkout, send reminders
- [ ] **Subscription / recurring orders** — Low priority for clothing
- [ ] **Multi-currency support** — Currently CAD only, future international expansion
- [ ] **Keycloak OIDC integration** — Optional SSO auth provider (AUTH_PROVIDER=local|oidc)
