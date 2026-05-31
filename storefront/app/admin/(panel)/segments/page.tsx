'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';

interface Segment { id: number; name: string; description: string | null; rules_json: string | null; member_count: number; }

export default function SegmentsPage() {
  const [segments, setSegments] = useState<Segment[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name: '', description: '' });
  const [helpOpen, setHelpOpen] = useState(false);

  useEffect(() => { load(); }, []);

  async function load() {
    try {
      const data = await api.get<Segment[]>('/api/admin/segments');
      setSegments(Array.isArray(data) ? data : []);
    } catch {} finally { setLoading(false); }
  }

  async function create() {
    await api.post('/api/admin/segments', form);
    setShowForm(false);
    setForm({ name: '', description: '' });
    load();
  }

  if (loading) return <div className="text-gray-400">Loading...</div>;

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Customer Segments</h1>
          <button onClick={() => setHelpOpen(!helpOpen)} className="text-xs text-blue-600 hover:underline mt-0.5">What are segments?</button>
          {helpOpen && <p className="text-sm text-gray-500 mt-2 bg-blue-50 border border-blue-100 rounded-lg p-3">Segments group customers by shared traits — e.g. "Repeat Buyers", "VIP ($500+ spent)", "Inactive 90 days". Use segments to target newsletter campaigns, apply exclusive promos, or analyze customer behavior by cohort.</p>}
        </div>
        <button onClick={() => setShowForm(!showForm)} className="px-4 py-2 bg-brand text-white rounded-lg text-sm font-medium">+ New Segment</button>
      </div>

      {showForm && (
        <div className="bg-white rounded-xl border border-gray-200 p-4 mb-4 flex items-end gap-3">
          <div>
            <label className="text-xs text-gray-500">Name</label>
            <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="block mt-1 border border-gray-200 rounded px-3 py-1.5 text-sm" />
          </div>
          <div className="flex-1">
            <label className="text-xs text-gray-500">Description</label>
            <input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} className="block mt-1 w-full border border-gray-200 rounded px-3 py-1.5 text-sm" />
          </div>
          <button onClick={create} className="px-4 py-1.5 bg-green-600 text-white rounded text-sm">Create</button>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {segments.map((s) => (
          <div key={s.id} className="bg-white rounded-xl border border-gray-200 p-4">
            <h3 className="font-medium text-gray-900">{s.name}</h3>
            {s.description && <p className="text-sm text-gray-500 mt-1">{s.description}</p>}
            <p className="text-xs text-gray-400 mt-2">{s.member_count} members</p>
          </div>
        ))}
      </div>
    </div>
  );
}
