import Link from 'next/link';
import Image from 'next/image';
import { ArrowUpRight } from 'lucide-react';
import { formatCents } from '@/lib/format';
import type { ProductListItem } from '@/lib/api';

export function ProductCard({ product }: { product: ProductListItem }) {
  const getAvailabilityBadge = () => {
    switch (product.availability_status) {
      case 'preorder':
        return (
          <div className="absolute top-3 left-3 bg-amber-500 text-white text-[9px] font-bold uppercase tracking-[0.12em] px-2.5 py-1 rounded-full shadow-sm">
            Pre-order
          </div>
        );
      case 'weekend_only':
        return (
          <div className="absolute top-3 left-3 bg-indigo-500 text-white text-[9px] font-bold uppercase tracking-[0.12em] px-2.5 py-1 rounded-full shadow-sm">
            Weekends
          </div>
        );
      case 'seasonal':
        return (
          <div className="absolute top-3 left-3 bg-sky-500 text-white text-[9px] font-bold uppercase tracking-[0.12em] px-2.5 py-1 rounded-full shadow-sm">
            Seasonal
          </div>
        );
      case 'sold_out':
        return (
          <div className="absolute top-3 left-3 bg-rose-500 text-white text-[9px] font-bold uppercase tracking-[0.12em] px-2.5 py-1 rounded-full shadow-sm">
            Sold Out
          </div>
        );
      default:
        return null;
    }
  };

  const getPriceDisplay = () => {
    if (product.pricing_mode === 'quote_only') {
      return 'Inquire';
    }
    if (product.pricing_mode === 'seasonal') {
      return 'Seasonal';
    }
    const price = formatCents(product.min_price_cents ?? 0);
    if (product.pricing_mode === 'starting_at') {
      return `From ${price}`;
    }
    return price;
  };

  return (
    <Link
      href={`/product/${product.slug}`}
      className="group block"
      aria-label={`${product.name} — ${getPriceDisplay()}`}
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
          <div className="absolute inset-0 flex flex-col items-center justify-center text-earth/20 bg-warm/50 gap-2">
            <span className="text-3xl">🍞</span>
            <span className="text-[9px] uppercase tracking-wider font-bold">No Image</span>
          </div>
        )}

        {/* Hover reveal overlay */}
        <div className="absolute inset-0 bg-gradient-to-t from-earth/70 via-earth/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
        <div className="absolute bottom-4 left-0 right-0 flex justify-center translate-y-3 opacity-0 group-hover:translate-y-0 group-hover:opacity-100 transition-all duration-400">
          <span className="inline-flex items-center gap-1.5 bg-terracotta text-white text-[10px] font-bold uppercase tracking-[0.18em] px-4 py-2 rounded-full">
            Details <ArrowUpRight size={12} />
          </span>
        </div>

        {/* Badges */}
        {getAvailabilityBadge()}
      </div>

      {/* Info */}
      <div className="mt-3.5 px-0.5">
        <div className="flex items-start justify-between gap-2">
          <h3 className="text-sm font-semibold text-earth group-hover:text-terracotta transition-colors duration-300 leading-snug line-clamp-2">
            {product.name}
          </h3>
          <div className="flex-shrink-0 text-right">
            <span className="text-sm font-black text-earth">{getPriceDisplay()}</span>
          </div>
        </div>
      </div>
    </Link>
  );
}
