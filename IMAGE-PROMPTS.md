# Image Prompts — Terra Supply Co. Storefront

Use these prompts in Midjourney, DALL-E 3, or Ideogram. Output at 2:1 for banners, 3:4 for products, 1:1 for avatars.

**Brand direction:** Warm, earthy, outdoors-adjacent. Think rugged but refined — field journals, waxed canvas, early morning light on trail. No stock-photo vibes. Every image should feel like it was shot on a good camera by someone who actually goes outside.

---

## Hero / Banner Images

### Homepage Hero — PRIMARY ✅ Generated
> `storefront/public/images/hero/hero-main.webp`
> Cinematic wide-angle shot of folded earth-tone clothing on a raw wooden surface — terracotta hoodie, sage tee, cream knit. Golden hour side lighting. Shallow depth of field. No text, no faces. 2:1 landscape.

### Homepage Hero Alt ✅ Generated
> Alternate background option — see `hero-lifestyle.webp`

---

## Collection Images (4:3, 1200x900px each)

### "New Arrivals" Collection ✅ Generated
> `storefront/public/images/collections/collection-new-arrivals.webp`

### "Campaign / Limited Drop" Collection ✅ Generated
> `storefront/public/images/collections/collection-campaign-merch.webp`

### "Everyday Essentials" Collection ✅ Generated
> `storefront/public/images/collections/collection-essentials.webp`

### "Outerwear" Collection — TODO
> Flat lay of a waxed canvas field jacket in deep brown, partially unfolded on rough-hewn wood. Brass zipper and pocket details visible. Natural window light from the left. No faces. 4:3.

### "Headwear" Collection — TODO
> Overhead shot of 3 different structured caps — cream, charcoal, terracotta — arranged in a loose triangle on worn leather. Shallow depth of field, warm tones. 4:3.

---

## Product Images (3:4, 900x1200px each)

### T-Shirt (multiple colors needed)
> Single [COLOR] crew-neck t-shirt laid flat on a warm cream paper backdrop, perfectly smooth and wrinkle-free. Soft even studio lighting, no harsh shadows. Overhead shot. Clean e-commerce product photography. Premium quality cotton visible in texture.

Colors to generate: terracotta, sage green, charcoal, cream, black, burnt orange

### Hoodie
> Single [COLOR] pullover hoodie laid flat on warm cream backdrop. Drawstrings neatly arranged. Soft studio lighting, overhead perspective. Premium heavyweight cotton visible in texture. Clean e-commerce style.

Colors: charcoal, cream, deep brown, sage

### Pin / Accessory
> Single enamel pin [DESCRIPTION] photographed on a small piece of raw wood or leather, macro close-up, shallow depth of field, warm side lighting. Premium product photography style.

Descriptions: "orange shirt with heart", "red dress silhouette", "feather in terracotta and gold", "medicine wheel in earth tones"

---

## Lifestyle / Story Images

### About Page Hero (2:1)
> Indigenous artisan's hands working with beading materials and fabric on a wooden workbench. Warm natural window light. Close crop on hands and materials only — no face. Earthy tones, authentic workshop setting. Documentary editorial style.

### Story Block (16:9)
> Wide shot of a community gathering in a bright, warm space — people connecting, laughing, sharing. Warm golden hour light streaming in. Defocused/bokeh background. Evokes community and togetherness. No specific faces in focus.

### Blog Post Headers (16:9, 1200x675px)

> **Culture post:** Overhead shot of traditional woven textiles in rich earth tones — terracotta, brown, cream patterns. Soft lighting, shallow focus edges.

> **Product launch:** Artistic arrangement of new clothing items emerging from tissue paper in a kraft box. Warm styling, gift-like unboxing moment.

> **Community post:** Warm-toned abstract pattern — geometric shapes inspired by Indigenous art in terracotta, sage, and cream. Digital art style, clean lines.

---

## Brand Assets

### Logo Concept (1:1, 512x512px)
> Minimalist logo mark — a single stylized feather or leaf made of geometric shapes, in terracotta (#B85C38) on transparent/cream background. Clean vector style, bold but simple. Would work at 32px favicon size.

### Favicon (1:1, 64x64px)
> Simple geometric shape — circle or rounded square in terracotta (#B85C38) with a single white stroke forming an abstract leaf or feather. Flat design, no gradients.

### Open Graph Image (1200x630px) — TODO
> Brand name "Terra Supply Co." in bold sans-serif white text centered on a warm earth brown (#5C3D2E) background with subtle woven texture. Tagline "Built for the Long Haul." below in terracotta (#B85C38). Clean, no photography, text only.

---

## Placeholder / Empty States

### No Product Image (3:4)
> Solid warm sand color (#E8DDD3) with a very subtle woven textile texture barely visible. A small, centered, thin-line illustration of a hanger or folded shirt in earth brown (#5C3D2E) at 20% opacity. Minimal and elegant.

### No Blog Image (16:9)
> Solid warm cream (#FBF7F4) with a subtle paper grain texture. A thin terracotta line drawing of an open book or quill in the center at 30% opacity.

---

## Notes

- **Aspect ratios matter** — products MUST be 3:4, heroes MUST be 2:1 or wider
- **Color consistency** — every image should feel warm. No cool/blue tones.
- **No text in images** — text is rendered by the website, never baked into photos
- **No faces** — avoids needing model releases and keeps focus on product/culture
- **File format:** WebP preferred, JPEG acceptable. Optimize to <200KB per product image.
- **Naming convention:** `hero-main.webp`, `collection-new-arrivals.webp`, `product-tee-terracotta.webp`

Place all generated assets in: `storefront/public/images/`
