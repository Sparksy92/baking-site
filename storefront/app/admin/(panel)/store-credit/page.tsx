'use client';

import { useState } from 'react';
import { CreditCard, Search, Plus, Minus } from 'lucide-react';
import { api } from '@/lib/api';

type Transaction = {
  id: number;
  amount_cents: number;
  balance_after_cents: number;
  reason: string;
  order_id: number | null;
  issued_by: string | null;
  created_at: string;
};

type CustomerCredit = {
  customer_id: number;
  balance_cents: number;
  transactions: Transaction[];
};

function cents(n: number) {
  return `$${(n / 100).toFixed(2)}`;
}

export default function StoreCreditPage() {
  const [customerId, setCustomerId] = useState('');
  const [data, setData] = useState<CustomerCredit | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const [issueAmount, setIssueAmount] = useState('');
  const [issueReason, setIssueReason] = useState('manual');
  const [adjustAmount, setAdjustAmount] = useState('');
  const [adjustReason, setAdjustReason] = useState('adjustment');
  const [actionLoading, setActionLoading] = useState(false);
  const [actionMsg, setActionMsg] = useState('');

  async function lookup() {
    const id = parseInt(customerId);
    if (!id) return;
    setLoading(true);
    setError('');
    setData(null);
    try {
      const result = await api.get<CustomerCredit>(`/api/admin/store-credit/${id}`);
      setData(result);
    } catch {
      setError('Customer not found or has no store credit record.');
    } finally {
      setLoading(false);
    }
  }

  async function handleIssue() {
    if (!data || !issueAmount) return;
    const cents = Math.round(parseFloat(issueAmount) * 100);
    if (cents <= 0) return;
    setActionLoading(true);
    setActionMsg('');
    try {
      await api.post('/api/admin/store-credit', {
        customer_id: data.customer_id,
        amount_cents: cents,
        reason: issueReason,
      });
      setActionMsg(`Issued ${cents / 100 > 0 ? '$' + (cents / 100).toFixed(2) : ''} store credit.`);
      setIssueAmount('');
      await lookup();
    } catch {
      setActionMsg('Failed to issue credit.');
    } finally {
      setActionLoading(false);
    }
  }

  async function handleAdjust(sign: 1 | -1) {
    if (!data || !adjustAmount) return;
    const cents = Math.round(parseFloat(adjustAmount) * 100) * sign;
    setActionLoading(true);
    setActionMsg('');
    try {
      await api.patch(`/api/admin/store-credit/${data.customer_id}`, {
        amount_cents: cents,
        reason: adjustReason,
      });
      setActionMsg(`Balance adjusted by ${sign > 0 ? '+' : ''}${(cents / 100).toFixed(2)}.`);
      setAdjustAmount('');
      await lookup();
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Adjustment failed.';
      setActionMsg(msg);
    } finally {
      setActionLoading(false);
    }
  }

  return (
    <div className="max-w-3xl space-y-6">
      <div className="flex items-center gap-2">
        <CreditCard size={20} className="text-brand" />
        <h1 className="text-xl font-bold text-gray-900">Store Credit</h1>
      </div>

      {/* Lookup */}
      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <h2 className="font-semibold text-gray-700 mb-3">Look up customer</h2>
        <div className="flex gap-2">
          <input
            type="number"
            placeholder="Customer ID"
            value={customerId}
            onChange={(e) => setCustomerId(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && lookup()}
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm flex-1"
          />
          <button
            onClick={lookup}
            disabled={loading}
            className="flex items-center gap-1.5 bg-brand text-white px-4 py-2 rounded-lg text-sm hover:opacity-90 disabled:opacity-50"
          >
            <Search size={14} />
            Look up
          </button>
        </div>
        {error && <p className="text-red-500 text-sm mt-2">{error}</p>}
      </div>

      {data && (
        <>
          {/* Balance */}
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">Customer #{data.customer_id}</p>
                <p className="text-2xl font-bold text-gray-900 mt-1">{cents(data.balance_cents)}</p>
                <p className="text-sm text-gray-500">available store credit</p>
              </div>
            </div>
          </div>

          {/* Issue credit */}
          <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-3">
            <h2 className="font-semibold text-gray-700">Issue credit</h2>
            <div className="flex gap-2">
              <input
                type="number"
                placeholder="Amount ($)"
                value={issueAmount}
                onChange={(e) => setIssueAmount(e.target.value)}
                className="border border-gray-300 rounded-lg px-3 py-2 text-sm w-32"
                min="0.01"
                step="0.01"
              />
              <input
                type="text"
                placeholder="Reason"
                value={issueReason}
                onChange={(e) => setIssueReason(e.target.value)}
                className="border border-gray-300 rounded-lg px-3 py-2 text-sm flex-1"
              />
              <button
                onClick={handleIssue}
                disabled={actionLoading || !issueAmount}
                className="flex items-center gap-1.5 bg-green-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-green-700 disabled:opacity-50"
              >
                <Plus size={14} />
                Issue
              </button>
            </div>
          </div>

          {/* Adjust */}
          <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-3">
            <h2 className="font-semibold text-gray-700">Adjust balance</h2>
            <div className="flex gap-2">
              <input
                type="number"
                placeholder="Amount ($)"
                value={adjustAmount}
                onChange={(e) => setAdjustAmount(e.target.value)}
                className="border border-gray-300 rounded-lg px-3 py-2 text-sm w-32"
                min="0.01"
                step="0.01"
              />
              <input
                type="text"
                placeholder="Reason"
                value={adjustReason}
                onChange={(e) => setAdjustReason(e.target.value)}
                className="border border-gray-300 rounded-lg px-3 py-2 text-sm flex-1"
              />
              <button
                onClick={() => handleAdjust(1)}
                disabled={actionLoading || !adjustAmount}
                className="flex items-center gap-1.5 bg-blue-600 text-white px-3 py-2 rounded-lg text-sm hover:bg-blue-700 disabled:opacity-50"
              >
                <Plus size={14} />
                Add
              </button>
              <button
                onClick={() => handleAdjust(-1)}
                disabled={actionLoading || !adjustAmount}
                className="flex items-center gap-1.5 bg-orange-500 text-white px-3 py-2 rounded-lg text-sm hover:bg-orange-600 disabled:opacity-50"
              >
                <Minus size={14} />
                Deduct
              </button>
            </div>
            {actionMsg && (
              <p className="text-sm text-gray-600">{actionMsg}</p>
            )}
          </div>

          {/* Transaction history */}
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <h2 className="font-semibold text-gray-700 mb-3">Transaction history</h2>
            {data.transactions.length === 0 ? (
              <p className="text-sm text-gray-400">No transactions yet.</p>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-gray-500 border-b border-gray-100">
                    <th className="pb-2 font-medium">Date</th>
                    <th className="pb-2 font-medium">Amount</th>
                    <th className="pb-2 font-medium">Balance after</th>
                    <th className="pb-2 font-medium">Reason</th>
                    <th className="pb-2 font-medium">Issued by</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {data.transactions.map((t) => (
                    <tr key={t.id}>
                      <td className="py-2 text-gray-500">{new Date(t.created_at).toLocaleDateString()}</td>
                      <td className={`py-2 font-medium ${t.amount_cents >= 0 ? 'text-green-600' : 'text-red-500'}`}>
                        {t.amount_cents >= 0 ? '+' : ''}{cents(t.amount_cents)}
                      </td>
                      <td className="py-2 text-gray-700">{cents(t.balance_after_cents)}</td>
                      <td className="py-2 text-gray-600 capitalize">{t.reason}</td>
                      <td className="py-2 text-gray-500">{t.issued_by ?? '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </>
      )}
    </div>
  );
}
