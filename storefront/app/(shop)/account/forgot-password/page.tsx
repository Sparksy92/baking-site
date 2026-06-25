'use client';

import { useState } from 'react';
import Link from 'next/link';
import { api } from '@/lib/api';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      await api.post('/api/customers/forgot-password', { email });
    } catch { /* ignore — always show success */ }
    setSent(true);
    setLoading(false);
  }

  const inputClass = "w-full px-4 py-3 rounded-lg border border-gray-200 focus:border-brand focus:ring-0 outline-none text-sm";

  return (
    <div className="max-w-sm mx-auto px-4 py-16">
      <h1 className="text-2xl font-bold text-gray-900 text-center mb-4">Forgot Password</h1>
      {sent ? (
        <div className="text-center">
          <p className="text-gray-600 mb-6">If an account exists with that email, we&apos;ve sent a password reset link. Check your inbox.</p>
          <Link href="/account/login" className="text-brand hover:underline font-medium text-sm">Back to Sign In</Link>
        </div>
      ) : (
        <>
          <p className="text-sm text-gray-500 text-center mb-8">Enter your email and we&apos;ll send you a link to reset your password.</p>
          <form onSubmit={handleSubmit} className="space-y-4">
            <input type="email" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} required className={inputClass} autoComplete="email" />
            <button type="submit" disabled={loading} className="w-full py-3 bg-brand text-white font-medium rounded-lg hover:bg-brand/90 disabled:opacity-50">
              {loading ? 'Sending...' : 'Send Reset Link'}
            </button>
          </form>
          <p className="mt-6 text-center text-sm text-gray-500">
            <Link href="/account/login" className="text-brand hover:underline">Back to Sign In</Link>
          </p>
        </>
      )}
    </div>
  );
}
