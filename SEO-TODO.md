# SEO Implementation Tracker
> **STATUS: COMPLETE — All phases done as of June 4, 2026. Archived for reference.**
> White-label ecommerce baseline — started 2026-06-04

## Architecture Decision Log
- **Brand model:** One brand per deployment (fork model). NOT multi-tenant SaaS.
- **Config split:** Colors/fonts/nav/feature-flags stay in `brand.config.ts` (require rebuild). Brand identity copy, SEO defaults, currency, social links move to `settings` DB table (admin-editable at runtime, no redeploy needed).
- **Public settings:** `GET /api/settings/public` already exists — needs expansion.
- **Currency:** Move `store_currency` from hardcoded `'CAD'` in schema to `brandConfig.metadata.currency` read from public settings.

---

## Phase 5 — Remaining Gaps ✅ COMPLETE

---

## Done ✅

### Phase 1 — Critical Infrastructure
- [x] `api/app/migrations/002_seo_fields.sql` — noindex, canonical_url, og_image_url on products; meta_title, meta_description, intro_copy, noindex on collections/categories; noindex, canonical_url on pages; `redirects` table with active index
- [x] `storefront/types/brand.ts` — `BrandSeo` interface + `BrandStat`; `seo` field on `BrandConfig`
- [x] `storefront/config/brand.config.ts` — `seo` block populated for Terra Supply Co.
- [x] `storefront/app/(shop)/blog/[slug]/page.tsx` — replaced "Terra Supply Co." / "Field Notes" / "Field Note" hardcodes with `brandConfig.seo.*` + `brandName()`
- [x] `storefront/app/(shop)/page.tsx` — replaced TERRA watermark, "Canadian Made", "Since 2019", stat strip, trust pills, story block body copy with brand config values
- [x] `storefront/app/(shop)/categories/[slug]/page.tsx` — replaced "Built for real weather" / "Ships from Canada" / "60-day free returns" / "No fast fashion" with `brandConfig.trustIndicators`
- [x] `api/app/models/schemas.py` — `PublicSettingsResponse` expanded with `brand_tagline`, `default_og_image`, `twitter_handle`, `google_verification`, `blog_section_name`, `brand_abbreviation`, `store_domain`
- [x] `api/app/routes/settings.py` — `/api/settings/public` returns all new SEO fields with env fallbacks
- [x] `storefront/app/(shop)/product/[slug]/page.tsx` — `priceCurrency` uses `brandConfig.seo.currency`; `og_image_url` override; `canonical_url` override; `noindex` robots meta
- [x] `storefront/app/admin/(panel)/products/ProductForm.tsx` — SEO preview uses `siteUrl()`; added noindex checkbox + canonical_url input

### Phase 2 — Category Metadata + Sitemap
- [x] `api/app/routes/products.py` — `GET /api/categories/{slug}` endpoint added; list endpoint returns SEO fields
- [x] `api/app/models/schemas.py` — `CategoryResponse` + `CategoryUpdate` include meta_title, meta_description, intro_copy, noindex
- [x] `storefront/app/(shop)/categories/[slug]/page.tsx` — `generateMetadata` fetches real DB data; page component uses real category name + intro_copy
- [x] `storefront/app/sitemap.ts` — categories, blog posts added; paginated product fetch; `lastModified` on blog posts; `/blog` static entry
- [x] `storefront/app/robots.ts` — `/account/` and `/cart` added to disallow list

### Phase 3 — Admin UI SEO Controls
- [x] `storefront/app/admin/(panel)/settings/page.tsx` — settings grouped into Brand Identity / SEO Defaults / Analytics & Verification / Store sections; 8 new fields exposed
- [x] `storefront/app/admin/(panel)/collections/[id]/page.tsx` — new collection edit page with SEO tab (intro_copy, meta_title, meta_description, noindex, Google preview)
- [x] `storefront/app/admin/(panel)/collections/page.tsx` — Edit link added per row
- [x] `api/app/routes/admin/collections.py` — `GET /{id}` endpoint; CREATE/PATCH handle SEO fields + noindex int conversion
- [x] `api/app/models/schemas.py` — `CollectionCreate`, `CollectionUpdate`, `CollectionDetail` include SEO fields
- [x] `storefront/components/admin/SortableImageGallery.tsx` — inline alt text input per image; `handleSetAlt` PATCHes `alt_text` to API
- [x] `api/app/routes/admin/redirects.py` — full CRUD + export endpoint for active redirects
- [x] `api/app/main.py` — redirects router registered
- [x] `storefront/app/admin/(panel)/redirects/page.tsx` — redirect manager UI (add, toggle active, delete, 301/302 type)
- [x] `storefront/app/admin/(panel)/layout.tsx` — Redirects nav item added

### Phase 5 — Remaining Gaps
- [x] `storefront/app/(shop)/product/[slug]/page.tsx` — `og:type` confirmed `'website'` (Next.js doesn't support `'product'`; Product JSON-LD handles the signal)
- [x] `storefront/middleware.ts` — redirect lookup with 60s in-memory cache; fetches from `/api/admin/redirects/export`; issues `NextResponse.redirect` with correct status code
- [x] `api/app/routes/admin/redirects.py` — `/export` endpoint auth removed (non-sensitive public routing data)
- [x] `storefront/app/(shop)/product/[slug]/page.tsx` — Product schema already had `availability`, `itemCondition`, `brand` fields (verified)
- [x] `storefront/app/(shop)/blog/[slug]/page.tsx` — `BlogPosting` JSON-LD already present (verified); added `noindex` and `canonical_url` support
- [x] `storefront/app/(shop)/categories/[slug]/page.tsx` — canonical always points to page-1 URL; `generateMetadata` updated to accept `searchParams`
- [x] `storefront/app/admin/(panel)/categories/[id]/page.tsx` — new category edit page with SEO tab (intro_copy, meta_title, meta_description, noindex, Google preview)
- [x] `storefront/app/admin/(panel)/categories/page.tsx` — SEO edit link added per row
- [x] `api/app/models/schemas.py` — `CategoryCreate` and `CategoryUpdate` now include `image_url`
- [x] `api/app/routes/admin/categories.py` — `noindex` int conversion added to PATCH handler
- [x] `storefront/app/admin/(panel)/pages/[id]/page.tsx` — new page/blog editor with full SEO tab (meta_title, meta_description, noindex, canonical_url, author, featured_image, publish date)
- [x] `storefront/app/admin/(panel)/pages/page.tsx` — Edit link added per row
- [x] `api/app/routes/admin/pages.py` — `GET /{page_id}` endpoint added; `PageUpdate` expanded with `noindex`, `canonical_url`, `page_type`, `published_at`; PATCH uses `exclude_unset=True`
- [x] `storefront/app/admin/(panel)/products/ProductForm.tsx` — slug-change warning banner + auto-POST 301 redirect on save
- [x] `storefront/app/admin/(panel)/collections/[id]/page.tsx` — slug-change warning banner + auto-POST 301 redirect on save
- [x] `storefront/app/sitemap.ts` — `changeFrequency` and `priority` already present (verified)

### Phase 4 — Schema + Remaining SEO
- [x] `storefront/app/(shop)/faq/page.tsx` — `FAQPage` JSON-LD with all Q&A pairs
- [x] `storefront/app/(shop)/collections/[slug]/page.tsx` — `ItemList` JSON-LD; `meta_title`/`meta_description`/`noindex` from DB; paginated canonical points to page 1
- [x] `storefront/app/(shop)/categories/[slug]/page.tsx` — `CollectionPage` + `ItemList` JSON-LD
- [x] `storefront/app/(shop)/page.tsx` — `WebSite` + `SearchAction` schema; `Organization` schema enhanced with logo + `sameAs` social links
- [x] `storefront/app/layout.tsx` — root metadata includes `twitter:site`, Google verification token, default OG image from brand config
- [x] `storefront/lib/api.ts` — `Collection` interface extended with SEO fields; `PublicSettings` extended with `brand_tagline`

---

## Known Hardcoded Values to Eliminate (full list)
| Value | File | Line | Fix |
|---|---|---|---|
| `"TERRA"` watermark | `page.tsx` | ~101 | `brandConfig.seo.abbreviation` |
| `"Canadian Made"` | `page.tsx` | ~109 | brand config |
| `"Since 2019"` | `page.tsx` | ~114 | brand config |
| `"60-day Free returns"` stat | `page.tsx` | ~159 | brand config |
| `"$75+"` stat | `page.tsx` | ~160 | brand config |
| `"5yr Craftsmanship guarantee"` | `page.tsx` | ~161 | brand config |
| `"Built for real weather"` badge | `categories/[slug]` | ~68 | `brandConfig.trustIndicators` |
| `"Ships from Canada"` badge | `categories/[slug]` | ~69 | `brandConfig.trustIndicators` |
| `"60-day free returns"` badge | `categories/[slug]` | ~70 | `brandConfig.trustIndicators` |
| `"No fast fashion"` badge | `categories/[slug]` | ~87 | brand config |
| `"Terra Supply Co."` author fallback | `blog/[slug]` | ~117 | `brandName()` |
| `"Field Notes"` back link | `blog/[slug]` | ~94 | `brandConfig.seo.blogSectionName` |
| `"Field Note"` kicker | `blog/[slug]` | ~98 | `brandConfig.seo.blogSectionName` |
| `priceCurrency: 'CAD'` | `product/[slug]` | ~70 | `brandConfig.metadata.currency` |
| `og:type: 'website'` on PDP | `product/[slug]` | ~29 | `'product'` |
| `yourstore.com` preview | `ProductForm.tsx` | ~283 | `siteUrl()` |
| fallback collections | `page.tsx` | ~17-42 | brand config or remove |
