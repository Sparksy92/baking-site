import { describe, it, expect } from 'vitest';
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
  it('returns brand config name', () => {
    expect(brandName()).toBe('Baseline Store');
  });
});

describe('brandTagline', () => {
  it('returns brand config tagline', () => {
    expect(brandTagline()).toBe('Your Tagline Here');
  });
});

describe('brandLogo', () => {
  it('returns brand config logo path', () => {
    expect(brandLogo()).toBe('/images/brand/logo.png');
  });
});

describe('siteUrl', () => {
  it('returns brand config baseUrl', () => {
    expect(siteUrl()).toBe('https://yourdomain.com');
  });
});
