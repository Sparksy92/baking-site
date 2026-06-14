'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { ShoppingBag, Check, Truck, RefreshCw, Shield, ChevronDown, ChevronUp } from 'lucide-react';
import type { Product } from '@/lib/api';
import { cart } from '@/lib/cart';
import { formatCents } from '@/lib/format';
import { addToast } from '@/lib/toast';
import { SizeGuide } from '@/components/SizeGuide';
import { SocialProof } from '@/components/SocialProof';
import { ExpressCheckout } from '@/components/ExpressCheckout';
import { trackView } from '@/lib/recently-viewed';
import { ImageGallery } from './ImageGallery';
import { NotifyMeButton } from '@/components/product/NotifyMeButton';

export function ProductInteractive({ product }: { product: Product }) {
  const sizes = [...new Set(product.variants.map((v) => v.size))];
  const colors = [...new Set(product.variants.map((v) => v.color))];

  const [selectedSize, setSelectedSize] = useState(sizes[0] || '');
  const [selectedColor, setSelectedColor] = useState(colors[0] || '');
  const [added, setAdded] = useState(false);
  const [descOpen, setDescOpen] = useState(true);

  useEffect(() => {
    trackView({
      id: product.id,
      slug: product.slug,
      name: product.name,
      description: product.description ?? null,
      image_url: product.images[0]?.url ?? null,
      min_price_cents: product.variants.reduce((min, v) => Math.min(min, v.price_cents), Infinity) || null,
      max_price_cents: product.variants.reduce((max, v) => Math.max(max, v.price_cents), 0) || null,
      compare_at_price_cents: product.variants[0]?.compare_at_price_cents ?? null,
      total_stock: product.variants.reduce((sum, v) => sum + v.stock_quantity, 0),
      category_id: product.category?.id ?? null,
      is_active: true,
      is_featured: false,
    });
  }, [product.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const now = new Date();

  const selectedVariant = product.variants.find(
    (v) => v.size === selectedSize && v.color === selectedColor
  );

  const variantDropDate = selectedVariant?.available_at ? new Date(selectedVariant.available_at) : null;
  const productDropDate = product.available_at ? new Date(product.available_at) : null;
  const dropDate = variantDropDate ?? productDropDate;
  const isScheduled = dropDate !== null && dropDate > now;

  const inStock = selectedVariant ? selectedVariant.stock_quantity > 0 : false;
  const canPreorder = isScheduled && product.allow_preorder;
  const isAvailableForCart = inStock && !isScheduled;

  const effectivePrice = selectedVariant?.price_cents
    || product.variants.find((v) => v.price_cents > 0)?.price_cents
    || 0;
  const isQuoteOrCustom = 
    effectivePrice === 0 ||
    product.pricing_mode === 'quote_only' ||
    product.pricing_mode === 'seasonal' ||
    product.pricing_mode === 'unavailable' ||
    product.availability_status === 'sold_out' ||
    product.availability_status === 'seasonal' ||
    product.availability_status === 'quote_only' ||
    product.availability_status === 'unavailable' ||
    product.availability_status === 'hidden' ||
    product.is_quote_only === true;

  const lowStock = selectedVariant && selectedVariant.stock_quantity > 0 && selectedVariant.stock_quantity <= 3 && !isScheduled;

  function formatDropDate(d: Date) {
    return d.toLocaleDateString('en-CA', { month: 'long', day: 'numeric', year: 'numeric' });
  }

  function handleAddToCart() {
    if (!selectedVariant || !inStock) return;
    cart.addItem({
      variantId: selectedVariant.id,
      productId: product.id,
      productName: product.name,
      variantSize: selectedVariant.size,
      variantColor: selectedVariant.color,
      unitPriceCents: effectivePrice,
      imageUrl: product.images[0]?.url ?? null,
    });
    addToast(`${product.name} added to cart`, 'success');
    setAdded(true);
    setTimeout(() => setAdded(false), 2500);
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 lg:gap-20">

      {/* ── Gallery ── */}
      <ImageGallery
        images={product.images}
        productName={product.name}
        selectedColor={selectedColor}
      />

      {/* ── Info panel ── */}
      <div className="flex flex-col lg:py-2">

        {/* Breadcrumb / category */}
        {product.category && (
          <Link
            href={`/categories/${product.category.slug}`}
            className="mb-3 text-[10px] font-black uppercase tracking-[0.26em] text-terracotta hover:text-earth transition-colors duration-200"
          >
            {product.category.name}
          </Link>
        )}

        {/* Name */}
        <h1 className="text-3xl md:text-4xl font-black tracking-[-0.02em] leading-[0.95] text-earth">
          {product.name}
        </h1>

        {/* Social proof */}
        <div className="mt-2">
          <SocialProof productId={product.id} />
        </div>

        {/* Tags */}
        {product.tags && product.tags.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-1.5">
            {product.tags.map((tag) => (
              <Link
                key={tag.id}
                href={`/tags/${tag.slug}`}
                className="inline-flex items-center px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-[0.14em] bg-warm border border-sand text-muted-earth hover:bg-terracotta/8 hover:text-terracotta hover:border-terracotta/30 transition-all duration-200"
              >
                {tag.name}
              </Link>
            ))}
          </div>
        )}

        {/* Price */}
        <div className="mt-5 flex items-baseline gap-3">
          <span className="text-4xl font-black text-earth tracking-tight">
            {formatCents(effectivePrice)}
          </span>
          {selectedVariant?.compare_at_price_cents && (
            <>
              <span className="text-xl text-muted-earth/50 line-through font-medium">
                {formatCents(selectedVariant.compare_at_price_cents)}
              </span>
              <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-terracotta/12 text-terracotta text-xs font-bold">
                Save {Math.round((1 - effectivePrice / selectedVariant.compare_at_price_cents) * 100)}%
              </span>
            </>
          )}
        </div>

        <div className="mt-6 h-px bg-sand" />

        {/* Color selector */}
        {colors.length > 1 && (
          <div className="mt-6">
            <div className="flex items-center gap-2 mb-3">
              <span className="text-xs font-bold uppercase tracking-[0.18em] text-earth">Colour</span>
              <span className="text-xs text-muted-earth font-medium">— {selectedColor}</span>
            </div>
            <div className="flex flex-wrap gap-2.5">
              {colors.map((color) => {
                const colorVariant = product.variants.find((v) => v.color === color);
                const hex = colorVariant?.color_hex;
                const isSelected = selectedColor === color;
                return (
                  <button
                    key={color}
                    onClick={() => {
                      setSelectedColor(color);
                      const hasCurrentSize = product.variants.find(
                        (v) => v.color === color && v.size === selectedSize && v.stock_quantity > 0
                      );
                      if (!hasCurrentSize) {
                        const firstAvailable = product.variants.find(
                          (v) => v.color === color && v.stock_quantity > 0
                        );
                        if (firstAvailable) setSelectedSize(firstAvailable.size);
                      }
                    }}
                    className={`relative w-10 h-10 rounded-full transition-all duration-200 ${
                      isSelected
                        ? 'ring-2 ring-terracotta ring-offset-2 ring-offset-cream scale-110'
                        : 'ring-1 ring-sand hover:ring-muted-earth hover:scale-105'
                    }`}
                    style={hex ? { backgroundColor: hex } : { backgroundColor: '#E8DDD3' }}
                    title={color}
                    aria-label={`Colour: ${color}${isSelected ? ' (selected)' : ''}`}
                    aria-pressed={isSelected}
                  >
                    {isSelected && (
                      <span className="absolute inset-0 flex items-center justify-center">
                        <Check size={14} className="text-white drop-shadow" strokeWidth={3} />
                      </span>
                    )}
                    {!hex && (
                      <span className="absolute inset-0 flex items-center justify-center text-[9px] font-black text-earth/60 uppercase">
                        {color.slice(0, 2)}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Size selector */}
        {sizes.length > 0 && (
          <div className="mt-6">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-bold uppercase tracking-[0.18em] text-earth">Size</span>
              <SizeGuide category={product.category?.slug} />
            </div>
            <div className="flex flex-wrap gap-2">
              {sizes.map((size) => {
                const sizeInCurrentColor = product.variants.find(
                  (v) => v.size === size && v.color === selectedColor && v.stock_quantity > 0
                );
                const sizeInAnyColor = product.variants.find(
                  (v) => v.size === size && v.stock_quantity > 0
                );
                const soldOut = !sizeInAnyColor;
                const isSelected = selectedSize === size;
                return (
                  <button
                    key={size}
                    onClick={() => {
                      setSelectedSize(size);
                      if (!sizeInCurrentColor && sizeInAnyColor) {
                        setSelectedColor(sizeInAnyColor.color);
                      }
                    }}
                    disabled={soldOut}
                    aria-pressed={isSelected}
                    className={`min-w-[3rem] px-4 py-3 rounded-2xl border text-sm font-bold transition-all duration-200 ${
                      isSelected
                        ? 'border-earth bg-earth text-white shadow-earth-sm'
                        : soldOut
                          ? 'border-sand/40 text-muted-earth/35 cursor-not-allowed line-through bg-cream'
                          : 'border-sand bg-cream text-earth hover:border-terracotta hover:text-terracotta hover:bg-terracotta/5'
                    }`}
                  >
                    {size}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Drop date badge */}
        {isScheduled && dropDate && (
          <div className="mt-4 inline-flex items-center gap-2 px-3 py-2 rounded-2xl bg-earth/8 border border-earth/20">
            <span className="w-2 h-2 rounded-full bg-terracotta animate-pulse" />
            <span className="text-xs font-bold text-earth">
              {canPreorder ? 'Pre-order — drops ' : 'Coming '}{formatDropDate(dropDate)}
            </span>
          </div>
        )}

        {/* Stock urgency */}
        {lowStock && (
          <div className="mt-4 flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-terracotta animate-pulse" />
            <span className="text-xs font-bold text-terracotta">
              Only {selectedVariant!.stock_quantity} left in this size
            </span>
          </div>
        )}

        {/* Add to cart / Quote Request CTA */}
        {isQuoteOrCustom ? (
          <div className="mt-6 space-y-3">
            <Link
              href="/custom-orders"
              className="w-full flex items-center justify-center gap-3 py-4 rounded-2xl font-bold text-base transition-all duration-300 bg-brand text-white hover:bg-earth hover:scale-[1.01] active:scale-[0.98] shadow-earth-sm hover:shadow-earth"
            >
              Request Custom Order / Quote
            </Link>
            <p className="text-center text-xs text-muted-earth mt-2">
              This item is a quote-only or custom item and cannot be checked out instantly. Please submit an inquiry above!
            </p>
          </div>
        ) : (
          <div className="mt-6 space-y-3">
            {isAvailableForCart || canPreorder ? (
              <button
                onClick={handleAddToCart}
                disabled={!isAvailableForCart && !canPreorder}
                className={`w-full flex items-center justify-center gap-3 py-4 rounded-2xl font-bold text-base transition-all duration-300 ${
                  added
                    ? 'bg-sage text-white scale-[0.99]'
                    : 'bg-terracotta text-white hover:bg-earth hover:scale-[1.01] active:scale-[0.98] shadow-earth-sm hover:shadow-earth'
                }`}
              >
                {added ? (
                  <>
                    <Check size={20} strokeWidth={2.5} />
                    Added to Cart
                  </>
                ) : canPreorder ? (
                  <>
                    <ShoppingBag size={20} />
                    Pre-order Now
                  </>
                ) : (
                  <>
                    <ShoppingBag size={20} />
                    Add to Cart
                  </>
                )}
              </button>
            ) : isScheduled ? (
              <button
                disabled
                className="w-full flex items-center justify-center gap-3 py-4 rounded-2xl font-bold text-base transition-all duration-300 bg-sand text-muted-earth/50 cursor-not-allowed"
              >
                Coming Soon
              </button>
            ) : selectedVariant ? (
              <NotifyMeButton variantId={selectedVariant.id} productName={product.name} />
            ) : (
              <button
                disabled
                className="w-full flex items-center justify-center gap-3 py-4 rounded-2xl font-bold text-base transition-all duration-300 bg-sand text-muted-earth/50 cursor-not-allowed"
              >
                Sold Out
              </button>
            )}

            <Link
              href="/cart"
              className="block w-full py-3.5 rounded-2xl border-2 border-earth text-earth font-bold text-base text-center hover:bg-earth hover:text-white transition-all duration-200 active:scale-[0.98]"
            >
              View Cart
            </Link>

            {inStock && selectedVariant && (
              <ExpressCheckout
                mode="buy-now"
                variantId={selectedVariant.id}
                productName={product.name}
                variantSize={selectedVariant.size}
                variantColor={selectedVariant.color}
                unitPriceCents={effectivePrice}
                imageUrl={product.images[0]?.url ?? null}
              />
            )}
          </div>
        )}

        {/* Trust micro-strip */}
        <div className="mt-6 grid grid-cols-3 gap-2">
          {[
            { icon: Truck, label: 'Free ship $75+' },
            { icon: RefreshCw, label: '60-day returns' },
            { icon: Shield, label: '5-yr guarantee' },
          ].map(({ icon: Icon, label }) => (
            <div key={label} className="flex flex-col items-center gap-1.5 p-3 rounded-2xl bg-warm border border-sand/60 text-center">
              <Icon size={16} strokeWidth={1.8} className="text-terracotta" aria-hidden="true" />
              <span className="text-[10px] font-semibold text-earth/70 leading-tight">{label}</span>
            </div>
          ))}
        </div>

        {/* Description accordion */}
        {product.description && (
          <div className="mt-6 border-t border-sand">
            <button
              onClick={() => setDescOpen((v) => !v)}
              className="w-full flex items-center justify-between py-4 text-left group"
            >
              <span className="text-sm font-bold text-earth group-hover:text-terracotta transition-colors duration-200">
                Product Details
              </span>
              {descOpen
                ? <ChevronUp size={16} className="text-muted-earth" />
                : <ChevronDown size={16} className="text-muted-earth" />
              }
            </button>
            <div className={`overflow-hidden transition-all duration-300 ${descOpen ? 'max-h-[600px] opacity-100 pb-4' : 'max-h-0 opacity-0'}`}>
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
