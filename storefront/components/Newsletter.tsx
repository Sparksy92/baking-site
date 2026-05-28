'use client';

import { useState } from 'react';
import { api } from '@/lib/api';
import { addToast } from '@/lib/toast';

export function Newsletter() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!email || loading) return;

    setLoading(true);
    try {
      await api.post('/api/newsletter/subscribe', { email });
      setDone(true);
      setEmail('');
      addToast("You're in! Watch your inbox.", 'success');
    } catch {
      addToast('Could not subscribe. Please try again.', 'error');
    } finally {
      setLoading(false);
    }
  }

  if (done) {
    return (
      <section className="bg-gray-50 py-12 md:py-16">
        <div className="max-w-xl mx-auto px-4 text-center">
          <p className="text-lg font-semibold text-gray-900">Thanks for subscribing!</p>
          <p className="mt-1 text-sm text-gray-500">Check your inbox for updates and drops.</p>
        </div>
      </section>
    );
  }

  return (
    <section className="bg-gray-50 py-12 md:py-16">
      <div className="max-w-xl mx-auto px-4 text-center">
        <h2 className="text-xl font-bold text-gray-900">Stay in the Loop</h2>
        <p className="mt-2 text-sm text-gray-500">
          New drops, restocks, and exclusive offers — straight to your inbox.
        </p>
        <form onSubmit={handleSubmit} className="mt-6 flex gap-2 max-w-md mx-auto">
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="your@email.com"
            className="flex-1 px-4 py-3 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-brand focus:border-transparent"
          />
          <button
            type="submit"
            disabled={loading}
            className="px-6 py-3 bg-brand text-white font-semibold text-sm rounded-xl hover:bg-brand/90 transition-colors disabled:opacity-50"
          >
            {loading ? 'Joining...' : 'Join'}
          </button>
        </form>
      </div>
    </section>
  );
}
