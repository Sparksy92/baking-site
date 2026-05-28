import { test, expect } from '@playwright/test';

test.describe('Cart page', () => {
  test('empty cart shows message', async ({ page }) => {
    await page.goto('/cart');
    await expect(page.getByText(/empty|no items/i)).toBeVisible();
  });

  test('empty cart has continue shopping link', async ({ page }) => {
    await page.goto('/cart');
    await expect(page.getByRole('link', { name: /continue shopping|start shopping|browse/i }).first()).toBeVisible();
  });
});

test.describe('Checkout page', () => {
  test('checkout page loads', async ({ page }) => {
    const response = await page.goto('/checkout');
    expect(response?.status()).toBeLessThan(500);
  });
});
