import type { Metadata } from 'next';
import { apiFetch, type ProductListItem } from '@/lib/api';
import { brandName, siteUrl } from '@/lib/format';
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
  const name = slug.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
  return {
    title: name,
    description: `Shop ${name} at ${brandName()}.`,
    alternates: { canonical: `${siteUrl()}/categories/${slug}` },
  };
}

export default async function CategoryPage({ params, searchParams }: Props) {
  const { slug } = await params;
  const sp = await searchParams;
  const page = Math.max(1, parseInt(sp.page || '1', 10) || 1);
  const sort = sp.sort || '';
  const name = slug.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());

  const sortParam = sort ? `&sort=${sort}` : '';
  const data = await apiFetch<{ products: ProductListItem[]; total: number }>(
    `/api/products?category=${encodeURIComponent(slug)}&page=${page}&limit=${PRODUCTS_PER_PAGE}${sortParam}`
  ).catch(() => ({ products: [] as ProductListItem[], total: 0 }));

  const totalPages = Math.ceil(data.total / PRODUCTS_PER_PAGE);

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

      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">{name}</h1>
          <p className="mt-1 text-sm text-gray-400">{data.total} product{data.total !== 1 ? 's' : ''}</p>
        </div>
        <SortSelect />
      </div>

      {data.products.length === 0 ? (
        <p className="mt-8 text-gray-500">No products in this category yet.</p>
      ) : (
        <>
          <div className="mt-8 grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 md:gap-6">
            {data.products.map((product) => (
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
              return `/categories/${slug}${qs ? `?${qs}` : ''}`;
            }}
          />
        </>
      )}
    </div>
  );
}
