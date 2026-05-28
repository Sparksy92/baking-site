import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { apiFetch, type Product } from '@/lib/api';
import { formatCents, brandName, siteUrl } from '@/lib/format';
import { JsonLd } from '@/components/JsonLd';
import { ProductInteractive } from './ProductInteractive';

interface Props {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  try {
    const product = await apiFetch<Product>(`/api/products/${slug}`);
    const price = product.variants[0]?.price_cents;
    const image = product.images[0]?.url;
    const url = `${siteUrl()}/product/${slug}`;

    return {
      title: product.name,
      description: product.description || `Shop ${product.name} from ${brandName()}`,
      openGraph: {
        title: product.name,
        description: product.description || `Shop ${product.name}`,
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

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-12">
        {/* Image gallery — server rendered for SEO */}
        <div className="space-y-4">
          <div className="aspect-[3/4] bg-gray-100 rounded-xl overflow-hidden">
            {image ? (
              <img
                src={image}
                alt={product.images[0]?.alt_text || product.name}
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-gray-400">
                No image
              </div>
            )}
          </div>
        </div>

        {/* Interactive product info — client component */}
        <ProductInteractive product={product} />
      </div>
    </div>
  );
}
