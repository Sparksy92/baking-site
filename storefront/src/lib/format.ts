export function formatCents(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

export function brandName(): string {
  return import.meta.env.VITE_BRAND_NAME || 'Store';
}

export function brandTagline(): string {
  return import.meta.env.VITE_BRAND_TAGLINE || '';
}

export function brandLogo(): string | null {
  return import.meta.env.VITE_BRAND_LOGO || null;
}

export function brandAccent(): string {
  return import.meta.env.VITE_BRAND_COLOR_ACCENT || '#C53030';
}
