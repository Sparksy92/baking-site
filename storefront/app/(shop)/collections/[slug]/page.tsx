import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { apiFetch, type ProductListItem, type Collection } from '@/lib/api';
import { formatCents, brandName, siteUrl } from '@/lib/format';
import { ProductCard } from '@/components/ProductCard';
import { JsonLd } from '@/components/JsonLd';
import { Pagination } from '@/components/Pagination';
import { SortSelect } from '@/components/SortSelect';

const PRODUCTS_PER_PAGE = 24;

interface Props {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ page?: string; sort?: string }>;
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

export default async function CollectionPage({ params, searchParams }: Props) {
  const { slug } = await params;
  const sp = await searchParams;
  const page = Math.max(1, parseInt(sp.page || '1', 10) || 1);
  const sort = sp.sort || '';

  let collection: Collection;
  let products: ProductListItem[] = [];
  let total = 0;

  try {
    const sortParam = sort ? `&sort=${sort}` : '';
    const [colData, prodData] = await Promise.all([
      apiFetch<Collection>(`/api/collections/${slug}`),
      apiFetch<{ products: ProductListItem[]; total: number }>(`/api/products?collection=${slug}&page=${page}&limit=${PRODUCTS_PER_PAGE}${sortParam}`),
    ]);
    collection = colData;
    products = prodData.products;
    total = prodData.total;
  } catch {
    notFound();
  }

  const totalPages = Math.ceil(total / PRODUCTS_PER_PAGE);

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

      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">{collection.name}</h1>
          {collection.description && (
            <p className="mt-2 text-gray-600 max-w-2xl">{collection.description}</p>
          )}
          <p className="mt-1 text-sm text-gray-400">{total} product{total !== 1 ? 's' : ''}</p>
        </div>
        <SortSelect />
      </div>

      {products.length === 0 ? (
        <p className="mt-8 text-gray-500">No products in this collection yet.</p>
      ) : (
        <>
          <div className="mt-8 grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 md:gap-6">
            {products.map((product) => (
              <ProductCard key={product.id} product={product} />
            ))}
          </div>
          <Pagination
            currentPage={page}
            totalPages={totalPages}
            buildHref={(p) => {
              const params = new URLSearchParams();
              if (p > 1) params.set('page', String(p));
              if (sort) params.set('sort', sort);
              const qs = params.toString();
              return `/collections/${slug}${qs ? `?${qs}` : ''}`;
            }}
          />
        </>
      )}
    </div>
  );
}
