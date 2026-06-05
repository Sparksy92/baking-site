'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { api } from '@/lib/api';
import { siteUrl } from '@/lib/format';
import { addToast } from '@/lib/toast';

interface CategoryDetail {
  id: number;
  name: string;
  slug: string;
  description: string | null;
  image_url: string | null;
  is_active: boolean;
  sort_order: number;
  meta_title: string | null;
  meta_description: string | null;
  intro_copy: string | null;
  noindex: boolean;
}

const inputClass = 'w-full px-4 py-2.5 rounded-lg border border-gray-200 focus:border-brand outline-none text-sm';

export default function CategoryEditPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const categoryId = params.id;

  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [description, setDescription] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [isActive, setIsActive] = useState(true);
  const [sortOrder, setSortOrder] = useState(0);
  const [metaTitle, setMetaTitle] = useState('');
  const [metaDescription, setMetaDescription] = useState('');
  const [introCopy, setIntroCopy] = useState('');
  const [noindex, setNoindex] = useState(false);
  const [seoOpen, setSeoOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get<CategoryDetail>(`/api/admin/categories/${categoryId}`)
      .then((c) => {
        setName(c.name);
        setSlug(c.slug);
        setDescription(c.description || '');
        setImageUrl(c.image_url || '');
        setIsActive(c.is_active);
        setSortOrder(c.sort_order);
        setMetaTitle(c.meta_title || '');
        setMetaDescription(c.meta_description || '');
        setIntroCopy(c.intro_copy || '');
        setNoindex(c.noindex ?? false);
      })
      .catch(() => router.push('/admin/categories'))
      .finally(() => setLoading(false));
  }, [categoryId, router]);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      await api.patch(`/api/admin/categories/${categoryId}`, {
        name: name || undefined,
        slug: slug || undefined,
        description: description || null,
        image_url: imageUrl || null,
        is_active: isActive,
        sort_order: sortOrder,
        meta_title: metaTitle || null,
        meta_description: metaDescription || null,
        intro_copy: introCopy || null,
        noindex,
      });
      addToast('Category saved', 'success');
    } catch {
      addToast('Failed to save category', 'error');
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <div className="text-gray-400">Loading...</div>;

  return (
    <div className="max-w-2xl">
      <div className="flex items-center gap-3 mb-6">
        <button type="button" onClick={() => router.push('/admin/categories')} className="text-sm text-gray-500 hover:text-gray-800">
          ← Categories
        </button>
        <span className="text-gray-300">/</span>
        <h1 className="text-2xl font-bold text-gray-900">{name}</h1>
      </div>

      <form onSubmit={handleSave} className="space-y-6">
        {/* Core fields */}
        <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-4">
          <h2 className="font-semibold text-gray-900">Details</h2>
          <div>
            <label className="text-sm font-medium text-gray-700 block mb-1">Name</label>
            <input value={name} onChange={(e) => setName(e.target.value)} required className={inputClass} />
          </div>
          <div>
            <label className="text-sm font-medium text-gray-700 block mb-1">Slug</label>
            <input value={slug} onChange={(e) => setSlug(e.target.value)} required className={`${inputClass} font-mono`} />
            <p className="text-xs text-gray-400 mt-1">URL: /categories/{slug || 'slug'}</p>
          </div>
          <div>
            <label className="text-sm font-medium text-gray-700 block mb-1">Description</label>
            <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} placeholder="Category description…" className={`${inputClass} resize-none`} />
          </div>
          <div>
            <label className="text-sm font-medium text-gray-700 block mb-1">Image URL</label>
            <input value={imageUrl} onChange={(e) => setImageUrl(e.target.value)} placeholder="https://…" className={inputClass} />
          </div>
          <div className="flex items-center gap-6">
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={isActive} onChange={(e) => setIsActive(e.target.checked)} className="w-4 h-4 rounded border-gray-300 text-brand" />
              <span className="text-sm font-medium text-gray-700">Active</span>
            </label>
            <div className="flex items-center gap-2">
              <label className="text-sm font-medium text-gray-700">Sort order</label>
              <input type="number" value={sortOrder} onChange={(e) => setSortOrder(Number(e.target.value))} className="w-20 px-3 py-2 rounded-lg border border-gray-200 focus:border-brand outline-none text-sm" />
            </div>
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
                <label className="text-sm font-medium text-gray-700 block mb-1">Intro Copy</label>
                <textarea value={introCopy} onChange={(e) => setIntroCopy(e.target.value)} rows={3} placeholder="Short descriptive text shown above the product grid." className={`${inputClass} resize-none`} />
                <p className="text-xs text-gray-400 mt-1">Shown above products on the category page. Use 1–2 sentences targeting your key phrase.</p>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700 block mb-1">Page Title</label>
                <input value={metaTitle} onChange={(e) => setMetaTitle(e.target.value)} placeholder={name || 'Category name'} maxLength={70} className={inputClass} />
                <p className="text-xs text-gray-400 mt-1">{metaTitle.length}/70 characters.</p>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700 block mb-1">Meta Description</label>
                <textarea value={metaDescription} onChange={(e) => setMetaDescription(e.target.value)} placeholder="Brief description for search results…" maxLength={160} rows={2} className={`${inputClass} resize-none`} />
                <p className="text-xs text-gray-400 mt-1">{metaDescription.length}/160 characters.</p>
              </div>
              <label className="flex items-center gap-3 cursor-pointer select-none">
                <input type="checkbox" checked={noindex} onChange={(e) => setNoindex(e.target.checked)} className="w-4 h-4 rounded border-gray-300 text-brand" />
                <span className="text-sm font-medium text-gray-700">Hide from search engines <span className="text-gray-400 font-normal">(noindex)</span></span>
              </label>
              {noindex && (
                <p className="text-xs text-amber-600 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                  ⚠ This category will not appear in Google search results.
                </p>
              )}
              <div className="bg-gray-50 rounded-lg p-4">
                <p className="text-xs text-gray-400 mb-1">Search result preview:</p>
                <p className="text-blue-700 text-base font-medium truncate">{metaTitle || name || 'Category Title'}</p>
                <p className="text-green-700 text-xs">{siteUrl().replace(/^https?:\/\//, '')}/categories/{slug || 'category-slug'}</p>
                <p className="text-sm text-gray-600 line-clamp-2">{metaDescription || description || 'Category description will appear here…'}</p>
              </div>
            </div>
          )}
        </div>

        <button type="submit" disabled={saving} className="bg-brand text-white px-6 py-2.5 rounded-lg font-medium text-sm hover:bg-brand/90 disabled:opacity-50">
          {saving ? 'Saving…' : 'Save Category'}
        </button>
      </form>
    </div>
  );
}
