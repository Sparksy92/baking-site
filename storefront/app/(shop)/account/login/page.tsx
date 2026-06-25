'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { api, ApiError } from '@/lib/api';
import { useCustomer } from '@/lib/customer';

export default function LoginPage() {
  const router = useRouter();
  const { refresh } = useCustomer();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await api.post('/api/customers/login', { email, password });
      await refresh();
      router.push('/account');
    } catch (err) {
      setError(err instanceof ApiError ? err.detail : 'Login failed');
    } finally {
      setLoading(false);
    }
  }

  const inputClass = "w-full px-4 py-3 rounded-lg border border-gray-200 focus:border-brand focus:ring-0 outline-none text-sm";

  return (
    <div className="max-w-sm mx-auto px-4 py-16">
      <h1 className="text-2xl font-bold text-gray-900 text-center mb-8">Sign In</h1>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label htmlFor="login-email" className="block text-sm font-medium text-gray-700 mb-1">Email</label>
          <input id="login-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required className={inputClass} autoComplete="email" />
        </div>
        <div>
          <label htmlFor="login-password" className="block text-sm font-medium text-gray-700 mb-1">Password</label>
          <input id="login-password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required className={inputClass} autoComplete="current-password" />
        </div>
        {error && <p className="text-sm text-red-600">{error}</p>}
        <button type="submit" disabled={loading} className="w-full py-3 bg-brand text-white font-medium rounded-lg hover:bg-brand/90 disabled:opacity-50">
          {loading ? 'Signing in...' : 'Sign In'}
        </button>
      </form>
      <div className="mt-6 text-center space-y-2 text-sm">
        <p><Link href="/account/forgot-password" className="text-brand hover:underline">Forgot password?</Link></p>
        <p className="text-gray-500">Don&apos;t have an account? <Link href="/account/register" className="text-brand hover:underline">Create one</Link></p>
      </div>
    </div>
  );
}
