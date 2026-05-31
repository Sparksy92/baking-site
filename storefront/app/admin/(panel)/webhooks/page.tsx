'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';

interface WebhookItem { id: number; url: string; events: string; is_active: number; created_at: string; }

const VALID_EVENTS = ['order.created', 'order.completed', 'order.cancelled', 'order.refunded', 'customer.created', 'newsletter.subscribed', 'return.requested', 'return.approved', 'return.received'];

export default function WebhooksPage() {
  const [hooks, setHooks] = useState<WebhookItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ url: '', events: [] as string[], secret: '' });
  const [helpOpen, setHelpOpen] = useState(false);

  useEffect(() => { load(); }, []);

  async function load() {
    try {
      const data = await api.get<WebhookItem[]>('/api/admin/webhooks');
      setHooks(Array.isArray(data) ? data : []);
    } catch {} finally { setLoading(false); }
  }

  async function create() {
    await api.post('/api/admin/webhooks', { url: form.url, events: form.events.join(','), secret: form.secret || undefined });
    setShowForm(false);
    setForm({ url: '', events: [], secret: '' });
    load();
  }

  async function remove(id: number) {
    await api.delete(`/api/admin/webhooks/${id}`);
    load();
  }

  async function toggle(id: number, active: boolean) {
    await api.patch(`/api/admin/webhooks/${id}`, { is_active: active });
    load();
  }

  if (loading) return <div className="text-gray-400">Loading...</div>;

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Webhooks</h1>
          <button onClick={() => setHelpOpen(!helpOpen)} className="text-xs text-blue-600 hover:underline mt-0.5">What are webhooks?</button>
          {helpOpen && <p className="text-sm text-gray-500 mt-2 bg-blue-50 border border-blue-100 rounded-lg p-3">Webhooks send real-time HTTP notifications to external services when events happen in your store (e.g. new order, return requested). Use them to integrate with shipping providers, accounting software, or custom automation.</p>}
        </div>
        <button onClick={() => setShowForm(!showForm)} className="px-4 py-2 bg-brand text-white rounded-lg text-sm font-medium">+ Add Webhook</button>
      </div>

      {showForm && (
        <div className="bg-white rounded-xl border border-gray-200 p-4 mb-4 space-y-3">
          <input placeholder="Endpoint URL (https://...)" value={form.url} onChange={(e) => setForm({ ...form, url: e.target.value })} className="w-full border border-gray-200 rounded px-3 py-1.5 text-sm" />
          <input placeholder="Secret (optional, for HMAC signature)" value={form.secret} onChange={(e) => setForm({ ...form, secret: e.target.value })} className="w-full border border-gray-200 rounded px-3 py-1.5 text-sm" />
          <div className="flex flex-wrap gap-2">
            {VALID_EVENTS.map((ev) => (
              <label key={ev} className="flex items-center gap-1.5 text-xs">
                <input type="checkbox" checked={form.events.includes(ev)} onChange={(e) => {
                  setForm({ ...form, events: e.target.checked ? [...form.events, ev] : form.events.filter((x) => x !== ev) });
                }} />
                {ev}
              </label>
            ))}
          </div>
          <button onClick={create} disabled={!form.url || form.events.length === 0} className="px-4 py-2 bg-green-600 text-white rounded text-sm disabled:opacity-50">Create</button>
        </div>
      )}

      <div className="space-y-3">
        {hooks.map((h) => (
          <div key={h.id} className="bg-white rounded-xl border border-gray-200 p-4 flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-900 font-mono">{h.url}</p>
              <p className="text-xs text-gray-500 mt-0.5">{h.events}</p>
            </div>
            <div className="flex gap-2">
              <button onClick={() => toggle(h.id, !h.is_active)} className={`text-xs px-2 py-1 rounded ${h.is_active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                {h.is_active ? 'Active' : 'Disabled'}
              </button>
              <button onClick={() => remove(h.id)} className="text-xs text-red-600 hover:underline">Delete</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
