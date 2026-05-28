import { ImageResponse } from 'next/og';
import { apiFetch, type Collection } from '@/lib/api';
import { brandName } from '@/lib/format';

export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';
export const alt = 'Collection image';

export default async function OgImage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  let collection: Collection;
  try {
    collection = await apiFetch<Collection>(`/api/collections/${slug}`);
  } catch {
    return new ImageResponse(
      <div style={{ display: 'flex', width: '100%', height: '100%', alignItems: 'center', justifyContent: 'center', background: '#1a1a1a', color: '#fff', fontSize: 48 }}>
        {brandName()}
      </div>,
      { ...size }
    );
  }

  return new ImageResponse(
    <div style={{ display: 'flex', width: '100%', height: '100%', background: '#1a1a1a', alignItems: 'center', justifyContent: 'center', flexDirection: 'column' }}>
      <div style={{ fontSize: 20, color: '#999', marginBottom: 16 }}>{brandName()}</div>
      <div style={{ fontSize: 56, fontWeight: 700, color: '#ffffff' }}>{collection.name}</div>
      {collection.description && (
        <div style={{ fontSize: 24, color: '#ccc', marginTop: 16, maxWidth: '80%', textAlign: 'center' }}>
          {collection.description}
        </div>
      )}
    </div>,
    { ...size }
  );
}
