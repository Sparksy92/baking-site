# Peer Tasks

> **Branch off `feature/audit-fixes`**. Create your own branch like `feature/cart-polish` or `feature/email-templates`.
> Run `cd api && source .venv/bin/activate && python -m pytest tests/ -q` before pushing.
> Run `cd storefront && npx tsc --noEmit` to check for TypeScript errors before pushing.

---

## 🚫 DO NOT TOUCH — Active Development

These paths are being actively worked on. **Do not modify any files in these directories:**

| Path | Reason |
|------|--------|
| `storefront/app/admin/(panel)/products/` | Product form, variants, images — active |
| `storefront/components/admin/` | RichTextEditor, SortableImageGallery, VariantMatrixBuilder — active |
| `storefront/app/(shop)/product/[slug]/` | Product detail page — active |
| `api/app/routes/admin/products.py` | Product API endpoints — active |
| `api/app/models/schemas.py` | Pydantic models — active |
| `api/app/middleware/rate_limit.py` | Security-sensitive — do not weaken rate limits |

---

## Tasks

### 1. ✅ Fix e2e admin test (your code)
Your `storefront/e2e/admin.spec.ts` uses `getByPlaceholder(/username/i)` but our login form uses **"Email"** not "Username". Fix the selector so the test passes.

### 2. ✅ Email templates — remaining functions
You did order confirmation and shipping. These still use inline HTML in `api/app/services/email_service.py`:
- `send_order_cancelled`
- `send_refund_confirmation`
- `send_password_reset`

Move them into `api/app/services/email_templates.py` following the same pattern you used. Add tests in `api/tests/test_email_templates.py`.

### 3. ✅ Cart page polish
`storefront/app/(shop)/cart/page.tsx` — improve UX, empty cart state, quantity controls, mobile layout.

### 4. ✅ Checkout flow
`storefront/app/(shop)/checkout/` — test the full flow, fix CSS issues, improve form validation UX.

### 5. ✅ Order confirmation page
`storefront/app/(shop)/confirmation/[orderNumber]/page.tsx` — make it look polished, show order summary.

### 6. ✅ Search page
`storefront/app/(shop)/search/page.tsx` — improve results display, empty state, loading state.

### 7. ✅ Collections & Categories pages
- `storefront/app/(shop)/collections/[slug]/page.tsx`
- `storefront/app/(shop)/categories/[slug]/page.tsx`

Polish layout, add filtering, improve product grid.

### 8. ✅ Static content pages
- `storefront/app/(shop)/about/page.tsx`
- `storefront/app/(shop)/faq/page.tsx`
- `storefront/app/(shop)/shipping-policy/page.tsx`
- `storefront/app/(shop)/terms-of-service/page.tsx`

Add real content structure, make them look professional.

### 9. Admin pages (NOT products)
Safe to work on:
- `storefront/app/admin/(panel)/orders/`
- `storefront/app/admin/(panel)/returns/`
- `storefront/app/admin/(panel)/gift-cards/`
- `storefront/app/admin/(panel)/loyalty/`
- `storefront/app/admin/(panel)/analytics/`
- `storefront/app/admin/(panel)/newsletter/`

Add empty states, loading skeletons, toast notifications, mobile responsiveness.

### 10. 404 page
Design a branded 404 page at `storefront/app/not-found.tsx`.

---

## ⚠️ Rules

1. **Never weaken security controls** (rate limits, auth checks) even for testing.
2. **Never modify files in the DO NOT TOUCH list above.**
3. **Run tests before pushing** — both pytest and tsc.
4. **One feature per branch** — don't bundle unrelated changes.
5. **If unsure, ask** — don't guess at API shapes or schema changes.

---

## Setup

```bash
git clone https://gitlab.turtleislandsupply.com/rezhub/clothing-ecommerce-baseline.git
cd clothing-ecommerce-baseline
git checkout feature/audit-fixes
git checkout -b feature/your-task-name

# See README.md for full dev setup instructions
```
