import { test, expect } from '@playwright/test';

test.describe('Customer Account (C1-C6)', () => {
  const timestamp = Date.now();
  const email = `testuser_${timestamp}@example.com`;
  const password = 'Password123!';

  test('C1: Register creates account', async ({ page }) => {
    await page.goto('/account/register');
    await page.locator('input[id*="first"]').fill('Test');
    await page.locator('input[id*="last"]').fill('User');
    await page.locator('input[type="email"]').fill(email);
    await page.locator('input[type="password"]').fill(password);
    await page.getByRole('button', { name: /register|create/i }).click();
    
    await expect(page).toHaveURL(/\/account/);
  });

  test('C2, C3, C5, C6: Account flow', async ({ page }) => {
    await page.goto('/account/login');
    await page.locator('input[type="email"]').fill(email);
    await page.locator('input[type="password"]').fill(password);
    await page.getByRole('button', { name: /login|sign in/i }).click();
    
    await expect(page).toHaveURL(/\/account/);
    await expect(page.getByText(/orders/i).first()).toBeVisible();

    const addressLink = page.getByRole('link', { name: /addresses/i });
    if (await addressLink.isVisible()) {
        await addressLink.click();
        await page.getByRole('button', { name: /add/i }).click();
        await page.locator('input[id*="address"], input[name*="address"]').first().fill('123 Test St');
        await page.locator('input[id*="city"], input[name*="city"]').first().fill('Toronto');
        await page.locator('input[id*="postal"], input[name*="postal"]').first().fill('M1M 1M1');
        await page.getByRole('button', { name: /save/i }).click();
        await expect(page.getByText('123 Test St')).toBeVisible();
    }

    await page.getByRole('button', { name: /sign out|logout/i }).click();
    await expect(page).not.toHaveURL(/\/account/);
  });
});
