import type { Metadata } from 'next';
import { apiFetch, type ProductListItem } from '@/lib/api';
import { brandName, siteUrl } from '@/lib/format';
import { ProductCard } from '@/components/ProductCard';
import { JsonLd } from '@/components/JsonLd';
import { Pagination } from '@/components/Pagination';
import { SortSelect } from '@/components/SortSelect';
import { SlidersHorizontal } from 'lucide-react';

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
    <div className="min-h-screen bg-cream pb-20">
      <JsonLd data={{
        '@context': 'https://schema.org',
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'Home', item: siteUrl() },
          { '@type': 'ListItem', position: 2, name: 'Categories', item: `${siteUrl()}/categories` },
          { '@type': 'ListItem', position: 3, name, item: `${siteUrl()}/categories/${slug}` },
        ],
      }} />

      {/* Hero Section */}
      <div className="bg-warm border-b border-sand">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 md:py-24 flex flex-col items-center text-center">
          <p className="text-terracotta font-semibold tracking-widest uppercase text-xs mb-3">Curated Category</p>
          <h1 className="text-4xl md:text-6xl font-black text-earth tracking-tight mb-4">{name}</h1>
          <p className="mt-2 text-lg text-muted-earth max-w-2xl">Explore our hand-picked selection of {name.toLowerCase()}.</p>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 md:py-12">
        {/* Toolbar */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-warm p-4 rounded-2xl shadow-earth-sm border border-sand mb-8">
          <p className="text-sm text-muted-earth font-semibold">
            Showing <span className="text-earth font-bold">{data.total}</span> product{data.total !== 1 ? 's' : ''}
          </p>
          <div className="flex items-center gap-3">
            <button className="flex items-center gap-2 px-4 py-2 bg-cream hover:bg-sand/60 text-earth rounded-xl text-sm font-semibold border border-sand transition-colors">
              <SlidersHorizontal size={16} /> Filters
            </button>
            <div className="h-6 w-[1px] bg-sand"></div>
            <SortSelect />
          </div>
        </div>

        {/* Product Grid */}
        {data.products.length === 0 ? (
          <div className="py-20 text-center bg-warm rounded-3xl border border-sand border-dashed">
            <p className="text-muted-earth text-lg">No products found in this category.</p>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 md:gap-6 lg:gap-8">
              {data.products.map((product) => (
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
                  return `/categories/${slug}${qs ? `?${qs}` : ''}`;
                }}
              />
            </div>
          </>
        )}
      </div>
    </div>
  );
}
