import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { api, type Product } from '../lib/api';
import { cart } from '../lib/cart';
import { formatCents } from '../lib/format';
import { useDocumentTitle } from '../lib/seo';

export default function ProductDetail() {
  const { slug } = useParams<{ slug: string }>();
  const [product, setProduct] = useState<Product | null>(null);
  const [loading, setLoading] = useState(true);
  useDocumentTitle(product?.name);
  const [selectedSize, setSelectedSize] = useState<string>('');
  const [selectedColor, setSelectedColor] = useState<string>('');
  const [activeImage, setActiveImage] = useState(0);
  const [added, setAdded] = useState(false);

  useEffect(() => {
    if (!slug) return;
    api.get<Product>(`/api/products/${slug}`)
      .then((p) => {
        setProduct(p);
        // Pre-select first available size and color
        const sizes = [...new Set(p.variants.map((v) => v.size))];
        const colors = [...new Set(p.variants.map((v) => v.color))];
        if (sizes.length > 0) setSelectedSize(sizes[0]!);
        if (colors.length > 0) setSelectedColor(colors[0]!);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [slug]);

  if (loading || !product) {
    return (
      <div className="py-20 text-center">
        <div className="inline-block w-8 h-8 border-2 border-brand border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const sizes = [...new Set(product.variants.map((v) => v.size))];
  const colors = [...new Set(product.variants.map((v) => v.color))];

  const selectedVariant = product.variants.find(
    (v) => v.size === selectedSize && v.color === selectedColor
  );

  const inStock = selectedVariant ? selectedVariant.stock_quantity > 0 : false;

  function handleAddToCart() {
    if (!selectedVariant || !inStock) return;
    cart.addItem({
      variantId: selectedVariant.id,
      productId: product!.id,
      productName: product!.name,
      variantSize: selectedVariant.size,
      variantColor: selectedVariant.color,
      unitPriceCents: selectedVariant.price_cents,
      imageUrl: product!.images[0]?.url ?? null,
    });
    setAdded(true);
    setTimeout(() => setAdded(false), 2000);
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 md:py-12">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-12">
        {/* Image gallery */}
        <div className="space-y-4">
          <div className="aspect-[3/4] bg-gray-100 rounded-xl overflow-hidden">
            {product.images.length > 0 ? (
              <img
                src={product.images[activeImage]?.url}
                alt={product.images[activeImage]?.alt_text || product.name}
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-gray-400">
                No image
              </div>
            )}
          </div>
          {product.images.length > 1 && (
            <div className="flex gap-2 overflow-x-auto">
              {product.images.map((img, idx) => (
                <button
                  key={img.id}
                  onClick={() => setActiveImage(idx)}
                  className={`w-16 h-16 rounded-lg overflow-hidden flex-shrink-0 border-2 transition-colors ${
                    idx === activeImage ? 'border-brand' : 'border-transparent'
                  }`}
                >
                  <img src={img.url} alt="" className="w-full h-full object-cover" />
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Product info */}
        <div className="flex flex-col">
          <h1 className="text-2xl md:text-3xl font-bold text-gray-900">{product.name}</h1>

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
            <p className="mt-4 text-gray-600 leading-relaxed">{product.description}</p>
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
              <h3 className="text-sm font-semibold text-gray-900 mb-2">Size</h3>
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
            {added ? '✓ Added to Cart' : inStock ? 'Add to Cart' : 'Sold Out'}
          </button>
        </div>
      </div>
    </div>
  );
}
