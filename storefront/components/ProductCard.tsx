import Link from 'next/link';
import Image from 'next/image';
import { ImageIcon, ArrowUpRight } from 'lucide-react';
import { formatCents } from '@/lib/format';
import type { ProductListItem } from '@/lib/api';

export function ProductCard({ product }: { product: ProductListItem }) {
  const soldOut = product.total_stock === 0;
  const lowStock = product.total_stock > 0 && product.total_stock <= 3;
  const hasCompare = product.compare_at_price_cents != null && product.compare_at_price_cents > (product.min_price_cents ?? 0);

  const priceLabel = product.min_price_cents === product.max_price_cents
    ? formatCents(product.min_price_cents ?? 0)
    : `${formatCents(product.min_price_cents ?? 0)} – ${formatCents(product.max_price_cents ?? 0)}`;

  return (
    <Link
      href={`/product/${product.slug}`}
      className="group block"
      aria-label={`${product.name} — ${priceLabel}`}
    >
      {/* Image container */}
      <div className="relative aspect-[3/4] bg-gradient-to-br from-warm via-sand to-cream rounded-2xl overflow-hidden shadow-earth-sm group-hover:shadow-earth transition-all duration-500 group-hover:-translate-y-1">
        {product.image_url ? (
          <Image
            src={product.image_url}
            alt={product.name}
            fill
            sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
            className="object-cover group-hover:scale-[1.06] transition-transform duration-700 ease-out"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-earth/20">
            <ImageIcon className="w-10 h-10" strokeWidth={1.1} aria-hidden="true" />
          </div>
        )}

        {/* Hover reveal overlay */}
        <div className="absolute inset-0 bg-gradient-to-t from-earth/70 via-earth/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
        <div className="absolute bottom-4 left-0 right-0 flex justify-center translate-y-3 opacity-0 group-hover:translate-y-0 group-hover:opacity-100 transition-all duration-400">
          <span className="inline-flex items-center gap-1.5 bg-terracotta text-white text-[10px] font-bold uppercase tracking-[0.18em] px-4 py-2 rounded-full">
            View Piece <ArrowUpRight size={12} />
          </span>
        </div>

        {/* Badges */}
        {soldOut && (
          <div className="absolute top-3 left-3 bg-deep/85 backdrop-blur-sm text-white text-[10px] font-bold uppercase tracking-[0.12em] px-2.5 py-1 rounded-full">
            Sold Out
          </div>
        )}
        {!soldOut && hasCompare && (
          <div className="absolute top-3 left-3 bg-terracotta text-white text-[10px] font-bold uppercase tracking-[0.12em] px-2.5 py-1 rounded-full">
            Sale
          </div>
        )}
        {lowStock && !soldOut && (
          <div className="absolute top-3 right-3 bg-sage/90 backdrop-blur-sm text-white text-[10px] font-bold px-2.5 py-1 rounded-full">
            {product.total_stock} left
          </div>
        )}
      </div>

      {/* Info */}
      <div className="mt-3.5 px-0.5">
        <div className="flex items-start justify-between gap-2">
          <h3 className="text-sm font-semibold text-earth group-hover:text-terracotta transition-colors duration-300 leading-snug line-clamp-2">
            {product.name}
          </h3>
          <div className="flex-shrink-0 text-right">
            <span className="text-sm font-black text-earth">{priceLabel}</span>
            {hasCompare && (
              <span className="block text-[11px] text-earth/35 line-through leading-none mt-0.5">
                {formatCents(product.compare_at_price_cents!)}
              </span>
            )}
          </div>
        </div>
      </div>
    </Link>
  );
}
