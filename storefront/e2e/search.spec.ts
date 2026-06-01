import { test, expect } from '@playwright/test';

test.describe('Search page', () => {
  test('search page loads with input and button', async ({ page }) => {
    await page.goto('/search');
    await expect(page.getByPlaceholder('Search products...')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Search' })).toBeVisible();
  });

  test('empty search does not submit', async ({ page }) => {
    await page.goto('/search');
    await expect(page.getByRole('button', { name: 'Search' })).toBeDisabled();
  });

  test('search with query shows result feedback', async ({ page }) => {
    await page.goto('/search');
    await page.getByPlaceholder('Search products...').fill('test');
    await page.getByRole('button', { name: 'Search' }).click();
    // Should show either results or "No products found" — either is valid
    await expect(
      page.getByText(/result|No products found/).first()
    ).toBeVisible({ timeout: 5000 });
  });
});
