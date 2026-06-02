'use client';

import { useState } from 'react';
import Link from 'next/link';
import type { Product } from '@/lib/api';
import { cart } from '@/lib/cart';
import { formatCents } from '@/lib/format';
import { addToast } from '@/lib/toast';
import { SizeGuide } from '@/components/SizeGuide';
import { SocialProof } from '@/components/SocialProof';
import { ImageGallery } from './ImageGallery';

export function ProductInteractive({ product }: { product: Product }) {
  const sizes = [...new Set(product.variants.map((v) => v.size))];
  const colors = [...new Set(product.variants.map((v) => v.color))];

  const [selectedSize, setSelectedSize] = useState(sizes[0] || '');
  const [selectedColor, setSelectedColor] = useState(colors[0] || '');
  const [added, setAdded] = useState(false);

  const selectedVariant = product.variants.find(
    (v) => v.size === selectedSize && v.color === selectedColor
  );
  const inStock = selectedVariant ? selectedVariant.stock_quantity > 0 : false;

  function handleAddToCart() {
    if (!selectedVariant || !inStock) return;
    cart.addItem({
      variantId: selectedVariant.id,
      productId: product.id,
      productName: product.name,
      variantSize: selectedVariant.size,
      variantColor: selectedVariant.color,
      unitPriceCents: selectedVariant.price_cents || product.variants.find((v) => v.price_cents > 0)?.price_cents || 0,
      imageUrl: product.images[0]?.url ?? null,
    });
    addToast(`${product.name} added to cart`, 'success');
    setAdded(true);
    setTimeout(() => setAdded(false), 2000);
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 lg:gap-16">
      <ImageGallery images={product.images} productName={product.name} selectedColor={selectedColor} />
      <div className="flex flex-col">
      {product.category && (
        <Link href={`/categories/${product.category.slug}`} className="mb-3 text-xs font-semibold uppercase tracking-widest text-terracotta hover:text-earth transition-colors">
          {product.category.name}
        </Link>
      )}
      <h1 className="text-3xl md:text-5xl font-black tracking-tight text-earth">{product.name}</h1>
      <SocialProof productId={product.id} />

      {/* Tags */}
      {product.tags && product.tags.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-2">
          {product.tags.map((tag) => (
            <Link
              key={tag.id}
              href={`/tags/${tag.slug}`}
              className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-warm border border-sand text-muted-earth hover:bg-terracotta/10 hover:text-terracotta transition-colors"
            >
              {tag.name}
            </Link>
          ))}
        </div>
      )}

      {selectedVariant && (
        <div className="mt-3 flex items-center gap-3">
          <span className="text-3xl font-black text-earth">
            {formatCents(selectedVariant.price_cents || product.variants.find((v) => v.price_cents > 0)?.price_cents || 0)}
          </span>
          {selectedVariant.compare_at_price_cents && (
            <span className="text-lg text-muted-earth/60 line-through">
              {formatCents(selectedVariant.compare_at_price_cents)}
            </span>
          )}
        </div>
      )}

      {/* Color selector */}
      {colors.length > 1 && (
        <div className="mt-6">
          <h3 className="text-sm font-semibold text-earth mb-3">Color — {selectedColor}</h3>
          <div className="flex gap-2">
            {colors.map((color) => {
              const colorVariant = product.variants.find((v) => v.color === color);
              const hex = colorVariant?.color_hex;
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
                  className={`w-11 h-11 rounded-full border-2 transition-all shadow-earth-sm ${
                    selectedColor === color ? 'border-terracotta scale-110' : 'border-sand hover:border-muted-earth'
                  }`}
                  style={hex ? { backgroundColor: hex } : undefined}
                  title={color}
                >
                  {!hex && <span className="text-xs">{color.slice(0, 2)}</span>}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Size selector */}
      {sizes.length > 0 && (
        <div className="mt-6">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-semibold text-earth">Size</h3>
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
                  className={`px-4 py-2.5 rounded-xl border text-sm font-semibold transition-all ${
                    selectedSize === size
                      ? 'border-earth bg-earth text-white'
                      : soldOut
                        ? 'border-sand/50 text-muted-earth/40 cursor-not-allowed line-through'
                        : 'border-sand bg-cream text-earth hover:border-terracotta hover:text-terracotta'
                  }`}
                >
                  {size}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Stock status */}
      {selectedVariant && (
        <div className="mt-4">
          {selectedVariant.stock_quantity <= 0 ? (
            <span className="text-sm text-red-700 font-semibold">Sold Out</span>
          ) : selectedVariant.stock_quantity <= 3 ? (
            <span className="text-sm text-terracotta font-semibold">
              Only {selectedVariant.stock_quantity} left
            </span>
          ) : null}
        </div>
      )}

      {/* Add to cart */}
      <button
        onClick={handleAddToCart}
        disabled={!inStock}
        className={`mt-8 w-full py-4 rounded-2xl font-bold text-base transition-all shadow-earth-sm ${
          added
            ? 'bg-sage text-white'
            : inStock
              ? 'bg-terracotta text-white hover:bg-terracotta/90 hover:scale-[1.01] active:scale-[0.98]'
              : 'bg-sand text-muted-earth/60 cursor-not-allowed shadow-none'
        }`}
      >
        {added ? 'Added to Cart' : inStock ? 'Add to Cart' : 'Sold Out'}
      </button>

      {/* Description */}
      {product.description && (
        <div
          className="mt-8 pt-8 border-t border-sand"
        >
          <h3 className="text-sm font-semibold text-earth mb-3">Description</h3>
          <div
            className="text-muted-earth leading-relaxed prose prose-sm max-w-none prose-headings:text-earth prose-a:text-terracotta"
            dangerouslySetInnerHTML={{ __html: product.description }}
          />
        </div>
      )}
      </div>
    </div>
  );
}
