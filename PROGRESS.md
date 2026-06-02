# Progress — clothing-ecommerce-baseline

## Status: Deployed to staging — storefront polish in progress

## Stack
- **API**: Python 3.12 + FastAPI + asyncpg (PostgreSQL 16)
- **Storefront**: Next.js 15 + React 19 + Tailwind CSS v4 + TypeScript
- **Payments**: Stripe Checkout
- **Email**: Resend (transactional)
- **Deploy**: Podman (rootless) + nginx + Ansible + GitLab CI/CD

## Completed — All Tiers (1–8)

See `TODO.md` for the full feature breakdown. Summary:

- **337 API tests** (pytest) covering all endpoints
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
