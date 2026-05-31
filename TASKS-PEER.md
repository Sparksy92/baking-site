# Peer Tasks — DFL-safe, independent of Products

> **Branch off `feature/audit-fixes`**. Create your own branch like `feature/mobile-polish` or `feature/empty-states`.
> **Don't touch anything in `storefront/app/admin/(panel)/products/`** — that's being actively worked on.
> Run `cd api && source .venv/bin/activate && python -m pytest tests/ -q` before pushing.

---

## Low Risk — UI/UX Polish (frontend only, no API changes)

### 1. Mobile responsiveness audit
Test all admin pages on tablet/mobile widths, fix layout breaks (especially the sidebar nav and data tables).

### 2. Empty states
Several admin pages just show blank when there's no data. Add friendly empty states with icons + CTAs (orders, returns, gift cards, analytics).

### 3. Loading skeletons
Replace the plain "Loading..." text on admin pages with shimmer/skeleton placeholders.

### 4. Toast notifications
Wire up success/error toasts on all admin CRUD actions that don't have them yet (categories, collections, tags, size guides).

---

## Medium — Storefront Polish (frontend, no backend)

### 5. 404 page
Design a branded 404 page for invalid routes.

### 6. Checkout flow UX
Test the full cart → checkout → payment flow, report bugs, fix CSS issues.

### 7. Product card hover states
Add image swap on hover (show 2nd image if exists), smooth transitions.

---

## Medium — Backend (isolated, won't conflict with products work)

### 8. Admin settings page
The settings UI exists but may not save all fields correctly. Test + fix the store settings form (brand name, shipping config, tax rate).

### 9. Email templates
The Resend service sends plain text. Create proper HTML email templates for order confirmation and shipping notification (`api/app/services/`).

### 10. Promo code validation edge cases
Test promo codes at checkout (expired, over-limit, minimum spend). Write tests for any gaps in `api/tests/`.

---

## Setup

```bash
git clone https://gitlab.turtleislandsupply.com/rezhub/clothing-ecommerce-baseline.git
cd clothing-ecommerce-baseline
git checkout feature/audit-fixes
git checkout -b feature/your-task-name

# See README.md for full dev setup instructions
```
