'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';

interface Tag { id: number; name: string; slug: string; product_count: number; }

export default function TagsPage() {
  const [tags, setTags] = useState<Tag[]>([]);
  const [loading, setLoading] = useState(true);
  const [newTag, setNewTag] = useState({ name: '', slug: '' });

  useEffect(() => { load(); }, []);

  async function load() {
    try {
      const data = await api.get<{ tags: Tag[] }>('/api/admin/tags');
      setTags(data.tags);
    } catch {} finally { setLoading(false); }
  }

  async function create() {
    if (!newTag.name) return;
    await api.post('/api/admin/tags', newTag);
    setNewTag({ name: '', slug: '' });
    load();
  }

  async function remove(id: number) {
    await api.delete(`/api/admin/tags/${id}`);
    load();
  }

  if (loading) return <div className="text-gray-400">Loading...</div>;

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Tags</h1>

      <div className="bg-white rounded-xl border border-gray-200 p-4 mb-4 flex items-end gap-3">
        <div>
          <label className="text-xs text-gray-500">Name</label>
          <input value={newTag.name} onChange={(e) => setNewTag({ ...newTag, name: e.target.value })} className="block mt-1 border border-gray-200 rounded px-3 py-1.5 text-sm" />
        </div>
        <div>
          <label className="text-xs text-gray-500">Slug</label>
          <input value={newTag.slug} onChange={(e) => setNewTag({ ...newTag, slug: e.target.value })} className="block mt-1 border border-gray-200 rounded px-3 py-1.5 text-sm" />
        </div>
        <button onClick={create} className="px-4 py-1.5 bg-brand text-white rounded text-sm">Add Tag</button>
      </div>

      <div className="flex flex-wrap gap-2">
        {tags.map((t) => (
          <div key={t.id} className="flex items-center gap-2 bg-white border border-gray-200 rounded-lg px-3 py-2">
            <span className="text-sm font-medium">{t.name}</span>
            <span className="text-xs text-gray-400">({t.product_count})</span>
            <button onClick={() => remove(t.id)} className="text-red-400 hover:text-red-600 text-xs">×</button>
          </div>
        ))}
      </div>
    </div>
  );
}
