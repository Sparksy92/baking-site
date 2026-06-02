import type { Metadata } from 'next';
import Link from 'next/link';
import { apiFetch } from '@/lib/api';
import { brandName, siteUrl } from '@/lib/format';
import { Tag } from 'lucide-react';

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

  return (
    <div className="min-h-screen bg-cream pb-20">
      <div className="bg-warm border-b border-sand">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 md:py-20 text-center">
          <p className="text-terracotta font-semibold tracking-widest uppercase text-xs mb-3">Explore Themes</p>
          <h1 className="text-4xl md:text-6xl font-black text-earth tracking-tight">Shop by Tag</h1>
          <p className="mt-4 text-lg text-muted-earth max-w-2xl mx-auto">
            Browse our products by theme and style.
          </p>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {tags.length === 0 ? (
          <div className="py-20 text-center bg-warm rounded-3xl border border-sand border-dashed">
            <p className="text-muted-earth text-lg">No tags available yet.</p>
          </div>
        ) : (
          <div className="flex flex-wrap gap-3 justify-center">
            {tags.map((tag) => (
              <Link
                key={tag.id}
                href={`/tags/${tag.slug}`}
                className="inline-flex items-center gap-2 px-5 py-3 bg-warm border border-sand rounded-full text-sm font-semibold text-earth hover:border-terracotta hover:text-terracotta shadow-earth-sm hover:shadow-earth transition-all"
              >
                <Tag size={14} />
                {tag.name}
                <span className="text-xs text-muted-earth bg-cream px-2 py-0.5 rounded-full">{tag.product_count}</span>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
