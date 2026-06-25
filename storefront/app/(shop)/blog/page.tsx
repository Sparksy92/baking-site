import type { Metadata } from 'next';
import Link from 'next/link';
import Image from 'next/image';
import { apiFetch } from '@/lib/api';
import { siteUrl } from '@/lib/format';
import { Pagination } from '@/components/Pagination';
import { ArrowRight, Calendar, User } from 'lucide-react';
import { brandConfig } from '@/config/brand.config';

export function generateMetadata(): Metadata {
  return {
    title: 'Homestead Journal & Recipes',
    description: 'Stories, baking guides, traditional recipes, and reflections from Sage & Sweetgrass Homestead.',
    alternates: { canonical: `${siteUrl()}/blog` },
  };
}

interface BlogPost {
  id: number;
  title: string;
  slug: string;
  meta_description: string | null;
  featured_image_url: string | null;
  author: string | null;
  published_at: string | null;
  content_html: string;
}

function readingTime(html: string): number {
  const words = html.replace(/<[^>]+>/g, ' ').trim().split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.ceil(words / 200));
}

const POSTS_PER_PAGE = 12;

interface PublicSettings { blog_post_label: string; blog_section_name: string; }

export default async function BlogPage({ searchParams }: { searchParams: Promise<{ page?: string }> }) {
  const sp = await searchParams;
  const page = Math.max(1, parseInt(sp.page || '1', 10) || 1);

  const [data, settings] = await Promise.all([
    apiFetch<{ pages: BlogPost[]; total: number }>(
      `/api/pages?page_type=blog_post&page=${page}&limit=${POSTS_PER_PAGE}`
    ).catch(() => ({ pages: [] as BlogPost[], total: 0 })),
    apiFetch<PublicSettings>('/api/settings/public').catch(() => ({ blog_post_label: '', blog_section_name: '' })),
  ]);

  const blogPostLabel = settings.blog_post_label || brandConfig.seo.blogPostLabel;
  const blogSectionName = settings.blog_section_name || brandConfig.seo.blogSectionName;

  const totalPages = Math.ceil(data.total / POSTS_PER_PAGE);

  return (
    <div className="min-h-screen bg-cream pb-20">
      <div className="relative overflow-hidden bg-deep text-white">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,rgba(184,92,56,0.18),transparent_58%),radial-gradient(ellipse_at_bottom_left,rgba(107,127,94,0.12),transparent_55%)]" aria-hidden="true" />
        <div className="grain" aria-hidden="true" />
        <div className="relative site-shell py-16 md:py-24 text-center">
          <p className="section-kicker mb-4">{blogSectionName}</p>
          <h1 className="text-5xl md:text-7xl font-serif font-bold tracking-[-0.03em] leading-[0.9]">Sage & Sweetgrass Notes</h1>
          <p className="mt-6 text-lg text-white/55 max-w-2xl mx-auto leading-relaxed">
            Reflections on slow living, artisan baking, and building a homestead from the ground up.
          </p>
        </div>
      </div>

      <div className="site-shell py-12 md:py-16">
        {data.pages.length === 0 ? (
          <div className="py-20 text-center bg-warm rounded-3xl border border-sand border-dashed px-6">
            <p className="section-kicker mb-3">Quiet for now</p>
            <h2 className="text-3xl font-black text-earth">No notes yet.</h2>
            <p className="mt-3 text-muted-earth">We&rsquo;re still putting words to it. Check back soon.</p>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
              {data.pages.map((post) => (
                <article key={post.id} className="group bg-warm rounded-3xl border border-sand overflow-hidden shadow-earth-sm hover:shadow-earth transition-all duration-500 hover:-translate-y-1">
                  <Link href={`/blog/${post.slug}`} className="block h-full">
                    <div className="aspect-[16/9] bg-warm relative overflow-hidden">
                      {post.featured_image_url ? (
                        <Image
                          src={post.featured_image_url}
                          alt={post.title}
                          fill
                          sizes="(max-width: 768px) 100vw, (max-width: 1024px) 50vw, 33vw"
                          className="object-contain group-hover:scale-105 transition-transform duration-500"
                        />
                      ) : (
                        <Image
                          src="/images/about/badasselder-story.webp"
                          alt={post.title}
                          fill
                          sizes="(max-width: 768px) 100vw, (max-width: 1024px) 50vw, 33vw"
                          className="object-cover group-hover:scale-105 transition-transform duration-500 opacity-80"
                        />
                      )}
                      <div className="absolute left-4 top-4 rounded-full bg-deep/80 px-3 py-1 text-[10px] font-black uppercase tracking-[0.16em] text-white/70 backdrop-blur">
                        {blogPostLabel}
                      </div>
                    </div>
                    <div className="p-6">
                      <h2 className="text-xl font-black leading-tight text-earth group-hover:text-terracotta transition-colors line-clamp-2">
                        {post.title}
                      </h2>
                      {post.meta_description && (
                        <p className="mt-3 text-sm leading-relaxed text-muted-earth line-clamp-3">{post.meta_description}</p>
                      )}
                      <div className="mt-5 flex items-center gap-4 text-xs text-muted-earth/70">
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
                        <span className="flex items-center gap-1">{readingTime(post.content_html)} min read</span>
                      </div>
                      <span className="mt-6 inline-flex items-center gap-1.5 text-sm font-black text-terracotta">
                        Read it <ArrowRight size={14} className="transition-transform duration-500 group-hover:translate-x-1" />
                      </span>
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
