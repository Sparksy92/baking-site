# Progress — clothing-ecommerce-baseline

## Status: Deployed to staging — storefront polish in progress

## Stack
- **API**: Python 3.12 + FastAPI + asyncpg (PostgreSQL 16)
- **Storefront**: Next.js 15 + React 19 + Tailwind CSS v4 + TypeScript
- **Payments**: Stripe Checkout + Stripe PaymentIntent (Apple Pay / Google Pay)
- **Email**: Resend (transactional)
- **Deploy**: Podman (rootless) + nginx + Ansible + GitLab CI/CD

## Completed — All Tiers (1–8)

See `TODO.md` for the full feature breakdown. Summary:

- **394 API tests** (pytest) — +11 store credit, +6 express checkout, +5 pre-orders, +4 LTV (`test_deferred_features.py`)
- **60+ API endpoints** across 29 migration files
- **Tiers 1–8 complete**: core commerce, customer accounts, refunds, shipping,
  admin CRUD, dashboard stats, wishlist, reviews, abandoned cart, loyalty,
  gift cards, bundles, returns, webhooks, social proof, blog/CMS, segments,
  tags, size guides, CSV import/export, reports, event tracking
- **Storefront**: full shopping flow, customer accounts, SEO, responsive
- **Admin panel**: products (with color/image tagging), orders, returns,
  analytics, gift cards, loyalty, newsletters, webhooks, staff roles

## Recent Changes (June 2026)

- Database migrated from SQLite to **PostgreSQL 16** (asyncpg)
- Admin image color tagging — tag images with variant colors for gallery filtering
- Color↔size auto-switch on PDP, image gallery color filtering
- Hydration fixes (Header cart badge, floating cart bar)
- Rich text product descriptions with SEO meta fields
- Variant matrix builder with color picker
- CI/CD pipeline fully operational (staging auto-deploy, production manual gate)
- Infrastructure impact detection (warns on MR when DB drivers or Dockerfiles change)
- Full SEO implementation: JSON-LD schemas, canonical URLs, noindex, Open Graph, sitemap, robots.txt, redirects middleware, admin SEO controls on all content types
- API-layer SEO test suite (`tests/test_seo.py`) — 25 tests covering field round-trips, noindex PATCH correctness, redirect CRUD, sitemap exclusion
- E2E SEO test suite (`e2e/seo.spec.ts`) — 35 passing browser-level tests
- `.env.example` updated to Postgres (removed SQLite relic)
- `docker-compose.yml` updated: `ecommerce_test` DB auto-created on first `docker compose up`
- **Admin nav progressive disclosure** — Core / Marketing / Advanced sections, collapsed by default, localStorage state
- **Store credit** — migration `003_store_credit.sql`, full ledger API, admin UI, checkout redemption, return resolution hook
- **Apple Pay / Google Pay** — Stripe Payment Request Button on PDP + checkout express lane via `POST /api/checkout/payment-intent`
- **Recently viewed products** — localStorage-based, shown on PDP + cart page, zero API cost
- **Pre-orders + scheduled drops** — `available_at` on products/variants, `allow_preorder` flag, drop date badge on PDP, admin UI in ProductForm, migration `004_preorders.sql`
- **Customer LTV report** — `GET /admin/reports/ltv`, admin page `/admin/ltv` with summary cards + ranked table, `min_orders` filter

## Deferred

- [ ] Playwright E2E in CI (needs headless browser in runner image)
- [ ] Community pricing — member vs non-member (needs segment integration)
- [ ] Indigenous language support — UI strings in Kanien'kéha (needs language consultant)
- [ ] Cultural content protection — watermarked images, right-click prevention
- [ ] Multi-currency support — currently CAD only
- [ ] Keycloak OIDC integration — optional SSO
- [ ] Subscription / recurring orders — low priority for clothing

## Architecture Decisions
- **Ports**: API on 8100, Next.js on 3000
- **Database**: PostgreSQL 16 (containerized, managed by Ansible)
- **Auth**: JWT in httpOnly cookie, admin + customer roles
- **Env-driven branding**: NEXT_PUBLIC_BRAND_NAME, BRAND_LOGO, etc.
- **Forking model**: Copy repo → edit .env → seed → deploy
- **CI/CD**: Inline cross-project triggers (not shared template)
- **Backup**: Pre-deploy pg_dump + daily cron backup with 14-day retention

## Platform Scope Decisions (June 2026)

Decisions made during feature gap audit — captured to avoid re-litigating these.

- **Turtle Island Supply is a separate fork** — not accommodated here. TIS (millions of products, multi-supplier, warehousing) requires a different catalog/search/inventory architecture. Fork this repo when ready and rebuild those layers. Everything else (auth, checkout, orders, email, webhooks, SEO, admin scaffolding) carries over cleanly.
- **Live chat: not built into platform** — small brand clients won't staff a chat widget. Embed Tawk.to or Chatwoot as a per-client script tag on request. 10-minute add-on, not a platform feature.
- **Inventory management: not needed at current client scale** — small-batch brands (10–50 products) manage stock fine through variant editing. Revisit when a client hits 200+ orders/month or multi-channel selling.
- **Newsletter: capture-only is correct** — export to Brevo/Klaviyo/Mailchimp. Building a broadcast engine means owning CASL compliance, bounce handling, and deliverability. Wrong layer for this platform.
- **Apple Pay / Google Pay: viable when needed** — Stripe Payment Request Button, no separate merchant accounts required. Domain verification handled by Stripe. Add to checkout when a client prioritises mobile conversion.
- **Store credit: shipped** — `store_credit_cents` ledger on customers, `store_credit_transactions` table, full API, admin UI, checkout redemption, return resolution hook. Was a broken code path (`resolution = 'store_credit'` existed with no ledger). Now complete.
- **Multi-currency: out of scope** — Canada-only platform. CAD only.
- **This platform is not over-engineered for small brands** — features like loyalty, gift cards, bundles, segments, and abandoned cart are hidden complexity. Clients interact with a clean admin UI. The feature depth is a selling point for upsell conversations, not a burden on the client.
