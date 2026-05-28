export function formatCents(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

export function brandName(): string {
  return import.meta.env.VITE_BRAND_NAME || 'Store';
}
