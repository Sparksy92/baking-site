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
      <section className="relative overflow-hidden bg-warm py-20 md:py-28">
        <div className="max-w-xl mx-auto px-4 text-center">
          <div className="w-14 h-14 rounded-full bg-sage/15 border border-sage/30 flex items-center justify-center mx-auto mb-5">
            <svg className="w-6 h-6 text-sage" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
            </svg>
          </div>
          <p className="text-2xl font-black text-earth tracking-tight">You&apos;re in.</p>
          <p className="mt-2 text-sm text-muted-earth">Watch your inbox for meaningful updates and drops.</p>
        </div>
      </section>
    );
  }

  return (
    <section className="relative overflow-hidden bg-warm py-20 md:py-28">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(184,92,56,0.05),transparent_70%)]" aria-hidden="true" />

      <div className="relative max-w-2xl mx-auto px-4 text-center">
        <span className="inline-block mb-4 text-[10px] font-black uppercase tracking-[0.28em] text-terracotta">
          Stay Connected
        </span>
        <h2 className="text-3xl sm:text-4xl md:text-5xl font-black tracking-[-0.02em] leading-[0.92] text-earth">
          First access to<br />meaningful drops.
        </h2>
        <p className="mt-5 text-base sm:text-lg text-muted-earth leading-relaxed max-w-md mx-auto">
          New releases, restocks, stories, and community updates — sent with care, never spam.
        </p>

        <form onSubmit={handleSubmit} className="mt-8 flex flex-col sm:flex-row gap-3 max-w-lg mx-auto">
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="your@email.com"
            className="input-earth flex-1"
            aria-label="Email address"
          />
          <button
            type="submit"
            disabled={loading}
            className="flex-shrink-0 px-7 py-3.5 bg-terracotta text-white font-bold text-sm rounded-2xl hover:bg-terracotta/90 transition-all duration-200 hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50 disabled:hover:scale-100 disabled:cursor-not-allowed shadow-earth-sm"
          >
            {loading ? 'Joining...' : 'Join the Community'}
          </button>
        </form>

        <p className="mt-4 text-[11px] text-muted-earth/55">
          No spam. Unsubscribe anytime. We respect your inbox.
        </p>
      </div>
    </section>
  );
}
