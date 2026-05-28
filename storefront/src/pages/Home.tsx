import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api, type ProductListItem, type Collection } from '../lib/api';
import { formatCents } from '../lib/format';

export default function Home() {
  const [featured, setFeatured] = useState<ProductListItem[]>([]);
  const [collections, setCollections] = useState<Collection[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const [prodData, colData] = await Promise.all([
          api.get<{ products: ProductListItem[] }>('/api/products?featured=true&limit=8'),
          api.get<Collection[]>('/api/collections'),
        ]);
        setFeatured(prodData.products);
        setCollections(colData);
      } catch (e) {
        console.error('Failed to load homepage', e);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  if (loading) {
    return (
      <div className="py-20 text-center">
        <div className="inline-block w-8 h-8 border-2 border-brand border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div>
      {/* Hero */}
      <section className="bg-brand text-white py-16 md:py-24">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h1 className="text-4xl md:text-6xl font-black tracking-tight">
            Culture. Worn Daily.
          </h1>
          <p className="mt-4 text-lg md:text-xl text-white/80 max-w-2xl mx-auto">
            Indigenous streetwear that tells our stories.
          </p>
          <Link
            to="/collections/new-arrivals"
            className="inline-block mt-8 px-8 py-3 bg-white text-brand font-bold rounded-lg hover:bg-gray-100 transition-colors"
          >
            Shop New Arrivals
          </Link>
        </div>
      </section>

      {/* Collections */}
      {collections.length > 0 && (
        <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 md:py-16">
          <h2 className="text-2xl font-bold text-gray-900 mb-6">Collections</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {collections.map((col) => (
              <Link
                key={col.id}
                to={`/collections/${col.slug}`}
                className="group relative overflow-hidden rounded-xl bg-gray-100 aspect-[4/3] flex items-end"
              >
                {col.image_url && (
                  <img
                    src={col.image_url}
                    alt={col.name}
                    className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                  />
                )}
                <div className="relative z-10 w-full p-6 bg-gradient-to-t from-black/70 to-transparent">
                  <h3 className="text-white font-bold text-lg">{col.name}</h3>
                  <p className="text-white/70 text-sm">{col.product_count} products</p>
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* Featured Products */}
      {featured.length > 0 && (
        <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 md:py-16">
          <h2 className="text-2xl font-bold text-gray-900 mb-6">Featured</h2>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 md:gap-6">
            {featured.map((product) => (
              <ProductCard key={product.id} product={product} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

function ProductCard({ product }: { product: ProductListItem }) {
  const soldOut = product.total_stock === 0;

  return (
    <Link to={`/product/${product.slug}`} className="group">
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
