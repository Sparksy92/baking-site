'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { api } from '@/lib/api';
import { siteUrl } from '@/lib/format';
import { addToast } from '@/lib/toast';

interface PageDetail {
  id: number;
  title: string;
  slug: string;
  content_html: string | null;
  page_type: string;
  status: string;
  meta_title: string | null;
  meta_description: string | null;
  noindex: boolean;
  canonical_url: string | null;
  author: string | null;
  featured_image_url: string | null;
  published_at: string | null;
}

const inputClass = 'w-full px-4 py-2.5 rounded-lg border border-gray-200 focus:border-brand outline-none text-sm';

export default function PageEditPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const pageId = params.id;

  const [title, setTitle] = useState('');
  const [slug, setSlug] = useState('');
  const [contentHtml, setContentHtml] = useState('');
  const [pageType, setPageType] = useState('page');
  const [status, setStatus] = useState('draft');
  const [author, setAuthor] = useState('');
  const [featuredImageUrl, setFeaturedImageUrl] = useState('');
  const [publishedAt, setPublishedAt] = useState('');
  const [metaTitle, setMetaTitle] = useState('');
  const [metaDescription, setMetaDescription] = useState('');
  const [noindex, setNoindex] = useState(false);
  const [canonicalUrl, setCanonicalUrl] = useState('');
  const [seoOpen, setSeoOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get<PageDetail>(`/api/admin/pages/${pageId}`)
      .then((p) => {
        setTitle(p.title);
        setSlug(p.slug);
        setContentHtml(p.content_html || '');
        setPageType(p.page_type);
        setStatus(p.status);
        setAuthor(p.author || '');
        setFeaturedImageUrl(p.featured_image_url || '');
        setPublishedAt(p.published_at ? p.published_at.slice(0, 10) : '');
        setMetaTitle(p.meta_title || '');
        setMetaDescription(p.meta_description || '');
        setNoindex(p.noindex ?? false);
        setCanonicalUrl(p.canonical_url || '');
      })
      .catch(() => router.push('/admin/pages'))
      .finally(() => setLoading(false));
  }, [pageId, router]);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      await api.patch(`/api/admin/pages/${pageId}`, {
        title: title || undefined,
        slug: slug || undefined,
        content_html: contentHtml || null,
        page_type: pageType,
        status,
        author: author || null,
        featured_image_url: featuredImageUrl || null,
        published_at: publishedAt || null,
        meta_title: metaTitle || null,
        meta_description: metaDescription || null,
        noindex,
        canonical_url: canonicalUrl || null,
      });
      addToast('Page saved', 'success');
    } catch {
      addToast('Failed to save page', 'error');
    } finally {
      setSaving(false);
    }
  }

  const pageUrlBase = pageType === 'blog_post'
    ? `${siteUrl()}/blog/${slug || 'slug'}`
    : `${siteUrl()}/pages/${slug || 'slug'}`;

  if (loading) return <div className="text-gray-400">Loading...</div>;

  return (
    <div className="max-w-2xl">
      <div className="flex items-center gap-3 mb-6">
        <button type="button" onClick={() => router.push('/admin/pages')} className="text-sm text-gray-500 hover:text-gray-800">
          ← Pages & Blog
        </button>
        <span className="text-gray-300">/</span>
        <h1 className="text-2xl font-bold text-gray-900 truncate">{title || 'Untitled'}</h1>
      </div>

      <form onSubmit={handleSave} className="space-y-6">
        {/* Core fields */}
        <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-4">
          <h2 className="font-semibold text-gray-900">Page Details</h2>
          <div>
            <label className="text-sm font-medium text-gray-700 block mb-1">Title</label>
            <input value={title} onChange={(e) => setTitle(e.target.value)} required className={inputClass} />
          </div>
          <div>
            <label className="text-sm font-medium text-gray-700 block mb-1">Slug</label>
            <input value={slug} onChange={(e) => setSlug(e.target.value)} required className={`${inputClass} font-mono`} />
            <p className="text-xs text-gray-400 mt-1">URL: {pageUrlBase}</p>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium text-gray-700 block mb-1">Type</label>
              <select value={pageType} onChange={(e) => setPageType(e.target.value)} className={`${inputClass} bg-white`}>
                <option value="page">Page</option>
                <option value="blog_post">Blog Post</option>
              </select>
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700 block mb-1">Status</label>
              <select value={status} onChange={(e) => setStatus(e.target.value)} className={`${inputClass} bg-white`}>
                <option value="draft">Draft</option>
                <option value="published">Published</option>
              </select>
            </div>
          </div>
          {pageType === 'blog_post' && (
            <>
              <div>
                <label className="text-sm font-medium text-gray-700 block mb-1">Author</label>
                <input value={author} onChange={(e) => setAuthor(e.target.value)} placeholder="Author name" className={inputClass} />
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700 block mb-1">Featured Image URL</label>
                <input value={featuredImageUrl} onChange={(e) => setFeaturedImageUrl(e.target.value)} placeholder="https://…" className={inputClass} />
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700 block mb-1">Publish Date</label>
                <input type="date" value={publishedAt} onChange={(e) => setPublishedAt(e.target.value)} className={inputClass} />
              </div>
            </>
          )}
          <div>
            <label className="text-sm font-medium text-gray-700 block mb-1">Content (HTML)</label>
            <textarea value={contentHtml} onChange={(e) => setContentHtml(e.target.value)} rows={12} className={`${inputClass} resize-y font-mono text-xs`} />
          </div>
        </div>

        {/* SEO */}
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <button type="button" onClick={() => setSeoOpen(!seoOpen)} className="flex items-center justify-between w-full">
            <h2 className="font-semibold text-gray-900">Search Engine Listing (SEO)</h2>
            {seoOpen ? <ChevronUp size={18} className="text-gray-400" /> : <ChevronDown size={18} className="text-gray-400" />}
          </button>
          {seoOpen && (
            <div className="mt-4 space-y-4">
              <div>
                <label className="text-sm font-medium text-gray-700 block mb-1">Page Title</label>
                <input value={metaTitle} onChange={(e) => setMetaTitle(e.target.value)} placeholder={title || 'Page title'} maxLength={70} className={inputClass} />
                <p className="text-xs text-gray-400 mt-1">{metaTitle.length}/70 characters.</p>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700 block mb-1">Meta Description</label>
                <textarea value={metaDescription} onChange={(e) => setMetaDescription(e.target.value)} placeholder="Brief description for search results…" maxLength={160} rows={2} className={`${inputClass} resize-none`} />
                <p className="text-xs text-gray-400 mt-1">{metaDescription.length}/160 characters.</p>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700 block mb-1">Canonical URL <span className="text-gray-400 font-normal">(optional override)</span></label>
                <input value={canonicalUrl} onChange={(e) => setCanonicalUrl(e.target.value)} placeholder={pageUrlBase} className={inputClass} />
                <p className="text-xs text-gray-400 mt-1">Leave blank to use the default URL.</p>
              </div>
              <label className="flex items-center gap-3 cursor-pointer select-none">
                <input type="checkbox" checked={noindex} onChange={(e) => setNoindex(e.target.checked)} className="w-4 h-4 rounded border-gray-300 text-brand" />
                <span className="text-sm font-medium text-gray-700">Hide from search engines <span className="text-gray-400 font-normal">(noindex)</span></span>
              </label>
              {noindex && (
                <p className="text-xs text-amber-600 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                  ⚠ This page will not appear in Google search results.
                </p>
              )}
              <div className="bg-gray-50 rounded-lg p-4">
                <p className="text-xs text-gray-400 mb-1">Search result preview:</p>
                <p className="text-blue-700 text-base font-medium truncate">{metaTitle || title || 'Page Title'}</p>
                <p className="text-green-700 text-xs truncate">{pageUrlBase.replace(/^https?:\/\//, '')}</p>
                <p className="text-sm text-gray-600 line-clamp-2">{metaDescription || 'Page description will appear here…'}</p>
              </div>
            </div>
          )}
        </div>

        <button type="submit" disabled={saving} className="bg-brand text-white px-6 py-2.5 rounded-lg font-medium text-sm hover:bg-brand/90 disabled:opacity-50">
          {saving ? 'Saving…' : 'Save Page'}
        </button>
      </form>
    </div>
  );
}
