import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { apiFetch } from '@/lib/api';
import { brandName, siteUrl } from '@/lib/format';
import { JsonLd } from '@/components/JsonLd';
import { ArrowLeft, BookOpen, Calendar, User } from 'lucide-react';

interface BlogPost {
  id: number;
  title: string;
  slug: string;
  content_html: string;
  meta_title: string | null;
  meta_description: string | null;
  featured_image_url: string | null;
  author: string | null;
  published_at: string | null;
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

    return {
      title,
      description,
      openGraph: {
        title,
        description,
        url,
        type: 'article',
        images: post.featured_image_url ? [{ url: post.featured_image_url, alt: post.title }] : [],
        publishedTime: post.published_at || undefined,
        authors: post.author ? [post.author] : undefined,
      },
      alternates: { canonical: url },
    };
  } catch {
    return { title: 'Post Not Found' };
  }
}

export default async function BlogPostPage({ params }: Props) {
  const { slug } = await params;
  let post: BlogPost;
  try {
    post = await apiFetch<BlogPost>(`/api/pages/${slug}`);
  } catch {
    notFound();
  }

  return (
    <article className="min-h-screen bg-cream pb-20">
      <JsonLd data={{
        '@context': 'https://schema.org',
        '@type': 'BlogPosting',
        headline: post.title,
        description: post.meta_description || undefined,
        image: post.featured_image_url || undefined,
        datePublished: post.published_at || undefined,
        author: post.author ? { '@type': 'Person', name: post.author } : undefined,
        publisher: { '@type': 'Organization', name: brandName() },
        url: `${siteUrl()}/blog/${slug}`,
      }} />

      <div className="relative overflow-hidden bg-deep text-white">
        {post.featured_image_url ? (
          <Image
            src={post.featured_image_url}
            alt={post.title}
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
            <ArrowLeft size={14} /> Back to Field Notes
          </Link>

          <div className="max-w-4xl">
            <p className="section-kicker mb-5">Field Note</p>
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
              {!post.author && !post.published_at && (
                <span className="flex items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5">
                  <BookOpen size={14} /> Terra Supply Co.
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="site-shell py-12">
        <div
          className="prose prose-lg mx-auto max-w-3xl prose-headings:font-black prose-headings:tracking-tight prose-headings:text-earth prose-p:text-muted-earth prose-p:leading-relaxed prose-a:text-terracotta prose-strong:text-earth prose-img:rounded-3xl prose-img:shadow-earth-sm"
          dangerouslySetInnerHTML={{ __html: post.content_html }}
        />
      </div>
    </article>
  );
}
