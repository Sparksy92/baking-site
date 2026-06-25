'use client';

import { useEffect, useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { api } from '@/lib/api';

interface Promo {
  id: number;
  code: string;
  description: string | null;
  discount_type: string;
  discount_value: number;
  minimum_order_cents: number;
  max_uses: number | null;
  times_used: number;
  starts_at: string | null;
  expires_at: string | null;
  is_active: boolean;
  created_at: string;
}

export default function AdminPromos() {
  const [promos, setPromos] = useState<Promo[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);

  const [code, setCode] = useState('');
  const [description, setDescription] = useState('');
  const [discountType, setDiscountType] = useState('percent');
  const [discountValue, setDiscountValue] = useState(10);
  const [minOrder, setMinOrder] = useState(0);
  const [maxUses, setMaxUses] = useState<number | ''>('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadPromos();
  }, []);

  async function loadPromos() {
    try {
      const data = await api.get<Promo[]>('/api/admin/promos');
      setPromos(data);
    } catch { /* */ }
    finally { setLoading(false); }
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      await api.post('/api/admin/promos', {
        code: code.trim(),
        description: description.trim() || null,
        discount_type: discountType,
        discount_value: discountValue,
        minimum_order_cents: minOrder,
        max_uses: maxUses || null,
        is_active: true,
      });
      setShowForm(false);
      setCode('');
      setDescription('');
      setDiscountValue(10);
      setMinOrder(0);
      setMaxUses('');
      await loadPromos();
    } catch (err) { console.error(err); }
    finally { setSaving(false); }
  }

  async function toggleActive(id: number, active: boolean) {
    await api.patch(`/api/admin/promos/${id}`, { is_active: !active });
    setPromos((prev) => prev.map((p) => p.id === id ? { ...p, is_active: !active } : p));
  }

  async function deletePromo(id: number) {
    if (!confirm('Delete this promo code?')) return;
    await api.delete(`/api/admin/promos/${id}`);
    setPromos((prev) => prev.filter((p) => p.id !== id));
  }

  if (loading) return <div className="text-gray-400">Loading...</div>;

  const inputClass = 'w-full px-3 py-2 rounded-lg border border-gray-200 focus:border-brand outline-none text-sm';

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Promo Codes</h1>
        <button onClick={() => setShowForm(!showForm)} className="flex items-center gap-1.5 bg-brand text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-brand/90">
          <Plus size={16} /> New Code
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleCreate} className="mb-6 bg-white rounded-xl border border-gray-200 p-5 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-gray-600 mb-1 block">Code</label>
              <input value={code} onChange={(e) => setCode(e.target.value)} required placeholder="SUMMER20" className={inputClass} />
            </div>
            <div>
              <label className="text-xs font-medium text-gray-600 mb-1 block">Description</label>
              <input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Summer sale" className={inputClass} />
            </div>
          </div>
          <div className="grid grid-cols-4 gap-3">
            <div>
              <label className="text-xs font-medium text-gray-600 mb-1 block">Type</label>
              <select value={discountType} onChange={(e) => setDiscountType(e.target.value)} className={inputClass}>
                <option value="percent">Percent</option>
                <option value="fixed_cents">Fixed (cents)</option>
              </select>
            </div>
            <div>
              <label className="text-xs font-medium text-gray-600 mb-1 block">Value</label>
              <input type="number" value={discountValue} onChange={(e) => setDiscountValue(Number(e.target.value))} min={1} required className={inputClass} />
            </div>
            <div>
              <label className="text-xs font-medium text-gray-600 mb-1 block">Min Order (¢)</label>
              <input type="number" value={minOrder} onChange={(e) => setMinOrder(Number(e.target.value))} min={0} className={inputClass} />
            </div>
            <div>
              <label className="text-xs font-medium text-gray-600 mb-1 block">Max Uses</label>
              <input type="number" value={maxUses} onChange={(e) => setMaxUses(e.target.value ? Number(e.target.value) : '')} placeholder="∞" className={inputClass} />
            </div>
          </div>
          <button type="submit" disabled={saving} className="bg-brand text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-brand/90 disabled:opacity-50">
            {saving ? 'Creating...' : 'Create'}
          </button>
        </form>
      )}

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="px-4 py-3 text-left font-medium text-gray-600">Code</th>
              <th className="px-4 py-3 text-left font-medium text-gray-600">Discount</th>
              <th className="px-4 py-3 text-right font-medium text-gray-600">Uses</th>
              <th className="px-4 py-3 text-left font-medium text-gray-600">Status</th>
              <th className="px-4 py-3 text-right font-medium text-gray-600">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {promos.map((p) => (
              <tr key={p.id} className="hover:bg-gray-50">
                <td className="px-4 py-3 font-mono font-medium">{p.code}</td>
                <td className="px-4 py-3 text-gray-600">
                  {p.discount_type === 'percent' ? `${p.discount_value}%` : `$${(p.discount_value / 100).toFixed(2)}`}
                  {p.minimum_order_cents > 0 && <span className="text-xs text-gray-400 ml-1">(min ${(p.minimum_order_cents / 100).toFixed(0)})</span>}
                </td>
                <td className="px-4 py-3 text-right text-gray-600">{p.times_used}{p.max_uses ? `/${p.max_uses}` : ''}</td>
                <td className="px-4 py-3">
                  <button onClick={() => toggleActive(p.id, p.is_active)} className={`px-2 py-0.5 rounded text-xs font-medium ${p.is_active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                    {p.is_active ? 'Active' : 'Inactive'}
                  </button>
                </td>
                <td className="px-4 py-3 text-right">
                  <button onClick={() => deletePromo(p.id)} className="text-gray-400 hover:text-red-500"><Trash2 size={14} /></button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {promos.length === 0 && <p className="text-center text-gray-400 py-8">No promo codes yet</p>}
      </div>
    </div>
  );
}
