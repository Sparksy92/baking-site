'use client';

import { useEffect, useState } from 'react';
import { getRecentlyViewed, type RecentItem } from '@/lib/recently-viewed';
import { ProductCard } from '@/components/ProductCard';
import type { ProductListItem } from '@/lib/api';

function toListItem(item: RecentItem): ProductListItem {
  return item as ProductListItem;
}

interface Props {
  excludeId?: number;
  title?: string;
  maxItems?: number;
}

export function RecentlyViewed({ excludeId, title = 'Recently Viewed', maxItems = 4 }: Props) {
  const [items, setItems] = useState<RecentItem[]>([]);

  useEffect(() => {
    setItems(getRecentlyViewed(excludeId).slice(0, maxItems));
  }, [excludeId, maxItems]);

  if (items.length === 0) return null;

  return (
    <section className="mt-20 border-t border-sand pt-12">
      <p className="text-terracotta font-semibold tracking-widest uppercase text-xs mb-2">Your History</p>
      <h2 className="text-3xl md:text-4xl font-bold text-earth mb-8">{title}</h2>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-5 md:gap-8">
        {items.map((item) => (
          <ProductCard key={item.id} product={toListItem(item)} />
        ))}
      </div>
    </section>
  );
}
