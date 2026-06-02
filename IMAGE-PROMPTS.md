# Image Prompts for Storefront Assets

Use these prompts in Midjourney, DALL-E 3, or Ideogram. Output at 2:1 for banners, 3:4 for products, 1:1 for avatars.

---

## Hero / Banner Images

### Homepage Hero (2:1, 2400x1200px)
> Warm, cinematic flat lay of Indigenous-inspired clothing and accessories on a raw wooden table — earth-toned t-shirts, beaded jewelry, woven textiles. Soft golden hour lighting from the left. Shallow depth of field. Colors: deep brown, terracotta, sage green, cream. Editorial style, no text, no faces. Shot from above at slight angle.

### Homepage Hero Alt (2:1, 2400x1200px)  
> Abstract organic texture — flowing watercolor gradients in terracotta, deep earth brown, and sage green on warm cream paper. Organic brush strokes with visible paper grain. Evokes Indigenous art without appropriation. Horizontal landscape format, suitable as a website banner background.

---

## Collection Images (4:3, 1200x900px each)

### "New Arrivals" Collection
> Overhead flat lay of neatly folded hoodies and t-shirts in earth tones arranged in a grid pattern on natural linen. Items in terracotta, sage, black, and cream. Minimalist styling with a small potted plant and wooden tray. Warm studio lighting.

### "Campaign Merch" Collection
> Close-up of orange and red enamel pins and badges arranged on a dark wooden surface with a woven blanket corner visible. Shallow depth of field, warm lighting, rich colors. Orange Shirt Day and red dress campaign style merchandise.

### "Everyday Essentials" Collection
> Stack of premium basic tees and joggers in neutral earth tones (cream, charcoal, olive) folded on a shelf made of reclaimed wood. Clean, minimal, editorial. Soft diffused natural light.

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

### Open Graph Image (1200x630px)
> Brand name "Baseline Store" in bold sans-serif white text centered on a warm earth brown (#5C3D2E) background with subtle organic texture. Tagline "Rooted in Culture. Made with Purpose." below in smaller terracotta text. Clean, professional.

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
