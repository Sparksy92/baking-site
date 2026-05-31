'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import dynamic from 'next/dynamic';
import { Trash2, Tag, X, ChevronDown, ChevronUp } from 'lucide-react';
import { api, type Product, type Category, type Variant, type ProductImage } from '@/lib/api';
import { addToast } from '@/lib/toast';
import SortableImageGallery from '@/components/admin/SortableImageGallery';
import VariantMatrixBuilder from '@/components/admin/VariantMatrixBuilder';

const RichTextEditor = dynamic(() => import('@/components/admin/RichTextEditor'), { ssr: false });

interface TagItem { id: number; name: string; }

interface Props {
  productId?: string;
}

export default function ProductForm({ productId }: Props) {
  const router = useRouter();
  const isNew = !productId;

  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [description, setDescription] = useState('');
  const [categoryId, setCategoryId] = useState<number | null>(null);
  const [isActive, setIsActive] = useState(true);
  const [isFeatured, setIsFeatured] = useState(false);
  const [weightG, setWeightG] = useState<number | null>(null);
  const [metaTitle, setMetaTitle] = useState('');
  const [metaDescription, setMetaDescription] = useState('');
  const [categories, setCategories] = useState<Category[]>([]);
  const [variants, setVariants] = useState<Variant[]>([]);
  const [images, setImages] = useState<ProductImage[]>([]);
  const [tags, setTags] = useState<TagItem[]>([]);
  const [allTags, setAllTags] = useState<TagItem[]>([]);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(!isNew);
  const [seoOpen, setSeoOpen] = useState(false);

  useEffect(() => {
    api.get<Category[]>('/api/categories').then(setCategories).catch(() => {});
    api.get<TagItem[]>('/api/admin/tags').then((data) => setAllTags(Array.isArray(data) ? data : [])).catch(() => {});
    if (!isNew) {
      api.get<Product & { tags?: TagItem[]; meta_title?: string; meta_description?: string }>(`/api/admin/products/${productId}`)
        .then((p) => {
          setName(p.name);
          setSlug(p.slug);
          setDescription(p.description || '');
          setCategoryId(p.category_id);
          setIsActive(p.is_active);
          setIsFeatured(p.is_featured);
          setWeightG(p.weight_g ?? null);
          setMetaTitle(p.meta_title || '');
          setMetaDescription(p.meta_description || '');
          setVariants(p.variants);
          setImages(p.images);
          setTags(p.tags ?? []);
        })
        .catch(() => router.push('/admin/products'))
        .finally(() => setLoading(false));
    }
  }, [isNew, productId, router]);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const body = {
        name, slug,
        description: description || null,
        category_id: categoryId,
        is_active: isActive,
        is_featured: isFeatured,
        weight_g: weightG,
        meta_title: metaTitle || null,
        meta_description: metaDescription || null,
      };
      if (isNew) {
        const created = await api.post<{ id: number }>('/api/admin/products', body);
        addToast('Product created', 'success');
        router.push(`/admin/products/${created.id}`);
      } else {
        await api.patch(`/api/admin/products/${productId}`, body);
        addToast('Product saved', 'success');
      }
    } catch (err) {
      console.error(err);
      addToast('Failed to save product', 'error');
    } finally {
      setSaving(false);
    }
  }

  async function addVariant() {
    if (isNew) return;
    try {
      const v = await api.post<Variant>(`/api/admin/products/${productId}/variants`, {
        size: 'M', color: 'Default', price_cents: 0, stock_quantity: 0,
      });
      setVariants((prev) => [...prev, v]);
    } catch (err) { console.error(err); }
  }

  async function saveVariant(id: number, data: Partial<Variant>) {
    try {
      await api.patch(`/api/admin/products/${productId}/variants/${id}`, data);
    } catch (err) { console.error(err); }
  }

  function updateVariantLocal(id: number, data: Partial<Variant>) {
    setVariants((prev) => prev.map((v) => (v.id === id ? { ...v, ...data } : v)));
  }

  async function deleteVariant(id: number) {
    try {
      await api.delete(`/api/admin/products/${productId}/variants/${id}`);
      setVariants((prev) => prev.filter((v) => v.id !== id));
    } catch (err) { console.error(err); }
  }

  async function addTag(tagId: number) {
    if (isNew) return;
    try {
      await api.post(`/api/admin/tags/products/${productId}/tags/${tagId}`, {});
      const tag = allTags.find((t) => t.id === tagId);
      if (tag) setTags((prev) => [...prev, tag]);
    } catch (err) { console.error(err); }
  }

  async function removeTag(tagId: number) {
    if (isNew) return;
    try {
      await api.delete(`/api/admin/tags/products/${productId}/tags/${tagId}`);
      setTags((prev) => prev.filter((t) => t.id !== tagId));
    } catch (err) { console.error(err); }
  }

  if (loading) return <div className="text-gray-400">Loading...</div>;

  const inputClass = 'w-full px-4 py-2.5 rounded-lg border border-gray-200 focus:border-brand outline-none text-sm';
  const availableTags = allTags.filter((t) => !tags.some((pt) => pt.id === t.id));

  return (
    <div className="max-w-3xl">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">{isNew ? 'New Product' : 'Edit Product'}</h1>
      <form onSubmit={handleSave} className="space-y-6">
        {/* Basic Info */}
        <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-4">
          <div>
            <label className="text-sm font-medium text-gray-700 block mb-1">Name</label>
            <input value={name} onChange={(e) => { setName(e.target.value); if (isNew) setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')); }} required className={inputClass} />
          </div>
          <div>
            <label className="text-sm font-medium text-gray-700 block mb-1">Slug</label>
            <input value={slug} onChange={(e) => setSlug(e.target.value)} required className={inputClass} />
          </div>
          <div>
            <label className="text-sm font-medium text-gray-700 block mb-1">Description</label>
            <RichTextEditor content={description} onChange={setDescription} />
          </div>
          <div>
            <label className="text-sm font-medium text-gray-700 block mb-1">Category</label>
            <select value={categoryId ?? ''} onChange={(e) => setCategoryId(e.target.value ? Number(e.target.value) : null)} className={inputClass}>
              <option value="">No category</option>
              {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <div>
            <label className="text-sm font-medium text-gray-700 block mb-1">Weight (grams)</label>
            <input type="number" value={weightG ?? ''} onChange={(e) => setWeightG(e.target.value ? Number(e.target.value) : null)} placeholder="e.g. 350" className={inputClass} />
            <p className="text-xs text-gray-400 mt-1">Used for Canada Post shipping rates. Enter the packaged weight in grams. Examples: T-shirt ≈ 200g, Hoodie ≈ 500g, Cap ≈ 100g. Leave blank to use the store default (500g).</p>
          </div>
          <div className="flex gap-6">
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={isActive} onChange={(e) => setIsActive(e.target.checked)} /> Active</label>
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={isFeatured} onChange={(e) => setIsFeatured(e.target.checked)} /> Featured</label>
          </div>
        </div>

        {/* Tags */}
        {!isNew && (
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <h2 className="font-semibold text-gray-900 mb-3 flex items-center gap-2"><Tag size={16} /> Tags</h2>
            <div className="flex flex-wrap gap-2 mb-3">
              {tags.map((t) => (
                <span key={t.id} className="inline-flex items-center gap-1 px-2.5 py-1 bg-gray-100 text-gray-700 rounded-full text-xs font-medium">
                  {t.name}
                  <button type="button" onClick={() => removeTag(t.id)} className="text-gray-400 hover:text-red-500"><X size={12} /></button>
                </span>
              ))}
              {tags.length === 0 && <span className="text-sm text-gray-400">No tags</span>}
            </div>
            {availableTags.length > 0 && (
              <select onChange={(e) => { if (e.target.value) { addTag(Number(e.target.value)); e.target.value = ''; } }} className="px-3 py-2 border border-gray-200 rounded-lg text-sm" defaultValue="">
                <option value="" disabled>Add a tag...</option>
                {availableTags.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
              </select>
            )}
          </div>
        )}

        {/* Variants */}
        {!isNew && (
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-semibold text-gray-900">Variants</h2>
              <button type="button" onClick={addVariant} className="text-sm text-accent hover:underline">+ Add Single Variant</button>
            </div>
            <div className="mb-4">
              <VariantMatrixBuilder productId={productId!} existingVariants={variants} onVariantsCreated={(created) => setVariants((prev) => [...prev, ...created])} />
            </div>
            {variants.length > 0 && (
              <div className="flex gap-2 text-xs text-gray-400 mb-2">
                <span className="flex-1">Size</span>
                <span className="flex-1">Color</span>
                <span className="w-8">Hex</span>
                <span className="w-24">Price ($)</span>
                <span className="w-20">Stock</span>
                <span className="w-8"></span>
              </div>
            )}
            <div className="space-y-2">
              {variants.map((v) => (
                <div key={v.id} className="flex gap-2 items-center">
                  <input value={v.size} onChange={(e) => updateVariantLocal(v.id, { size: e.target.value })} onBlur={(e) => saveVariant(v.id, { size: e.target.value })} placeholder="Size" className="flex-1 px-3 py-2 border border-gray-200 rounded-lg text-sm" />
                  <input value={v.color} onChange={(e) => updateVariantLocal(v.id, { color: e.target.value })} onBlur={(e) => saveVariant(v.id, { color: e.target.value })} placeholder="Color" className="flex-1 px-3 py-2 border border-gray-200 rounded-lg text-sm" />
                  <input
                    type="color"
                    value={v.color_hex || '#000000'}
                    onChange={(e) => { updateVariantLocal(v.id, { color_hex: e.target.value }); saveVariant(v.id, { color_hex: e.target.value }); }}
                    title="Pick swatch color"
                    className="w-8 h-8 rounded-full border border-gray-200 cursor-pointer p-0 overflow-hidden"
                  />
                  <input
                    type="text"
                    inputMode="decimal"
                    value={((v.price_cents ?? 0) / 100).toFixed(2)}
                    onChange={(e) => { const n = Number(e.target.value); if (!isNaN(n)) updateVariantLocal(v.id, { price_cents: Math.round(n * 100) }); }}
                    onBlur={(e) => { const n = Number(e.target.value); if (!isNaN(n)) saveVariant(v.id, { price_cents: Math.round(n * 100) }); }}
                    placeholder="0.00"
                    className="w-24 px-3 py-2 border border-gray-200 rounded-lg text-sm"
                  />
                  <input type="text" inputMode="numeric" value={v.stock_quantity} onChange={(e) => { const n = Number(e.target.value); if (!isNaN(n)) updateVariantLocal(v.id, { stock_quantity: n }); }} onBlur={(e) => { const n = Number(e.target.value); if (!isNaN(n)) saveVariant(v.id, { stock_quantity: n }); }} placeholder="0" className="w-20 px-3 py-2 border border-gray-200 rounded-lg text-sm" />
                  <button type="button" onClick={() => deleteVariant(v.id)} className="w-8 text-red-400 hover:text-red-600 flex items-center justify-center"><Trash2 size={16} /></button>
                </div>
              ))}
              {variants.length === 0 && <p className="text-sm text-gray-400">No variants yet. Use the matrix builder above to bulk-create all size/color combinations.</p>}
            </div>
          </div>
        )}

        {/* Images */}
        {!isNew && (
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <h2 className="font-semibold text-gray-900 mb-4">Images</h2>
            <SortableImageGallery productId={productId!} images={images} onImagesChange={setImages} />
          </div>
        )}

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
                <input value={metaTitle} onChange={(e) => setMetaTitle(e.target.value)} placeholder={name || 'Product name'} maxLength={70} className={inputClass} />
                <p className="text-xs text-gray-400 mt-1">{metaTitle.length}/70 characters. Leave blank to use the product name.</p>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700 block mb-1">Meta Description</label>
                <textarea value={metaDescription} onChange={(e) => setMetaDescription(e.target.value)} placeholder="Brief description for search results..." maxLength={160} rows={2} className={`${inputClass} resize-none`} />
                <p className="text-xs text-gray-400 mt-1">{metaDescription.length}/160 characters. Shown in Google search results.</p>
              </div>
              {/* Preview */}
              <div className="bg-gray-50 rounded-lg p-4">
                <p className="text-xs text-gray-400 mb-1">Search result preview:</p>
                <p className="text-blue-700 text-base font-medium truncate">{metaTitle || name || 'Product Title'}</p>
                <p className="text-green-700 text-xs">yourstore.com/products/{slug || 'product-slug'}</p>
                <p className="text-sm text-gray-600 line-clamp-2">{metaDescription || description?.replace(/<[^>]*>/g, '').slice(0, 160) || 'Product description will appear here...'}</p>
              </div>
            </div>
          )}
        </div>

        <button type="submit" disabled={saving} className="bg-brand text-white px-6 py-2.5 rounded-lg font-medium text-sm hover:bg-brand/90 disabled:opacity-50">
          {saving ? 'Saving...' : isNew ? 'Create Product' : 'Save Changes'}
        </button>
      </form>
    </div>
  );
}
