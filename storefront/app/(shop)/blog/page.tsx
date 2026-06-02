import type { Metadata } from 'next';
import Link from 'next/link';
import Image from 'next/image';
import { apiFetch } from '@/lib/api';
import { brandName, siteUrl } from '@/lib/format';
import { Pagination } from '@/components/Pagination';
import { Calendar, User } from 'lucide-react';

export const metadata: Metadata = {
  title: 'Blog',
  description: `Stories, news, and updates from ${brandName()}.`,
  alternates: { canonical: `${siteUrl()}/blog` },
};

interface BlogPost {
  id: number;
  title: string;
  slug: string;
  meta_description: string | null;
  featured_image_url: string | null;
  author: string | null;
  published_at: string | null;
}

const POSTS_PER_PAGE = 12;

export default async function BlogPage({ searchParams }: { searchParams: Promise<{ page?: string }> }) {
  const sp = await searchParams;
  const page = Math.max(1, parseInt(sp.page || '1', 10) || 1);

  const data = await apiFetch<{ pages: BlogPost[]; total: number }>(
    `/api/pages?page_type=blog_post&page=${page}&limit=${POSTS_PER_PAGE}`
  ).catch(() => ({ pages: [] as BlogPost[], total: 0 }));

  const totalPages = Math.ceil(data.total / POSTS_PER_PAGE);

  return (
    <div className="min-h-screen bg-cream pb-20">
      {/* Header */}
      <div className="bg-warm border-b border-sand">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 md:py-20 text-center">
          <p className="text-terracotta font-semibold tracking-widest uppercase text-xs mb-3">Stories</p>
          <h1 className="text-4xl md:text-6xl font-black text-earth tracking-tight">Blog</h1>
          <p className="mt-4 text-lg text-muted-earth max-w-2xl mx-auto">
            Stories, culture, and updates from {brandName()}.
          </p>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {data.pages.length === 0 ? (
          <div className="py-20 text-center bg-warm rounded-3xl border border-sand border-dashed">
            <p className="text-muted-earth text-lg">No posts yet. Check back soon.</p>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
              {data.pages.map((post) => (
                <article key={post.id} className="group bg-warm rounded-2xl border border-sand overflow-hidden shadow-earth-sm hover:shadow-earth transition-all duration-500">
                  <Link href={`/blog/${post.slug}`}>
                    <div className="aspect-[16/9] bg-sand relative overflow-hidden">
                      {post.featured_image_url ? (
                        <Image
                          src={post.featured_image_url}
                          alt={post.title}
                          fill
                          sizes="(max-width: 768px) 100vw, (max-width: 1024px) 50vw, 33vw"
                          className="object-cover group-hover:scale-105 transition-transform duration-500"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-earth/30 bg-gradient-to-br from-warm via-sand to-cream">
                          <svg className="w-12 h-12" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 20H5a2 2 0 01-2-2V6a2 2 0 012-2h10a2 2 0 012 2v1m2 13a2 2 0 01-2-2V7m2 13a2 2 0 002-2V9a2 2 0 00-2-2h-2m-4-3H9M7 16h6M7 8h6v4H7V8z" />
                          </svg>
                        </div>
                      )}
                    </div>
                    <div className="p-6">
                      <h2 className="text-lg font-bold text-earth group-hover:text-terracotta transition-colors line-clamp-2">
                        {post.title}
                      </h2>
                      {post.meta_description && (
                        <p className="mt-2 text-sm text-muted-earth line-clamp-3">{post.meta_description}</p>
                      )}
                      <div className="mt-4 flex items-center gap-4 text-xs text-muted-earth/70">
                        {post.author && (
                          <span className="flex items-center gap-1">
                            <User size={12} /> {post.author}
                          </span>
                        )}
                        {post.published_at && (
                          <span className="flex items-center gap-1">
                            <Calendar size={12} />
                            {new Date(post.published_at).toLocaleDateString('en-CA', { year: 'numeric', month: 'short', day: 'numeric' })}
                          </span>
                        )}
                      </div>
                    </div>
                  </Link>
                </article>
              ))}
            </div>

            {totalPages > 1 && (
              <div className="mt-12 flex justify-center">
                <Pagination
                  currentPage={page}
                  totalPages={totalPages}
                  buildHref={(p) => `/blog${p > 1 ? `?page=${p}` : ''}`}
                />
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
