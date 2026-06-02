# Tasks — Blair

**Branch from:** `feature/local-dev-testing` (origin)
**Your branch:** `feature/storefront-reviews-notify-giftcards`

## Overview

We're building out storefront features that the admin already supports. You're handling:
1. Product Reviews (PDP display + submission)
2. Back-in-Stock "Notify Me" (sold-out variant UI)
3. Gift Card purchase + checkout redemption

Rezzer is handling Blog/CMS pages + Tags on storefront — **do not modify those files** (see conflict avoidance below).

---

## 1. Product Reviews

**Goal:** Customers see star ratings on product cards and PDP, and can submit reviews after purchase.

**API already exists — endpoints to use:**
- `GET /api/products/{product_id}/reviews` — list reviews (paginated)
- `POST /api/products/{product_id}/reviews` — submit a review (requires customer auth)
- Response includes: `rating` (1-5), `title`, `body`, `customer_name`, `created_at`, `is_verified`

**What to build:**
- `storefront/components/StarRating.tsx` — reusable star display (filled/empty/half)
- `storefront/components/ReviewList.tsx` — list of reviews with pagination
- `storefront/components/ReviewForm.tsx` — submit form (star picker, title, body)
- Wire into `storefront/app/(shop)/product/[slug]/ProductInteractive.tsx`:
  - Show average rating + review count below product name
  - Add review section below description
- Optionally show average star rating on `ProductCard.tsx` (below price)

**Design notes:**
- Follow existing styling (Tailwind, rounded-lg/xl, gray-100 backgrounds, brand color accents)
- Reviews section goes BELOW the description in `ProductInteractive.tsx`
- Star color: `text-amber-400` for filled, `text-gray-200` for empty
- Verified purchase badge: small green checkmark + "Verified Purchase"

---

## 2. Back-in-Stock "Notify Me"

**Goal:** When a selected variant is sold out, show an email capture form so the customer gets notified when it's back.

**API already exists:**
- `POST /api/products/{product_id}/notify` — body: `{ "email": "...", "variant_id": 123 }`
- Returns `201` on success

**What to build:**
- `storefront/components/NotifyMe.tsx` — email input + "Notify Me" button
- Wire into `ProductInteractive.tsx`:
  - When `selectedVariant.stock_quantity <= 0`, show `<NotifyMe>` instead of "Sold Out" button
  - Show success message after submission ("We'll email you when it's back!")

**Design notes:**
- Replace the disabled "Sold Out" button with the notify form
- Input + button on same row, rounded-xl, brand button styling
- Success state: green check + message, auto-dismiss after 3s

---

## 3. Gift Cards

**Goal:** Customers can buy gift cards and apply them at checkout.

**API endpoints:**
- `GET /api/gift-cards/catalog` — available denominations
- `POST /api/gift-cards/purchase` — buy a gift card (body: `{ "amount_cents": 5000, "recipient_email": "..." }`)
- `POST /api/checkout/apply-gift-card` — apply to cart (body: `{ "code": "..." }`)
- `GET /api/gift-cards/{code}/balance` — check remaining balance

**What to build:**
- `storefront/app/(shop)/gift-cards/page.tsx` — purchase page
  - Grid of denomination options ($25, $50, $75, $100, custom)
  - Recipient email + optional message
  - "Buy Gift Card" button (uses Stripe or e-transfer)
- In `storefront/app/(shop)/checkout/page.tsx`:
  - Add "Have a gift card?" expandable section
  - Input field for gift card code + "Apply" button
  - Show applied gift card with remaining balance + discount on order total
- `storefront/components/GiftCardInput.tsx` — reusable code input + apply logic

**Design notes:**
- Gift card page: big, visual, card-shaped design with brand colors
- Checkout section: subtle, collapsible (like promo code sections on Shopify)

---

## Conflict Avoidance — DO NOT MODIFY

These files are being modified by Rezzer. Do not touch them:
- `storefront/app/(shop)/page.tsx` (homepage)
- `storefront/app/(shop)/product/[slug]/page.tsx` (PDP server component)
- `storefront/components/Header.tsx` or navigation components
- Any files in `storefront/app/(shop)/blog/` (new — Rezzer is creating)
- Any files in `storefront/app/(shop)/tags/` (new — Rezzer is creating)
- `storefront/lib/api.ts` — **coordinate if you need new types here** (add yours at the bottom of the file to minimize merge conflicts)

**Safe to modify:**
- `storefront/app/(shop)/product/[slug]/ProductInteractive.tsx` — you're adding reviews + notify-me here
- `storefront/app/(shop)/checkout/page.tsx` — you're adding gift card input here
- `storefront/components/ProductCard.tsx` — you're adding star rating here
- Any NEW files you create (components, pages)

---

## Local Dev Setup

```bash
git fetch origin
git checkout feature/local-dev-testing
git pull origin feature/local-dev-testing
git checkout -b feature/storefront-reviews-notify-giftcards

# PostgreSQL (if not already running)
podman run -d --name ecommerce-postgres --replace \
  -e POSTGRES_USER=ecommerce \
  -e POSTGRES_PASSWORD=ecommerce_dev_pass \
  -e POSTGRES_DB=ecommerce \
  -p 5432:5432 postgres:16-alpine

# API
cd api && source .venv/bin/activate
pip install -r requirements.txt
POSTGRES_USER=ecommerce POSTGRES_PASSWORD=ecommerce_dev_pass POSTGRES_DB=ecommerce \
  POSTGRES_HOST=localhost POSTGRES_PORT=5432 DEV_MODE=true \
  ADMIN_JWT_SECRET=local-dev-secret-change-in-prod \
  CUSTOMER_JWT_SECRET=local-dev-customer-secret \
  uvicorn app.main:create_app --factory --reload --port 8100

# Storefront
cd storefront && npm install && npm run dev
```

API docs: http://localhost:8100/api/docs (Swagger UI)

---

## Definition of Done

- [ ] Reviews display on PDP with star ratings
- [ ] Review submission form works (logged-in customers)
- [ ] Average rating shows on ProductCard (optional — nice to have)
- [ ] "Notify Me" replaces "Sold Out" button for out-of-stock variants
- [ ] Gift card purchase page at `/gift-cards`
- [ ] Gift card redemption in checkout flow
- [ ] No console errors, responsive on mobile
- [ ] Commit with conventional commit messages (`feat: ...`)
