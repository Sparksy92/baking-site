import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { apiFetch } from '@/lib/api';
import { brandName, siteUrl } from '@/lib/format';
import { JsonLd } from '@/components/JsonLd';
import { ArrowLeft, Calendar, User } from 'lucide-react';

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

      {/* Hero image */}
      {post.featured_image_url && (
        <div className="relative w-full h-64 md:h-96 bg-sand">
          <Image
            src={post.featured_image_url}
            alt={post.title}
            fill
            priority
            sizes="100vw"
            className="object-cover"
          />
        </div>
      )}

      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {/* Back link */}
        <Link href="/blog" className="inline-flex items-center gap-1.5 text-sm font-semibold text-muted-earth hover:text-terracotta transition-colors mb-8">
          <ArrowLeft size={14} /> Back to Blog
        </Link>

        {/* Title */}
        <h1 className="text-4xl md:text-6xl font-black text-earth tracking-tight leading-tight">
          {post.title}
        </h1>

        {/* Meta */}
        <div className="mt-5 flex items-center gap-4 text-sm text-muted-earth">
          {post.author && (
            <span className="flex items-center gap-1.5">
              <User size={14} /> {post.author}
            </span>
          )}
          {post.published_at && (
            <span className="flex items-center gap-1.5">
              <Calendar size={14} />
              {new Date(post.published_at).toLocaleDateString('en-CA', { year: 'numeric', month: 'long', day: 'numeric' })}
            </span>
          )}
        </div>

        {/* Content */}
        <div
          className="mt-10 prose prose-lg max-w-none prose-headings:font-bold prose-headings:text-earth prose-p:text-muted-earth prose-a:text-terracotta prose-strong:text-earth prose-img:rounded-2xl"
          dangerouslySetInnerHTML={{ __html: post.content_html }}
        />
      </div>
    </article>
  );
}
