import { test, expect } from '@playwright/test';

test.describe('Security Checks (D1-D4)', () => {
  test('D1: Admin auth required', async ({ page }) => {
    await page.goto('/admin');
    await expect(page).toHaveURL(/\/admin\/login/);
  });

  test('D2: Rate limit login', async ({ page }) => {
    await page.goto('/admin/login');
    for (let i = 0; i < 6; i++) {
      await page.getByPlaceholder(/username/i).fill('wrongadmin');
      await page.getByPlaceholder(/password/i).fill('wrongpass');
      await page.getByRole('button', { name: /login|sign in/i }).click();
      await page.waitForTimeout(500);
    }
    await expect(page.getByText(/too many requests|rate limit/i)).toBeVisible();
  });

  test('D3: Order lookup rate limit', async ({ request }) => {
    let status429 = false;
    for (let i = 0; i < 15; i++) {
      const response = await request.get('/api/orders/FAKE?email=fake@example.com');
      if (response.status() === 429) {
        status429 = true;
        break;
      }
    }
    expect(status429).toBeTruthy();
  });
});
