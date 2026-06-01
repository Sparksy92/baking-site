import { test, expect } from '@playwright/test';

test.describe('Storefront (B1-B7)', () => {
  test('B1: Homepage loads products grid', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('a[href*="/product/"]').first()).toBeVisible();
  });

  test('B2 & B3: Product detail page and social proof', async ({ page }) => {
    await page.goto('/');
    const firstProduct = page.locator('a[href*="/product/"]').first();
    await firstProduct.click();
    
    await expect(page.getByRole('button', { name: /add to cart/i })).toBeVisible();
    await expect(page.getByText(/viewing|sold this week/i)).toBeVisible();
  });

  test('B4 & B5: Add to cart and Cart page', async ({ page }) => {
    await page.goto('/');
    await page.locator('a[href*="/product/"]').first().click();
    
    // Select first size/color if available
    const sizeSelect = page.locator('select').first();
    if (await sizeSelect.isVisible()) {
      await sizeSelect.selectOption({ index: 1 });
    }
    
    await page.getByRole('button', { name: /add to cart/i }).click();
    await expect(page.getByText(/added|success/i).first()).toBeVisible();
    
    await page.goto('/cart');
    await expect(page.getByRole('button', { name: /remove|delete/i }).first()).toBeVisible();
  });

  test('B6: Guest order lookup error', async ({ page }) => {
    await page.goto('/order-lookup');
    await page.getByPlaceholder(/order number/i).fill('FAKE-123');
    await page.getByPlaceholder(/email/i).fill('fake@example.com');
    await page.getByRole('button', { name: /lookup|find/i }).click();
    
    await expect(page.getByText(/not found|error/i)).toBeVisible();
  });
});
