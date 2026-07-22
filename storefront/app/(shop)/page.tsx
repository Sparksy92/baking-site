import type { Metadata } from 'next';
import Link from 'next/link';

import { apiFetch } from '@/lib/api-server';
import { type ProductListItem } from '@/lib/api';
import { ProductCard } from '@/components/ProductCard';
import { JsonLd } from '@/components/JsonLd';
import { Newsletter } from '@/components/Newsletter';
import { brandName, brandTagline, siteUrl } from '@/lib/format';
import { brandConfig } from '@/config/brand.config';
import { ArrowRight, Leaf, HeartHandshake, Truck, Shield, HelpCircle } from 'lucide-react';

import InteractiveKitchenScene from '@/components/home/InteractiveKitchenScene';
import HomesteadBackground from '@/components/home/HomesteadBackground';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'The Artisan Bakery | Fresh Baking & Handcrafted Goods',
  description: 'Fresh breads, sourdough preorders, desserts, pantry goods, and handmade home and body care products from The Artisan Bakery.',
};

export default async function Home() {
  const prodData = await apiFetch<{ products: ProductListItem[] }>('/api/products?featured=true&limit=8').catch(() => ({ products: [] }));
  const featured = prodData.products;

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

      {/* Hero */}
      <section className="relative isolate overflow-hidden bg-brand text-white py-20 sm:py-28 lg:py-36 border-b border-sand/30">
        {/* Interactive Pond Background */}
        <HomesteadBackground />
        
        <div className="absolute inset-0 bg-gradient-to-r from-brand/90 via-brand/60 to-transparent pointer-events-none" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,rgba(200,162,168,0.15),transparent_55%)] pointer-events-none" aria-hidden="true" />
        <div className="grain pointer-events-none" aria-hidden="true" />

        <div className="relative z-10 site-shell flex flex-col justify-center min-h-[60vh]">
          <div className="max-w-3xl bg-black/45 backdrop-blur-md border border-white/10 p-8 sm:p-12 rounded-[2rem] shadow-2xl">
            {/* Eyebrow */}
            <div className="mb-6 flex flex-wrap items-center gap-3">
              <span className="inline-flex items-center rounded-full border border-white/20 bg-white/5 px-4 py-2 text-[10px] font-bold uppercase tracking-[0.25em] text-white/95">
                The Artisan Bakery
              </span>
            </div>

            {/* Heading */}
            <h1 className="font-serif font-black leading-[1.05] tracking-[-0.01em] text-white">
              <span className="block text-[clamp(2.25rem,6.5vw,5rem)]">Fresh baking from</span>
              <span className="block text-[clamp(2.25rem,6.5vw,5rem)] text-brand-secondary italic font-normal">
                The Artisan Bakery
              </span>
            </h1>

            {/* Subheading */}
            <p className="mt-6 max-w-2xl text-base sm:text-lg leading-relaxed text-white/80">
              Homemade breads, buns, bagels, cinnamon rolls, cookies, muffins, banana bread, pantry goods, and handmade home and body care products.
            </p>

            {/* Supporting note */}
            <p className="mt-4 max-w-xl text-xs sm:text-sm italic text-white/70">
              Regular loaves are made with yeast. Sourdough is available by preorder and is usually prepared on weekends. Special requests are welcome.
            </p>

            {/* CTAs */}
            <div className="mt-10 flex flex-col sm:flex-row gap-4">
              <Link href="/shop" className="btn-primary">
                View the Menu <ArrowRight size={18} />
              </Link>
              <Link href="/custom-orders" className="btn-outline-light">
                Place an Order Request
              </Link>
              <Link href="/oven-fund" className="btn-outline-light">
                Support the Oven Fund
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Trust / Values Strip */}
      <section className="bg-warm border-b border-sand/50">
        <div className="site-shell py-8">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6 text-center">
            {[
              { label: 'Small Batch', icon: Leaf, desc: 'Handmade in our kitchen' },
              { label: 'Homemade', icon: HeartHandshake, desc: 'Quality local ingredients' },
              { label: 'Request-Based Ordering', icon: Shield, desc: 'Baking day reservation' },
              { label: 'Local Pickup / Delivery', icon: Truck, desc: 'Flexible delivery requests' }
            ].map((indicator) => {
              const Icon = indicator.icon;
              return (
                <div key={indicator.label} className="flex flex-col items-center gap-1.5">
                  <span className="w-11 h-11 rounded-full bg-cream border border-sand flex items-center justify-center text-brand">
                    <Icon size={19} strokeWidth={1.8} aria-hidden="true" />
                  </span>
                  <span className="text-sm font-semibold text-earth/90">{indicator.label}</span>
                  <span className="text-[10px] text-muted-earth">{indicator.desc}</span>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Interactive homestead kitchen scene */}
      <section className="py-16 bg-cream">
        <InteractiveKitchenScene />
      </section>

      {/* Order Explanation Teaser */}
      <section className="bg-warm border-y border-sand/40 py-16">
        <div className="site-shell max-w-4xl">
          <div className="bg-cream border border-sand rounded-[2rem] p-8 md:p-12 flex flex-col md:flex-row items-center gap-8 shadow-sm">
            <div className="w-14 h-14 rounded-full bg-brand/10 text-brand flex items-center justify-center shrink-0">
              <HelpCircle size={28} />
            </div>
            <div className="flex-1 text-center md:text-left">
              <h3 className="text-xl font-bold text-earth tracking-[-0.01em] mb-2">
                How Our Baking Style Ordering Works
              </h3>
              <p className="text-muted-earth text-sm leading-relaxed">
                Because we bake in small batches, items can be ordered in two ways: instant checkout for fixed-price daily items, or via custom quote requests for sourdough preorders, specialty bakes, and custom bundles. 
              </p>
            </div>
            <Link 
              href="/order-info" 
              className="inline-flex items-center gap-2 px-6 py-3 rounded-2xl bg-brand text-white font-bold text-sm hover:bg-brand-accent transition-colors"
            >
              <span>Ordering Guide</span>
              <ArrowRight size={16} />
            </Link>
          </div>
        </div>
      </section>

      {/* Featured Products */}
      {featured.length > 0 && (
        <section className="bg-cream py-16 md:py-24">
          <div className="site-shell">
            <div className="flex items-end justify-between mb-10">
              <div>
                <p className="section-kicker mb-3">Freshly Baked</p>
                <h2 className="section-heading">Featured Selections</h2>
              </div>
              <Link href="/shop" className="hidden md:inline-flex items-center gap-1 text-sm font-semibold text-brand hover:underline">
                View all items <ArrowRight size={14} />
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

      {/* Newsletter */}
      <Newsletter />
    </div>
  );
}
