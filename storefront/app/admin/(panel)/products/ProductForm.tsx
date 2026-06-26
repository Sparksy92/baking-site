'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import dynamic from 'next/dynamic';
import { ArrowLeft, Sparkles, Loader2, Upload, FolderOpen, ChevronDown, ChevronUp, Image, Trash2 } from 'lucide-react';
import { api, type Category } from '@/lib/api';
import { addToast } from '@/lib/toast';
import MediaLibraryModal from '@/components/admin/MediaLibraryModal';

const RichTextEditor = dynamic(() => import('@/components/admin/RichTextEditor'), { ssr: false });

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
  const [imageUrl, setImageUrl] = useState('');
  const [price, setPrice] = useState('0.00');
  const [pricingMode, setPricingMode] = useState('fixed');
  const [availabilityStatus, setAvailabilityStatus] = useState('available');
  const [leadTimeDays, setLeadTimeDays] = useState(0);
  const [allergyNotes, setAllergyNotes] = useState('');
  const [pickupNotes, setPickupNotes] = useState('');
  const [sortOrder, setSortOrder] = useState(0);
  const [isFeatured, setIsFeatured] = useState(false);

  const [categories, setCategories] = useState<Category[]>([]);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(!isNew);

  const [isLibraryOpen, setIsLibraryOpen] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [showAdvancedUrl, setShowAdvancedUrl] = useState(false);

  async function handleFormFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 4 * 1024 * 1024) {
      addToast('File size exceeds 4 MB limit.', 'error');
      return;
    }

    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp'];
    if (!allowedTypes.includes(file.type)) {
      addToast('Only JPEG, PNG, and WebP images are allowed.', 'error');
      return;
    }

    setIsUploading(true);
    const formData = new FormData();
    formData.append('file', file);

    try {
      const res = await fetch('/api/admin/media/upload', {
        method: 'POST',
        body: formData,
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.detail || 'Upload failed');
      }

      const data = await res.json();
      setImageUrl(data.url);
      addToast('Image uploaded and applied successfully', 'success');
    } catch (err: any) {
      console.error(err);
      addToast(err.message || 'Failed to upload image', 'error');
    } finally {
      setIsUploading(false);
    }
  }

  useEffect(() => {
    api.get<Category[]>('/api/categories')
      .then(setCategories)
      .catch(() => {});

    if (!isNew) {
      api.get<any>(`/api/admin/products/${productId}`)
        .then((p) => {
          setName(p.name);
          setSlug(p.slug);
          setDescription(p.description || '');
          setCategoryId(p.category_id);
          setImageUrl(p.image_url || '');
          setPrice(p.price_cents ? (p.price_cents / 100).toFixed(2) : '0.00');
          setPricingMode(p.pricing_mode || 'fixed');
          setAvailabilityStatus(p.availability_status || 'available');
          setLeadTimeDays(p.lead_time_days ?? 0);
          setAllergyNotes(p.allergy_notes || '');
          setPickupNotes(p.pickup_notes || '');
          setSortOrder(p.sort_order ?? 0);
          setIsFeatured(p.is_featured ?? false);
        })
        .catch((err) => {
          console.error(err);
          addToast('Failed to load menu item', 'error');
          router.push('/admin/products');
        })
        .finally(() => setLoading(false));
    }
  }, [isNew, productId, router]);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);

    const priceNum = parseFloat(price);
    if (isNaN(priceNum) || priceNum < 0) {
      addToast('Please enter a valid price.', 'error');
      setSaving(false);
      return;
    }

    const priceCents = Math.round(priceNum * 100);

    try {
      const body = {
        name,
        slug,
        description: description || null,
        category_id: categoryId,
        image_url: imageUrl || null,
        price_cents: priceCents,
        pricing_mode: pricingMode,
        availability_status: availabilityStatus,
        lead_time_days: leadTimeDays,
        allergy_notes: allergyNotes || null,
        pickup_notes: pickupNotes || null,
        sort_order: sortOrder,
        is_featured: isFeatured,
      };

      if (isNew) {
        await api.post('/api/admin/products', body);
        addToast('Menu item created successfully', 'success');
      } else {
        await api.patch(`/api/admin/products/${productId}`, body);
        addToast('Menu item updated successfully', 'success');
      }
      router.push('/admin/products');
      router.refresh();
    } catch (err: any) {
      console.error(err);
      const msg = err.errors ? Object.values(err.errors).join(' ') : 'Failed to save menu item';
      addToast(msg, 'error');
    } finally {
      setSaving(false);
    }
  }

  function handleAutoSlug(title: string) {
    if (!isNew) return;
    const computed = title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '');
    setSlug(computed);
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="w-8 h-8 animate-spin text-brand" />
      </div>
    );
  }

  const inputClass = 'w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:border-brand focus:ring-4 focus:ring-brand/10 outline-none text-sm transition-all bg-white text-gray-900';
  const labelClass = 'text-xs font-bold text-gray-700 uppercase tracking-wider block mb-1.5';

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-8">
        <button
          type="button"
          onClick={() => router.push('/admin/products')}
          className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-900 transition-colors"
        >
          <ArrowLeft size={16} />
          Back to Menu Items
        </button>
        <h1 className="text-2xl font-black text-gray-900 tracking-tight flex items-center gap-2">
          <Sparkles className="text-brand w-6 h-6" />
          {isNew ? 'Create Menu Item' : 'Edit Menu Item'}
        </h1>
      </div>

      <form onSubmit={handleSave} className="space-y-8">
        {/* Core details */}
        <div className="bg-white rounded-2xl border border-gray-100 p-6 shadow-sm space-y-5">
          <h2 className="text-sm font-bold uppercase tracking-wider text-gray-400 border-b border-gray-50 pb-2 mb-4">Core Details</h2>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div>
              <label className={labelClass}>Name</label>
              <input
                value={name}
                onChange={(e) => {
                  setName(e.target.value);
                  handleAutoSlug(e.target.value);
                }}
                required
                placeholder="e.g. Sourdough Boule"
                className={inputClass}
              />
            </div>
            <div>
              <label className={labelClass}>URL Slug</label>
              <input
                value={slug}
                onChange={(e) => setSlug(e.target.value)}
                required
                placeholder="e.g. sourdough-boule"
                className={inputClass}
              />
            </div>
          </div>

          <div>
            <label className={labelClass}>Category</label>
            <select
              value={categoryId ?? ''}
              onChange={(e) => setCategoryId(e.target.value ? Number(e.target.value) : null)}
              className={inputClass}
            >
              <option value="">No Category</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className={labelClass}>Description</label>
            <RichTextEditor content={description} onChange={setDescription} />
          </div>
        </div>

        {/* Pricing & Availability */}
        <div className="bg-white rounded-2xl border border-gray-100 p-6 shadow-sm space-y-5">
          <h2 className="text-sm font-bold uppercase tracking-wider text-gray-400 border-b border-gray-50 pb-2 mb-4">Pricing &amp; Availability</h2>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            <div>
              <label className={labelClass}>Pricing Mode</label>
              <select
                value={pricingMode}
                onChange={(e) => setPricingMode(e.target.value)}
                className={inputClass}
              >
                <option value="fixed">Fixed Price</option>
                <option value="starting_at">Starting At Price</option>
                <option value="quote_only">Quote Only (Request Quote)</option>
                <option value="seasonal">Seasonal Pricing</option>
              </select>
            </div>
            <div>
              <label className={labelClass}>Price ($ CAD)</label>
              <input
                type="text"
                inputMode="decimal"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                disabled={pricingMode === 'quote_only' || pricingMode === 'seasonal'}
                placeholder="e.g. 12.50"
                className={`${inputClass} disabled:bg-gray-50 disabled:text-gray-400`}
              />
            </div>
            <div>
              <label className={labelClass}>Availability Status</label>
              <select
                value={availabilityStatus}
                onChange={(e) => setAvailabilityStatus(e.target.value)}
                className={inputClass}
              >
                <option value="available">Available</option>
                <option value="preorder">Pre-order</option>
                <option value="weekend_only">Weekends Only</option>
                <option value="sold_out">Sold Out</option>
                <option value="seasonal">Seasonal Availability</option>
                <option value="hidden">Hidden (Not on storefront)</option>
              </select>
            </div>
          </div>
        </div>

        {/* Media & Sorting */}
        <div className="bg-white rounded-2xl border border-gray-100 p-6 shadow-sm space-y-5">
          <h2 className="text-sm font-bold uppercase tracking-wider text-gray-400 border-b border-gray-50 pb-2 mb-4">Media &amp; Sorting</h2>

          <div className="space-y-4">
            <label className={labelClass}>Product Image</label>
            
            {/* Image Preview Block */}
            {imageUrl ? (
              <div className="relative w-48 h-48 rounded-xl border border-gray-200 overflow-hidden bg-gray-50 group shadow-sm flex items-center justify-center">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={imageUrl}
                  alt="Product preview"
                  className="object-cover w-full h-full"
                />
                <button
                  type="button"
                  onClick={() => setImageUrl('')}
                  className="absolute inset-0 bg-black/55 flex items-center justify-center text-white opacity-0 group-hover:opacity-100 transition-opacity font-semibold text-xs gap-1.5"
                >
                  <Trash2 size={14} />
                  <span>Remove Image</span>
                </button>
              </div>
            ) : (
              <div className="w-48 h-48 rounded-xl border-2 border-dashed border-gray-200 flex flex-col items-center justify-center bg-gray-50/50 text-gray-400 gap-1.5 p-4 text-center">
                <Image size={24} className="text-gray-300" />
                <span className="text-xs font-semibold">No Image Selected</span>
                <span className="text-[10px] text-gray-400">Select one below</span>
              </div>
            )}

            {/* Selector Actions */}
            <div className="flex flex-wrap items-center gap-3">
              <label className="flex items-center gap-2 px-4 py-2 bg-brand text-white font-bold text-xs rounded-xl hover:bg-brand/90 cursor-pointer shadow-sm transition-colors disabled:opacity-50">
                {isUploading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Uploading...</span>
                  </>
                ) : (
                  <>
                    <Upload size={14} />
                    <span>Upload New</span>
                  </>
                )}
                <input type="file" accept="image/jpeg,image/png,image/webp" onChange={handleFormFileUpload} disabled={isUploading} className="hidden" />
              </label>

              <button
                type="button"
                onClick={() => setIsLibraryOpen(true)}
                className="flex items-center gap-2 px-4 py-2 border border-gray-200 text-gray-700 font-bold text-xs rounded-xl hover:bg-gray-50 transition-colors shadow-sm bg-white"
              >
                <FolderOpen size={14} className="text-gray-400" />
                <span>Choose from Library</span>
              </button>
            </div>

            {/* Collapsed Advanced input */}
            <div className="pt-2">
              <button
                type="button"
                onClick={() => setShowAdvancedUrl(!showAdvancedUrl)}
                className="flex items-center gap-1.5 text-xs font-bold text-gray-500 hover:text-gray-900 transition-colors"
              >
                {showAdvancedUrl ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                <span>Advanced: paste image URL</span>
              </button>

              {showAdvancedUrl && (
                <div className="mt-3">
                  <input
                    type="url"
                    value={imageUrl}
                    onChange={(e) => setImageUrl(e.target.value)}
                    placeholder="e.g. https://images.unsplash.com/photo-..."
                    className={inputClass}
                  />
                  <p className="text-[10px] text-gray-400 mt-1">Direct HTTPS link to external image file.</p>
                </div>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div>
              <label className={labelClass}>Sort Order</label>
              <input
                type="number"
                value={sortOrder}
                onChange={(e) => setSortOrder(Number(e.target.value))}
                className={inputClass}
              />
              <p className="text-xs text-gray-400 mt-1">Lower numbers appear first on the menu.</p>
            </div>
            <div className="flex items-center pt-6">
              <label className="flex items-center gap-3 cursor-pointer select-none text-sm font-bold text-gray-700">
                <input
                  type="checkbox"
                  checked={isFeatured}
                  onChange={(e) => setIsFeatured(e.target.checked)}
                  className="w-5 h-5 rounded border-gray-300 text-brand focus:ring-brand/20"
                />
                <span>Feature this item on homepage</span>
              </label>
            </div>
          </div>
        </div>

        {/* Logistics & Baker Notes */}
        <div className="bg-white rounded-2xl border border-gray-100 p-6 shadow-sm space-y-5">
          <h2 className="text-sm font-bold uppercase tracking-wider text-gray-400 border-b border-gray-50 pb-2 mb-4">Logistics &amp; Baker Notes</h2>

          <div>
            <label className={labelClass}>Lead Time (Days)</label>
            <input
              type="number"
              min={0}
              value={leadTimeDays}
              onChange={(e) => setLeadTimeDays(Number(e.target.value))}
              className={inputClass}
            />
            <p className="text-xs text-gray-400 mt-1">Minimum days notice required before delivery/pickup.</p>
          </div>

          <div>
            <label className={labelClass}>Allergy Notes</label>
            <textarea
              value={allergyNotes}
              onChange={(e) => setAllergyNotes(e.target.value)}
              placeholder="e.g. Contains wheat gluten. Processed in a kitchen that handles nuts and dairy."
              rows={2}
              className={`${inputClass} resize-none`}
            />
          </div>

          <div>
            <label className={labelClass}>Pickup &amp; Delivery Logistics Notes</label>
            <textarea
              value={pickupNotes}
              onChange={(e) => setPickupNotes(e.target.value)}
              placeholder="e.g. Fresh baking pickups are available Saturdays from 10am-2pm at the Homestead gate."
              rows={2}
              className={`${inputClass} resize-none`}
            />
          </div>
        </div>

        {/* Action button */}
        <div className="flex flex-col-reverse sm:flex-row justify-end gap-3 sm:gap-4 pt-4">
          <button
            type="button"
            onClick={() => router.push('/admin/products')}
            className="w-full sm:w-auto px-6 py-3 border border-gray-200 text-gray-700 font-semibold text-sm rounded-xl hover:bg-gray-50 transition-colors"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={saving}
            className="w-full sm:w-auto px-6 py-3 bg-brand text-white font-bold text-sm rounded-xl hover:bg-brand/90 disabled:opacity-50 transition-colors shadow-sm"
          >
            {saving ? 'Saving...' : isNew ? 'Create Menu Item' : 'Save Changes'}
          </button>
        </div>
      </form>

      <MediaLibraryModal
        isOpen={isLibraryOpen}
        onClose={() => setIsLibraryOpen(false)}
        onSelect={(url) => setImageUrl(url)}
      />
    </div>
  );
}
