import { ImageResponse } from 'next/og';
import { apiFetch, type Product } from '@/lib/api';
import { brandName } from '@/lib/format';

export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';
export const alt = 'Product image';

export default async function OgImage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  let product: Product;
  try {
    product = await apiFetch<Product>(`/api/products/${slug}`);
  } catch {
    return new ImageResponse(
      <div style={{ display: 'flex', width: '100%', height: '100%', alignItems: 'center', justifyContent: 'center', background: '#1a1a1a', color: '#fff', fontSize: 48 }}>
        {brandName()}
      </div>,
      { ...size }
    );
  }

  const image = product.images[0]?.url;
  const price = product.variants[0]?.price_cents;

  return new ImageResponse(
    <div style={{ display: 'flex', width: '100%', height: '100%', background: '#ffffff' }}>
      {image && (
        <div style={{ display: 'flex', width: '50%', height: '100%' }}>
          <img src={image} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        </div>
      )}
      <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', padding: '60px', flex: 1 }}>
        <div style={{ fontSize: 20, color: '#666', marginBottom: 12 }}>{brandName()}</div>
        <div style={{ fontSize: 48, fontWeight: 700, color: '#1a1a1a', lineHeight: 1.2 }}>{product.name}</div>
        {price && (
          <div style={{ fontSize: 32, fontWeight: 600, color: '#C53030', marginTop: 24 }}>
            ${(price / 100).toFixed(2)} CAD
          </div>
        )}
      </div>
    </div>,
    { ...size }
  );
}
