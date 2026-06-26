import type { Metadata } from 'next';
import Link from 'next/link';
import { apiFetch } from '@/lib/api';
import { brandName, siteUrl } from '@/lib/format';
import { ArrowRight, Tag } from 'lucide-react';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Shop by Tag',
  description: `Browse products by tag at ${brandName()}.`,
  alternates: { canonical: `${siteUrl()}/tags` },
};

interface TagItem {
  id: number;
  name: string;
  slug: string;
  product_count: number;
}

export default async function TagsPage() {
  const tags = await apiFetch<TagItem[]>('/api/tags').catch(() => [] as TagItem[]);
  const totalProducts = tags.reduce((sum, tag) => sum + tag.product_count, 0);

  return (
    <div className="min-h-screen bg-cream pb-20">
      <div className="relative overflow-hidden bg-deep text-white">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,rgba(184,92,56,0.18),transparent_58%),radial-gradient(ellipse_at_bottom_left,rgba(107,127,94,0.12),transparent_55%)]" aria-hidden="true" />
        <div className="grain" aria-hidden="true" />
        <div className="relative site-shell py-16 md:py-24 text-center">
          <p className="section-kicker mb-4">Explore Themes</p>
          <h1 className="text-5xl md:text-7xl font-black tracking-[-0.03em] leading-[0.9]">Shop by Tag</h1>
          <p className="mt-6 text-lg text-white/55 max-w-2xl mx-auto leading-relaxed">
            Find pieces by use, material, fit, and season. Practical filters for people who know what they need.
          </p>
          <div className="mt-8 inline-flex rounded-full border border-white/10 bg-white/[0.04] px-5 py-2 text-xs font-black uppercase tracking-[0.18em] text-white/50">
            {tags.length} tags · {totalProducts} product{totalProducts !== 1 ? 's' : ''}
          </div>
        </div>
      </div>

      <div className="site-shell py-12 md:py-16">
        {tags.length === 0 ? (
          <div className="py-20 text-center bg-warm rounded-3xl border border-sand border-dashed px-6">
            <p className="section-kicker mb-3">Still sorting</p>
            <h2 className="text-3xl font-black text-earth">No tags available yet.</h2>
            <p className="mt-3 text-muted-earth">The catalog is ready to shop while we finish organizing the field notes.</p>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {tags.map((tag) => (
              <Link
                key={tag.id}
                href={`/tags/${tag.slug}`}
                className="group rounded-3xl border border-sand bg-warm p-5 shadow-earth-sm transition-all duration-500 hover:-translate-y-1 hover:border-terracotta/50 hover:shadow-earth"
              >
                <div className="flex items-start justify-between gap-4">
                  <span className="flex h-11 w-11 items-center justify-center rounded-full bg-cream text-terracotta border border-sand">
                    <Tag size={16} aria-hidden="true" />
                  </span>
                  <ArrowRight size={17} className="mt-2 text-muted-earth transition-transform duration-500 group-hover:translate-x-1 group-hover:text-terracotta" aria-hidden="true" />
                </div>
                <h2 className="mt-7 text-xl font-black text-earth transition-colors duration-300 group-hover:text-terracotta">{tag.name}</h2>
                <p className="mt-2 text-sm leading-relaxed text-muted-earth">
                  {tag.product_count} product{tag.product_count !== 1 ? 's' : ''} selected for this field-ready theme.
                </p>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
