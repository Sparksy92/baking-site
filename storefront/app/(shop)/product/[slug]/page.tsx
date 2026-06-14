import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { apiFetch } from '@/lib/api-server';
import { type Product, type ProductListItem } from '@/lib/api';
import { brandName, siteUrl } from '@/lib/format';
import { brandConfig } from '@/config/brand.config';
import { JsonLd } from '@/components/JsonLd';
import { ProductCard } from '@/components/ProductCard';
import { RecentlyViewed } from '@/components/RecentlyViewed';
import { ProductInteractive } from './ProductInteractive';
import { ProductReviews } from '@/components/product/ProductReviews';

export const revalidate = 3600; // re-generate at most once per hour
export const dynamicParams = true; // new products added after build still work

export async function generateStaticParams() {
  try {
    const data = await apiFetch<{ products: ProductListItem[] }>('/api/products?limit=200');
    return data.products.map((p) => ({ slug: p.slug }));
  } catch {
    return [];
  }
}

interface Props {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  try {
    const product = await apiFetch<Product>(`/api/products/${slug}`);
    const image = product.og_image_url || product.images[0]?.url;
    const defaultUrl = `${siteUrl()}/product/${slug}`;
    const canonicalUrl = product.canonical_url || defaultUrl;
    const title = product.meta_title || product.name;
    const description = product.meta_description || product.description || `Shop ${product.name} from ${brandName()}`;

    return {
      title,
      description,
      openGraph: {
        title,
        description,
        url: canonicalUrl,
        type: 'website' as const, // og:type 'product' is not a valid Next.js OpenGraph type literal; 'website' is correct here — the Product schema handles the product signal
        images: image ? [{ url: image, alt: product.name }] : [],
      },
      alternates: { canonical: canonicalUrl },
      ...(product.noindex ? { robots: { index: false, follow: true } } : {}),
    };
  } catch {
    return { title: 'Product Not Found' };
  }
}

export default async function ProductPage({ params }: Props) {
  const { slug } = await params;
  let product: Product;
  try {
    product = await apiFetch<Product>(`/api/products/${slug}`);
  } catch {
    notFound();
  }

  return (
    <div className="bg-cream">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 md:py-16">
      <JsonLd data={{
        '@context': 'https://schema.org',
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'Home', item: siteUrl() },
          { '@type': 'ListItem', position: 2, name: product.name, item: `${siteUrl()}/product/${slug}` },
        ],
      }} />
      <JsonLd data={{
        '@context': 'https://schema.org',
        '@type': 'Product',
        name: product.name,
        description: product.description,
        image: product.images.map((img) => img.url),
        brand: { '@type': 'Brand', name: brandName() },
        url: `${siteUrl()}/product/${slug}`,
        offers: product.variants.map((v) => ({
          '@type': 'Offer',
          price: (v.price_cents / 100).toFixed(2),
          priceCurrency: brandConfig.seo.currency,
          availability: v.stock_quantity > 0
            ? 'https://schema.org/InStock'
            : 'https://schema.org/OutOfStock',
          sku: v.sku || undefined,
          itemCondition: 'https://schema.org/NewCondition',
        })),
      }} />

        <ProductInteractive product={product} />

        <div className="mt-16">
          <ProductReviews productId={product.id} />
        </div>

        <RelatedProducts categorySlug={product.category?.slug ?? null} currentSlug={slug} />
        <RecentlyViewed excludeId={product.id} title="Recently Viewed" />
      </div>
    </div>
  );
}

async function RelatedProducts({ categorySlug, currentSlug }: { categorySlug: string | null; currentSlug: string }) {
  if (!categorySlug) return null;

  try {
    const data = await apiFetch<{ products: ProductListItem[] }>(
      `/api/products?category=${encodeURIComponent(categorySlug)}&limit=5`
    );
    const related = data.products.filter((p) => p.slug !== currentSlug).slice(0, 4);
    if (related.length === 0) return null;

    return (
      <section className="mt-20 border-t border-sand pt-12">
        <p className="text-terracotta font-semibold tracking-widest uppercase text-xs mb-2">Keep Exploring</p>
        <h2 className="text-3xl md:text-4xl font-bold text-earth mb-8">You Might Also Like</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-5 md:gap-8">
          {related.map((product) => (
            <ProductCard key={product.id} product={product} />
          ))}
        </div>
      </section>
    );
  } catch {
    return null;
  }
}
