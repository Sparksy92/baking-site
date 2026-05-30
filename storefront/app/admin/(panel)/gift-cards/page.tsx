'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { formatCents } from '@/lib/format';

interface GiftCard {
  id: number;
  code: string;
  initial_balance_cents: number;
  balance_cents: number;
  is_active: number;
  created_at: string;
}

export default function GiftCardsPage() {
  const [cards, setCards] = useState<GiftCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [amount, setAmount] = useState('25.00');

  useEffect(() => { load(); }, []);

  async function load() {
    try {
      const data = await api.get<{ gift_cards: GiftCard[] }>('/api/admin/gift-cards');
      setCards(data.gift_cards);
    } catch {} finally { setLoading(false); }
  }

  async function create() {
    const cents = Math.round(parseFloat(amount) * 100);
    await api.post('/api/admin/gift-cards', { initial_balance_cents: cents });
    setShowCreate(false);
    load();
  }

  async function toggle(id: number, active: boolean) {
    await api.patch(`/api/admin/gift-cards/${id}`, { is_active: active });
    load();
  }

  if (loading) return <div className="text-gray-400">Loading...</div>;

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Gift Cards</h1>
        <button onClick={() => setShowCreate(!showCreate)} className="px-4 py-2 bg-brand text-white rounded-lg text-sm font-medium">+ Issue Card</button>
      </div>

      {showCreate && (
        <div className="bg-white rounded-xl border border-gray-200 p-4 mb-4 flex items-end gap-3">
          <div>
            <label className="text-xs text-gray-500">Amount ($)</label>
            <input value={amount} onChange={(e) => setAmount(e.target.value)} className="block mt-1 border border-gray-200 rounded px-3 py-1.5 text-sm w-32" />
          </div>
          <button onClick={create} className="px-4 py-1.5 bg-green-600 text-white rounded text-sm">Create</button>
        </div>
      )}

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Code</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Initial</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Balance</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Status</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {cards.map((c) => (
              <tr key={c.id}>
                <td className="px-4 py-3 font-mono text-xs">{c.code}</td>
                <td className="px-4 py-3">{formatCents(c.initial_balance_cents)}</td>
                <td className="px-4 py-3 font-medium">{formatCents(c.balance_cents)}</td>
                <td className="px-4 py-3">
                  <span className={`px-2 py-0.5 rounded text-xs ${c.is_active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                    {c.is_active ? 'Active' : 'Inactive'}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <button onClick={() => toggle(c.id, !c.is_active)} className="text-xs text-blue-600 hover:underline">
                    {c.is_active ? 'Deactivate' : 'Activate'}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
