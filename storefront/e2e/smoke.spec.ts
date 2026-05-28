import { test, expect } from '@playwright/test';

/**
 * Smoke tests — every public route loads without a server error.
 * These are intentionally loose (check for 200, not full DOM)
 * so they stay green even when the API is unavailable.
 */

const publicRoutes = [
  '/',
  '/about',
  '/categories',
  '/contact',
  '/faq',
  '/search',
  '/cart',
  '/order-lookup',
  '/privacy-policy',
  '/terms-of-service',
  '/shipping-policy',
  '/return-policy',
];

for (const route of publicRoutes) {
  test(`${route} loads without error`, async ({ page }) => {
    const response = await page.goto(route);
    expect(response?.status()).toBeLessThan(500);
  });
}

test('404 page renders for unknown route', async ({ page }) => {
  const response = await page.goto('/this-page-does-not-exist');
  expect(response?.status()).toBe(404);
  await expect(page.getByText(/not found/i)).toBeVisible();
});
