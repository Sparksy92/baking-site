import { describe, it, expect, vi, beforeEach } from 'vitest';
import { formatCents, brandName, brandTagline, brandLogo, siteUrl } from '@/lib/format';

describe('formatCents', () => {
  it('formats zero', () => {
    expect(formatCents(0)).toBe('$0.00');
  });

  it('formats whole dollars', () => {
    expect(formatCents(2500)).toBe('$25.00');
  });

  it('formats cents correctly', () => {
    expect(formatCents(1999)).toBe('$19.99');
  });

  it('formats single cent', () => {
    expect(formatCents(1)).toBe('$0.01');
  });

  it('formats large amounts', () => {
    expect(formatCents(999999)).toBe('$9999.99');
  });
});

describe('brandName', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
  });

  it('returns env value when set', () => {
    process.env.NEXT_PUBLIC_BRAND_NAME = 'TestBrand';
    expect(brandName()).toBe('TestBrand');
  });

  it('returns default when not set', () => {
    delete process.env.NEXT_PUBLIC_BRAND_NAME;
    expect(brandName()).toBe('Store');
  });
});

describe('brandTagline', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
  });

  it('returns env value when set', () => {
    process.env.NEXT_PUBLIC_BRAND_TAGLINE = 'Best clothing';
    expect(brandTagline()).toBe('Best clothing');
  });

  it('returns empty string when not set', () => {
    delete process.env.NEXT_PUBLIC_BRAND_TAGLINE;
    expect(brandTagline()).toBe('');
  });
});

describe('brandLogo', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
  });

  it('returns url when set', () => {
    process.env.NEXT_PUBLIC_BRAND_LOGO = '/logo.png';
    expect(brandLogo()).toBe('/logo.png');
  });

  it('returns null when not set', () => {
    delete process.env.NEXT_PUBLIC_BRAND_LOGO;
    expect(brandLogo()).toBeNull();
  });
});

describe('siteUrl', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
  });

  it('returns env value when set', () => {
    process.env.NEXT_PUBLIC_SITE_URL = 'https://example.com';
    expect(siteUrl()).toBe('https://example.com');
  });

  it('returns default when not set', () => {
    delete process.env.NEXT_PUBLIC_SITE_URL;
    expect(siteUrl()).toBe('http://localhost:5173');
  });
});
