'use client';

import { useState } from 'react';
import type { Product } from '@/lib/api';
import { cart } from '@/lib/cart';
import { formatCents } from '@/lib/format';
import { addToast } from '@/lib/toast';
import { SizeGuide } from '@/components/SizeGuide';
import { SocialProof } from '@/components/SocialProof';

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
      unitPriceCents: selectedVariant.price_cents,
      imageUrl: product.images[0]?.url ?? null,
    });
    addToast(`${product.name} added to cart`, 'success');
    setAdded(true);
    setTimeout(() => setAdded(false), 2000);
  }

  return (
    <div className="flex flex-col">
      <h1 className="text-2xl md:text-3xl font-bold text-gray-900">{product.name}</h1>
      <SocialProof productId={product.id} />

      {selectedVariant && (
        <div className="mt-3 flex items-center gap-3">
          <span className="text-2xl font-bold text-gray-900">
            {formatCents(selectedVariant.price_cents)}
          </span>
          {selectedVariant.compare_at_price_cents && (
            <span className="text-lg text-gray-400 line-through">
              {formatCents(selectedVariant.compare_at_price_cents)}
            </span>
          )}
        </div>
      )}

      {product.description && (
        <div
          className="mt-4 text-gray-600 leading-relaxed prose prose-sm max-w-none"
          dangerouslySetInnerHTML={{ __html: product.description }}
        />
      )}

      {/* Color selector */}
      {colors.length > 1 && (
        <div className="mt-6">
          <h3 className="text-sm font-semibold text-gray-900 mb-2">Color — {selectedColor}</h3>
          <div className="flex gap-2">
            {colors.map((color) => {
              const colorVariant = product.variants.find((v) => v.color === color);
              const hex = colorVariant?.color_hex;
              return (
                <button
                  key={color}
                  onClick={() => setSelectedColor(color)}
                  className={`w-10 h-10 rounded-full border-2 transition-all ${
                    selectedColor === color ? 'border-brand scale-110' : 'border-gray-200'
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
            <h3 className="text-sm font-semibold text-gray-900">Size</h3>
            <SizeGuide category={product.category?.slug} />
          </div>
          <div className="flex flex-wrap gap-2">
            {sizes.map((size) => {
              const sizeVariant = product.variants.find(
                (v) => v.size === size && v.color === selectedColor
              );
              const sizeAvailable = sizeVariant ? sizeVariant.stock_quantity > 0 : false;
              return (
                <button
                  key={size}
                  onClick={() => setSelectedSize(size)}
                  disabled={!sizeAvailable}
                  className={`px-4 py-2.5 rounded-lg border text-sm font-medium transition-all ${
                    selectedSize === size
                      ? 'border-brand bg-brand text-white'
                      : sizeAvailable
                        ? 'border-gray-200 text-gray-700 hover:border-gray-400'
                        : 'border-gray-100 text-gray-300 cursor-not-allowed line-through'
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
            <span className="text-sm text-red-600 font-medium">Sold Out</span>
          ) : selectedVariant.stock_quantity <= 3 ? (
            <span className="text-sm text-amber-600 font-medium">
              Only {selectedVariant.stock_quantity} left
            </span>
          ) : null}
        </div>
      )}

      {/* Add to cart */}
      <button
        onClick={handleAddToCart}
        disabled={!inStock}
        className={`mt-8 w-full py-4 rounded-xl font-bold text-base transition-all ${
          added
            ? 'bg-green-600 text-white'
            : inStock
              ? 'bg-brand text-white hover:bg-brand/90 active:scale-[0.98]'
              : 'bg-gray-200 text-gray-400 cursor-not-allowed'
        }`}
      >
        {added ? 'Added to Cart' : inStock ? 'Add to Cart' : 'Sold Out'}
      </button>
    </div>
  );
}
