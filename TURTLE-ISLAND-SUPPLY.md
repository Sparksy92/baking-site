# Turtle Island Supply — Platform Planning

> This file tracks architectural decisions and build priorities for the
> Turtle Island Supply (TIS) platform. TIS will be forked from
> `clothing-ecommerce-baseline` but is a fundamentally different product.
> Do not attempt to accommodate TIS requirements in this repo.

---

## What TIS Is

A large-scale Indigenous marketplace/supply platform. Think Amazon or
Faire — not a single-brand storefront. Millions of products and variants,
multiple suppliers, warehousing, and B2B/wholesale capabilities alongside
retail. The scale and operational complexity are categorically different
from the small-brand clients this baseline serves.

---

## What to Fork From This Repo

These modules carry over cleanly and should not be rebuilt from scratch:

- **Auth** — JWT httpOnly cookie pattern, admin + customer roles, staff permissions
- **Customer accounts** — registration, addresses, order history, password reset
- **Checkout + Stripe** — Stripe Checkout session, webhook handling, idempotency
- **Order management** — status flow, fulfillments, partial shipments, tracking
- **Returns** — return request flow, resolution types including store credit (ledger, redemption, admin UI all complete)
- **Email service** — Resend transactional, template pattern
- **Webhooks** — HMAC-signed outbound webhooks, delivery log
- **Audit log** — who changed what, entity tracking
- **SEO infrastructure** — JSON-LD, canonical URLs, sitemap, robots.txt, noindex
- **Admin panel scaffolding** — Next.js App Router admin layout, auth flow
- **Test harness** — pytest fixtures, conftest pattern, Playwright config
- **CI/CD structure** — GitLab pipeline, staging/production gates, backup pattern
- **Ansible + Podman deploy** — infrastructure as code baseline

---

## What Must Be Rebuilt for TIS Scale

### 1. Catalog & Search — Highest Priority

The current Postgres ILIKE search breaks at thousands of products, let alone millions.

- **Search engine**: Meilisearch (self-hosted, fast, good Canadian data residency story) or Typesense. Elasticsearch is overkill unless TIS becomes truly massive.
- **Faceted filtering**: brand, category, price range, size, colour, availability, supplier, Indigenous nation/region — all indexed fields, not runtime SQL
- **Product ingestion pipeline**: bulk import via CSV/EDI/supplier API feeds, not manual admin UI entry
- **Catalog hierarchy**: likely needs a deeper taxonomy than categories + collections — subcategories, product types, attributes per type (apparel vs. food vs. craft vs. tools all have different attributes)
- **Variant model**: current Size × Color is too narrow. TIS needs a generic attribute model (any number of dimensions: size, colour, material, scent, weight, etc.)

### 2. Inventory Management — High Priority

Current platform has no inventory history, no adjustment log, no multi-location support.

- **Inventory transactions table** — every stock change recorded (adjustment, sale, return, import) with reason + user
- **Multi-location / warehouse support** — products available from multiple suppliers/locations
- **Reservation system** — reserve stock at add-to-cart, release on abandonment (critical at scale to prevent overselling)
- **Reorder points + low stock alerts per location**
- **Supplier-managed inventory** — suppliers update their own stock via API

### 3. Multi-Vendor / Supplier Architecture — Core Requirement

This doesn't exist at all in the baseline.

- **Vendors/suppliers table** — each with their own products, inventory, payout settings
- **Split order routing** — one customer order → multiple supplier fulfillment sub-orders
- **Vendor payouts** — track what's owed to each supplier, Stripe Connect for automated splits
- **Vendor portal** — suppliers manage their own products, inventory, and view their orders
- **Commission/margin model** — TIS takes a cut, supplier gets the rest

### 4. Order Routing & Fulfillment — High Priority

Current model assumes a single fulfillment location.

- **Split orders** — route line items to correct supplier/warehouse automatically
- **Dropshipping support** — supplier ships directly to customer
- **Fulfillment SLA tracking** — flag orders not shipped within X days
- **Carrier integrations** — Shippo or EasyPost for multi-carrier label generation (not just Canada Post)

### 5. B2B / Wholesale — Medium Priority

- **Tiered pricing** — member vs. non-member, wholesale vs. retail
- **Minimum order quantities**
- **Net terms / invoice billing** (not pay-now Stripe Checkout)
- **Trade account applications + approval flow**

### 6. Performance Architecture — Must Plan Upfront

At millions of products, the current architecture breaks:

- **Read replicas** — separate read/write Postgres connections
- **CDN + edge caching** — product pages, images, search results
- **Search index sync** — async job queue (Celery + Redis, or similar) to keep search index in sync with DB changes
- **Image CDN** — Cloudflare Images or similar, not local disk uploads
- **Database indexing strategy** — partial indexes, materialized views for aggregations, query planning review
- **ISR at scale** — Next.js ISR works for hundreds of pages; millions of product pages need a different strategy (on-demand revalidation, not time-based)

### 7. Analytics & Reporting — Medium Priority

Current reports are basic. TIS needs:

- **Supplier performance reports** — sales, returns, SLA compliance per vendor
- **Marketplace-level dashboards** — GMV, take rate, active vendors, active buyers
- **Customer LTV and cohort analysis**
- **Indigenous community/nation attribution** — where are sales coming from, where are suppliers from

---

## Features That Are the Same as Baseline

These do not need to be rethought — just carry forward:

- Promo codes and automatic discounts
- Gift cards
- Loyalty points (may need multi-vendor rules)
- Reviews with moderation
- Blog/CMS
- Newsletter capture (Brevo/Klaviyo export)
- SEO (JSON-LD schemas will expand for marketplace)
- Abandoned cart recovery
- Customer segments
- Webhooks

---

## Technology Decisions to Make at Fork Time

| Decision | Options | Notes |
|---|---|---|
| Search engine | Meilisearch, Typesense, Elasticsearch | Meilisearch recommended for self-hosted start |
| Job queue | Celery + Redis, ARQ, Dramatiq | Needed for search sync, email, inventory jobs |
| Image storage | Cloudflare Images, S3 + CloudFront, Bunny CDN | Local disk won't scale |
| Vendor payouts | Stripe Connect, manual reconciliation | Stripe Connect is the right answer long-term |
| Caching layer | Redis | Already needed for job queue, add response caching |
| DB read replicas | Postgres streaming replication | Plan from day one, add when read load warrants it |

---

## What TIS Is NOT

Scope boundaries to keep clear:

- Not a social platform (no feeds, follows, messaging between users)
- Not a digital goods marketplace (physical products only at launch)
- Not multi-currency (CAD only, Canada focus)
- Not a marketplace for services (products only)

---

## Build Sequence (When Fork Happens)

1. Fork `clothing-ecommerce-baseline`
2. Strip the seed data and brand-specific content
3. Design and implement the **vendor/supplier data model** — everything depends on this
4. Implement the **generic variant attribute model** (replace Size × Color with flexible attributes)
5. Integrate **Meilisearch** — replace all search and filtering
6. Build **vendor portal** (separate auth scope, not admin panel)
7. Implement **inventory transaction log + reservation system**
8. Build **split order routing**
9. Add **Stripe Connect** for vendor payouts
10. Scale infrastructure (read replicas, image CDN, job queue)

---

## Status

**Not started.** Planning only. Fork when a client engagement or funding warrants it.
