import type { Metadata } from 'next';
import { apiFetch, type ProductListItem } from '@/lib/api';
import { brandName, siteUrl } from '@/lib/format';
import { ProductCard } from '@/components/ProductCard';
import { JsonLd } from '@/components/JsonLd';

interface Props {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const name = slug.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
  return {
    title: name,
    description: `Shop ${name} at ${brandName()}.`,
    alternates: { canonical: `${siteUrl()}/categories/${slug}` },
  };
}

export default async function CategoryPage({ params }: Props) {
  const { slug } = await params;
  const name = slug.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());

  const data = await apiFetch<{ products: ProductListItem[] }>(
    `/api/products?category=${encodeURIComponent(slug)}&limit=100`
  ).catch(() => ({ products: [] }));

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 md:py-12">
      <JsonLd data={{
        '@context': 'https://schema.org',
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'Home', item: siteUrl() },
          { '@type': 'ListItem', position: 2, name: 'Categories', item: `${siteUrl()}/categories` },
          { '@type': 'ListItem', position: 3, name, item: `${siteUrl()}/categories/${slug}` },
        ],
      }} />

      <h1 className="text-3xl font-bold text-gray-900">{name}</h1>

      {data.products.length === 0 ? (
        <p className="mt-8 text-gray-500">No products in this category yet.</p>
      ) : (
        <div className="mt-8 grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 md:gap-6">
          {data.products.map((product) => (
            <ProductCard key={product.id} product={product} />
          ))}
        </div>
      )}
    </div>
  );
}
