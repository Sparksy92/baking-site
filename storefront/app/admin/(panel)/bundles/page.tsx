'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { formatCents } from '@/lib/format';

interface Bundle {
  id: number;
  name: string;
  slug: string;
  discount_type: string;
  discount_value: number;
  is_active: number;
}

export default function BundlesPage() {
  const [bundles, setBundles] = useState<Bundle[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name: '', slug: '', discount_type: 'percent', discount_value: '10' });

  useEffect(() => { load(); }, []);

  async function load() {
    try {
      const data = await api.get<{ bundles: Bundle[] }>('/api/admin/bundles');
      setBundles(data.bundles);
    } catch {} finally { setLoading(false); }
  }

  async function create() {
    await api.post('/api/admin/bundles', {
      ...form, discount_value: parseInt(form.discount_value),
    });
    setShowForm(false);
    setForm({ name: '', slug: '', discount_type: 'percent', discount_value: '10' });
    load();
  }

  if (loading) return <div className="text-gray-400">Loading...</div>;

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Product Bundles</h1>
        <button onClick={() => setShowForm(!showForm)} className="px-4 py-2 bg-brand text-white rounded-lg text-sm font-medium">+ New Bundle</button>
      </div>

      {showForm && (
        <div className="bg-white rounded-xl border border-gray-200 p-4 mb-4 grid grid-cols-2 gap-3">
          <input placeholder="Bundle name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="border border-gray-200 rounded px-3 py-1.5 text-sm" />
          <input placeholder="slug" value={form.slug} onChange={(e) => setForm({ ...form, slug: e.target.value })} className="border border-gray-200 rounded px-3 py-1.5 text-sm" />
          <select value={form.discount_type} onChange={(e) => setForm({ ...form, discount_type: e.target.value })} className="border border-gray-200 rounded px-3 py-1.5 text-sm">
            <option value="percent">Percent Off</option>
            <option value="fixed_cents">Fixed Cents Off</option>
          </select>
          <input placeholder="Discount value" value={form.discount_value} onChange={(e) => setForm({ ...form, discount_value: e.target.value })} className="border border-gray-200 rounded px-3 py-1.5 text-sm" />
          <button onClick={create} className="col-span-2 px-4 py-2 bg-green-600 text-white rounded text-sm">Create Bundle</button>
        </div>
      )}

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Name</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Slug</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Discount</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {bundles.map((b) => (
              <tr key={b.id}>
                <td className="px-4 py-3 font-medium">{b.name}</td>
                <td className="px-4 py-3 text-gray-500">{b.slug}</td>
                <td className="px-4 py-3">{b.discount_type === 'percent' ? `${b.discount_value}%` : formatCents(b.discount_value)}</td>
                <td className="px-4 py-3">
                  <span className={`px-2 py-0.5 rounded text-xs ${b.is_active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                    {b.is_active ? 'Active' : 'Inactive'}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
