'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Plus, Pencil, Trash2, X, Check } from 'lucide-react';
import { api } from '@/lib/api';

interface Category {
  id: number;
  name: string;
  slug: string;
  description: string | null;
  sort_order: number;
  is_active: number;
  product_count: number;
  created_at: string;
}

export default function AdminCategories() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [message, setMessage] = useState('');

  // Form state
  const [formName, setFormName] = useState('');
  const [formSlug, setFormSlug] = useState('');
  const [formDescription, setFormDescription] = useState('');
  const [formSortOrder, setFormSortOrder] = useState(0);
  const [formIsActive, setFormIsActive] = useState(true);

  async function loadCategories() {
    try {
      const data = await api.get<Category[]>('/api/admin/categories');
      setCategories(data);
    } catch {
      setMessage('Failed to load categories');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { loadCategories(); }, []);

  function resetForm() {
    setFormName('');
    setFormSlug('');
    setFormDescription('');
    setFormSortOrder(0);
    setFormIsActive(true);
  }

  function generateSlug(name: string) {
    return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  }

  async function handleCreate() {
    if (!formName.trim()) return;
    setMessage('');
    try {
      await api.post('/api/admin/categories', {
        name: formName.trim(),
        slug: formSlug.trim() || generateSlug(formName),
        description: formDescription.trim() || null,
        sort_order: formSortOrder,
        is_active: formIsActive,
      });
      setShowCreate(false);
      resetForm();
      await loadCategories();
      setMessage('Category created.');
    } catch (err: unknown) {
      setMessage(err instanceof Error ? err.message : 'Failed to create category');
    }
  }

  function startEdit(cat: Category) {
    setEditingId(cat.id);
    setFormName(cat.name);
    setFormSlug(cat.slug);
    setFormDescription(cat.description || '');
    setFormSortOrder(cat.sort_order);
    setFormIsActive(Boolean(cat.is_active));
  }

  async function handleUpdate() {
    if (!editingId || !formName.trim()) return;
    setMessage('');
    try {
      await api.patch(`/api/admin/categories/${editingId}`, {
        name: formName.trim(),
        slug: formSlug.trim(),
        description: formDescription.trim() || null,
        sort_order: formSortOrder,
        is_active: formIsActive,
      });
      setEditingId(null);
      resetForm();
      await loadCategories();
      setMessage('Category updated.');
    } catch (err: unknown) {
      setMessage(err instanceof Error ? err.message : 'Failed to update category');
    }
  }

  async function handleDelete(id: number, name: string) {
    if (!confirm(`Delete "${name}"? Products will be unlinked from this category.`)) return;
    setMessage('');
    try {
      await api.delete(`/api/admin/categories/${id}`);
      await loadCategories();
      setMessage('Category deleted.');
    } catch {
      setMessage('Failed to delete category');
    }
  }

  if (loading) return <div className="text-gray-400">Loading...</div>;

  const inputClass = "w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:border-brand outline-none";

  return (
    <div className="max-w-4xl">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Categories</h1>
        {!showCreate && (
          <button
            onClick={() => { resetForm(); setShowCreate(true); setEditingId(null); }}
            className="flex items-center gap-1.5 px-4 py-2 bg-brand text-white rounded-lg text-sm font-medium hover:bg-brand/90"
          >
            <Plus size={16} /> New Category
          </button>
        )}
      </div>

      {message && (
        <div className={`mb-4 px-4 py-2 rounded text-sm ${message.includes('Failed') ? 'bg-red-50 text-red-700' : 'bg-green-50 text-green-700'}`}>
          {message}
        </div>
      )}

      {/* Create / Edit Form */}
      {(showCreate || editingId !== null) && (
        <div className="bg-white rounded-xl border border-gray-200 p-5 mb-6">
          <h2 className="font-semibold text-gray-900 mb-4">
            {editingId ? 'Edit Category' : 'New Category'}
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-medium text-gray-600 mb-1 block">Name *</label>
              <input
                type="text"
                value={formName}
                onChange={(e) => {
                  setFormName(e.target.value);
                  if (!editingId) setFormSlug(generateSlug(e.target.value));
                }}
                placeholder="e.g. Hoodies"
                className={inputClass}
              />
            </div>
            <div>
              <label className="text-xs font-medium text-gray-600 mb-1 block">Slug</label>
              <input
                type="text"
                value={formSlug}
                onChange={(e) => setFormSlug(e.target.value)}
                placeholder="auto-generated"
                className={`${inputClass} font-mono text-xs`}
              />
            </div>
            <div className="md:col-span-2">
              <label className="text-xs font-medium text-gray-600 mb-1 block">Description</label>
              <textarea
                value={formDescription}
                onChange={(e) => setFormDescription(e.target.value)}
                rows={2}
                className={`${inputClass} resize-none`}
              />
            </div>
            <div>
              <label className="text-xs font-medium text-gray-600 mb-1 block">Sort Order</label>
              <input
                type="number"
                value={formSortOrder}
                onChange={(e) => setFormSortOrder(parseInt(e.target.value) || 0)}
                className={inputClass}
              />
            </div>
            <div className="flex items-center gap-2 pt-5">
              <input
                type="checkbox"
                id="cat-active"
                checked={formIsActive}
                onChange={(e) => setFormIsActive(e.target.checked)}
                className="rounded border-gray-300"
              />
              <label htmlFor="cat-active" className="text-sm text-gray-700">Active</label>
            </div>
          </div>
          <div className="flex gap-2 mt-4">
            <button
              onClick={editingId ? handleUpdate : handleCreate}
              className="flex items-center gap-1.5 px-4 py-2 bg-brand text-white rounded-lg text-sm font-medium hover:bg-brand/90"
            >
              <Check size={14} /> {editingId ? 'Save' : 'Create'}
            </button>
            <button
              onClick={() => { setShowCreate(false); setEditingId(null); resetForm(); }}
              className="flex items-center gap-1.5 px-4 py-2 border border-gray-200 text-gray-600 rounded-lg text-sm hover:bg-gray-50"
            >
              <X size={14} /> Cancel
            </button>
          </div>
        </div>
      )}

      {/* Categories table */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="px-4 py-3 text-left font-medium text-gray-600">Name</th>
              <th className="px-4 py-3 text-left font-medium text-gray-600">Slug</th>
              <th className="px-4 py-3 text-right font-medium text-gray-600">Products</th>
              <th className="px-4 py-3 text-center font-medium text-gray-600">Order</th>
              <th className="px-4 py-3 text-left font-medium text-gray-600">Status</th>
              <th className="px-4 py-3 text-right font-medium text-gray-600">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {categories.map((cat) => (
              <tr key={cat.id} className="hover:bg-gray-50">
                <td className="px-4 py-3">
                  <span className="font-medium text-gray-900">{cat.name}</span>
                  {cat.description && (
                    <p className="text-xs text-gray-500 mt-0.5 truncate max-w-[200px]">{cat.description}</p>
                  )}
                </td>
                <td className="px-4 py-3 text-gray-500 font-mono text-xs">{cat.slug}</td>
                <td className="px-4 py-3 text-right text-gray-600">{cat.product_count}</td>
                <td className="px-4 py-3 text-center text-gray-500">{cat.sort_order}</td>
                <td className="px-4 py-3">
                  <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                    cat.is_active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'
                  }`}>
                    {cat.is_active ? 'Active' : 'Draft'}
                  </span>
                </td>
                <td className="px-4 py-3 text-right">
                  <div className="flex items-center justify-end gap-1">
                    <Link
                      href={`/admin/categories/${cat.id}`}
                      className="px-2 py-1 text-xs font-medium text-brand hover:underline"
                      title="Edit SEO & details"
                    >
                      SEO
                    </Link>
                    <button
                      onClick={() => startEdit(cat)}
                      className="p-1.5 text-gray-400 hover:text-brand rounded hover:bg-gray-100"
                      title="Quick edit"
                    >
                      <Pencil size={14} />
                    </button>
                    <button
                      onClick={() => handleDelete(cat.id, cat.name)}
                      className="p-1.5 text-gray-400 hover:text-red-600 rounded hover:bg-red-50"
                      title="Delete"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {categories.length === 0 && (
          <p className="text-center text-gray-400 py-8">No categories yet. Create one above.</p>
        )}
      </div>
    </div>
  );
}
