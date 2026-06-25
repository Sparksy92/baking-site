import { test, expect } from '@playwright/test';

test.describe('Policy pages', () => {
  test('privacy policy has expected content', async ({ page }) => {
    await page.goto('/privacy-policy');
    await expect(page.getByRole('heading', { name: /privacy policy/i })).toBeVisible();
  });

  test('terms of service has expected content', async ({ page }) => {
    await page.goto('/terms-of-service');
    await expect(page.getByRole('heading', { name: /terms of service/i })).toBeVisible();
  });

  test('shipping policy has expected content', async ({ page }) => {
    await page.goto('/shipping-policy');
    await expect(page.getByRole('heading', { name: /shipping|pickup.*delivery/i })).toBeVisible();
  });

  test('return policy has expected content', async ({ page }) => {
    await page.goto('/return-policy');
    await expect(page.getByRole('heading', { name: /return.*cancellation/i })).toBeVisible();
  });
});

test.describe('Info pages', () => {
  test('about page has heading', async ({ page }) => {
    await page.goto('/about');
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  });

  test('contact page has heading and email', async ({ page }) => {
    await page.goto('/contact');
    await expect(page.getByRole('heading', { name: /contact/i })).toBeVisible();
  });

  test('FAQ page has questions', async ({ page }) => {
    await page.goto('/faq');
    await expect(page.getByRole('heading', { name: /faq|frequently/i })).toBeVisible();
    // Should have at least one Q&A
    const headings = page.getByRole('heading', { level: 3 });
    await expect(headings.first()).toBeVisible();
  });

  test('FAQ page links to contact page', async ({ page }) => {
    await page.goto('/faq');
    const contactLink = page.getByRole('link', { name: 'Contact Us' });
    await expect(contactLink).toBeVisible();
  });
});

test.describe('Categories page', () => {
  test('categories page loads', async ({ page }) => {
    await page.goto('/categories');
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  });
});
