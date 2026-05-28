import Link from 'next/link';
import Image from 'next/image';
import { formatCents } from '@/lib/format';
import type { ProductListItem } from '@/lib/api';

export function ProductCard({ product }: { product: ProductListItem }) {
  const soldOut = product.total_stock === 0;
  const lowStock = product.total_stock > 0 && product.total_stock <= 3;
  const hasCompare = product.compare_at_price_cents != null && product.compare_at_price_cents > (product.min_price_cents ?? 0);

  return (
    <Link href={`/product/${product.slug}`} className="group">
      <div className="relative aspect-[3/4] bg-gray-100 rounded-lg overflow-hidden">
        {product.image_url ? (
          <Image
            src={product.image_url}
            alt={product.name}
            fill
            sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
            className="object-cover group-hover:scale-105 transition-transform duration-500"
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
        {!soldOut && hasCompare && (
          <div className="absolute top-2 left-2 bg-accent text-white text-xs font-bold px-2 py-1 rounded">
            Sale
          </div>
        )}
        {lowStock && !soldOut && (
          <div className="absolute top-2 right-2 bg-amber-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded">
            {product.total_stock} left
          </div>
        )}
      </div>
      <div className="mt-3">
        <h3 className="text-sm font-medium text-gray-900 group-hover:text-accent transition-colors truncate">
          {product.name}
        </h3>
        <div className="mt-1 flex items-center gap-2">
          <span className="text-sm font-bold text-gray-900">
            {product.min_price_cents === product.max_price_cents
              ? formatCents(product.min_price_cents ?? 0)
              : `${formatCents(product.min_price_cents ?? 0)} – ${formatCents(product.max_price_cents ?? 0)}`}
          </span>
          {hasCompare && (
            <span className="text-xs text-gray-400 line-through">
              {formatCents(product.compare_at_price_cents!)}
            </span>
          )}
        </div>
      </div>
    </Link>
  );
}
