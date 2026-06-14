'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Clock, AlertTriangle, MapPin, ChevronDown, ChevronUp, ArrowLeft, Send } from 'lucide-react';
import type { Product } from '@/lib/api';
import { formatCents } from '@/lib/format';
import { ImageGallery } from './ImageGallery';
import { trackView } from '@/lib/recently-viewed';

export function ProductInteractive({ product }: { product: Product }) {
  const [descOpen, setDescOpen] = useState(true);

  useEffect(() => {
    trackView({
      id: product.id,
      slug: product.slug,
      name: product.name,
      description: product.description ?? null,
      image_url: product.images[0]?.url ?? null,
      min_price_cents: product.variants[0]?.price_cents || null,
      max_price_cents: product.variants[0]?.price_cents || null,
      compare_at_price_cents: null,
      total_stock: product.availability_status === 'sold_out' ? 0 : 99,
      category_id: product.category?.id ?? null,
      is_active: true,
      is_featured: product.is_featured,
    });
  }, [product.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const getAvailabilityBadge = () => {
    switch (product.availability_status) {
      case 'available':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-emerald-500/10 text-emerald-700 border border-emerald-500/20">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
            Available
          </span>
        );
      case 'preorder':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-amber-500/10 text-amber-700 border border-amber-500/20">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
            Pre-order
          </span>
        );
      case 'weekend_only':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-indigo-500/10 text-indigo-700 border border-indigo-500/20">
            <span className="w-1.5 h-1.5 rounded-full bg-indigo-500" />
            Weekends Only
          </span>
        );
      case 'sold_out':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-rose-500/10 text-rose-700 border border-rose-500/20">
            <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />
            Sold Out
          </span>
        );
      case 'seasonal':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-sky-500/10 text-sky-700 border border-sky-500/20">
            <span className="w-1.5 h-1.5 rounded-full bg-sky-500" />
            Seasonal Availability
          </span>
        );
      default:
        return null;
    }
  };

  const renderPrice = () => {
    if (product.pricing_mode === 'quote_only') {
      return (
        <span className="text-3xl font-black text-earth tracking-tight">
          By Inquiry
        </span>
      );
    }
    if (product.pricing_mode === 'seasonal') {
      return (
        <span className="text-3xl font-black text-earth tracking-tight">
          Seasonal Pricing
        </span>
      );
    }
    const cents = product.variants[0]?.price_cents || 0;
    const formattedPrice = formatCents(cents);
    if (product.pricing_mode === 'starting_at') {
      return (
        <div className="flex flex-col">
          <span className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-earth/60">Starting at</span>
          <span className="text-3xl md:text-4xl font-black text-earth tracking-tight">
            {formattedPrice}
          </span>
        </div>
      );
    }
    return (
      <span className="text-3xl md:text-4xl font-black text-earth tracking-tight">
        {formattedPrice}
      </span>
    );
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 lg:gap-20">
      {/* Image Gallery */}
      <ImageGallery
        images={product.images}
        productName={product.name}
      />

      {/* Info panel */}
      <div className="flex flex-col lg:py-2">
        {/* Breadcrumb / category */}
        {product.category && (
          <div className="mb-3">
            <Link
              href={`/shop?category=${encodeURIComponent(product.category.slug)}`}
              className="text-[10px] font-black uppercase tracking-[0.26em] text-terracotta hover:text-earth transition-colors duration-200"
            >
              {product.category.name}
            </Link>
          </div>
        )}

        {/* Title & Badge */}
        <div className="flex flex-wrap items-center gap-3 mb-4">
          <h1 className="text-3xl md:text-4xl font-black tracking-[-0.02em] leading-[0.95] text-earth">
            {product.name}
          </h1>
          <div>{getAvailabilityBadge()}</div>
        </div>

        {/* Price display */}
        <div className="mt-2 flex items-baseline gap-3">
          {renderPrice()}
        </div>

        <div className="mt-6 h-px bg-sand" />

        {/* Bakers notes / attributes */}
        <div className="mt-6 space-y-4">
          {/* Lead time */}
          {(product.lead_time_days ?? 0) > 0 && (
            <div className="flex items-start gap-3 p-4 rounded-2xl bg-amber-500/5 border border-amber-500/10">
              <Clock className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
              <div>
                <h4 className="text-xs font-bold text-earth uppercase tracking-wider">Advance Notice Required</h4>
                <p className="text-sm text-muted-earth mt-0.5">
                  This item requires at least <span className="font-bold">{product.lead_time_days} days</span> notice to prepare.
                </p>
              </div>
            </div>
          )}

          {/* Allergy warnings */}
          {product.allergy_notes && (
            <div className="flex items-start gap-3 p-4 rounded-2xl bg-rose-500/5 border border-rose-500/10">
              <AlertTriangle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
              <div>
                <h4 className="text-xs font-bold text-earth uppercase tracking-wider">Allergy Information</h4>
                <p className="text-sm text-muted-earth mt-0.5">{product.allergy_notes}</p>
              </div>
            </div>
          )}

          {/* Pickup notes */}
          {product.pickup_notes && (
            <div className="flex items-start gap-3 p-4 rounded-2xl bg-emerald-500/5 border border-emerald-500/10">
              <MapPin className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
              <div>
                <h4 className="text-xs font-bold text-earth uppercase tracking-wider">Pickup & Logistics</h4>
                <p className="text-sm text-muted-earth mt-0.5">{product.pickup_notes}</p>
              </div>
            </div>
          )}
        </div>

        {/* Primary CTA */}
        <div className="mt-8 space-y-4">
          {product.availability_status !== 'sold_out' ? (
            <Link
              href={`/custom-orders?item=${encodeURIComponent(product.slug)}`}
              className="w-full flex items-center justify-center gap-3 py-4 rounded-2xl font-bold text-base transition-all duration-300 bg-brand text-white hover:bg-earth hover:scale-[1.01] active:scale-[0.98] shadow-earth-sm hover:shadow-earth"
            >
              <Send size={18} />
              Request This Item
            </Link>
          ) : (
            <button
              disabled
              className="w-full flex items-center justify-center gap-3 py-4 rounded-2xl font-bold text-base bg-sand text-muted-earth/50 cursor-not-allowed border border-sand/70"
            >
              Temporarily Sold Out
            </button>
          )}

          <Link
            href="/shop"
            className="w-full flex items-center justify-center gap-2 py-3.5 rounded-2xl border-2 border-earth text-earth font-bold text-base text-center hover:bg-earth hover:text-white transition-all duration-200 active:scale-[0.98]"
          >
            <ArrowLeft size={16} />
            View Full Menu
          </Link>

          <p className="text-center text-xs text-muted-earth">
            All orders are processed as requests. Kirstin will review availability and confirm your baking date via email.
          </p>
        </div>

        {/* Description Accordion */}
        {product.description && (
          <div className="mt-8 border-t border-sand">
            <button
              onClick={() => setDescOpen((v) => !v)}
              className="w-full flex items-center justify-between py-4 text-left group"
            >
              <span className="text-sm font-bold text-earth group-hover:text-terracotta transition-colors duration-200">
                Product Details
              </span>
              {descOpen ? (
                <ChevronUp size={16} className="text-muted-earth" />
              ) : (
                <ChevronDown size={16} className="text-muted-earth" />
              )}
            </button>
            <div
              className={`overflow-hidden transition-all duration-300 ${
                descOpen ? 'max-h-[600px] opacity-100 pb-4' : 'max-h-0 opacity-0'
              }`}
            >
              <div
                className="text-sm text-muted-earth leading-relaxed prose prose-sm max-w-none prose-headings:text-earth prose-a:text-terracotta"
                dangerouslySetInnerHTML={{ __html: product.description }}
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
