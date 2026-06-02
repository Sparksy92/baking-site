import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { apiFetch, type Product, type ProductListItem } from '@/lib/api';
import { formatCents, brandName, siteUrl } from '@/lib/format';
import { JsonLd } from '@/components/JsonLd';
import { ProductCard } from '@/components/ProductCard';
import { ProductInteractive } from './ProductInteractive';
import { ProductReviews } from '@/components/product/ProductReviews';

interface Props {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  try {
    const product = await apiFetch<Product>(`/api/products/${slug}`);
    const image = product.images[0]?.url;
    const url = `${siteUrl()}/product/${slug}`;
    const title = product.meta_title || product.name;
    const description = product.meta_description || product.description || `Shop ${product.name} from ${brandName()}`;

    return {
      title,
      description,
      openGraph: {
        title,
        description,
        url,
        type: 'website',
        images: image ? [{ url: image, alt: product.name }] : [],
      },
      alternates: { canonical: url },
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

  const minPrice = Math.min(...product.variants.map((v) => v.price_cents));
  const maxPrice = Math.max(...product.variants.map((v) => v.price_cents));
  const inStock = product.variants.some((v) => v.stock_quantity > 0);
  const image = product.images[0]?.url;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 md:py-12">
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
          priceCurrency: 'CAD',
          availability: v.stock_quantity > 0
            ? 'https://schema.org/InStock'
            : 'https://schema.org/OutOfStock',
          sku: v.sku || undefined,
          itemCondition: 'https://schema.org/NewCondition',
        })),
      }} />

      <ProductInteractive product={product} />

      {/* Reviews section */}
      <ProductReviews productId={product.id} />

      {/* Related products */}
      <RelatedProducts categorySlug={product.category?.slug ?? null} currentSlug={slug} />
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
      <section className="mt-16 border-t border-gray-100 pt-12">
        <h2 className="text-2xl font-bold text-gray-900 mb-6">You Might Also Like</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-6">
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
