import type { Metadata } from 'next';
import Link from 'next/link';
import { apiFetch, type Category } from '@/lib/api';
import { brandName, siteUrl } from '@/lib/format';

export function generateMetadata(): Metadata {
  return {
    title: 'Categories',
    description: `Browse all categories at ${brandName()}.`,
    alternates: { canonical: `${siteUrl()}/categories` },
  };
}

export default async function CategoriesPage() {
  const categories = await apiFetch<Category[]>('/api/categories').catch(() => []);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 md:py-12">
      <h1 className="text-3xl font-bold text-gray-900 mb-8">Shop by Category</h1>

      {categories.length === 0 ? (
        <p className="text-gray-500">No categories available yet.</p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {categories.map((cat) => (
            <Link
              key={cat.id}
              href={`/categories/${cat.slug}`}
              className="group relative overflow-hidden rounded-xl bg-gray-100 aspect-[4/3] flex items-end"
            >
              {cat.image_url && (
                <img
                  src={cat.image_url}
                  alt={cat.name}
                  className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                />
              )}
              <div className="relative z-10 w-full p-6 bg-gradient-to-t from-black/70 to-transparent">
                <h2 className="text-white font-bold text-lg">{cat.name}</h2>
                <p className="text-white/70 text-sm">{cat.product_count} products</p>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
