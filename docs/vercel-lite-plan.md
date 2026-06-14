# Vercel-Lite Architecture Plan

This document outlines the architecture and deployment strategy for the Vercel-Lite version of the Cedar & Sage Homestead website.

## Architectural Changes

- **FastAPI Backend (api/)**: Intentionally bypassed and not deployed. 
- **Next.js Serverless Routes**: Replace the backend API. All public and admin endpoints are handled via Next.js Route Handlers (`storefront/app/api/...`).
- **Database Persistence**: Switched from Render Postgres to Neon Postgres via a serverless database layer in the storefront (`storefront/lib/db.ts`).
- **Order Flow**: Switch from cart/payment checkout to direct request-based orders submitted via custom order forms.

---

## Features to Keep vs. Remove

### Keep (Public Pages)
- **Home**: Main landing page with a hero, categories list, ordering process instructions, and Oven Fund callout.
- **Menu/Shop**: Dynamic listing of small-batch products.
- **Product details**: Product detail view page.
- **Custom Orders**: Unified request form for custom bakes.
- **Order Info**: Details about prepayment, pickups, and allergy policies.
- **About/FAQ/Contact/Oven Fund**: Public info pages linked to database-driven site settings.

### Keep (Admin Pages)
- `/admin/login`: Secure, password-based login.
- `/admin`: Dashboard showing request counts, quick links, and recent requests.
- `/admin/menu`: List and edit menu items (name, description, price, pricing mode, availability status, notes, static image URL).
- `/admin/order-requests`: Inbox to view details, update status, and add admin notes.
- `/admin/settings`: Editor for About, FAQ, pickup/payment instructions, and Oven Fund parameters.

### Remove / Ignore
- Stripe Checkout & Cart payment checkout.
- shipping calculations & Canada Post integrations.
- Customer accounts, wishlists, reviews, loyalty points, gift cards, bundles, and store credit.
- Social/RSS background worker automations.
- Persistent filesystem uploads (images will use static repo files or direct URL links).

---

## Database Schema (Neon Postgres)

We will define a simple schema under `storefront/db/schema.sql`:
1. `categories`: Defines menu categories.
2. `menu_items`: Replaces the `products`/`variants` schema with a single flat table for small-batch baking.
3. `order_requests`: Replaces full checkout orders.
4. `site_settings`: Flat key-value table for about/FAQ/pickup/payment text.

---

## Authentication and Security
- Simple session authentication using signed HTTP-only cookies.
- Admin credentials checked against environment variables (`ADMIN_EMAIL` and `ADMIN_PASSWORD_HASH`).
