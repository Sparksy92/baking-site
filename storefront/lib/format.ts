export function formatCents(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

export function brandName(): string {
  return process.env.NEXT_PUBLIC_BRAND_NAME || 'Store';
}

export function brandTagline(): string {
  return process.env.NEXT_PUBLIC_BRAND_TAGLINE || '';
}

export function brandLogo(): string | null {
  return process.env.NEXT_PUBLIC_BRAND_LOGO || null;
}

export function siteUrl(): string {
  return process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:5173';
}
