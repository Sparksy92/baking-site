import Link from 'next/link';
import { apiFetch, type ProductListItem, type Collection } from '@/lib/api';
import { formatCents } from '@/lib/format';
import { ProductCard } from '@/components/ProductCard';
import { JsonLd } from '@/components/JsonLd';
import { brandName, brandTagline, siteUrl } from '@/lib/format';

export default async function Home() {
  const [prodData, collections] = await Promise.all([
    apiFetch<{ products: ProductListItem[] }>('/api/products?featured=true&limit=8').catch(() => ({ products: [] })),
    apiFetch<Collection[]>('/api/collections').catch(() => []),
  ]);
  const featured = prodData.products;

  return (
    <div>
      <JsonLd data={{
        '@context': 'https://schema.org',
        '@type': 'Organization',
        name: brandName(),
        description: brandTagline(),
        url: siteUrl(),
      }} />

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
            href="/collections/new-arrivals"
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
                href={`/collections/${col.slug}`}
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
