'use client';

import { useState } from 'react';
import { addToast } from '@/lib/toast';

export function NotifyMeButton({ variantId, productName }: { variantId: number; productName: string }) {
  const [isOpen, setIsOpen] = useState(false);
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [subscribed, setSubscribed] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!email) return;

    setLoading(true);
    try {
      const res = await fetch('/api/notifications/back-in-stock', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, variant_id: variantId }),
      });

      if (res.ok || res.status === 409) {
        setSubscribed(true);
        addToast('You will be notified when this item is restocked.', 'success');
        setTimeout(() => setIsOpen(false), 2000);
      } else {
        const data = await res.json();
        addToast(data.detail || 'Failed to subscribe', 'error');
      }
    } catch (err) {
      addToast('An error occurred. Please try again.', 'error');
    } finally {
      setLoading(false);
    }
  }

  if (subscribed && !isOpen) {
    return (
      <button
        disabled
        className="mt-8 w-full py-4 rounded-xl font-bold text-base bg-gray-100 text-gray-500 cursor-not-allowed"
      >
        Notification Set
      </button>
    );
  }

  if (!isOpen) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        className="mt-8 w-full py-4 rounded-xl font-bold text-base transition-all bg-brand text-white hover:bg-brand/90 active:scale-[0.98]"
      >
        Notify Me When Available
      </button>
    );
  }

  return (
    <div className="mt-8 p-4 border border-gray-200 rounded-xl bg-gray-50">
      <h4 className="font-semibold text-gray-900 mb-2">Get notified when back in stock</h4>
      <form onSubmit={handleSubmit} className="flex gap-2">
        <input
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="your@email.com"
          className="flex-1 px-4 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-brand"
        />
        <button
          type="submit"
          disabled={loading}
          className="px-4 py-2 bg-brand text-white font-bold text-sm rounded-lg hover:bg-brand/90 disabled:opacity-50"
        >
          {loading ? '...' : 'Notify Me'}
        </button>
      </form>
    </div>
  );
}
