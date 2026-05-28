import Link from 'next/link';
import { formatCents } from '@/lib/format';
import type { ProductListItem } from '@/lib/api';

export function ProductCard({ product }: { product: ProductListItem }) {
  const soldOut = product.total_stock === 0;

  return (
    <Link href={`/product/${product.slug}`} className="group">
      <div className="relative aspect-[3/4] bg-gray-100 rounded-lg overflow-hidden">
        {product.image_url ? (
          <img
            src={product.image_url}
            alt={product.name}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
            loading="lazy"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-gray-400 text-sm">
            No image
          </div>
        )}
        {soldOut && (
          <div className="absolute top-2 left-2 bg-black/80 text-white text-xs font-bold px-2 py-1 rounded">
            Sold Out
          </div>
        )}
      </div>
      <div className="mt-3">
        <h3 className="text-sm font-medium text-gray-900 group-hover:text-accent transition-colors truncate">
          {product.name}
        </h3>
        <p className="mt-1 text-sm font-bold text-gray-900">
          {product.min_price_cents === product.max_price_cents
            ? formatCents(product.min_price_cents ?? 0)
            : `${formatCents(product.min_price_cents ?? 0)} – ${formatCents(product.max_price_cents ?? 0)}`}
        </p>
      </div>
    </Link>
  );
}
