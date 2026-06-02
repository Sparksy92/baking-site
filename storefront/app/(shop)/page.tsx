import Link from 'next/link';
import Image from 'next/image';
import { apiFetch, type ProductListItem, type Collection } from '@/lib/api';
import { formatCents } from '@/lib/format';
import { ProductCard } from '@/components/ProductCard';
import { JsonLd } from '@/components/JsonLd';
import { Newsletter } from '@/components/Newsletter';
import { brandName, brandTagline, siteUrl } from '@/lib/format';
import { ArrowRight } from 'lucide-react';

export default async function Home() {
  const [prodData, collections] = await Promise.all([
    apiFetch<{ products: ProductListItem[] }>('/api/products?featured=true&limit=8').catch(() => ({ products: [] })),
    apiFetch<Collection[]>('/api/collections').catch(() => []),
  ]);
  const featured = prodData.products;

  return (
    <div>
      <JsonLd data={{
        '@context': 'https://schema.org',
        '@type': 'Organization',
        name: brandName(),
        description: brandTagline(),
        url: siteUrl(),
      }} />

      {/* Hero */}
      <section className="relative overflow-hidden bg-earth text-white">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_rgba(184,92,56,0.3)_0%,_transparent_60%)]" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_bottom_left,_rgba(107,127,94,0.2)_0%,_transparent_60%)]" />
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-24 md:py-36 lg:py-44">
          <div className="max-w-3xl">
            <p className="text-terracotta font-medium tracking-widest uppercase text-sm mb-4 animate-fade-up">
              Rooted in Culture
            </p>
            <h1 className="text-5xl md:text-7xl lg:text-8xl font-black tracking-tight leading-[0.9] animate-fade-up">
              Wear Your<br />
              <span className="text-terracotta">Story.</span>
            </h1>
            <p className="mt-6 text-lg md:text-xl text-white/70 max-w-xl leading-relaxed animate-fade-up-delay">
              Handcrafted designs rooted in Indigenous culture. Every piece carries a story, a tradition, a purpose.
            </p>
            <div className="mt-10 flex flex-col sm:flex-row gap-4 animate-fade-up-delay">
              <Link
                href="/search"
                className="inline-flex items-center justify-center gap-2 px-8 py-4 bg-terracotta text-white font-bold rounded-full hover:bg-terracotta/90 transition-all hover:scale-[1.02] active:scale-[0.98] shadow-lg shadow-terracotta/30"
              >
                Shop Collection <ArrowRight size={18} />
              </Link>
              <Link
                href="/about"
                className="inline-flex items-center justify-center gap-2 px-8 py-4 border-2 border-white/30 text-white font-medium rounded-full hover:bg-white/10 transition-all"
              >
                Our Story
              </Link>
            </div>
          </div>
        </div>
        {/* Decorative bottom wave */}
        <div className="absolute bottom-0 left-0 right-0 h-16 bg-cream" style={{ clipPath: 'ellipse(70% 100% at 50% 100%)' }} />
      </section>

      {/* Trust / Values Strip */}
      <section className="bg-cream border-b border-sand">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6 text-center">
            {[
              { icon: '🌿', label: 'Ethically Made' },
              { icon: '🪶', label: 'Indigenous Owned' },
              { icon: '📦', label: 'Free Shipping $100+' },
              { icon: '💚', label: 'Community First' },
            ].map((item) => (
              <div key={item.label} className="flex flex-col items-center gap-1.5">
                <span className="text-2xl">{item.icon}</span>
                <span className="text-sm font-medium text-earth/80">{item.label}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Collections */}
      {collections.length > 0 && (
        <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 md:py-24">
          <div className="flex items-end justify-between mb-10">
            <div>
              <p className="text-terracotta font-medium tracking-widest uppercase text-xs mb-2">Curated</p>
              <h2 className="text-3xl md:text-4xl font-bold text-earth">Collections</h2>
            </div>
            <Link href="/collections" className="hidden md:inline-flex items-center gap-1 text-sm font-medium text-terracotta hover:underline">
              View all <ArrowRight size={14} />
            </Link>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {collections.map((col) => (
              <Link
                key={col.id}
                href={`/collections/${col.slug}`}
                className="group relative overflow-hidden rounded-2xl bg-sand aspect-[4/3] flex items-end shadow-sm hover:shadow-xl transition-shadow duration-500"
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
                <div className="relative z-10 w-full p-6 bg-gradient-to-t from-earth/90 via-earth/50 to-transparent">
                  <h3 className="text-white font-bold text-xl">{col.name}</h3>
                  <p className="text-white/60 text-sm mt-1">{col.product_count} products</p>
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* Featured Products */}
      {featured.length > 0 && (
        <section className="bg-white py-16 md:py-24">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex items-end justify-between mb-10">
              <div>
                <p className="text-terracotta font-medium tracking-widest uppercase text-xs mb-2">Handpicked</p>
                <h2 className="text-3xl md:text-4xl font-bold text-earth">Featured Pieces</h2>
              </div>
              <Link href="/search" className="hidden md:inline-flex items-center gap-1 text-sm font-medium text-terracotta hover:underline">
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
      <section className="bg-earth text-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20 md:py-28">
          <div className="max-w-2xl mx-auto text-center">
            <p className="text-terracotta font-medium tracking-widest uppercase text-xs mb-4">Our Purpose</p>
            <h2 className="text-3xl md:text-4xl font-bold leading-tight">
              Every Purchase Supports<br />Indigenous Communities
            </h2>
            <p className="mt-6 text-white/60 text-lg leading-relaxed max-w-xl mx-auto">
              We&apos;re more than a brand. A portion of every sale goes directly to cultural preservation, language revitalization, and youth programs.
            </p>
            <Link
              href="/about"
              className="inline-flex items-center gap-2 mt-10 px-8 py-4 border-2 border-terracotta text-terracotta font-bold rounded-full hover:bg-terracotta hover:text-white transition-all"
            >
              Learn More <ArrowRight size={18} />
            </Link>
          </div>
        </div>
      </section>

      {/* Newsletter */}
      <Newsletter />
    </div>
  );
}
