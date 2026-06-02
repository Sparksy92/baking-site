'use client';

import { useState } from 'react';
import { formatCents } from '@/lib/format';

interface GiftCardBalance {
  balance_cents: number;
  currency: string;
  expires_at: string | null;
}

export function GiftCardChecker() {
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [balance, setBalance] = useState<GiftCardBalance | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleCheck(e: React.FormEvent) {
    e.preventDefault();
    if (!code) return;

    setLoading(true);
    setError(null);
    setBalance(null);

    try {
      const res = await fetch('/api/gift-cards/check', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: code.trim() }),
      });

      if (res.ok) {
        const data = await res.json();
        setBalance(data);
      } else {
        const err = await res.json();
        setError(err.detail || 'Invalid or expired gift card.');
      }
    } catch (err) {
      setError('An error occurred while checking your balance.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="max-w-md mx-auto bg-white p-8 rounded-2xl shadow-sm border border-gray-100">
      <h2 className="text-2xl font-bold text-gray-900 mb-6 text-center">Check Your Balance</h2>
      
      <form onSubmit={handleCheck} className="space-y-4">
        <div>
          <label htmlFor="code" className="block text-sm font-medium text-gray-700 mb-1">
            Gift Card Code
          </label>
          <input
            type="text"
            id="code"
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            placeholder="XXXX-XXXX-XXXX-XXXX"
            className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-brand uppercase"
            required
          />
        </div>
        
        <button
          type="submit"
          disabled={loading || !code}
          className="w-full py-3 bg-brand text-white font-bold rounded-xl hover:bg-brand/90 transition-all disabled:opacity-50"
        >
          {loading ? 'Checking...' : 'Check Balance'}
        </button>
      </form>

      {error && (
        <div className="mt-6 p-4 bg-red-50 text-red-700 text-sm rounded-xl border border-red-100">
          {error}
        </div>
      )}

      {balance && (
        <div className="mt-6 p-6 bg-green-50 rounded-xl border border-green-100 text-center">
          <div className="text-sm text-green-800 font-medium mb-1">Current Balance</div>
          <div className="text-4xl font-bold text-green-900 mb-2">
            {formatCents(balance.balance_cents)}
          </div>
          {balance.expires_at ? (
            <div className="text-xs text-green-700">
              Expires: {new Date(balance.expires_at).toLocaleDateString()}
            </div>
          ) : (
            <div className="text-xs text-green-700">Does not expire</div>
          )}
        </div>
      )}
    </div>
  );
}
