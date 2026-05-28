import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { apiFetch, type ProductListItem, type Collection } from '@/lib/api';
import { formatCents, brandName, siteUrl } from '@/lib/format';
import { ProductCard } from '@/components/ProductCard';
import { JsonLd } from '@/components/JsonLd';

interface Props {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  try {
    const collection = await apiFetch<Collection>(`/api/collections/${slug}`);
    const url = `${siteUrl()}/collections/${slug}`;
    return {
      title: collection.name,
      description: collection.description || `Shop ${collection.name} from ${brandName()}`,
      openGraph: {
        title: collection.name,
        description: collection.description || `Shop ${collection.name}`,
        url,
        images: collection.image_url ? [{ url: collection.image_url, alt: collection.name }] : [],
      },
      alternates: { canonical: url },
    };
  } catch {
    return { title: 'Collection Not Found' };
  }
}

export default async function CollectionPage({ params }: Props) {
  const { slug } = await params;
  let collection: Collection;
  let products: ProductListItem[] = [];

  try {
    const [colData, prodData] = await Promise.all([
      apiFetch<Collection>(`/api/collections/${slug}`),
      apiFetch<{ products: ProductListItem[] }>(`/api/products?collection=${slug}`),
    ]);
    collection = colData;
    products = prodData.products;
  } catch {
    notFound();
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 md:py-12">
      <JsonLd data={{
        '@context': 'https://schema.org',
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'Home', item: siteUrl() },
          { '@type': 'ListItem', position: 2, name: collection.name, item: `${siteUrl()}/collections/${slug}` },
        ],
      }} />
      <JsonLd data={{
        '@context': 'https://schema.org',
        '@type': 'CollectionPage',
        name: collection.name,
        description: collection.description,
        url: `${siteUrl()}/collections/${slug}`,
      }} />

      <h1 className="text-3xl font-bold text-gray-900">{collection.name}</h1>
      {collection.description && (
        <p className="mt-2 text-gray-600 max-w-2xl">{collection.description}</p>
      )}

      {products.length === 0 ? (
        <p className="mt-8 text-gray-500">No products in this collection yet.</p>
      ) : (
        <div className="mt-8 grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 md:gap-6">
          {products.map((product) => (
            <ProductCard key={product.id} product={product} />
          ))}
        </div>
      )}
    </div>
  );
}
