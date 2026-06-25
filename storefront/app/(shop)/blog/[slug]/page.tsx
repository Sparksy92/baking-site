import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { apiFetch } from '@/lib/api';
import { brandName, siteUrl } from '@/lib/format';
import { brandConfig } from '@/config/brand.config';
import { JsonLd } from '@/components/JsonLd';
import { ArrowLeft, ArrowRight, Calendar, User } from 'lucide-react';

export const revalidate = 86400; // blog posts change rarely — 24h
export const dynamicParams = true;

export async function generateStaticParams() {
  try {
    const { pages } = await apiFetch<{ pages: { slug: string }[]; total: number }>('/api/pages?page_type=blog_post&limit=500');
    return pages.map((p) => ({ slug: p.slug }));
  } catch {
    return [];
  }
}

interface BlogPost {
  id: number;
  title: string;
  slug: string;
  content_html: string;
  meta_title: string | null;
  meta_description: string | null;
  noindex: boolean;
  canonical_url: string | null;
  featured_image_url: string | null;
  author: string | null;
  published_at: string | null;
  updated_at: string | null;
  keywords: string[] | null;
  featured_image_alt: string | null;
}

function readingTime(html: string): number {
  const words = html.replace(/<[^>]+>/g, ' ').trim().split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.ceil(words / 200));
}

function wordCount(html: string): number {
  return html.replace(/<[^>]+>/g, ' ').trim().split(/\s+/).filter(Boolean).length;
}

/** Extract FAQ pairs from content_html.
 *  Detects two patterns the AI commonly generates:
 *  1. <details><summary>Q</summary><p>A</p></details>
 *  2. <h3>Q?</h3><p>A</p>  (h3 ending with '?')
 */
function extractFaqPairs(html: string): { question: string; answer: string }[] {
  const pairs: { question: string; answer: string }[] = [];
  const strip = (s: string) => s.replace(/<[^>]+>/g, '').trim();

  // Pattern 1 — <details><summary>…</summary>…</details>
  const detailsRe = /<details[^>]*>\s*<summary[^>]*>(.*?)<\/summary>([\s\S]*?)<\/details>/gi;
  let m: RegExpExecArray | null;
  while ((m = detailsRe.exec(html)) !== null) {
    const q = strip(m[1]);
    const a = strip(m[2]);
    if (q && a) pairs.push({ question: q, answer: a });
  }

  if (pairs.length > 0) return pairs.slice(0, 10);

  // Pattern 2 — <h3>…?</h3><p>…</p>
  const h3Re = /<h3[^>]*>(.*?\?)<\/h3>\s*<p[^>]*>(.*?)<\/p>/gi;
  while ((m = h3Re.exec(html)) !== null) {
    const q = strip(m[1]);
    const a = strip(m[2]);
    if (q && a) pairs.push({ question: q, answer: a });
  }

  return pairs.slice(0, 10);
}

interface Props {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  try {
    const post = await apiFetch<BlogPost>(`/api/pages/${slug}`);
    const title = post.meta_title || post.title;
    const description = post.meta_description || `Read "${post.title}" on ${brandName()}`;
    const url = `${siteUrl()}/blog/${slug}`;

    const canonicalUrl = post.canonical_url || url;
    const keywords = post.keywords?.join(', ') || undefined;
    return {
      title,
      description,
      keywords,
      openGraph: {
        title,
        description,
        url: canonicalUrl,
        type: 'article',
        images: post.featured_image_url ? [{ url: post.featured_image_url, alt: post.title }] : [],
        publishedTime: post.published_at || undefined,
        authors: post.author ? [post.author] : undefined,
      },
      alternates: { canonical: canonicalUrl },
      other: {
        'ai-content': 'true',
        ...(keywords ? { 'article:tag': keywords } : {}),
      },
      ...(post.noindex ? { robots: { index: false, follow: true } } : {}),
    };
  } catch {
    return { title: 'Post Not Found' };
  }
}

interface RelatedPost {
  id: number;
  title: string;
  slug: string;
  meta_description: string | null;
  featured_image_url: string | null;
  author: string | null;
  published_at: string | null;
}

interface PublicSettings { blog_post_label: string; blog_section_name: string; }

export default async function BlogPostPage({ params }: Props) {
  const { slug } = await params;
  let post: BlogPost;
  try {
    post = await apiFetch<BlogPost>(`/api/pages/${slug}`);
  } catch {
    notFound();
  }

  const [relatedData, siteSettings] = await Promise.all([
    apiFetch<{ related: RelatedPost[] }>(`/api/pages/${slug}/related?limit=3`)
      .catch(() => ({ related: [] as RelatedPost[] })),
    apiFetch<PublicSettings>('/api/settings/public')
      .catch(() => ({ blog_post_label: '', blog_section_name: '' })),
  ]);

  const blogPostLabel = siteSettings.blog_post_label || brandConfig.seo.blogPostLabel;
  const blogSectionName = siteSettings.blog_section_name || brandConfig.seo.blogSectionName;
  const related = relatedData.related;

  const faqPairs = extractFaqPairs(post.content_html);

  return (
    <article className="min-h-screen bg-cream pb-20">
      <JsonLd data={{
        '@context': 'https://schema.org',
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'Home', item: siteUrl() },
          { '@type': 'ListItem', position: 2, name: blogSectionName || 'Blog', item: `${siteUrl()}/blog` },
          { '@type': 'ListItem', position: 3, name: post.title, item: `${siteUrl()}/blog/${slug}` },
        ],
      }} />
      <JsonLd data={{
        '@context': 'https://schema.org',
        '@type': 'BlogPosting',
        headline: post.title,
        description: post.meta_description || undefined,
        image: post.featured_image_url || undefined,
        datePublished: post.published_at || undefined,
        dateModified: post.updated_at || post.published_at || undefined,
        author: post.author ? { '@type': 'Person', name: post.author } : undefined,
        publisher: { '@type': 'Organization', name: brandName() },
        url: `${siteUrl()}/blog/${slug}`,
        keywords: post.keywords?.join(', ') || undefined,
        wordCount: wordCount(post.content_html),
        timeRequired: `PT${readingTime(post.content_html)}M`,
        speakable: {
          '@type': 'SpeakableSpecification',
          cssSelector: ['h1', 'h2', '.prose p:first-of-type'],
        },
      }} />

      {faqPairs.length > 0 && (
        <JsonLd data={{
          '@context': 'https://schema.org',
          '@type': 'FAQPage',
          mainEntity: faqPairs.map(({ question, answer }) => ({
            '@type': 'Question',
            name: question,
            acceptedAnswer: { '@type': 'Answer', text: answer },
          })),
        }} />
      )}

      <div className="relative overflow-hidden bg-deep text-white">
        {post.featured_image_url ? (
          <Image
            src={post.featured_image_url}
            alt={post.featured_image_alt || post.title}
            fill
            priority
            sizes="100vw"
            className="object-cover opacity-35"
          />
        ) : (
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,rgba(184,92,56,0.2),transparent_58%),radial-gradient(ellipse_at_bottom_left,rgba(107,127,94,0.12),transparent_55%)]" aria-hidden="true" />
        )}
        <div className="absolute inset-0 bg-gradient-to-r from-deep via-deep/88 to-deep/55" />
        <div className="grain" aria-hidden="true" />

        <div className="relative site-shell py-16 md:py-24">
          <Link href="/blog" className="inline-flex items-center gap-1.5 text-sm font-bold text-white/60 hover:text-terracotta transition-colors mb-10">
            <ArrowLeft size={14} /> Back to {blogSectionName}
          </Link>

          <div className="max-w-4xl">
            <p className="section-kicker mb-5">{blogPostLabel}</p>
            <h1 className="text-4xl md:text-7xl font-black tracking-[-0.035em] leading-[0.92]">
              {post.title}
            </h1>

            <div className="mt-8 flex flex-wrap items-center gap-4 text-sm text-white/55">
              {post.author && (
                <span className="flex items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5">
                  <User size={14} /> {post.author}
                </span>
              )}
              {post.published_at && (
                <span className="flex items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5">
                  <Calendar size={14} />
                  {new Date(post.published_at).toLocaleDateString('en-CA', { year: 'numeric', month: 'long', day: 'numeric' })}
                </span>
              )}
              <span className="flex items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5">
                {readingTime(post.content_html)} min read
              </span>
              {!post.author && !post.published_at && (
                <span className="flex items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5">
                  {brandName()}
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Custom styles for article-specific HTML classes injected via content_html */}
      <style>{`
        .article-shirt-art {
          margin: 2rem auto;
          max-width: 28rem;
        }
        .article-shirt-art img {
          width: 100%;
          aspect-ratio: 4 / 5;
          object-fit: contain;
          padding: 1.5rem;
          background: #F7F3EC;
          border-radius: 1.5rem;
          box-shadow: 0 4px 24px rgba(60,50,30,0.10);
        }
        .article-shirt-art figcaption {
          margin-top: 0.6rem;
          font-size: 0.72rem;
          text-transform: uppercase;
          letter-spacing: 0.08em;
          font-weight: 700;
          color: rgba(90,80,55,0.45);
          text-align: center;
        }
        .miitig-callout {
          margin: 2.5rem 0;
          background: #2D4A3E;
          border-radius: 1.5rem;
          padding: 2rem 2rem;
          position: relative;
          overflow: hidden;
        }
        .miitig-callout::before {
          content: '';
          position: absolute;
          inset: 0;
          background: radial-gradient(ellipse at 100% 0%, rgba(217,122,95,0.18) 0%, transparent 55%);
          pointer-events: none;
        }
        .miitig-callout h2 {
          color: #ffffff !important;
          margin-top: 0 !important;
        }
        .miitig-callout p {
          color: rgba(255,255,255,0.75) !important;
          margin-bottom: 0.75rem;
        }
        .miitig-callout strong {
          color: #ffffff !important;
        }
        .miitig-link {
          display: inline-flex;
          align-items: center;
          gap: 0.35rem;
          margin-top: 0.75rem;
          padding: 0.6rem 1.25rem;
          border-radius: 1rem;
          border: 1px solid rgba(255,255,255,0.22);
          color: rgba(255,255,255,0.80) !important;
          font-size: 0.875rem;
          font-weight: 700;
          text-decoration: none !important;
          transition: background 0.2s, color 0.2s;
        }
        .miitig-link:hover {
          background: rgba(255,255,255,0.10);
          color: #ffffff !important;
        }
        @media (max-width: 640px) {
          .miitig-callout { padding: 1.5rem 1.25rem; }
          .article-shirt-art { max-width: 100%; }
        }
      `}</style>

      <div className="site-shell py-10 sm:py-14">
        <div
          className="prose prose-lg mx-auto max-w-3xl
            prose-headings:font-black prose-headings:tracking-tight prose-headings:text-earth
            prose-p:text-muted-earth prose-p:leading-[1.75] prose-p:mb-5
            prose-a:text-terracotta prose-strong:text-earth
            prose-img:rounded-3xl prose-img:shadow-earth-sm
            prose-blockquote:border-l-terracotta prose-blockquote:text-pine
            prose-blockquote:font-black prose-blockquote:not-italic prose-blockquote:text-xl
            prose-h2:mt-10 prose-h2:mb-4
            prose-figcaption:text-center"
          dangerouslySetInnerHTML={{ __html: post.content_html }}
        />
      </div>

      {/* ── Related Posts ── */}
      {related.length > 0 && (
        <div className="site-shell py-12 border-t border-sand">
          <h2 className="text-xl font-black text-earth mb-6 tracking-tight">More from the fire</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6">
            {related.map((rp) => (
              <Link
                key={rp.id}
                href={`/blog/${rp.slug}`}
                className="group bg-warm rounded-2xl border border-sand overflow-hidden hover:shadow-earth transition-all duration-300 hover:-translate-y-0.5"
              >
                <div className="aspect-[16/9] bg-sand relative overflow-hidden">
                  {rp.featured_image_url ? (
                    <Image
                      src={rp.featured_image_url}
                      alt={rp.title}
                      fill
                      sizes="(max-width: 768px) 100vw, 33vw"
                      className="object-cover group-hover:scale-105 transition-transform duration-500"
                    />
                  ) : (
                    <div className="absolute inset-0 bg-gradient-to-br from-pine/10 to-terracotta/10" />
                  )}
                </div>
                <div className="p-4">
                  <h3 className="font-black text-earth text-sm leading-snug line-clamp-2 group-hover:text-terracotta transition-colors">
                    {rp.title}
                  </h3>
                  {rp.meta_description && (
                    <p className="mt-1.5 text-xs text-muted-earth line-clamp-2">{rp.meta_description}</p>
                  )}
                  {rp.published_at && (
                    <p className="mt-2 text-xs text-muted-earth/60">
                      {new Date(rp.published_at).toLocaleDateString('en-CA', { year: 'numeric', month: 'short', day: 'numeric' })}
                    </p>
                  )}
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* ── Closing CTA ── */}
      <div className="relative overflow-hidden" style={{ backgroundColor: '#F0E8D8' }}>
        <div
          className="absolute inset-0 pointer-events-none"
          style={{ background: 'radial-gradient(ellipse at 0% 100%, rgba(184,92,56,0.09) 0%, transparent 55%)' }}
          aria-hidden="true"
        />
        <div className="relative max-w-3xl mx-auto px-6 py-14 sm:py-20 text-center space-y-5">
          <p className="section-kicker">The First Drop</p>
          <h2 className="text-2xl md:text-3xl font-black text-pine leading-tight tracking-[-0.02em]">
            For the ones still healing,<br className="hidden sm:block" /> still laughing, still standing.
          </h2>
          <p className="text-base text-olive/70 leading-relaxed max-w-md mx-auto">
            Premium hoodies and tees rooted in resilience, humour, healing, and earned wisdom.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
            <Link
              href="/shop"
              className="btn-primary inline-flex items-center gap-2 px-7 py-3 rounded-2xl font-bold text-sm"
            >
              Shop the First Drop <ArrowRight size={15} />
            </Link>
            <Link
              href="/about"
              className="inline-flex items-center gap-2 px-7 py-3 rounded-2xl border border-pine/30 text-pine font-bold text-sm hover:bg-pine hover:text-white transition-all duration-200"
            >
              Read Our Story
            </Link>
          </div>
        </div>
      </div>
    </article>
  );
}
