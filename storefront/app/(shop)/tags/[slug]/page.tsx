import type { Metadata } from 'next';
import { Suspense } from 'react';
import { apiFetch, type ProductListItem } from '@/lib/api';
import { brandName, siteUrl } from '@/lib/format';
import { JsonLd } from '@/components/JsonLd';
import { ProductCard } from '@/components/ProductCard';
import { Pagination } from '@/components/Pagination';
import { SortSelect } from '@/components/SortSelect';
import { Compass, Tag } from 'lucide-react';

export const dynamic = 'force-dynamic';

const PRODUCTS_PER_PAGE = 24;

interface Props {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ page?: string; sort?: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const name = slug.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
  const canonicalBase = `${siteUrl()}/tags/${slug}`;
  return {
    title: `${name} Products`,
    description: `Shop ${name} products at ${brandName()}.`,
    alternates: { canonical: canonicalBase },
  };
}

export default async function TagPage({ params, searchParams }: Props) {
  const { slug } = await params;
  const sp = await searchParams;
  const page = Math.max(1, parseInt(sp.page || '1', 10) || 1);
  const sort = sp.sort || '';
  const name = slug.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());

  const sortParam = sort ? `&sort=${sort}` : '';
  const data = await apiFetch<{ products: ProductListItem[]; total: number }>(
    `/api/products?tag=${encodeURIComponent(slug)}&page=${page}&limit=${PRODUCTS_PER_PAGE}${sortParam}`
  ).catch(() => ({ products: [] as ProductListItem[], total: 0 }));

  const totalPages = Math.ceil(data.total / PRODUCTS_PER_PAGE);

  return (
    <div className="min-h-screen bg-cream pb-20">
      <JsonLd data={{
        '@context': 'https://schema.org',
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'Home', item: siteUrl() },
          { '@type': 'ListItem', position: 2, name: name, item: `${siteUrl()}/tags/${slug}` },
        ],
      }} />
      <div className="relative overflow-hidden bg-warm border-b border-sand">
        <div className="absolute -left-24 top-0 h-72 w-72 rounded-full bg-sage/10 blur-3xl" aria-hidden="true" />
        <div className="absolute -right-20 bottom-0 h-80 w-80 rounded-full bg-terracotta/10 blur-3xl" aria-hidden="true" />
        <div className="grain" aria-hidden="true" />
        <div className="relative site-shell py-16 md:py-24 flex flex-col items-center text-center">
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-cream border border-sand rounded-full text-sm font-bold text-terracotta mb-5 shadow-earth-sm">
            <Tag size={14} /> Tag
          </div>
          <h1 className="text-5xl md:text-7xl font-black text-earth tracking-[-0.03em] leading-[0.9]">{name}</h1>
          <p className="mt-6 text-lg text-muted-earth max-w-2xl leading-relaxed">
            Shop {name} products at {brandName()}.
          </p>
        </div>
      </div>

      <div className="site-shell py-8 md:py-12">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-warm p-4 rounded-3xl shadow-earth-sm border border-sand mb-8">
          <p className="text-sm text-muted-earth font-semibold">
            <span className="text-earth font-bold">{data.total}</span> product{data.total !== 1 ? 's' : ''}
          </p>
          <div className="flex items-center gap-3">
            <span className="hidden sm:inline-flex items-center gap-2 rounded-full bg-cream px-4 py-2 text-xs font-black uppercase tracking-[0.16em] text-muted-earth border border-sand">
              <Compass size={13} className="text-terracotta" aria-hidden="true" />
              {name}
            </span>
            <Suspense>
              <SortSelect />
            </Suspense>
          </div>
        </div>

        {data.products.length > 0 && (
          <JsonLd data={{
            '@context': 'https://schema.org',
            '@type': 'ItemList',
            name: `${name} Products`,
            itemListElement: data.products.map((p, i) => ({
              '@type': 'ListItem',
              position: i + 1,
              url: `${siteUrl()}/product/${p.slug}`,
              name: p.name,
            })),
          }} />
        )}
        {data.products.length === 0 ? (
          <div className="py-20 text-center bg-warm rounded-3xl border border-sand border-dashed px-6">
            <p className="section-kicker mb-3">No matches</p>
            <h2 className="text-3xl font-black text-earth">Nothing is tagged here yet.</h2>
            <p className="mt-3 text-muted-earth">Try another field note or browse the full shop.</p>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 md:gap-6 lg:gap-8">
              {data.products.map((product) => (
                <ProductCard key={product.id} product={product} />
              ))}
            </div>

            {totalPages > 1 && (
              <div className="mt-12 flex justify-center">
                <Pagination
                  currentPage={page}
                  totalPages={totalPages}
                  buildHref={(p) => {
                    const params = new URLSearchParams();
                    if (p > 1) params.set('page', String(p));
                    if (sort) params.set('sort', sort);
                    const qs = params.toString();
                    return `/tags/${slug}${qs ? `?${qs}` : ''}`;
                  }}
                />
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
