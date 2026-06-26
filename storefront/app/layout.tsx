import type { Metadata } from 'next';
import { Suspense } from 'react';
import { brandName, brandTagline, siteUrl } from '@/lib/format';
import { Analytics } from '@/components/Analytics';
import { brandConfig } from '@/config/brand.config';
import './globals.css';

export function generateMetadata(): Metadata {
  const name = brandName();
  const tagline = brandTagline();
  const description = brandConfig.metadata.description || tagline || `Shop ${name} — fresh baking, pantry preserves, and home and body care.`;
  const url = siteUrl();
  const { seo } = brandConfig;

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
      ...(seo.defaultOgImage ? { images: [{ url: seo.defaultOgImage }] } : {}),
    },
    twitter: {
      card: 'summary_large_image',
      ...(seo.twitterHandle ? { site: `@${seo.twitterHandle}` } : {}),
    },
    robots: { index: true, follow: true },
    alternates: { canonical: url },
    icons: {
      icon: brandConfig.assets.favicon,
      shortcut: brandConfig.assets.favicon,
      apple: '/logo.png',
    },
    other: { 'theme-color': brandConfig.colors.primary },
    ...(seo.googleVerification ? { verification: { google: seo.googleVerification } } : {}),
  };
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang={brandConfig.metadata.locale} style={{
      '--brand-primary': brandConfig.colors.primary,
      '--brand-secondary': brandConfig.colors.secondary,
      '--brand-accent': brandConfig.colors.accent,
      '--brand-background': brandConfig.colors.background,
      '--brand-surface': brandConfig.colors.surface,
      '--brand-text': brandConfig.colors.text,
      '--brand-text-muted': brandConfig.colors.textMuted,
      '--brand-border': brandConfig.colors.border,
      '--brand-error': brandConfig.colors.error,
      '--brand-success': brandConfig.colors.success,
      '--brand-warning': brandConfig.colors.warning,
    } as React.CSSProperties}>
      <body className="bg-[var(--brand-background)] text-[var(--brand-text)]">
        <a href="#main-content" className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-[9999] bg-[var(--brand-primary)] text-white focus:px-4 focus:py-2 focus:rounded-lg focus:text-sm focus:font-medium">
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
