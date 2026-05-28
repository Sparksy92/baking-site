import type { Metadata } from 'next';
import { brandName, brandTagline, siteUrl } from '@/lib/format';
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
      <body>{children}</body>
    </html>
  );
}
