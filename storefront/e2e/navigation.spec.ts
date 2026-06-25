import { test, expect } from '@playwright/test';

test.describe('Header navigation', () => {
  test('logo links to homepage', async ({ page }) => {
    await page.goto('/about');
    await page.locator('header a[href="/"]').first().click();
    await expect(page).toHaveURL('/');
  });

  test('desktop nav has expected links', async ({ page }) => {
    await page.goto('/');
    const nav = page.locator('header nav.hidden.md\\:flex');
    await expect(nav.getByRole('link', { name: 'Shop' })).toBeVisible();
    await expect(nav.getByRole('link', { name: 'Oven Fund' })).toBeVisible();
    await expect(nav.getByRole('link', { name: 'About' })).toBeVisible();
  });

  test('mobile menu opens and shows links', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto('/');
    await page.getByLabel('Menu').click();
    const mobileNav = page.locator('header nav.md\\:hidden');
    await expect(mobileNav.getByRole('link', { name: 'Shop' })).toBeVisible();
    await expect(mobileNav.getByRole('link', { name: 'Oven Fund' })).toBeVisible();
    await expect(mobileNav.getByRole('link', { name: 'About' })).toBeVisible();
  });

  test('mobile menu closes on navigation', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto('/');
    await page.getByLabel('Menu').click();
    const mobileNav = page.locator('header nav.md\\:hidden');
    await expect(mobileNav).toBeVisible();
    await mobileNav.getByRole('link', { name: 'About' }).click();
    await expect(page).toHaveURL('/about');
    await expect(mobileNav).not.toBeVisible();
  });
});

test.describe('Footer navigation', () => {
  test('footer has policy links', async ({ page }) => {
    await page.goto('/');
    const footer = page.locator('footer');
    await expect(footer.getByRole('link', { name: 'Privacy Policy' })).toBeVisible();
    await expect(footer.getByRole('link', { name: 'Terms of Service' })).toBeVisible();
    await expect(footer.getByRole('link', { name: /shipping|pickup/i })).toBeVisible();
  });

  test('footer has company links', async ({ page }) => {
    await page.goto('/');
    const footer = page.locator('footer');
    await expect(footer.getByRole('link', { name: 'Our Story' })).toBeVisible();
    await expect(footer.getByRole('link', { name: 'Contact' })).toBeVisible();
    await expect(footer.getByRole('link', { name: 'FAQ' })).toBeVisible();
  });
});
