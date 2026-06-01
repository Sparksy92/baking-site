'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';

interface SizeGuide { id: number; name: string; category_slug: string | null; measurements_json: string; is_default: number; }

export default function SizeGuidesPage() {
  const [guides, setGuides] = useState<SizeGuide[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const [form, setForm] = useState({ name: '', category_slug: '', measurements_json: '{"columns":["Size","Chest","Length"],"rows":[["S","36","28"],["M","38","29"],["L","40","30"]]}', is_default: false });

  useEffect(() => { load(); }, []);

  async function load() {
    try {
      const data = await api.get<SizeGuide[]>('/api/admin/size-guides');
      setGuides(Array.isArray(data) ? data : []);
    } catch {} finally { setLoading(false); }
  }

  async function create() {
    await api.post('/api/admin/size-guides', {
      ...form, category_slug: form.category_slug || null,
    });
    setShowForm(false);
    load();
  }

  async function remove(id: number) {
    await api.delete(`/api/admin/size-guides/${id}`);
    load();
  }

  if (loading) return <div className="text-gray-400">Loading...</div>;

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Size Guides</h1>
          <button onClick={() => setHelpOpen(!helpOpen)} className="text-xs text-blue-600 hover:underline mt-0.5">What are size guides?</button>
          {helpOpen && <p className="text-sm text-gray-500 mt-2 bg-blue-50 border border-blue-100 rounded-lg p-3">Size guides are measurement charts displayed on product pages to help customers choose the right fit. You can create guides per category (e.g. tops vs pants) or set a default guide. The measurements JSON defines column headers and rows.</p>}
        </div>
        <button onClick={() => setShowForm(!showForm)} className="px-4 py-2 bg-brand text-white rounded-lg text-sm font-medium">+ New Guide</button>
      </div>

      {showForm && (
        <div className="bg-white rounded-xl border border-gray-200 p-4 mb-4 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <input placeholder="Name (e.g. Tees Guide)" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="border border-gray-200 rounded px-3 py-1.5 text-sm" />
            <input placeholder="Category slug (optional)" value={form.category_slug} onChange={(e) => setForm({ ...form, category_slug: e.target.value })} className="border border-gray-200 rounded px-3 py-1.5 text-sm" />
          </div>
          <textarea placeholder="Measurements JSON" value={form.measurements_json} onChange={(e) => setForm({ ...form, measurements_json: e.target.value })} rows={4} className="w-full border border-gray-200 rounded px-3 py-1.5 text-sm font-mono text-xs" />
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={form.is_default} onChange={(e) => setForm({ ...form, is_default: e.target.checked })} />
            Default guide (used when no category match)
          </label>
          <button onClick={create} className="px-4 py-2 bg-green-600 text-white rounded text-sm">Create</button>
        </div>
      )}

      <div className="space-y-3">
        {guides.map((g) => (
          <div key={g.id} className="bg-white rounded-xl border border-gray-200 p-4 flex items-center justify-between">
            <div>
              <h3 className="font-medium text-gray-900">{g.name}</h3>
              <p className="text-xs text-gray-500 mt-0.5">
                {g.category_slug ? `Category: ${g.category_slug}` : 'Global'} {g.is_default ? '(default)' : ''}
              </p>
            </div>
            <button onClick={() => remove(g.id)} className="text-xs text-red-600 hover:underline">Delete</button>
          </div>
        ))}
      </div>
    </div>
  );
}
