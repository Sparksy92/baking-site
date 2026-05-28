import type { MetadataRoute } from 'next';
import { apiFetch, type ProductListItem, type Collection } from '@/lib/api';
import { siteUrl } from '@/lib/format';

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = siteUrl();
  const entries: MetadataRoute.Sitemap = [
    { url: base, lastModified: new Date(), changeFrequency: 'daily', priority: 1.0 },
    { url: `${base}/search`, changeFrequency: 'weekly', priority: 0.3 },
    { url: `${base}/order-lookup`, changeFrequency: 'monthly', priority: 0.2 },
  ];

  try {
    const collections = await apiFetch<Collection[]>('/api/collections');
    for (const col of collections) {
      entries.push({
        url: `${base}/collections/${col.slug}`,
        changeFrequency: 'weekly',
        priority: 0.8,
      });
    }
  } catch { /* API unavailable at build time — skip */ }

  try {
    const data = await apiFetch<{ products: ProductListItem[] }>('/api/products?limit=1000');
    for (const p of data.products) {
      entries.push({
        url: `${base}/product/${p.slug}`,
        changeFrequency: 'weekly',
        priority: 0.9,
      });
    }
  } catch { /* API unavailable at build time — skip */ }

  return entries;
}
