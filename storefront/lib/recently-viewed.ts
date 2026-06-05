/**
 * Recently viewed products — localStorage persistence.
 * Stores up to MAX_ITEMS product stubs (id, slug, name, image, price).
 * Most recent first. Current product is always excluded from the display list.
 */

import type { ProductListItem } from '@/lib/api';

const KEY = 'recently_viewed';
const MAX_ITEMS = 8;

export type RecentItem = Pick<
  ProductListItem,
  | 'id' | 'slug' | 'name' | 'description'
  | 'image_url' | 'min_price_cents' | 'max_price_cents'
  | 'compare_at_price_cents' | 'total_stock'
  | 'category_id' | 'is_active' | 'is_featured'
>;

function read(): RecentItem[] {
  if (typeof window === 'undefined') return [];
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? '[]') as RecentItem[];
  } catch {
    return [];
  }
}

function write(items: RecentItem[]) {
  try {
    localStorage.setItem(KEY, JSON.stringify(items));
  } catch {
    // Storage full or unavailable — fail silently
  }
}

export function trackView(item: RecentItem) {
  const current = read().filter((i) => i.id !== item.id);
  write([item, ...current].slice(0, MAX_ITEMS));
}

export function getRecentlyViewed(excludeId?: number): RecentItem[] {
  return read().filter((i) => i.id !== excludeId);
}
