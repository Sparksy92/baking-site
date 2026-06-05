import Link from 'next/link';
import Image from 'next/image';
import { apiFetch, type ProductListItem, type Collection } from '@/lib/api';
import { ProductCard } from '@/components/ProductCard';
import { JsonLd } from '@/components/JsonLd';
import { Newsletter } from '@/components/Newsletter';
import { brandName, brandTagline, siteUrl } from '@/lib/format';
import { brandConfig } from '@/config/brand.config';
import { ArrowRight, Feather, HeartHandshake, Leaf, Truck } from 'lucide-react';

const collectionImageBySlug: Record<string, string> = {
  'new-arrivals': '/images/collections/collection-new-arrivals.webp',
  'campaign-merch': '/images/collections/collection-campaign-merch.webp',
  essentials: '/images/collections/collection-essentials.webp',
  'everyday-essentials': '/images/collections/collection-essentials.webp',
};

const fallbackCollections = [
  {
    id: 'new-arrivals',
    name: 'New Arrivals',
    slug: 'new-arrivals',
    description: 'Fresh seasonal pieces in warm earth tones.',
    image_url: collectionImageBySlug['new-arrivals'],
    product_count: null,
  },
  {
    id: 'campaign-merch',
    name: 'Campaign Merch',
    slug: 'campaign-merch',
    description: 'Purpose-led pins, apparel, and accessories.',
    image_url: collectionImageBySlug['campaign-merch'],
    product_count: null,
  },
  {
    id: 'everyday-essentials',
    name: 'Everyday Essentials',
    slug: 'everyday-essentials',
    description: 'Premium basics for daily wear.',
    image_url: collectionImageBySlug['everyday-essentials'],
    product_count: null,
  },
];

type DisplayCollection = {
  id: number | string;
  name: string;
  slug: string;
  description: string | null;
  image_url: string | null;
  product_count: number | null;
};

export default async function Home() {
  const [prodData, collections] = await Promise.all([
    apiFetch<{ products: ProductListItem[] }>('/api/products?featured=true&limit=8').catch(() => ({ products: [] })),
    apiFetch<Collection[]>('/api/collections').catch(() => []),
  ]);
  const featured = prodData.products;
  const apiCollections: DisplayCollection[] = collections.slice(0, 3).map((col) => ({
    ...col,
    image_url: col.image_url || collectionImageBySlug[col.slug] || null,
  }));
  const displayCollections = [
    ...apiCollections,
    ...fallbackCollections.filter((fallback) => !apiCollections.some((col) => col.slug === fallback.slug)),
  ].slice(0, 3);

  return (
    <div className="bg-cream">
      <JsonLd data={{
        '@context': 'https://schema.org',
        '@type': 'WebSite',
        name: brandName(),
        url: siteUrl(),
        potentialAction: {
          '@type': 'SearchAction',
          target: { '@type': 'EntryPoint', urlTemplate: `${siteUrl()}/search?q={search_term_string}` },
          'query-input': 'required name=search_term_string',
        },
      }} />
      <JsonLd data={{
        '@context': 'https://schema.org',
        '@type': 'Organization',
        name: brandName(),
        description: brandTagline(),
        url: siteUrl(),
        logo: brandConfig.assets.logo ? `${siteUrl()}${brandConfig.assets.logo}` : undefined,
        ...(brandConfig.socialLinks.length > 0 ? {
          sameAs: brandConfig.socialLinks.map((s) => s.href),
        } : {}),
      }} />
      {brandConfig.localBusiness && (() => {
        const lb = brandConfig.localBusiness!;
        return (
          <JsonLd data={{
            '@context': 'https://schema.org',
            '@type': lb.type,
            name: brandName(),
            url: siteUrl(),
            ...(lb.telephone ? { telephone: lb.telephone } : {}),
            ...(lb.priceRange ? { priceRange: lb.priceRange } : {}),
            ...(lb.openingHours ? { openingHours: lb.openingHours } : {}),
            ...(lb.hasMap ? { hasMap: lb.hasMap } : {}),
            ...(lb.streetAddress ? {
              address: {
                '@type': 'PostalAddress',
                streetAddress: lb.streetAddress,
                addressLocality: lb.addressLocality,
                addressRegion: lb.addressRegion,
                postalCode: lb.postalCode,
                addressCountry: lb.addressCountry,
              },
            } : {}),
            ...(lb.latitude != null && lb.longitude != null ? {
              geo: { '@type': 'GeoCoordinates', latitude: lb.latitude, longitude: lb.longitude },
            } : {}),
          }} />
        );
      })()}

      {/* Hero */}
      <section className="relative isolate overflow-hidden bg-deep text-white" style={{ minHeight: '92svh' }}>
        {/* Background image */}
        <Image
          src="/images/hero/hero-main.webp"
          alt=""
          fill
          priority
          sizes="100vw"
          className="object-cover opacity-40"
        />
        {/* Layered gradients */}
        <div className="absolute inset-0 bg-gradient-to-r from-deep via-deep/92 to-deep/50" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_82%_18%,rgba(184,92,56,0.22),transparent_42%),radial-gradient(ellipse_at_72%_62%,rgba(184,92,56,0.10),transparent_35%)]" />
        {/* Film grain */}
        <div className="grain" aria-hidden="true" />
        {/* Decorative rings */}
        <div className="deco-ring hidden lg:block" style={{ width: '38rem', height: '38rem', left: '-8%', top: '8%' }} aria-hidden="true" />
        <div className="deco-ring hidden lg:block" style={{ width: '54rem', height: '54rem', right: '-14%', top: '14%' }} aria-hidden="true" />
        {/* Glow orb */}
        <div className="glow-orb hidden lg:block" style={{ width: '34rem', height: '34rem', right: '10%', top: '16%', backgroundColor: '#B85C38' }} aria-hidden="true" />
        {/* Watermark */}
        {brandConfig.seo.abbreviation && (
          <div className="watermark hidden lg:block" style={{ fontSize: '20vw', top: '10%', left: '50%', transform: 'translateX(-50%)' }} aria-hidden="true">
            {brandConfig.seo.abbreviation}
          </div>
        )}

        <div className="relative z-10 site-shell flex flex-col justify-center py-28 sm:py-36 lg:py-44" style={{ minHeight: '92svh' }}>
          <div className="max-w-3xl">
            {/* Eyebrow */}
            <div className="animate-fade-up mb-6 flex flex-wrap items-center gap-3">
              <span className="inline-flex items-center rounded-full border border-white/12 bg-white/[0.04] px-4 py-2 text-[10px] font-bold uppercase tracking-[0.28em] text-white/70">
                {brandConfig.trustIndicators[0]?.label ?? brandName()}
              </span>
            </div>

            {/* Heading */}
            <h1 className="animate-fade-up font-black leading-[0.88] tracking-[-0.03em]">
              <span className="block text-[clamp(3rem,8vw,6.5rem)] text-white">{brandName()}</span>
              {brandTagline() && (
                <span
                  className="block text-[clamp(2.5rem,8vw,6rem)] leading-[0.92] mt-2"
                  style={{ color: 'var(--brand-accent)', textShadow: '0 0 120px rgba(var(--brand-accent-rgb,184,92,56),0.28)' }}
                >
                  {brandTagline()}
                </span>
              )}
            </h1>

            {/* Body copy */}
            <p className="animate-fade-up-delay-1 mt-7 max-w-lg text-base sm:text-lg leading-relaxed text-white/60">
              {brandConfig.metadata.description}
            </p>

            {/* Pill tags — brand trust indicators */}
            {brandConfig.trustIndicators.length > 0 && (
              <div className="animate-fade-up-delay-1 mt-6 flex flex-wrap gap-2.5">
                {brandConfig.trustIndicators.map((t) => (
                  <span
                    key={t.label}
                    className="inline-flex items-center rounded-full border border-white/10 bg-white/[0.04] px-3.5 py-1.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-white/60"
                  >
                    {t.label}
                  </span>
                ))}
              </div>
            )}

            {/* CTAs */}
            <div className="animate-fade-up-delay-2 mt-10 flex flex-col sm:flex-row gap-4">
              <Link href="/search" className="btn-primary">
                Shop Collection <ArrowRight size={18} />
              </Link>
              <Link href="/about" className="btn-outline-light">
                Our Story
              </Link>
            </div>
          </div>

          {/* Stat strip */}
          {brandConfig.seo.heroStats.length > 0 && (
            <div className="animate-fade-up-delay-3 mt-16 grid gap-3 max-w-sm" style={{ gridTemplateColumns: `repeat(${brandConfig.seo.heroStats.length}, minmax(0, 1fr))` }}>
              {brandConfig.seo.heroStats.map((stat) => (
                <div key={stat.label} className="stat-card">
                  <span className="block mb-1.5 h-[2px] w-6 bg-terracotta/70 rounded-full" />
                  <span className="block text-xl font-black text-white leading-none">{stat.value}</span>
                  <span className="mt-1.5 block text-[9px] uppercase tracking-[0.18em] text-white/40">{stat.label}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Bottom transition */}
        <div className="absolute bottom-0 left-0 right-0 h-16 bg-cream" style={{ clipPath: 'ellipse(68% 100% at 50% 100%)' }} />
      </section>

      {/* Trust / Values Strip */}
      <section className="bg-cream border-b border-sand">
        <div className="site-shell py-8">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6 text-center">
            {[Leaf, Truck, HeartHandshake, Feather].slice(0, brandConfig.trustIndicators.length).map((Icon, i) => (
              <div key={brandConfig.trustIndicators[i].label} className="flex flex-col items-center gap-1.5">
                <span className="w-11 h-11 rounded-full bg-warm border border-sand flex items-center justify-center text-terracotta">
                  <Icon size={19} strokeWidth={1.8} aria-hidden="true" />
                </span>
                <span className="text-sm font-semibold text-earth/80">{brandConfig.trustIndicators[i].label}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Collections */}
      {displayCollections.length > 0 && (
        <section className="site-shell py-16 md:py-24">
          <div className="flex items-end justify-between mb-10">
            <div>
              <p className="section-kicker mb-3">Curated</p>
              <h2 className="section-heading">Collections</h2>
            </div>
            <Link href="/search" className="hidden md:inline-flex items-center gap-1 text-sm font-semibold text-terracotta hover:underline">
              View all <ArrowRight size={14} />
            </Link>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {displayCollections.map((col) => (
              <Link
                key={col.id}
                href={`/collections/${col.slug}`}
                className="premium-card group relative bg-sand aspect-[4/3] flex items-end"
              >
                {col.image_url && (
                  <Image
                    src={col.image_url}
                    alt={col.name}
                    fill
                    sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
                    className="object-cover group-hover:scale-105 transition-transform duration-700"
                  />
                )}
                <div className="absolute inset-0 bg-gradient-to-t from-earth/95 via-earth/42 to-transparent" />
                <div className="relative z-10 w-full p-6">
                  <h3 className="text-white font-bold text-xl">{col.name}</h3>
                  <p className="text-white/60 text-sm mt-1">
                    {col.product_count == null ? col.description : `${col.product_count} products`}
                  </p>
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* Featured Products */}
      {featured.length > 0 && (
        <section className="bg-warm py-16 md:py-24">
          <div className="site-shell">
            <div className="flex items-end justify-between mb-10">
              <div>
                <p className="section-kicker mb-3">Handpicked</p>
                <h2 className="section-heading">Featured Pieces</h2>
              </div>
              <Link href="/search" className="hidden md:inline-flex items-center gap-1 text-sm font-semibold text-terracotta hover:underline">
                Shop all <ArrowRight size={14} />
              </Link>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-5 md:gap-8">
              {featured.map((product) => (
                <ProductCard key={product.id} product={product} />
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Story / CTA Block */}
      <section className="relative isolate overflow-hidden bg-deep text-white">
        <Image
          src="/images/hero/hero-lifestyle.webp"
          alt=""
          fill
          sizes="100vw"
          className="object-cover opacity-20"
        />
        <div className="absolute inset-0 bg-gradient-to-br from-deep via-deep/95 to-earth/80" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(184,92,56,0.14),transparent_65%)]" />
        <div className="grain" aria-hidden="true" />

        <div className="relative z-10 site-shell py-24 md:py-32">
          <div className="max-w-2xl mx-auto text-center">
            <div className="flex items-center justify-center gap-3 mb-6">
              <span className="h-px w-10 bg-terracotta/60" />
              <p className="section-kicker">Our Purpose</p>
              <span className="h-px w-10 bg-terracotta/60" />
            </div>
            <h2 className="text-4xl md:text-5xl lg:text-6xl font-black leading-[0.92] tracking-[-0.02em]">
              {brandTagline()}
            </h2>
            <p className="mt-8 text-white/55 text-base sm:text-lg leading-relaxed max-w-xl mx-auto">
              {brandConfig.metadata.description}
            </p>
            <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4">
              <Link href="/about" className="btn-outline-light">
                Learn More <ArrowRight size={18} />
              </Link>
              <Link href="/search" className="btn-primary">
                Shop Now <ArrowRight size={18} />
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Newsletter */}
      <Newsletter />
    </div>
  );
}
