'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Trash2 } from 'lucide-react';
import { api, type Product, type Category, type Variant, type ProductImage } from '@/lib/api';

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
  const [categories, setCategories] = useState<Category[]>([]);
  const [variants, setVariants] = useState<Variant[]>([]);
  const [images, setImages] = useState<ProductImage[]>([]);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(!isNew);

  useEffect(() => {
    api.get<Category[]>('/api/categories').then(setCategories).catch(() => {});
    if (!isNew) {
      api.get<Product>(`/api/admin/products/${productId}`)
        .then((p) => {
          setName(p.name);
          setSlug(p.slug);
          setDescription(p.description || '');
          setCategoryId(p.category_id);
          setIsActive(p.is_active);
          setIsFeatured(p.is_featured);
          setVariants(p.variants);
          setImages(p.images);
        })
        .catch(() => router.push('/admin/products'))
        .finally(() => setLoading(false));
    }
  }, [isNew, productId, router]);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const body = { name, slug, description: description || null, category_id: categoryId, is_active: isActive, is_featured: isFeatured };
      if (isNew) {
        const created = await api.post<{ id: number }>('/api/admin/products', body);
        router.push(`/admin/products/${created.id}`);
      } else {
        await api.patch(`/api/admin/products/${productId}`, body);
      }
    } catch (err) {
      console.error(err);
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

  async function updateVariant(id: number, data: Partial<Variant>) {
    try {
      const updated = await api.patch<Variant>(`/api/admin/products/${productId}/variants/${id}`, data);
      setVariants((prev) => prev.map((v) => (v.id === id ? updated : v)));
    } catch (err) { console.error(err); }
  }

  async function deleteVariant(id: number) {
    try {
      await api.delete(`/api/admin/products/${productId}/variants/${id}`);
      setVariants((prev) => prev.filter((v) => v.id !== id));
    } catch (err) { console.error(err); }
  }

  async function uploadImage(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || isNew) return;
    const fd = new FormData();
    fd.append('file', file);
    try {
      const img = await api.upload<ProductImage>(`/api/admin/products/${productId}/images`, fd);
      setImages((prev) => [...prev, img]);
    } catch (err) { console.error(err); }
    e.target.value = '';
  }

  async function deleteImage(id: number) {
    try {
      await api.delete(`/api/admin/products/${productId}/images/${id}`);
      setImages((prev) => prev.filter((i) => i.id !== id));
    } catch (err) { console.error(err); }
  }

  if (loading) return <div className="text-gray-400">Loading...</div>;

  const inputClass = 'w-full px-4 py-2.5 rounded-lg border border-gray-200 focus:border-brand outline-none text-sm';

  return (
    <div className="max-w-3xl">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">{isNew ? 'New Product' : 'Edit Product'}</h1>
      <form onSubmit={handleSave} className="space-y-6">
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
            <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} className={`${inputClass} resize-none`} />
          </div>
          <div>
            <label className="text-sm font-medium text-gray-700 block mb-1">Category</label>
            <select value={categoryId ?? ''} onChange={(e) => setCategoryId(e.target.value ? Number(e.target.value) : null)} className={inputClass}>
              <option value="">No category</option>
              {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <div className="flex gap-6">
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={isActive} onChange={(e) => setIsActive(e.target.checked)} /> Active</label>
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={isFeatured} onChange={(e) => setIsFeatured(e.target.checked)} /> Featured</label>
          </div>
        </div>

        {/* Variants */}
        {!isNew && (
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-semibold text-gray-900">Variants</h2>
              <button type="button" onClick={addVariant} className="text-sm text-accent hover:underline">+ Add Variant</button>
            </div>
            <div className="space-y-3">
              {variants.map((v) => (
                <div key={v.id} className="grid grid-cols-5 gap-2 items-center">
                  <input value={v.size} onChange={(e) => updateVariant(v.id, { size: e.target.value })} placeholder="Size" className="px-3 py-2 border border-gray-200 rounded-lg text-sm" />
                  <input value={v.color} onChange={(e) => updateVariant(v.id, { color: e.target.value })} placeholder="Color" className="px-3 py-2 border border-gray-200 rounded-lg text-sm" />
                  <input type="number" value={v.price_cents} onChange={(e) => updateVariant(v.id, { price_cents: Number(e.target.value) })} placeholder="Price (cents)" className="px-3 py-2 border border-gray-200 rounded-lg text-sm" />
                  <input type="number" value={v.stock_quantity} onChange={(e) => updateVariant(v.id, { stock_quantity: Number(e.target.value) })} placeholder="Stock" className="px-3 py-2 border border-gray-200 rounded-lg text-sm" />
                  <button type="button" onClick={() => deleteVariant(v.id)} className="text-red-400 hover:text-red-600"><Trash2 size={16} /></button>
                </div>
              ))}
              {variants.length === 0 && <p className="text-sm text-gray-400">No variants yet</p>}
            </div>
          </div>
        )}

        {/* Images */}
        {!isNew && (
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <h2 className="font-semibold text-gray-900 mb-4">Images</h2>
            <div className="flex flex-wrap gap-4">
              {images.map((img) => (
                <div key={img.id} className="relative w-24 h-24 rounded-lg overflow-hidden border border-gray-200">
                  <img src={img.url} alt="" className="w-full h-full object-cover" />
                  <button type="button" onClick={() => deleteImage(img.id)} className="absolute top-1 right-1 bg-red-500 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs">&times;</button>
                </div>
              ))}
            </div>
            <input type="file" accept="image/*" onChange={uploadImage} className="mt-4 text-sm" />
          </div>
        )}

        <button type="submit" disabled={saving} className="bg-brand text-white px-6 py-2.5 rounded-lg font-medium text-sm hover:bg-brand/90 disabled:opacity-50">
          {saving ? 'Saving...' : isNew ? 'Create Product' : 'Save Changes'}
        </button>
      </form>
    </div>
  );
}
