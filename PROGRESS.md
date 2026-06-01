# Progress — clothing-ecommerce-baseline

## Status: Template hardening — near launch-ready

## Stack
- **API**: Python 3.12 + FastAPI + aiosqlite (SQLite WAL)
- **Storefront**: Next.js 15 + React 19 + Tailwind CSS v4 + TypeScript
- **Payments**: Stripe Checkout
- **Email**: Resend (transactional)
- **Deploy**: Podman + nginx + Ansible

## Completed

### Core Features
- [x] 11-table schema (products, variants, images, categories, collections, orders, promos, newsletter, settings, admin_users, audit_log)
- [x] Product CRUD with variants (size × color), images, categories, collections
- [x] Stripe checkout with stock enforcement (validate + decrement)
- [x] Promo/discount codes (percent + fixed, with limits and expiry)
- [x] Order management (status, tracking, admin notes)
- [x] JWT auth with httpOnly cookies, rate-limited login
- [x] Newsletter subscribe/unsubscribe (CASL-compliant)
- [x] Admin-configurable analytics (GA4 measurement ID via settings)
- [x] Public settings API (announcement, shipping, tax, analytics)
- [x] CLI: `cli.py seed` + `cli.py create-admin`

### Storefront
- [x] Next.js `<Image>` optimization (all public images)
- [x] SEO: dynamic meta, OpenGraph images, JSON-LD, sitemap, robots
- [x] Toast notification system (add to cart feedback)
- [x] Size guide modal (3 chart types: tops, bottoms, headwear)
- [x] Newsletter signup component (homepage)
- [x] Loading skeletons (product grid, product detail)
- [x] Pagination + sorting on category/collection/search pages
- [x] Related products section on PDP
- [x] Security headers middleware (X-Frame-Options, HSTS, nosniff)

### Testing
- [x] API: 50 pytest tests (products, auth, promos, settings, checkout)
- [x] Storefront unit: 26 Vitest tests (formatCents, cart store)
- [x] Storefront E2E: 34 Playwright tests (smoke, navigation, search, cart, pages)

### Infrastructure
- [x] Rate limiting middleware (login, checkout, general)
- [x] In-memory rate limiter with sliding window
- [x] `.gitignore` excludes test artifacts

### Admin
- [x] Newsletter subscriber viewer with pagination + CSV export
- [x] Settings page with friendly labels, hints, toast feedback
- [x] Admin-configurable GA4 analytics (measurement ID in settings)

### Infrastructure
- [x] GitLab CI pipeline (pytest, vitest, typecheck, build)
- [x] Cart TTL — 7-day expiry prevents stale variant checkout failures
- [x] Accessibility — skip-nav link, focus trap on modals, ARIA attributes
- [x] `.env.example` updated for Next.js (removed stale Vite vars)
- [x] `store_domain` default fixed to localhost:3000

## Deferred
- [ ] Abandoned cart email (needs background job scheduler)
- [ ] Product CSV import/export
- [ ] Playwright E2E in CI (needs headless browser in runner)

## Architecture Decisions
- **Port**: API on 8100, Next.js on 3000
- **SQLite**: Single file DB, no container. WAL mode for concurrency.
- **Auth**: JWT in httpOnly cookie, admin role only
- **Env-driven branding**: NEXT_PUBLIC_BRAND_NAME, BRAND_LOGO, etc.
- **Forking model**: Copy repo → edit .env → seed → deploy
- **Image domains**: localhost + *.yourdomain.com

## Key Files
- `api/app/migrations/001_initial_schema.sql` — full schema (11 tables)
- `api/app/migrations/003_newsletter.sql` — newsletter subscribers
- `api/app/migrations/004_analytics.sql` — analytics setting
- `api/app/config.py` — all env vars
- `api/app/services/order_service.py` — checkout validation + stock
- `storefront/next.config.ts` — image domains, API rewrites
- `storefront/middleware.ts` — security headers
- `storefront/lib/toast.ts` — toast notification store
- `.env.example` — full config template
