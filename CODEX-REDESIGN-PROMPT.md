# Storefront UI Redesign — Codex Prompt

## Role
You are a world-class frontend designer and Tailwind CSS expert. You specialize in premium e-commerce storefronts that feel like $50K agency builds. Your work rivals the best Shopify Plus custom themes.

## Project Context

This is a Next.js 15 + Tailwind CSS v3 storefront for **Terra Supply Co.** — a Canadian outdoor/lifestyle clothing brand. Positioning: durable, ethically made clothing for people who actually go outside. Think Patagonia meets Everlane but independent and warmer. The backend API is already built (FastAPI + PostgreSQL). Your job is to make the **customer-facing storefront beautiful, warm, premium, and conversion-optimized**.

**Tech stack (DO NOT CHANGE):**
- Next.js 15 (App Router, server components)
- Tailwind CSS v3 (standard `tailwind.config.js` — all custom colors/shadows/animations are defined there)
- TypeScript
- Lucide React icons
- `next/image` for all images
- CSS file: `app/globals.css` uses `@tailwind base/components/utilities` (Tailwind v3 syntax)

**DO NOT:**
- Install new packages (use what's there)
- Touch anything in `app/admin/` 
- Change API contracts or lib/api.ts types
- Remove existing functionality
- Add comments unless documenting a complex pattern

## Design Direction: Earthy / Cultural / Premium

### Color Palette
```
Earth Brown:   #5C3D2E  (brand primary — headers, footer, hero bg)
Terracotta:    #B85C38  (accent — CTAs, hover states, highlights)
Sage Green:    #6B7F5E  (secondary — success states, subtle accents)
Sand:          #E8DDD3  (borders, card backgrounds, dividers)
Warm Cream:    #FBF7F4  (page background)
Warm White:    #F5EDE8  (surface/cards)
Deep Brown:    #3D2E1F  (body text)
Muted Earth:   #8B7B6B  (secondary text)
```

### Design Principles
1. **Generous whitespace** — let content breathe. Sections need 80-120px vertical padding on desktop.
2. **Rounded corners** — use `rounded-2xl` or `rounded-3xl` on cards. Never sharp corners.
3. **Subtle shadows** — warm-toned shadows (`shadow-earth/10`), never cold gray.
4. **Typography hierarchy** — massive hero headings (text-7xl+), clear section titles with uppercase tracking-widest eyebrow labels in terracotta.
5. **Micro-interactions** — scale on hover (1.02), smooth 500-700ms transitions, subtle parallax feel.
6. **Photography-first** — design layouts that NEED beautiful imagery. Large aspect ratios. Overlap/offset patterns.
7. **Brand storytelling** — weave durability, ethics, and craftsmanship into the shopping experience naturally. Not preachy — confident.

### Vibe References (describe, don't link)
- The warmth and material honesty of Patagonia or tentree but with bolder, more editorial typography
- The editorial quality of SSENSE but approachable and grounded — not cold
- The conversion optimization of Shopify Dawn but with real personality and texture
- The trust signals of Everlane (transparency, ethics, pricing honesty) woven into layout

## Files to Redesign

### Critical (these make or break the demo):

1. **`app/globals.css`** — Color tokens, custom properties, animations, global styles
2. **`app/(shop)/page.tsx`** — Homepage (hero, collections, featured, story, newsletter)
3. **`components/Header.tsx`** — Sticky nav with warm glass-morphism
4. **`components/Footer.tsx`** — Rich footer with brand warmth
5. **`components/ProductCard.tsx`** — Premium product cards

### Important (polish the experience):

6. **`app/(shop)/product/[slug]/page.tsx`** — Product detail page wrapper
7. **`app/(shop)/product/[slug]/ProductInteractive.tsx`** — Variant selector, add to cart
8. **`app/(shop)/product/[slug]/ImageGallery.tsx`** — Product image gallery
9. **`app/(shop)/search/page.tsx`** — Search results page
10. **`app/(shop)/categories/[slug]/page.tsx`** — Category product listing
11. **`app/(shop)/blog/page.tsx`** — Blog listing grid
12. **`app/(shop)/blog/[slug]/page.tsx`** — Blog post detail
13. **`app/(shop)/tags/page.tsx`** — Tags listing
14. **`app/(shop)/tags/[slug]/page.tsx`** — Tag filtered products
15. **`components/Newsletter.tsx`** — Email signup section
16. **`components/Pagination.tsx`** — Page navigation

### Config:
17. **`config/brand.config.ts`** — Brand metadata, colors, navigation, features

## Homepage Structure (desired sections, top to bottom):

1. **Hero** — Full-width, tall (80vh minimum), dark earth background with subtle gradient orbs. Left-aligned text with massive heading, eyebrow label, body copy, and two CTAs (primary filled terracotta, secondary outline). Optional: decorative geometric/organic shape or texture overlay.

2. **Trust Strip** — Slim banner below hero with 4 values (icons + labels). Subtle cream bg, sand border.

3. **Collections** — "Curated" eyebrow + "Collections" heading. Grid of 3 cards with overlay text. Rounded-2xl, hover shadow lift.

4. **Featured Products** — "Handpicked" eyebrow + "Featured Pieces" heading. 4-col grid of ProductCards on white bg section.

5. **Story / Mission CTA** — Full-width dark earth section. Centered text about craftsmanship, ethics, and durability. Headline: "Clothing made to outlast the trend cycle." Outline CTA to About page.

6. **Newsletter** — Warm bg section. Compelling headline, input + button.

## ProductCard Design Spec:

- `rounded-2xl` container with sand background
- Aspect ratio 3:4
- Smooth hover: image scale 1.05 (700ms), shadow lift
- Badge positions: top-left (sale/sold-out), top-right (low stock)
- Badges use `rounded-full` pills
- Below image: product name (font-semibold, truncate), price (font-bold)
- Hover: name color transitions to terracotta
- No image state: subtle icon placeholder, not text

## Header Design Spec:

- Sticky, backdrop-blur, warm cream/95 opacity
- Height: h-16
- Logo left, nav center or left-aligned, cart/search/account right
- Nav links: text-sm font-medium, earth/70 default, terracotta on active/hover
- Cart badge: terracotta bg
- Mobile: slide-down drawer with sand bg, rounded items

## Footer Design Spec:

- Dark earth background (#5C3D2E), white text
- 4-column grid (brand info + 3 link columns)
- Links: white/50 default, terracotta hover
- Copyright: white/30, smaller, with border-t white/10 separator
- Generous padding (py-14+)

## Animation Classes to Define in globals.css:

```css
@keyframes fade-up {
  from { opacity: 0; transform: translateY(24px); }
  to { opacity: 1; transform: translateY(0); }
}
.animate-fade-up { animation: fade-up 0.7s ease-out forwards; }
.animate-fade-up-delay-1 { animation: fade-up 0.7s ease-out 0.15s forwards; opacity: 0; }
.animate-fade-up-delay-2 { animation: fade-up 0.7s ease-out 0.3s forwards; opacity: 0; }
.animate-fade-up-delay-3 { animation: fade-up 0.7s ease-out 0.45s forwards; opacity: 0; }
```

## Important Notes:

- Tailwind v3 uses `tailwind.config.js` for custom colors — all earthy tokens (`earth`, `terracotta`, `sage`, `sand`, `cream`, `warm`, `deep`, `muted-earth`) and custom shadows (`shadow-earth`, `shadow-earth-sm`) are already defined there
- Use them as standard utilities: `text-earth`, `bg-terracotta`, `shadow-earth`, etc.
- `@tailwindcss/typography` is already installed and registered in `tailwind.config.js` plugins — use `prose` classes for blog content
- Products may have no images — always handle the empty state elegantly
- The site must look premium even WITHOUT product images (rely on color, typography, spacing)
- Responsive: mobile-first, looks incredible on all breakpoints
- Accessibility: proper color contrast ratios, focus states, aria labels

## Current Brand Config Values:

```typescript
name: 'Terra Supply Co.'
tagline: 'Built for the Long Haul.'
description: 'Durable, ethically made clothing for people who live and work outdoors. No fluff, no fast fashion.'
locale: 'en-CA'
announcementBar: 'Free shipping on orders over $75 — Built to last, made to matter.'
newsletter.heading: 'Less noise. More good stuff.'
newsletter.description: 'New drops, field notes, and occasional deals. Never spam — we hate it too.'
trustIndicators: ['Ethically Made', 'Built to Last', 'Free Returns 60-day', 'Ships from Canada']
```

## Success Criteria:

When someone visits this storefront, they should:
1. Immediately feel warmth, quality, and trust — like a brand that stands behind its product
2. Believe this is a legitimate, professional brand worth spending money with
3. Want to explore products even before seeing them — the design sells the brand
4. Feel the craftsmanship and ethics woven into the shopping experience (not forced)
5. Notice the attention to detail (animations, spacing, hover states, micro-copy)
6. See this as better than any Shopify template they've ever used

## Existing Work (already implemented — improve or leave if already good):

The following has already been built in a previous pass. Codex should **review each file and improve** rather than starting from scratch:
- `globals.css` — film grain overlay, fade-up animations, `input-earth`, `no-scrollbar`, `grain`, `glow-orb`, `deco-ring`, `watermark`, `stat-card` utilities
- `Header.tsx` — scroll-reactive blur, mobile drawer, active dot indicator, hydration-safe cart badge
- `Footer.tsx` — dark bg with radial gradients, brand story column, policy links
- `app/(shop)/page.tsx` — hero with grain/orbs/rings/watermark, stat strip, story section
- `ProductCard.tsx` — hover-reveal overlay, translate lift, badges
- `Newsletter.tsx` — success state, pulls copy from brandConfig
- `ImageGallery.tsx` — prev/next arrows, counter pill, thumbnail strip
- `ProductInteractive.tsx` — save% badge, swatch checkmark, low-stock pulse, trust micro-strip, accordion description
- `search/page.tsx` — editorial gradient hero header

**Focus your improvements on:** blog pages, tags pages, categories page, Pagination component, and anything that still feels generic.

---

## Execution Order:

1. Start with `globals.css` (color foundation)
2. Then `Header.tsx` + `Footer.tsx` (frame the page)
3. Then `app/(shop)/page.tsx` (homepage — the demo star)
4. Then `ProductCard.tsx` (used everywhere)
5. Then PDP files (`ProductInteractive.tsx`, `ImageGallery.tsx`)
6. Then listing pages (search, categories, blog, tags)
7. Finally `brand.config.ts` and `Newsletter.tsx`

Make each file complete and production-ready. Do not leave TODOs or placeholders.
