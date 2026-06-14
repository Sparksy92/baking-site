import type { MetadataRoute } from 'next';
import { apiFetch } from '@/lib/api-server';
import { type ProductListItem, type Collection } from '@/lib/api';
import { siteUrl } from '@/lib/format';

interface CategoryItem { slug: string; }
interface BlogPost { slug: string; published_at: string | null; }

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = siteUrl();
  const entries: MetadataRoute.Sitemap = [
    { url: base, lastModified: new Date(), changeFrequency: 'daily', priority: 1.0 },
    { url: `${base}/about`, changeFrequency: 'monthly', priority: 0.6 },
    { url: `${base}/categories`, changeFrequency: 'weekly', priority: 0.7 },
    { url: `${base}/contact`, changeFrequency: 'monthly', priority: 0.4 },
    { url: `${base}/faq`, changeFrequency: 'monthly', priority: 0.4 },
    { url: `${base}/shipping-policy`, changeFrequency: 'monthly', priority: 0.3 },
    { url: `${base}/return-policy`, changeFrequency: 'monthly', priority: 0.3 },
    { url: `${base}/privacy-policy`, changeFrequency: 'monthly', priority: 0.2 },
    { url: `${base}/terms-of-service`, changeFrequency: 'monthly', priority: 0.2 },
    { url: `${base}/blog`, changeFrequency: 'weekly', priority: 0.6 },
  ];

  try {
    const categories = await apiFetch<CategoryItem[]>('/api/categories');
    for (const cat of categories) {
      entries.push({ url: `${base}/categories/${cat.slug}`, changeFrequency: 'weekly', priority: 0.7 });
    }
  } catch { /* API unavailable at build time — skip */ }

  try {
    const collections = await apiFetch<Collection[]>('/api/collections');
    for (const col of collections) {
      entries.push({ url: `${base}/collections/${col.slug}`, changeFrequency: 'weekly', priority: 0.8 });
    }
  } catch { /* API unavailable at build time — skip */ }

  try {
    let page = 1;
    const pageSize = 200;
    while (true) {
      const data = await apiFetch<{ products: ProductListItem[]; total: number }>(
        `/api/products?page=${page}&limit=${pageSize}`
      );
      for (const p of data.products) {
        entries.push({ url: `${base}/product/${p.slug}`, changeFrequency: 'weekly', priority: 0.9 });
      }
      if (data.products.length < pageSize) break;
      page++;
    }
  } catch { /* API unavailable at build time — skip */ }

  try {
    const { pages: posts } = await apiFetch<{ pages: BlogPost[]; total: number }>('/api/pages?page_type=blog_post&limit=500');
    for (const post of posts) {
      entries.push({
        url: `${base}/blog/${post.slug}`,
        lastModified: post.published_at ? new Date(post.published_at) : undefined,
        changeFrequency: 'monthly',
        priority: 0.7,
      });
    }
  } catch { /* API unavailable at build time — skip */ }

  return entries;
}
