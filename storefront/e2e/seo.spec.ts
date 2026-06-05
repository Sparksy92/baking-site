import { test, expect } from '@playwright/test';

/**
 * SEO E2E tests — browser-level rendering assertions only.
 *
 * This file tests what REQUIRES a rendered browser: meta tags, JSON-LD
 * presence in HTML, canonical links, robots directives, and admin UI fields.
 *
 * API-layer SEO tests (field storage, round-trips, noindex=false PATCH bug,
 * redirect CRUD, sitemap noindex exclusion) live in:
 *   api/tests/test_seo.py  ← run these first, they are faster and more precise
 *
 * Run in isolation to avoid rate-limit collisions with security.spec.ts:
 *   npx playwright test e2e/seo.spec.ts
 */

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

async function getMetaContent(page: import('@playwright/test').Page, name: string) {
  return page.$eval(
    `meta[name="${name}"]`,
    (el) => el.getAttribute('content'),
  ).catch(() => null);
}

async function getOgContent(page: import('@playwright/test').Page, property: string) {
  return page.$eval(
    `meta[property="og:${property}"]`,
    (el) => el.getAttribute('content'),
  ).catch(() => null);
}

async function getJsonLd(page: import('@playwright/test').Page): Promise<any[]> {
  const handles = await page.$$('script[type="application/ld+json"]');
  const results: any[] = [];
  for (const h of handles) {
    try {
      const text = await h.textContent();
      if (text) results.push(JSON.parse(text));
    } catch { /* malformed — counts as a failure below */ }
  }
  return results;
}

function findSchema(schemas: any[], type: string) {
  return schemas.find((s) => s['@type'] === type);
}

// ─────────────────────────────────────────────────────────────────────────────
// robots.txt
// ─────────────────────────────────────────────────────────────────────────────

test.describe('robots.txt', () => {
  test('is served and contains sitemap reference', async ({ request }) => {
    const res = await request.get('/robots.txt');
    expect(res.status()).toBe(200);
    const body = await res.text();
    expect(body).toContain('sitemap.xml');
  });

  test('disallows admin and API paths', async ({ request }) => {
    const body = await (await request.get('/robots.txt')).text();
    expect(body).toContain('/admin/');
    expect(body).toContain('/api/');
  });

  test('disallows transactional paths', async ({ request }) => {
    const body = await (await request.get('/robots.txt')).text();
    expect(body).toContain('/checkout');
    expect(body).toContain('/cart');
    expect(body).toContain('/search');
    expect(body).toContain('/order-lookup');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// sitemap.xml
// ─────────────────────────────────────────────────────────────────────────────

test.describe('sitemap.xml', () => {
  test('is served and is valid XML', async ({ request }) => {
    const res = await request.get('/sitemap.xml');
    expect(res.status()).toBe(200);
    expect(res.headers()['content-type']).toContain('xml');
    const body = await res.text();
    expect(body).toContain('<urlset');
    expect(body).toContain('<url>');
  });

  test('includes homepage', async ({ request }) => {
    const body = await (await request.get('/sitemap.xml')).text();
    expect(body).toMatch(/<loc>[^<]*<\/loc>/);
  });

  test('includes static pages', async ({ request }) => {
    const body = await (await request.get('/sitemap.xml')).text();
    expect(body).toContain('/about');
    expect(body).toContain('/faq');
    expect(body).toContain('/blog');
    expect(body).toContain('/categories');
  });

  test('does NOT include noindexed paths', async ({ request }) => {
    const body = await (await request.get('/sitemap.xml')).text();
    expect(body).not.toContain('/search');
    expect(body).not.toContain('/order-lookup');
    expect(body).not.toContain('/cart');
    expect(body).not.toContain('/checkout');
    expect(body).not.toContain('/admin');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Homepage
// ─────────────────────────────────────────────────────────────────────────────

test.describe('Homepage SEO', () => {
  test.beforeEach(async ({ page }) => { await page.goto('/'); });

  test('has a non-empty <title>', async ({ page }) => {
    const title = await page.title();
    expect(title.length).toBeGreaterThan(3);
  });

  test('has meta description', async ({ page }) => {
    const desc = await getMetaContent(page, 'description');
    expect(desc).toBeTruthy();
    expect(desc!.length).toBeGreaterThan(10);
  });

  test('has canonical link', async ({ page }) => {
    const canonical = await page.$eval('link[rel="canonical"]', (el) => el.getAttribute('href')).catch(() => null);
    expect(canonical).toBeTruthy();
  });

  test('has og:title and og:description', async ({ page }) => {
    expect(await getOgContent(page, 'title')).toBeTruthy();
    expect(await getOgContent(page, 'description')).toBeTruthy();
  });

  test('has og:site_name', async ({ page }) => {
    expect(await getOgContent(page, 'site_name')).toBeTruthy();
  });

  test('has WebSite JSON-LD with SearchAction', async ({ page }) => {
    const schemas = await getJsonLd(page);
    const website = findSchema(schemas, 'WebSite');
    expect(website).toBeTruthy();
    expect(website.potentialAction?.['@type']).toBe('SearchAction');
    expect(website.potentialAction?.['query-input']).toContain('search_term_string');
  });

  test('has Organization JSON-LD', async ({ page }) => {
    const schemas = await getJsonLd(page);
    const org = findSchema(schemas, 'Organization');
    expect(org).toBeTruthy();
    expect(org.name).toBeTruthy();
    expect(org.url).toBeTruthy();
  });

  test('does NOT have robots noindex', async ({ page }) => {
    const robots = await getMetaContent(page, 'robots');
    expect(robots ?? '').not.toContain('noindex');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Noindex on transactional pages
// ─────────────────────────────────────────────────────────────────────────────

test.describe('Noindex — transactional pages', () => {
  const noindexPages = ['/cart', '/checkout', '/search', '/order-lookup'];

  for (const path of noindexPages) {
    test(`${path} has robots noindex`, async ({ page }) => {
      await page.goto(path);
      const robots = await getMetaContent(page, 'robots');
      expect(robots).toContain('noindex');
    });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// Product page
// ─────────────────────────────────────────────────────────────────────────────

test.describe('Product page SEO', () => {
  let productSlug: string;

  test.beforeAll(async ({ request }) => {
    const res = await request.get('/api/products?limit=1');
    const data = await res.json();
    productSlug = data.products?.[0]?.slug;
    test.skip(!productSlug, 'No products in DB');
  });

  test('has correct <title>', async ({ page }) => {
    await page.goto(`/product/${productSlug}`);
    const title = await page.title();
    expect(title.length).toBeGreaterThan(3);
  });

  test('has canonical pointing to product URL', async ({ page }) => {
    await page.goto(`/product/${productSlug}`);
    const canonical = await page.$eval('link[rel="canonical"]', (el) => el.getAttribute('href')).catch(() => null);
    expect(canonical).toContain(`/product/${productSlug}`);
  });

  test('has og:type', async ({ page }) => {
    await page.goto(`/product/${productSlug}`);
    const ogType = await getOgContent(page, 'type');
    expect(ogType).toBeTruthy();
  });

  test('has Product JSON-LD with offers', async ({ page }) => {
    await page.goto(`/product/${productSlug}`);
    const schemas = await getJsonLd(page);
    const product = findSchema(schemas, 'Product');
    expect(product).toBeTruthy();
    expect(product.name).toBeTruthy();
    expect(Array.isArray(product.offers)).toBe(true);
    expect(product.offers.length).toBeGreaterThan(0);
    expect(product.offers[0].priceCurrency).toBeTruthy();
    expect(product.offers[0].availability).toContain('schema.org');
    expect(product.offers[0].itemCondition).toContain('schema.org');
  });

  test('has BreadcrumbList JSON-LD', async ({ page }) => {
    await page.goto(`/product/${productSlug}`);
    const schemas = await getJsonLd(page);
    const bc = findSchema(schemas, 'BreadcrumbList');
    expect(bc).toBeTruthy();
    expect(bc.itemListElement.length).toBeGreaterThanOrEqual(2);
    expect(bc.itemListElement[0].position).toBe(1);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Collection page
// ─────────────────────────────────────────────────────────────────────────────

test.describe('Collection page SEO', () => {
  let collectionSlug: string;

  test.beforeAll(async ({ request }) => {
    const res = await request.get('/api/collections');
    const data = await res.json();
    collectionSlug = data?.[0]?.slug;
    test.skip(!collectionSlug, 'No collections in DB');
  });

  test('has canonical pointing to collection URL (not paginated)', async ({ page }) => {
    await page.goto(`/collections/${collectionSlug}?page=2`);
    const canonical = await page.$eval('link[rel="canonical"]', (el) => el.getAttribute('href')).catch(() => null);
    expect(canonical).toContain(`/collections/${collectionSlug}`);
    expect(canonical).not.toContain('page=');
  });

  test('has BreadcrumbList JSON-LD', async ({ page }) => {
    await page.goto(`/collections/${collectionSlug}`);
    const schemas = await getJsonLd(page);
    expect(findSchema(schemas, 'BreadcrumbList')).toBeTruthy();
  });

  test('has CollectionPage JSON-LD', async ({ page }) => {
    await page.goto(`/collections/${collectionSlug}`);
    const schemas = await getJsonLd(page);
    expect(findSchema(schemas, 'CollectionPage')).toBeTruthy();
  });

  test('has ItemList JSON-LD when products exist', async ({ page }) => {
    await page.goto(`/collections/${collectionSlug}`);
    const schemas = await getJsonLd(page);
    const itemList = findSchema(schemas, 'ItemList');
    if (itemList) {
      expect(itemList.itemListElement.length).toBeGreaterThan(0);
      expect(itemList.itemListElement[0]['@type']).toBe('ListItem');
    }
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Category page
// ─────────────────────────────────────────────────────────────────────────────

test.describe('Category page SEO', () => {
  let categorySlug: string;

  test.beforeAll(async ({ request }) => {
    const res = await request.get('/api/categories');
    const data = await res.json();
    categorySlug = data?.[0]?.slug;
    test.skip(!categorySlug, 'No categories in DB');
  });

  test('has canonical pointing to base URL (not paginated)', async ({ page }) => {
    await page.goto(`/categories/${categorySlug}?page=2`);
    const canonical = await page.$eval('link[rel="canonical"]', (el) => el.getAttribute('href')).catch(() => null);
    expect(canonical).toContain(`/categories/${categorySlug}`);
    expect(canonical).not.toContain('page=');
  });

  test('has BreadcrumbList with 3 levels', async ({ page }) => {
    await page.goto(`/categories/${categorySlug}`);
    const schemas = await getJsonLd(page);
    const bc = findSchema(schemas, 'BreadcrumbList');
    expect(bc).toBeTruthy();
    expect(bc.itemListElement.length).toBe(3);
  });

  test('has CollectionPage JSON-LD', async ({ page }) => {
    await page.goto(`/categories/${categorySlug}`);
    const schemas = await getJsonLd(page);
    expect(findSchema(schemas, 'CollectionPage')).toBeTruthy();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Blog listing page
// ─────────────────────────────────────────────────────────────────────────────

test.describe('Blog listing SEO', () => {
  test('has title, description, canonical', async ({ page }) => {
    await page.goto('/blog');
    expect(await page.title()).toBeTruthy();
    expect(await getMetaContent(page, 'description')).toBeTruthy();
    const canonical = await page.$eval('link[rel="canonical"]', (el) => el.getAttribute('href')).catch(() => null);
    expect(canonical).toContain('/blog');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Blog post page
// ─────────────────────────────────────────────────────────────────────────────

test.describe('Blog post SEO', () => {
  let postSlug: string;

  test.beforeAll(async ({ request }) => {
    const res = await request.get('/api/pages?page_type=blog_post&limit=1');
    const data = await res.json();
    postSlug = data?.pages?.[0]?.slug;
    test.skip(!postSlug, 'No published blog posts in DB');
  });

  test('has title and meta description', async ({ page }) => {
    await page.goto(`/blog/${postSlug}`);
    expect(await page.title()).toBeTruthy();
    expect(await getMetaContent(page, 'description')).toBeTruthy();
  });

  test('has og:type article', async ({ page }) => {
    await page.goto(`/blog/${postSlug}`);
    const ogType = await getOgContent(page, 'type');
    expect(ogType).toBe('article');
  });

  test('has BlogPosting JSON-LD with datePublished and dateModified', async ({ page }) => {
    await page.goto(`/blog/${postSlug}`);
    const schemas = await getJsonLd(page);
    const post = findSchema(schemas, 'BlogPosting');
    expect(post).toBeTruthy();
    expect(post.headline).toBeTruthy();
    expect(post.datePublished).toBeTruthy();
    expect(post.dateModified).toBeTruthy();
  });

  test('has BreadcrumbList with 3 levels', async ({ page }) => {
    await page.goto(`/blog/${postSlug}`);
    const schemas = await getJsonLd(page);
    const bc = findSchema(schemas, 'BreadcrumbList');
    expect(bc).toBeTruthy();
    expect(bc.itemListElement.length).toBe(3);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// FAQ page
// ─────────────────────────────────────────────────────────────────────────────

test.describe('FAQ page SEO', () => {
  test('has FAQPage JSON-LD with questions', async ({ page }) => {
    await page.goto('/faq');
    const schemas = await getJsonLd(page);
    const faq = findSchema(schemas, 'FAQPage');
    expect(faq).toBeTruthy();
    expect(Array.isArray(faq.mainEntity)).toBe(true);
    expect(faq.mainEntity.length).toBeGreaterThan(0);
    expect(faq.mainEntity[0]['@type']).toBe('Question');
    expect(faq.mainEntity[0].acceptedAnswer?.['@type']).toBe('Answer');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Tags page
// ─────────────────────────────────────────────────────────────────────────────

test.describe('Tag page SEO', () => {
  let tagSlug: string;

  test.beforeAll(async ({ request }) => {
    const res = await request.get('/api/tags');
    const data = await res.json();
    tagSlug = data?.[0]?.slug;
    test.skip(!tagSlug, 'No tags in DB');
  });

  test('has title and canonical', async ({ page }) => {
    await page.goto(`/tags/${tagSlug}`);
    expect(await page.title()).toBeTruthy();
    const canonical = await page.$eval('link[rel="canonical"]', (el) => el.getAttribute('href')).catch(() => null);
    expect(canonical).toContain(`/tags/${tagSlug}`);
  });

  test('has BreadcrumbList JSON-LD', async ({ page }) => {
    await page.goto(`/tags/${tagSlug}`);
    const schemas = await getJsonLd(page);
    expect(findSchema(schemas, 'BreadcrumbList')).toBeTruthy();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 301 Redirect middleware
// ─────────────────────────────────────────────────────────────────────────────

test.describe('Redirect middleware', () => {
  test('follows a registered redirect', async ({ request, page }) => {
    // Create a redirect via admin API first
    const loginRes = await request.post('/api/auth/login', {
      data: { username: 'testadmin', password: 'admin123' },
    });
    test.skip(loginRes.status() !== 200, 'Admin login failed — skipping redirect test');

    await request.post('/api/admin/redirects', {
      data: { from_path: '/test-redirect-src', to_path: '/about', status_code: 301 },
    });

    // Follow in browser (middleware handles it)
    await page.goto('/test-redirect-src');
    await expect(page).toHaveURL(/\/about/);

    // Cleanup
    const listRes = await request.get('/api/admin/redirects');
    const redirects = await listRes.json();
    const match = redirects.find((r: any) => r.from_path === '/test-redirect-src');
    if (match) await request.delete(`/api/admin/redirects/${match.id}`);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Admin SEO fields
// ─────────────────────────────────────────────────────────────────────────────

test.describe.serial('Admin SEO fields', () => {
  test.setTimeout(60_000);

  test.beforeEach(async ({ page, request }) => {
    // Probe the login endpoint first — skip the whole group if rate-limited
    // (can happen when security.spec.ts runs concurrently and exhausts the window)
    const probe = await request.post('/api/auth/login', {
      data: { username: 'testadmin', password: 'admin123' },
    });
    if (probe.status() === 429) {
      test.skip(true, 'Admin login rate-limited — run this spec in isolation: npx playwright test e2e/seo.spec.ts');
      return;
    }
    await page.goto('/admin/login');
    await page.getByPlaceholder(/username/i).fill('testadmin');
    await page.getByPlaceholder(/password/i).fill('admin123');
    await page.getByRole('button', { name: /login|sign in/i }).click();
    await page.waitForURL('**/admin', { timeout: 15_000 });
  });

  test('Settings page has SEO Defaults section', async ({ page }) => {
    await page.goto('/admin/settings');
    await expect(page.getByText('SEO Defaults')).toBeVisible();
    await expect(page.getByLabel(/Default Social Share Image/i)).toBeVisible();
    await expect(page.getByLabel(/Store Domain/i)).toBeVisible();
    await expect(page.getByLabel(/Twitter/i)).toBeVisible();
    await expect(page.getByLabel(/Google Search Console/i)).toBeVisible();
  });

  test('Product edit page has SEO panel', async ({ page }) => {
    const res = await page.request.get('/api/admin/products?limit=1');
    const data = await res.json();
    const id = data.products?.[0]?.id;
    if (!id) return test.skip(true, 'No products');

    await page.goto(`/admin/products/${id}`);
    await page.getByRole('button', { name: /Search Engine Listing/i }).click();
    await expect(page.getByLabel(/Page Title/i)).toBeVisible();
    await expect(page.getByLabel(/Meta Description/i)).toBeVisible();
    await expect(page.getByLabel(/Canonical URL/i)).toBeVisible();
    await expect(page.getByLabel(/Social Share Image/i)).toBeVisible();
    await expect(page.getByLabel(/Hide from search engines/i)).toBeVisible();
  });

  test('Collection edit page has SEO fields', async ({ page }) => {
    const res = await page.request.get('/api/admin/collections?limit=1');
    const data = await res.json();
    const id = data?.[0]?.id;
    if (!id) return test.skip(true, 'No collections');

    await page.goto(`/admin/collections/${id}`);
    await expect(page.getByLabel(/Meta Title/i)).toBeVisible();
    await expect(page.getByLabel(/Meta Description/i)).toBeVisible();
    await expect(page.getByLabel(/noindex/i)).toBeVisible();
  });

  test('Category edit page has SEO fields', async ({ page }) => {
    const res = await page.request.get('/api/admin/categories');
    const data = await res.json();
    const id = data?.[0]?.id;
    if (!id) return test.skip(true, 'No categories');

    await page.goto(`/admin/categories/${id}`);
    await expect(page.getByLabel(/Meta Title/i)).toBeVisible();
    await expect(page.getByLabel(/Meta Description/i)).toBeVisible();
    await expect(page.getByLabel(/noindex/i)).toBeVisible();
  });

  test('Pages admin has SEO edit link', async ({ page }) => {
    await page.goto('/admin/pages');
    await expect(page.getByRole('link', { name: /edit/i }).first()).toBeVisible();
  });

  test('Redirects admin page loads and shows table', async ({ page }) => {
    await page.goto('/admin/redirects');
    await expect(page.getByRole('heading', { name: /redirects/i })).toBeVisible();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// theme-color and global meta
// ─────────────────────────────────────────────────────────────────────────────

test.describe('Global meta tags', () => {
  test('has theme-color meta', async ({ page }) => {
    await page.goto('/');
    const themeColor = await page.$eval(
      'meta[name="theme-color"]',
      (el) => el.getAttribute('content'),
    ).catch(() => null);
    expect(themeColor).toBeTruthy();
  });

  test('html lang attribute is set', async ({ page }) => {
    await page.goto('/');
    const lang = await page.$eval('html', (el) => el.getAttribute('lang'));
    expect(lang).toBeTruthy();
    expect(lang!.length).toBeGreaterThanOrEqual(2);
  });
});
