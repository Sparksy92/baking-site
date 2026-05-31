import { test, expect } from '@playwright/test';

test.describe('Admin Panel (A5-A11)', () => {
  test('A5-A11: Complete Admin Flow', async ({ page }) => {
    // A1: Login
    await page.goto('/admin/login');
    await page.getByLabel(/email/i).fill('testadmin');
    await page.getByPlaceholder(/password/i).fill('admin123');
    await page.getByRole('button', { name: /login|sign in/i }).click();
    await page.waitForURL('**/admin');
    await expect(page).toHaveURL(/.*\/admin\/?$/);

    // A5: Orders
    await page.getByRole('link', { name: /orders/i }).click();
    await expect(page.getByRole('heading', { name: /orders/i })).toBeVisible();
    await expect(page.locator('table').or(page.getByText(/no orders/i)).first()).toBeVisible();

    // A6 & A7: Categories and Collections
    await page.getByRole('link', { name: /categories/i }).click();
    await expect(page.getByText(/categories/i).first()).toBeVisible();

    await page.getByRole('link', { name: /collections/i }).click();
    await expect(page.getByText(/collections/i).first()).toBeVisible();
    await expect(page.locator('table').first()).toBeVisible();

    // A8: Promos
    await page.getByRole('link', { name: /promos|discounts/i }).click();
    await expect(page.getByText(/promos/i).first()).toBeVisible();

    // A9: Newsletter
    await page.getByRole('link', { name: /newsletter|subscribers/i }).click();
    await expect(page.getByText(/newsletter/i).first()).toBeVisible();
    await expect(page.locator('table').or(page.getByText(/no subscribers/i)).first()).toBeVisible();

    // A10: Settings
    await page.getByRole('link', { name: /settings/i }).click();
    const brandInput = page.getByLabel(/Brand Name/i);
    await brandInput.fill('Automated Brand');
    await page.getByRole('button', { name: /save/i }).click();
    await expect(page.getByText(/saved/i).first()).toBeVisible();

    // A11: Logout
    await page.getByRole('button', { name: /logout|sign out/i }).click();
    await expect(page).toHaveURL(/.*\/admin\/login/);
  });
});
