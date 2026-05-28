import type { Metadata } from 'next';
import { Suspense } from 'react';
import { brandName, brandTagline, siteUrl } from '@/lib/format';
import { Analytics } from '@/components/Analytics';
import './globals.css';

export function generateMetadata(): Metadata {
  const name = brandName();
  const tagline = brandTagline();
  const description = tagline || `Shop ${name} — premium streetwear and apparel.`;
  const url = siteUrl();

  return {
    title: { default: `${name} — ${tagline || 'Shop'}`, template: `%s | ${name}` },
    description,
    metadataBase: new URL(url),
    openGraph: {
      type: 'website',
      siteName: name,
      title: `${name} — ${tagline || 'Shop'}`,
      description,
      url,
    },
    twitter: { card: 'summary_large_image' },
    robots: { index: true, follow: true },
    alternates: { canonical: url },
    icons: { icon: '/images/brand/favicon.ico' },
  };
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <a href="#main-content" className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-[9999] focus:bg-brand focus:text-white focus:px-4 focus:py-2 focus:rounded-lg focus:text-sm focus:font-medium">
          Skip to content
        </a>
        {children}
        <Suspense fallback={null}>
          <Analytics />
        </Suspense>
      </body>
    </html>
  );
}
