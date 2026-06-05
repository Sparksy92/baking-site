import type { Metadata } from 'next';
import { apiFetch, type ProductListItem, type Category } from '@/lib/api';
import { brandName, siteUrl } from '@/lib/format';

import { ProductCard } from '@/components/ProductCard';
import { JsonLd } from '@/components/JsonLd';
import { Pagination } from '@/components/Pagination';
import { SortSelect } from '@/components/SortSelect';
import { CheckCircle2, Compass, PackageCheck } from 'lucide-react';
import { brandConfig } from '@/config/brand.config';

export const revalidate = 3600;
export const dynamicParams = true;

export async function generateStaticParams() {
  try {
    const categories = await apiFetch<Category[]>('/api/categories');
    return categories.map((c) => ({ slug: c.slug }));
  } catch {
    return [];
  }
}

interface CategoryData {
  id: number;
  name: string;
  slug: string;
  description: string | null;
  image_url: string | null;
  meta_title: string | null;
  meta_description: string | null;
  intro_copy: string | null;
  noindex: boolean;
}

const PRODUCTS_PER_PAGE = 24;

interface Props {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ page?: string; sort?: string }>;
}

export async function generateMetadata({ params, searchParams }: Props): Promise<Metadata> {
  const { slug } = await params;
  const canonicalBase = `${siteUrl()}/categories/${slug}`;
  const fallbackName = slug.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
  try {
    const category = await apiFetch<CategoryData>(`/api/categories/${slug}`);
    const title = category.meta_title || category.name;
    const description = category.meta_description || `Shop ${category.name} at ${brandName()}.`;
    return {
      title,
      description,
      openGraph: {
        title,
        description,
        url: canonicalBase,
        ...(category.image_url ? { images: [{ url: category.image_url, alt: category.name }] } : {}),
      },
      alternates: { canonical: canonicalBase },
      ...(category.noindex ? { robots: { index: false, follow: true } } : {}),
    };
  } catch {
    return {
      title: fallbackName,
      description: `Shop ${fallbackName} at ${brandName()}.`,
      alternates: { canonical: canonicalBase },
    };
  }
}

export default async function CategoryPage({ params, searchParams }: Props) {
  const { slug } = await params;
  const sp = await searchParams;
  const page = Math.max(1, parseInt(sp.page || '1', 10) || 1);
  const sort = sp.sort || '';

  const sortParam = sort ? `&sort=${sort}` : '';
  const [category, data] = await Promise.all([
    apiFetch<CategoryData>(`/api/categories/${slug}`).catch(() => null),
    apiFetch<{ products: ProductListItem[]; total: number }>(
      `/api/products?category=${encodeURIComponent(slug)}&page=${page}&limit=${PRODUCTS_PER_PAGE}${sortParam}`
    ).catch(() => ({ products: [] as ProductListItem[], total: 0 })),
  ]);
  const name = category?.name ?? slug.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());

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
      <JsonLd data={{
        '@context': 'https://schema.org',
        '@type': 'CollectionPage',
        name,
        description: category?.meta_description || category?.description || undefined,
        url: `${siteUrl()}/categories/${slug}`,
      }} />
      {data.products.length > 0 && (
        <JsonLd data={{
          '@context': 'https://schema.org',
          '@type': 'ItemList',
          name,
          url: `${siteUrl()}/categories/${slug}`,
          numberOfItems: data.total,
          itemListElement: data.products.map((p, i) => ({
            '@type': 'ListItem',
            position: (page - 1) * PRODUCTS_PER_PAGE + i + 1,
            url: `${siteUrl()}/product/${p.slug}`,
            name: p.name,
          })),
        }} />
      )}

      <div className="relative overflow-hidden bg-warm border-b border-sand">
        <div className="absolute -left-24 top-10 h-72 w-72 rounded-full bg-sage/10 blur-3xl" aria-hidden="true" />
        <div className="absolute -right-24 bottom-0 h-80 w-80 rounded-full bg-terracotta/10 blur-3xl" aria-hidden="true" />
        <div className="grain" aria-hidden="true" />
        <div className="relative site-shell py-16 md:py-24">
          <div className="max-w-3xl">
            <p className="section-kicker mb-4">Curated Category</p>
            <h1 className="text-5xl md:text-7xl font-black text-earth leading-[0.9] tracking-[-0.03em]">{name}</h1>
            {(category?.intro_copy || category?.description || brandConfig.trustIndicators[0]?.description) && (
              <p className="mt-6 text-lg text-muted-earth max-w-2xl leading-relaxed">
                {category?.intro_copy || category?.description || brandConfig.trustIndicators[0]?.description}
              </p>
            )}
          </div>
          <div className="mt-10 grid gap-3 sm:grid-cols-3">
            {brandConfig.trustIndicators.slice(0, 3).map((item, i) => {
              const icons = [Compass, PackageCheck, CheckCircle2];
              const Icon = icons[i] || CheckCircle2;
              return { icon: Icon, label: item.label };
            }).map((item) => (
              <div key={item.label} className="flex items-center gap-3 rounded-2xl border border-sand bg-cream/70 px-4 py-3 text-sm font-bold text-earth shadow-earth-sm">
                <item.icon size={17} className="text-terracotta" aria-hidden="true" />
                {item.label}
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="site-shell py-8 md:py-12">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-warm p-4 rounded-3xl shadow-earth-sm border border-sand mb-8">
          <p className="text-sm text-muted-earth font-semibold">
            Showing <span className="text-earth font-bold">{data.total}</span> product{data.total !== 1 ? 's' : ''}
          </p>
          <div className="flex items-center gap-3">
            <span className="hidden sm:inline-flex rounded-full bg-cream px-4 py-2 text-xs font-black uppercase tracking-[0.16em] text-muted-earth border border-sand">
              {brandConfig.trustIndicators[1]?.label ?? brandConfig.metadata.tagline}
            </span>
            <SortSelect />
          </div>
        </div>

        {data.products.length === 0 ? (
          <div className="py-20 text-center bg-warm rounded-3xl border border-sand border-dashed px-6">
            <p className="section-kicker mb-3">Nothing here yet</p>
            <h2 className="text-3xl font-black text-earth">This rack is still being stocked.</h2>
            <p className="mt-3 text-muted-earth">Check back soon or browse the full collection for gear ready now.</p>
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
