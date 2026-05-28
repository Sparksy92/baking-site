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
│  Products • Orders • Payments • Shipping        │
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
| **SEO** | Metadata API, JSON-LD, dynamic sitemap, robots.txt |
| **Payments** | Stripe Checkout (card payments) |
| **Email** | Resend (order confirmations, shipping updates) |
| **Deploy** | Podman (rootless) + nginx + Ansible |

## Features

### Customer-Facing
- **Product gallery** — multiple images per product, hero carousel, zoom
- **Size × Color variants** — swatch selectors, size guide
- **Collections** — curated groups (drops, seasons, categories)
- **Smart search** — search by name, description, collection
- **Cart & Checkout** — Stripe Checkout, promo codes, clean UX
- **Order tracking** — lookup by order number + email
- **Responsive** — desktop grid + mobile-optimized
- **SEO** — SSR pages, JSON-LD structured data, dynamic OG images, sitemap.xml

### Admin Dashboard
- **Product management** — CRUD, multi-image upload, variant matrix
- **Collection management** — create/edit collections, assign products
- **Order management** — view, update status, add tracking numbers
- **Inventory tracking** — stock levels, low-stock alerts
- **Settings** — brand config, shipping, tax, announcements
- **Audit log** — who changed what and when

### Brand Architecture
- White-label: fork once per brand, configure via `.env`
- No food-service concepts (no store hours, no modifiers, no kitchen kanban)
- Shipping-first fulfillment (flat rate or free above threshold)
- Tax calculation built in

---

## Data Model

10 tables (lean but complete):

| Table | Purpose |
|-------|---------|
| `categories` | Product categories (Tees, Hoodies, Hats, etc.) |
| `products` | Name, slug, description, is_active |
| `product_variants` | Size × Color matrix with price, SKU, stock |
| `product_images` | Multiple images per product (ordered) |
| `collections` | Curated groups (New Arrivals, Summer Drop) |
| `collection_products` | Many-to-many: products ↔ collections |
| `orders` | Customer info, shipping, payment status |
| `order_items` | Line items with variant snapshot |
| `admin_users` | Admin accounts (bcrypt, JWT) |
| `audit_log` | Change tracking |

---

## Quick Start (Local Development)

### Prerequisites

- Python 3.12+
- Node.js 20+
- npm

### Backend

```bash
cd api
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
cp ../.env.example ../.env  # Edit with your values

# Seed sample data + create admin user
python cli.py seed
python cli.py create-admin

# Start API
uvicorn app.main:app --reload --port 8100
```

API docs: `http://localhost:8100/api/docs` (Swagger UI)

### Frontend (Next.js)

```bash
cd storefront
npm install
npm run dev
```

Storefront: `http://localhost:5173`

The storefront proxies `/api/*` to the backend via `next.config.ts` rewrites.

---

## Environment Variables

See `.env.example` for the full list. Key variables:

```bash
BRAND_NAME="Elder"
BRAND_COLOR_PRIMARY="#1A1A1A"
BRAND_COLOR_ACCENT="#C53030"

DATABASE_PATH=./data/store.db
ADMIN_JWT_SECRET=<openssl rand -base64 32>

STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...

SHIPPING_FLAT_RATE_CENTS=1200
SHIPPING_FREE_THRESHOLD_CENTS=15000

TAX_RATE=0.13
STORE_CURRENCY=CAD
```

---

## Deployment

Two containers: API (FastAPI/uvicorn) + Storefront (Next.js `next start`).
nginx reverse-proxies both behind a single domain.

```bash
# Build
podman-compose -f infra/docker/docker-compose.prod.yml build

# Run
podman-compose -f infra/docker/docker-compose.prod.yml up -d
```

See `infra/` directory for Docker and nginx configuration.

---

## Testing

### API (pytest)

```bash
cd api
source .venv/bin/activate
python -m pytest tests/ -v
```

50 tests covering: health, auth, products (CRUD, filtering, sorting, pagination), categories, collections, promo codes (admin CRUD, validation, discount calc), and public settings.

### Storefront Unit Tests (Vitest)

```bash
cd storefront
npm test
```

26 tests covering: `formatCents`, brand helpers, cart store (add, remove, update, persistence, subscriptions).

### Storefront E2E (Playwright)

```bash
cd storefront
npx playwright test
```

34 tests covering: smoke tests (all public routes), header/footer navigation, mobile menu, search, cart, policy pages, info pages, and categories.

> **Note:** E2E tests require the Next.js dev server on port 3000. Playwright auto-starts it, or reuses an existing one.

---

## Forking for a New Brand

1. Fork/copy this repo
2. Update `.env` with brand name, colors, logo
3. Replace `storefront/public/images/brand/` assets
4. Seed your products via admin dashboard or API
5. Deploy

---

## License

Proprietary — RezHub internal.
