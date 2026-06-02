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
    <div className="min-h-screen bg-gray-50/30 pb-20">
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 md:py-20 text-center">
          <h1 className="text-4xl md:text-5xl font-extrabold text-gray-900 tracking-tight">Shop by Tag</h1>
          <p className="mt-4 text-lg text-gray-500 max-w-2xl mx-auto">
            Browse our products by theme and style.
          </p>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {tags.length === 0 ? (
          <div className="py-20 text-center bg-white rounded-3xl border border-gray-100 border-dashed">
            <p className="text-gray-500 text-lg">No tags available yet.</p>
          </div>
        ) : (
          <div className="flex flex-wrap gap-3 justify-center">
            {tags.map((tag) => (
              <Link
                key={tag.id}
                href={`/tags/${tag.slug}`}
                className="inline-flex items-center gap-2 px-5 py-3 bg-white border border-gray-200 rounded-full text-sm font-medium text-gray-700 hover:border-brand hover:text-brand shadow-sm hover:shadow-md transition-all"
              >
                <Tag size={14} />
                {tag.name}
                <span className="text-xs text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">{tag.product_count}</span>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
