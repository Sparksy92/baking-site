import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { apiFetch, type ProductListItem, type Collection } from '@/lib/api';
import { brandName, siteUrl } from '@/lib/format';
import { ProductCard } from '@/components/ProductCard';
import { JsonLd } from '@/components/JsonLd';
import { Pagination } from '@/components/Pagination';
import { SortSelect } from '@/components/SortSelect';
import { SlidersHorizontal } from 'lucide-react';

export const revalidate = 3600;
export const dynamicParams = true;

export async function generateStaticParams() {
  try {
    const collections = await apiFetch<Collection[]>('/api/collections');
    return collections.map((c) => ({ slug: c.slug }));
  } catch {
    return [];
  }
}

const PRODUCTS_PER_PAGE = 24;

interface Props {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ page?: string; sort?: string }>;
}

export async function generateMetadata({ params, searchParams }: Props): Promise<Metadata> {
  const { slug } = await params;
  const sp = await searchParams;
  const page = Math.max(1, parseInt(sp.page || '1', 10) || 1);
  try {
    const collection = await apiFetch<Collection>(`/api/collections/${slug}`);
    const url = `${siteUrl()}/collections/${slug}`;
    const title = collection.meta_title || collection.name;
    const description = collection.meta_description || collection.description || `Shop ${collection.name} from ${brandName()}`;
    return {
      title,
      description,
      openGraph: {
        title,
        description,
        url,
        images: collection.image_url ? [{ url: collection.image_url, alt: collection.name }] : [],
      },
      alternates: { canonical: page > 1 ? `${siteUrl()}/collections/${slug}` : url },
      ...(collection.noindex ? { robots: { index: false, follow: true } } : {}),
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
    <div className="min-h-screen bg-gray-50/30 pb-20">
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
      {products.length > 0 && (
        <JsonLd data={{
          '@context': 'https://schema.org',
          '@type': 'ItemList',
          name: collection.name,
          url: `${siteUrl()}/collections/${slug}`,
          numberOfItems: total,
          itemListElement: products.map((p, i) => ({
            '@type': 'ListItem',
            position: (page - 1) * PRODUCTS_PER_PAGE + i + 1,
            url: `${siteUrl()}/product/${p.slug}`,
            name: p.name,
          })),
        }} />
      )}

      {/* Hero Section */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 md:py-24 flex flex-col items-center text-center">
          <h1 className="text-4xl md:text-5xl font-extrabold text-gray-900 tracking-tight mb-4">{collection.name}</h1>
          {collection.description && (
            <p className="mt-2 text-lg text-gray-600 max-w-2xl">{collection.description}</p>
          )}
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 md:py-12">
        {/* Toolbar */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-4 rounded-2xl shadow-sm border border-gray-100 mb-8">
          <p className="text-sm text-gray-600 font-medium">
            Showing <span className="text-gray-900 font-bold">{total}</span> product{total !== 1 ? 's' : ''}
          </p>
          <div className="flex items-center gap-3">
            <button className="flex items-center gap-2 px-4 py-2 bg-gray-50 hover:bg-gray-100 text-gray-700 rounded-xl text-sm font-medium border border-gray-200 transition-colors">
              <SlidersHorizontal size={16} /> Filters
            </button>
            <div className="h-6 w-[1px] bg-gray-200"></div>
            <SortSelect />
          </div>
        </div>

        {/* Product Grid */}
        {products.length === 0 ? (
          <div className="py-20 text-center bg-white rounded-3xl border border-gray-100 border-dashed">
            <p className="text-gray-500 text-lg">No products found in this collection.</p>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 md:gap-6 lg:gap-8">
              {products.map((product) => (
                <ProductCard key={product.id} product={product} />
              ))}
            </div>
            
            <div className="mt-12 flex justify-center">
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
            </div>
          </>
        )}
      </div>
    </div>
  );
}
