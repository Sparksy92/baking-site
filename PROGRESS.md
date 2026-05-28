# Progress — clothing-ecommerce-baseline

## Status: Pre-first-fork baseline hardening

## Completed
- [x] API: FastAPI + SQLite (WAL), 10-table schema, JWT auth, Stripe checkout, Resend email
- [x] Storefront: React 19 + Vite + Tailwind, 8 customer pages, 8 admin pages
- [x] Infra: Dockerfiles, docker-compose (no internal nginx — uses host nginx-proxy)
- [x] Tests: 9/9 API tests passing
- [x] CLI: `cli.py seed` + `cli.py create-admin`
- [x] Git: initial commit on `main` (f36ec69)
- [x] Smoke test: all API endpoints verified working

## In Progress — Tier 1 (Must-fix before forking)
- [ ] Fix branding (logo, brand name from env in storefront)
- [ ] Promo/discount codes (schema + API + checkout)
- [ ] Complete admin product form (variants, images, category picker)
- [ ] SEO: dynamic `<title>` + meta tags per page

## Next — Tier 2
- [ ] Branded email templates (HTML with logo/colors)
- [ ] Static page system (About, Shipping Policy, Returns)
- [ ] Size guide component
- [ ] Product CSV import/export
- [ ] Low stock alerts in admin

## Architecture Decisions
- **Port**: API runs on 8100, Vite dev on 5173
- **No internal nginx**: Host-level nginx-proxy handles routing
- **SQLite**: Single file DB, no container needed. WAL mode for concurrency.
- **Auth**: JWT in httpOnly cookie, roles: owner | admin
- **Env-driven theming**: BRAND_NAME, BRAND_COLOR_*, BRAND_LOGO_PATH
- **Forking model**: Copy repo → edit .env → seed → deploy

## Key Files
- `api/app/migrations/001_initial_schema.sql` — full schema
- `api/app/config.py` — all env vars
- `storefront/src/main.tsx` — all routes
- `storefront/vite.config.ts` — proxy to API
- `.env.example` — full config template
