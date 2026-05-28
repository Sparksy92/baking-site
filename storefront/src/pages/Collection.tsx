import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { api, type ProductListItem } from '../lib/api';
import { formatCents } from '../lib/format';
import { useDocumentTitle } from '../lib/seo';

export default function CollectionPage() {
  const { slug } = useParams<{ slug: string }>();
  const [products, setProducts] = useState<ProductListItem[]>([]);
  const [collection, setCollection] = useState<{ name: string; description: string | null } | null>(null);
  const [loading, setLoading] = useState(true);
  useDocumentTitle(collection?.name || slug);

  useEffect(() => {
    if (!slug) return;
    async function load() {
      try {
        const [colData, prodData] = await Promise.all([
          api.get<{ name: string; description: string | null }>(`/api/collections/${slug}`),
          api.get<{ products: ProductListItem[] }>(`/api/products?collection=${slug}`),
        ]);
        setCollection(colData);
        setProducts(prodData.products);
      } catch (e) {
        console.error('Failed to load collection', e);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [slug]);

  if (loading) {
    return (
      <div className="py-20 text-center">
        <div className="inline-block w-8 h-8 border-2 border-brand border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 md:py-12">
      <h1 className="text-3xl font-bold text-gray-900">{collection?.name || slug}</h1>
      {collection?.description && (
        <p className="mt-2 text-gray-600 max-w-2xl">{collection.description}</p>
      )}

      {products.length === 0 ? (
        <p className="mt-8 text-gray-500">No products in this collection yet.</p>
      ) : (
        <div className="mt-8 grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 md:gap-6">
          {products.map((product) => (
            <Link key={product.id} to={`/product/${product.slug}`} className="group">
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
                {product.total_stock === 0 && (
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
                  {formatCents(product.min_price_cents ?? 0)}
                </p>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
