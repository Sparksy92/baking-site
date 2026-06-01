import { brandConfig } from '../config/brand.config';

export function formatCents(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

export function brandName(): string {
  return brandConfig.metadata.name;
}

export function brandTagline(): string {
  return brandConfig.metadata.tagline;
}

export function brandLogo(): string | null {
  return brandConfig.assets.logo || null;
}

export function siteUrl(): string {
  return brandConfig.metadata.baseUrl;
}
