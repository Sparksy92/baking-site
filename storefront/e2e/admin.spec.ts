import { test, expect } from '@playwright/test';

test.describe('Admin Panel (A5-A11)', () => {
  test('A5-A11: Complete Admin Flow', async ({ page }) => {
    // A1: Login
    await page.goto('/admin/login');
    await page.getByPlaceholder(/username/i).fill('testadmin');
    await page.getByPlaceholder(/password/i).fill('admin123');
    await page.getByRole('button', { name: /login|sign in/i }).click();
    await page.waitForURL('**/admin');
    await expect(page).toHaveURL(/.*\/admin\/?$/);

    // A5: Orders
    await page.goto('/admin/orders');
    await expect(page.getByRole('heading', { name: /orders/i })).toBeVisible();
    await expect(page.locator('table').or(page.getByText(/no orders/i)).first()).toBeVisible();

    // A6 & A7: Categories and Collections
    await page.goto('/admin/categories');
    await expect(page.getByText(/categories/i).first()).toBeVisible();

    await page.goto('/admin/collections');
    await expect(page.getByText(/collections/i).first()).toBeVisible();
    await expect(page.locator('table').first()).toBeVisible();

    // A8: Promos
    await page.goto('/admin/promos');
    await expect(page.getByText(/promos/i).first()).toBeVisible();

    // A9: Newsletter
    await page.goto('/admin/newsletter');
    await expect(page.getByText(/newsletter/i).first()).toBeVisible();
    await expect(page.locator('table').or(page.getByText(/no subscribers/i)).first()).toBeVisible();

    // A10: Settings
    await page.goto('/admin/settings');
    const brandInput = page.getByLabel(/Brand Name/i);
    await brandInput.fill('Automated Brand');
    await page.getByRole('button', { name: /save/i }).click();
    await expect(page.getByText(/saved/i).first()).toBeVisible();

    // A11: Logout
    await page.getByRole('button', { name: /logout|sign out/i }).click();
    await expect(page).toHaveURL(/.*\/admin\/login/);
  });
});
