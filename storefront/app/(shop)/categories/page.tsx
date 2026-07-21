import type { Metadata } from 'next';
import Link from 'next/link';
import { getCategories } from '@/lib/db-service';
import { siteUrl } from '@/lib/format';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export function generateMetadata(): Metadata {
  const url = `${siteUrl()}/categories`;
  return {
    title: 'Browse Collections | The Artisan Bakery',
    description: 'Explore our curated collections of artisanal sourdough baking, wildflower honey, apothecary, and organic pantry items.',
    alternates: {
      canonical: url,
    },
  };
}

export default async function CategoriesPage() {
  const categories = await getCategories();

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 sm:py-24">
      <header className="text-center mb-16 border-b border-[var(--brand-border)] pb-12">
        <span className="text-sm font-semibold tracking-widest uppercase text-[var(--brand-accent)]">
          Our Collections
        </span>
        <h1 className="text-4xl sm:text-5xl font-serif font-bold mt-3 text-[var(--brand-text)]">
          The Artisan Bakery Offerings
        </h1>
        <p className="mt-4 text-lg text-[var(--brand-text-muted)] max-w-xl mx-auto">
          Honest, handcrafted kitchen foods, nourishing apothecary balms, and home supplies.
        </p>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
        {categories.map((category) => (
          <Link
            key={category.slug}
            href={`/categories/${category.slug}`}
            className="group flex flex-col bg-white rounded-3xl border border-[var(--brand-border)] overflow-hidden hover:shadow-xl hover:shadow-gray-100 transition-all duration-300 active:scale-[0.99]"
          >
            {category.image_url ? (
              <div className="aspect-[4/3] overflow-hidden bg-gray-50 relative">
                <img
                  src={category.image_url}
                  alt={category.name}
                  className="w-full h-full object-cover object-center group-hover:scale-105 transition-transform duration-500"
                />
              </div>
            ) : (
              <div className="aspect-[4/3] bg-gray-50 flex items-center justify-center text-[var(--brand-text-muted)]">
                No Image Available
              </div>
            )}
            <div className="p-8 flex-1 flex flex-col justify-between">
              <div>
                <h2 className="text-2xl font-serif font-bold text-[var(--brand-text)] group-hover:text-[var(--brand-primary)] transition-colors">
                  {category.name}
                </h2>
                {category.description && (
                  <p className="mt-3 text-sm text-[var(--brand-text-muted)] leading-relaxed">
                    {category.description}
                  </p>
                )}
              </div>
              <div className="mt-8 pt-4 border-t border-[var(--brand-border)]/50 flex items-center justify-between">
                <span className="text-sm font-semibold text-[var(--brand-accent)]">
                  Browse Collection
                </span>
                <span className="text-sm font-medium text-[var(--brand-text-muted)] group-hover:translate-x-1 transition-transform">
                  →
                </span>
              </div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
