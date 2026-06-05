import type { MetadataRoute } from 'next';
import { siteUrl } from '@/lib/format';

export default function robots(): MetadataRoute.Robots {
  const base = siteUrl();
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: ['/admin/', '/api/', '/checkout', '/confirmation/', '/account/', '/cart', '/search', '/order-lookup'],
      },
    ],
    sitemap: `${base}/sitemap.xml`,
  };
}
