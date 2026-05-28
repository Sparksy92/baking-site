import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { api } from '../../lib/api';
import { Plus, Trash2, Upload } from 'lucide-react';

interface Variant {
  id?: number;
  size: string;
  color: string;
  color_hex: string;
  price_cents: number;
  stock_quantity: number;
  sku: string;
}

interface Category {
  id: number;
  name: string;
}

export default function AdminProductForm() {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const isEdit = Boolean(id);

  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [description, setDescription] = useState('');
  const [categoryId, setCategoryId] = useState<number | ''>('');
  const [isActive, setIsActive] = useState(true);
  const [isFeatured, setIsFeatured] = useState(false);
  const [categories, setCategories] = useState<Category[]>([]);
  const [variants, setVariants] = useState<Variant[]>([]);
  const [images, setImages] = useState<{ id: number; url: string }[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    api.get<Category[]>('/api/categories').then(setCategories).catch(() => {});
    if (isEdit) {
      api.get<any>(`/api/products/${id}`).then((p) => {
        setName(p.name);
        setSlug(p.slug);
        setDescription(p.description || '');
        setCategoryId(p.category_id || '');
        setIsActive(Boolean(p.is_active));
        setIsFeatured(Boolean(p.is_featured));
        setVariants(p.variants || []);
        setImages(p.images || []);
      }).catch(() => {});
    }
  }, [id, isEdit]);

  function handleNameChange(value: string) {
    setName(value);
    if (!isEdit) {
      setSlug(value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''));
    }
  }

  function addVariant() {
    setVariants([...variants, { size: '', color: '', color_hex: '#000000', price_cents: 0, stock_quantity: 0, sku: '' }]);
  }

  function updateVariant(index: number, field: keyof Variant, value: string | number) {
    const updated = [...variants];
    (updated[index] as any)[field] = value;
    setVariants(updated);
  }

  function removeVariant(index: number) {
    setVariants(variants.filter((_, i) => i !== index));
  }

  async function handleImageUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !isEdit) return;
    const formData = new FormData();
    formData.append('file', file);
    try {
      const result = await api.upload<{ id: number; url: string }>(`/api/admin/products/${id}/images`, formData);
      setImages([...images, result]);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Image upload failed');
    }
  }

  async function deleteImage(imageId: number) {
    try {
      await api.delete(`/api/admin/products/${id}/images/${imageId}`);
      setImages(images.filter((img) => img.id !== imageId));
    } catch {}
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const payload = {
        name, slug,
        description: description || null,
        category_id: categoryId || null,
        is_active: isActive,
        is_featured: isFeatured,
      };

      if (isEdit) {
        await api.patch(`/api/admin/products/${id}`, payload);
        // Save variants
        for (const v of variants) {
          if (v.id) {
            await api.patch(`/api/admin/products/${id}/variants/${v.id}`, v);
          } else if (v.size && v.color && v.price_cents > 0) {
            await api.post(`/api/admin/products/${id}/variants`, v);
          }
        }
      } else {
        const result = await api.post<{ id: number }>('/api/admin/products', payload);
        // Create variants for new product
        for (const v of variants) {
          if (v.size && v.color && v.price_cents > 0) {
            await api.post(`/api/admin/products/${result.id}/variants`, v);
          }
        }
      }
      navigate('/admin/products');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to save product');
    } finally {
      setLoading(false);
    }
  }

  const inputClass = "w-full px-4 py-3 rounded-lg border border-gray-200 focus:border-brand outline-none text-sm";

  return (
    <div className="max-w-4xl">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">{isEdit ? 'Edit Product' : 'New Product'}</h1>
      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Basic Info */}
        <section className="bg-white border border-gray-200 rounded-xl p-6 space-y-4">
          <h2 className="font-semibold text-gray-900">Basic Info</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium text-gray-700 block mb-1">Name</label>
              <input type="text" value={name} onChange={(e) => handleNameChange(e.target.value)} required className={inputClass} />
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700 block mb-1">Slug</label>
              <input type="text" value={slug} onChange={(e) => setSlug(e.target.value)} required className={inputClass} />
            </div>
          </div>
          <div>
            <label className="text-sm font-medium text-gray-700 block mb-1">Description</label>
            <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} className={`${inputClass} resize-none`} />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="text-sm font-medium text-gray-700 block mb-1">Category</label>
              <select value={categoryId} onChange={(e) => setCategoryId(e.target.value ? Number(e.target.value) : '')} className={inputClass}>
                <option value="">No category</option>
                {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div className="flex items-end gap-4">
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={isActive} onChange={(e) => setIsActive(e.target.checked)} className="rounded" />
                Active
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={isFeatured} onChange={(e) => setIsFeatured(e.target.checked)} className="rounded" />
                Featured
              </label>
            </div>
          </div>
        </section>

        {/* Variants */}
        <section className="bg-white border border-gray-200 rounded-xl p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold text-gray-900">Variants</h2>
            <button type="button" onClick={addVariant} className="flex items-center gap-1 text-sm text-brand font-medium hover:underline">
              <Plus size={16} /> Add Variant
            </button>
          </div>
          {variants.length === 0 && <p className="text-sm text-gray-400">No variants yet. Add size/color combinations with pricing.</p>}
          {variants.map((v, i) => (
            <div key={i} className="grid grid-cols-2 md:grid-cols-6 gap-3 items-end border-b border-gray-100 pb-3">
              <div>
                <label className="text-xs text-gray-500">Size</label>
                <input type="text" placeholder="M" value={v.size} onChange={(e) => updateVariant(i, 'size', e.target.value)} className={inputClass} />
              </div>
              <div>
                <label className="text-xs text-gray-500">Color</label>
                <input type="text" placeholder="Black" value={v.color} onChange={(e) => updateVariant(i, 'color', e.target.value)} className={inputClass} />
              </div>
              <div>
                <label className="text-xs text-gray-500">Price ($)</label>
                <input type="number" step="0.01" value={(v.price_cents / 100).toFixed(2)} onChange={(e) => updateVariant(i, 'price_cents', Math.round(parseFloat(e.target.value || '0') * 100))} className={inputClass} />
              </div>
              <div>
                <label className="text-xs text-gray-500">Stock</label>
                <input type="number" value={v.stock_quantity} onChange={(e) => updateVariant(i, 'stock_quantity', parseInt(e.target.value || '0'))} className={inputClass} />
              </div>
              <div>
                <label className="text-xs text-gray-500">SKU</label>
                <input type="text" value={v.sku} onChange={(e) => updateVariant(i, 'sku', e.target.value)} className={inputClass} />
              </div>
              <button type="button" onClick={() => removeVariant(i)} className="text-red-400 hover:text-red-600 p-2">
                <Trash2 size={16} />
              </button>
            </div>
          ))}
        </section>

        {/* Images (edit mode only) */}
        {isEdit && (
          <section className="bg-white border border-gray-200 rounded-xl p-6 space-y-4">
            <h2 className="font-semibold text-gray-900">Images</h2>
            <div className="flex flex-wrap gap-4">
              {images.map((img) => (
                <div key={img.id} className="relative w-24 h-24 rounded-lg overflow-hidden border border-gray-200">
                  <img src={img.url} alt="" className="w-full h-full object-cover" />
                  <button type="button" onClick={() => deleteImage(img.id)} className="absolute top-1 right-1 bg-red-500 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs">×</button>
                </div>
              ))}
              <label className="w-24 h-24 rounded-lg border-2 border-dashed border-gray-300 flex flex-col items-center justify-center cursor-pointer hover:border-brand transition-colors">
                <Upload size={20} className="text-gray-400" />
                <span className="text-xs text-gray-400 mt-1">Upload</span>
                <input type="file" accept="image/*" onChange={handleImageUpload} className="hidden" />
              </label>
            </div>
          </section>
        )}

        {error && <p className="text-sm text-red-600">{error}</p>}
        <div className="flex gap-3">
          <button type="submit" disabled={loading} className="bg-brand text-white px-6 py-3 rounded-lg font-medium hover:bg-brand/90 disabled:opacity-50">
            {loading ? 'Saving...' : isEdit ? 'Save Changes' : 'Create Product'}
          </button>
          <button type="button" onClick={() => navigate('/admin/products')} className="px-6 py-3 rounded-lg font-medium text-gray-600 hover:bg-gray-100">
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
}
