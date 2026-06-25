import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import Link from 'next/link';
import { getCategoryBySlug, getProducts } from '@/lib/db-service';
import { siteUrl } from '@/lib/format';
import { JsonLd } from '@/components/JsonLd';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface Props {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const category = await getCategoryBySlug(slug);
  if (!category) return {};

  const url = `${siteUrl()}/categories/${slug}`;
  return {
    title: `${category.name} | Sourdough, Pantry & Apothecary`,
    description: category.description || `Browse our selection of fresh and natural ${category.name} products.`,
    alternates: {
      canonical: url,
    },
  };
}

export default async function CategoryPage({ params }: Props) {
  const { slug } = await params;
  const category = await getCategoryBySlug(slug);
  if (!category) {
    notFound();
  }

  const { products } = await getProducts(slug);

  const breadcrumbList = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Home', item: siteUrl() },
      { '@type': 'ListItem', position: 2, name: 'Categories', item: `${siteUrl()}/categories` },
      { '@type': 'ListItem', position: 3, name: category.name, item: `${siteUrl()}/categories/${slug}` },
    ],
  };

  const collectionPage = {
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    name: category.name,
    description: category.description || `Collection of ${category.name}`,
    url: `${siteUrl()}/categories/${slug}`,
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      <JsonLd data={breadcrumbList as any} />
      <JsonLd data={collectionPage as any} />

      <header className="mb-12 border-b border-[var(--brand-border)] pb-8">
        <div className="text-sm font-semibold tracking-wider text-[var(--brand-accent)] uppercase mb-2">
          Category Collection
        </div>
        <h1 className="text-4xl sm:text-5xl font-serif font-bold text-[var(--brand-text)]">
          {category.name}
        </h1>
        {category.description && (
          <p className="mt-4 text-lg text-[var(--brand-text-muted)] max-w-3xl leading-relaxed">
            {category.description}
          </p>
        )}
      </header>

      {products.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-2xl border border-[var(--brand-border)]">
          <p className="text-[var(--brand-text-muted)]">No items available in this category currently.</p>
          <Link href="/shop" className="mt-4 inline-block font-semibold text-[var(--brand-primary)] hover:underline">
            Browse all items
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8">
          {products.map((product) => (
            <Link
              key={product.slug}
              href={`/product/${product.slug}`}
              className="group flex flex-col bg-white rounded-2xl border border-[var(--brand-border)] overflow-hidden hover:shadow-xl hover:shadow-gray-100 transition-all active:scale-[0.99] duration-300"
            >
              {product.image_url ? (
                <div className="aspect-square relative bg-gray-50 overflow-hidden">
                  <img
                    src={product.image_url}
                    alt={product.name}
                    className="w-full h-full object-cover object-center group-hover:scale-105 transition-transform duration-500"
                  />
                </div>
              ) : (
                <div className="aspect-square bg-gray-50 flex items-center justify-center text-[var(--brand-text-muted)]">
                  No Image Available
                </div>
              )}
              <div className="p-6 flex-1 flex flex-col justify-between">
                <div>
                  <h2 className="text-xl font-serif font-semibold text-[var(--brand-text)] group-hover:text-[var(--brand-primary)] transition-colors">
                    {product.name}
                  </h2>
                  {product.description && (
                    <p className="mt-2 text-sm text-[var(--brand-text-muted)] line-clamp-2 leading-relaxed">
                      {product.description}
                    </p>
                  )}
                </div>
                <div className="mt-6 flex items-center justify-between pt-4 border-t border-[var(--brand-border)]/50">
                  <span className="text-lg font-bold text-[var(--brand-primary)]">
                    {product.is_quote_only ? 'Custom Quote' : `$${(product.min_price_cents! / 100).toFixed(2)}`}
                  </span>
                  <span className="text-sm font-medium text-[var(--brand-accent)]">
                    View details →
                  </span>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
