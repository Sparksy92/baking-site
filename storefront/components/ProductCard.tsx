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
      <div className="relative aspect-[3/4] bg-sand rounded-2xl overflow-hidden shadow-sm group-hover:shadow-lg transition-shadow duration-500">
        {product.image_url ? (
          <Image
            src={product.image_url}
            alt={product.name}
            fill
            sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
            className="object-cover group-hover:scale-105 transition-transform duration-700"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-earth/30">
            <svg className="w-12 h-12" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
          </div>
        )}
        {soldOut && (
          <div className="absolute top-3 left-3 bg-earth/90 text-white text-xs font-bold px-2.5 py-1 rounded-full">
            Sold Out
          </div>
        )}
        {!soldOut && hasCompare && (
          <div className="absolute top-3 left-3 bg-terracotta text-white text-xs font-bold px-2.5 py-1 rounded-full">
            Sale
          </div>
        )}
        {lowStock && !soldOut && (
          <div className="absolute top-3 right-3 bg-sage text-white text-[10px] font-bold px-2 py-0.5 rounded-full">
            {product.total_stock} left
          </div>
        )}
      </div>
      <div className="mt-4 px-1">
        <h3 className="text-sm font-semibold text-earth group-hover:text-terracotta transition-colors truncate">
          {product.name}
        </h3>
        <div className="mt-1.5 flex items-center gap-2">
          <span className="text-sm font-bold text-earth">
            {product.min_price_cents === product.max_price_cents
              ? formatCents(product.min_price_cents ?? 0)
              : `${formatCents(product.min_price_cents ?? 0)} – ${formatCents(product.max_price_cents ?? 0)}`}
          </span>
          {hasCompare && (
            <span className="text-xs text-earth/40 line-through">
              {formatCents(product.compare_at_price_cents!)}
            </span>
          )}
        </div>
      </div>
    </Link>
  );
}
