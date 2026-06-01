# Clothing Ecommerce Baseline

A lightweight, white-label ecommerce platform purpose-built for **clothing and apparel brands**. Designed for Indigenous streetwear, small-batch drops, and culture-forward fashion brands.

## Architecture

```
┌─────────────────────────────────────────────────┐
│  Storefront (Next.js 15 + Tailwind CSS v4)      │
│  SSR/SSG • SEO-first • Image-forward • Fast     │
└────────────────────┬────────────────────────────┘
                     │ /api/* (proxy rewrite)
┌────────────────────▼────────────────────────────┐
│  API (Python 3.12 + FastAPI + SQLite)           │
│  60+ endpoints • 29 migration files • 337 tests│
└────────────────────┬────────────────────────────┘
                     │
┌────────────────────▼────────────────────────────┐
│  SQLite (WAL mode) — single file, no container  │
└─────────────────────────────────────────────────┘
```

## Stack

| Layer | Technology |
|-------|-----------|
| **API** | Python 3.12 + FastAPI + uvicorn + aiosqlite |
| **Database** | SQLite (WAL mode) — zero infrastructure |
| **Frontend** | Next.js 15 (App Router) + TypeScript + Tailwind CSS v4 |
| **SEO** | Metadata API, JSON-LD, dynamic sitemap.xml, robots.txt |
| **Payments** | Stripe Checkout (card payments) |
| **Email** | Resend (order confirmations, shipping updates, alerts) |
| **Deploy** | Podman (rootless) + nginx + Ansible |

---

## Quick Start (Local Development)

### Prerequisites

- **Python 3.12+** (for API)
- **Node.js 20+** (for storefront)
- **npm** (comes with Node)

### 1. Clone & Configure

```bash
git clone https://gitlab.turtleislandsupply.com/rezhub/clothing-ecommerce-baseline.git
cd clothing-ecommerce-baseline
cp .env.example .env
```

Edit `.env` — for local dev the defaults work fine. Set these at minimum:

```bash
DEV_MODE=true                  # Enables Swagger docs at /api/docs
ADMIN_JWT_SECRET=dev-secret    # Any string works for local
CUSTOMER_JWT_SECRET=dev-cust   # Any string works for local
```

### 2. Backend (API)

```bash
cd api
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt

# Start the API server (auto-creates DB + runs migrations on first boot)
uvicorn app.main:create_app --factory --reload --port 8100

# In another terminal — seed sample data & create admin user:
cd api && source .venv/bin/activate
python cli.py seed           # 6 products, 3 categories, 2 collections
python cli.py create-admin   # interactive prompt for email/password
```

The API will:
- Auto-create `data/store.db` on first run
- Run all 29 SQL migrations automatically
- Serve Swagger docs at `http://localhost:8100/api/docs` (when `DEV_MODE=true`)

### 3. Storefront (Next.js)

```bash
cd storefront
npm install
npm run dev
```

The storefront `.env.local` is already committed with local defaults. If you need to change the API URL or brand settings, edit `storefront/.env.local`.

- **Storefront:** http://localhost:5173
- **Admin panel:** http://localhost:5173/admin
- **API docs:** http://localhost:8100/api/docs

The storefront proxies `/api/*` to `http://localhost:8100` via `next.config.ts` rewrites.

### 4. Login to Admin

Navigate to `http://localhost:5173/admin` and log in with the credentials you created in step 2.

---

## Features

### Customer-Facing Storefront
- **Product gallery** — multiple images, hero carousel, zoom
- **Size × Color variants** — swatch selectors, per-variant images, size guide
- **Collections** — curated groups (drops, seasons)
- **Smart search** — search by name, description, collection
- **Cart & Checkout** — Stripe Checkout, promo codes, auto-discounts
- **Customer accounts** — register, login, order history, saved addresses, wishlist
- **Reviews** — star ratings with admin moderation
- **Gift cards** — purchase, balance check, redeem at checkout
- **Loyalty points** — earn on purchase, track balance
- **Product bundles** — discounted multi-product sets
- **Back-in-stock notifications** — email alerts when restocked
- **Social proof** — "X people viewing" / "Y sold this week" on PDP
- **Related products** — category-based recommendations
- **Returns** — customer self-serve return requests
- **Blog** — published pages and blog posts
- **Newsletter signup** — email capture
- **Order tracking** — lookup by order number + email
- **SEO** — SSR, JSON-LD, OG images, sitemap.xml, robots.txt
- **Responsive** — desktop + mobile optimized

### Admin Dashboard (all manageable from UI)
- **Dashboard** — revenue, orders, low stock, top products
- **Products** — CRUD, multi-image upload, variant matrix
- **Collections** — create/edit, assign products
- **Categories** — organize catalog
- **Orders** — view, update status, tracking, partial fulfillment, order editing
- **Returns** — approve/reject/receive, auto-restock
- **Analytics** — conversion funnel, date-range sales reports, UTM attribution
- **Gift Cards** — issue, deactivate, balance tracking
- **Loyalty** — program stats
- **Bundles** — create/manage bundle deals
- **Pages & Blog** — CRUD with draft/published workflow
- **Tags** — product tagging
- **Segments** — customer segmentation with rules
- **Size Guides** — per-category with fallback
- **Promos** — discount codes (percent/fixed, limits, expiry)
- **Newsletter** — subscriber list, CSV export
- **Webhooks** — outbound event webhooks (order.*, customer.*, return.*)
- **Staff** — roles & permissions (owner/admin/staff)
- **Settings** — brand config, shipping, tax, analytics

### Platform Features
- **Request ID tracing** — `X-Request-Id` on every response
- **Global exception handler** — catch-all 500s with correlation ID
- **Rate limiting** — sliding window per IP
- **Structured JSON logging** — for log aggregation
- **UTM tracking** — marketing attribution on orders
- **Event analytics** — server-side conversion funnel
- **Webhook system** — HMAC-signed outbound webhooks
- **Auto-discounts** — rule-based discounts
- **Abandoned cart recovery** — email reminders
- **Packing slips** — printable order documents
- **CSV import/export** — bulk product management
- **Audit log** — who changed what

---

## Environment Variables

See `.env.example` for the full list. Key variables:

| Variable | Description | Default |
|----------|-------------|---------|
| `DATABASE_PATH` | SQLite file path | `./data/store.db` |
| `ADMIN_JWT_SECRET` | JWT signing key (admin) | Must change in prod |
| `CUSTOMER_JWT_SECRET` | JWT signing key (customers) | Must change in prod |
| `STRIPE_SECRET_KEY` | Stripe API key | `sk_test_...` |
| `STRIPE_WEBHOOK_SECRET` | Stripe webhook signature | `whsec_...` |
| `RESEND_API_KEY` | Email service API key | `re_...` |
| `SHIPPING_FLAT_RATE_CENTS` | Flat rate shipping | `1200` |
| `SHIPPING_FREE_THRESHOLD_CENTS` | Free shipping above | `15000` |
| `TAX_RATE` | Tax rate | `0` (set to `0.13` for ON) |
| `STORE_DOMAIN` | Public URL | `http://localhost:5173` |
| `DEV_MODE` | Enable docs + relaxed cookies | `true` |

---

## Testing

### API Tests (pytest)

```bash
cd api
source .venv/bin/activate
python -m pytest tests/ -v
```

**337 tests** covering: health, auth, products, categories, collections, orders, promos, checkout, shipping, customers, wishlist, reviews, related products, back-in-stock, cart, pages, tags, segments, size guides, gift cards, loyalty, bundles, events, analytics, reports, returns, webhooks, social proof, sitemap, CSV import/export, request ID.

### Storefront Unit Tests (Vitest)

```bash
cd storefront
npm test
```

### Storefront E2E (Playwright)

```bash
cd storefront
npx playwright test
```

> Requires the dev servers running (Next.js + API).

---

## Deployment

Two containers: API (FastAPI/uvicorn) + Storefront (Next.js standalone).
nginx reverse-proxies both behind a single domain.

```bash
# Build
podman-compose -f infra/docker/docker-compose.prod.yml build

# Run
podman-compose -f infra/docker/docker-compose.prod.yml up -d
```

See `infra/` for Docker and nginx configuration.

---

## Project Structure

```
├── api/
│   ├── app/
│   │   ├── main.py              # FastAPI app factory
│   │   ├── config.py            # Settings (from env)
│   │   ├── database.py          # SQLite connection + migrations
│   │   ├── auth.py              # Admin JWT auth
│   │   ├── customer_auth.py     # Customer JWT auth
│   │   ├── middleware/          # Rate limiting, request ID, logging
│   │   ├── migrations/          # 001-029 SQL schema files
│   │   ├── models/schemas.py    # Pydantic models
│   │   ├── routes/              # Public API routes
│   │   ├── routes/admin/        # Admin API routes
│   │   └── services/            # Business logic (orders, email, webhooks)
│   ├── tests/                   # pytest async tests
│   ├── cli.py                   # seed + create-admin commands
│   └── requirements.txt
├── storefront/
│   ├── app/
│   │   ├── (shop)/              # Public pages (products, cart, checkout)
│   │   └── admin/(panel)/       # Admin dashboard pages
│   ├── components/              # Shared React components
│   ├── lib/                     # API client, cart store, helpers
│   └── package.json
├── infra/                       # Docker + nginx configs
├── .env.example                 # Environment template
├── TODO.md                      # Feature tracking
└── README.md                    # This file
```

---

## Forking for a New Brand

1. Fork/copy this repo
2. Update `.env` with brand name, colors, domain
3. Replace `storefront/public/images/brand/` assets
4. Update `storefront/.env.local` with brand name + colors
5. `cd api && python cli.py seed` (or add products via admin UI)
6. `python cli.py create-admin`
7. Deploy

---

## Development Workflow

**Branch strategy:** feature branches → `staging` → `main`. Never commit directly to `staging` or `main`.

```bash
# Create a feature branch
git checkout -b feature/your-feature

# Work, commit, push
git push -u origin feature/your-feature

# Create MR to staging when ready
```

**Running tests before pushing:**

```bash
cd api && source .venv/bin/activate && python -m pytest tests/ -q
cd ../storefront && npx tsc --noEmit
```

**Key directories for common tasks:**

| Task | Directory |
|------|----------|
| Add/edit API endpoints | `api/app/routes/` or `api/app/routes/admin/` |
| Change DB schema | `api/app/migrations/` (add new numbered .sql file) |
| Frontend pages (shop) | `storefront/app/(shop)/` |
| Admin panel pages | `storefront/app/admin/(panel)/` |
| Shared components | `storefront/components/` |
| API client + types | `storefront/lib/api.ts` |
| Business logic | `api/app/services/` |
| Tests | `api/tests/` |

---

## License

Proprietary — RezHub internal.
