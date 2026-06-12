'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { api, ApiError } from '@/lib/api';
import { useCustomer } from '@/lib/customer';

export default function RegisterPage() {
  const router = useRouter();
  const { refresh } = useCustomer();
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [acceptsEmailMarketing, setAcceptsEmailMarketing] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }
    setLoading(true);
    try {
      await api.post('/api/customers/register', {
        first_name: firstName,
        last_name: lastName,
        email,
        password,
        accepts_email_marketing: acceptsEmailMarketing,
      });
      await refresh();
      router.push('/account');
    } catch (err) {
      setError(err instanceof ApiError ? err.detail : 'Registration failed');
    } finally {
      setLoading(false);
    }
  }

  const inputClass = "w-full px-4 py-3 rounded-lg border border-gray-200 focus:border-brand focus:ring-0 outline-none text-sm";

  return (
    <div className="max-w-sm mx-auto px-4 py-16">
      <h1 className="text-2xl font-bold text-gray-900 text-center mb-8">Create Account</h1>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label htmlFor="reg-first" className="block text-sm font-medium text-gray-700 mb-1">First name</label>
            <input id="reg-first" type="text" value={firstName} onChange={(e) => setFirstName(e.target.value)} required className={inputClass} autoComplete="given-name" />
          </div>
          <div>
            <label htmlFor="reg-last" className="block text-sm font-medium text-gray-700 mb-1">Last name</label>
            <input id="reg-last" type="text" value={lastName} onChange={(e) => setLastName(e.target.value)} required className={inputClass} autoComplete="family-name" />
          </div>
        </div>
        <div>
          <label htmlFor="reg-email" className="block text-sm font-medium text-gray-700 mb-1">Email</label>
          <input id="reg-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required className={inputClass} autoComplete="email" />
        </div>
        <div>
          <label htmlFor="reg-password" className="block text-sm font-medium text-gray-700 mb-1">Password</label>
          <input id="reg-password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={8} className={inputClass} autoComplete="new-password" />
          <p className="mt-1 text-xs text-gray-500">Minimum 8 characters</p>
        </div>
        <div>
          <label htmlFor="reg-confirm-password" className="block text-sm font-medium text-gray-700 mb-1">Confirm password</label>
          <input id="reg-confirm-password" type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} required minLength={8} className={inputClass} autoComplete="new-password" />
        </div>
        <label className="flex gap-3 text-sm text-gray-600">
          <input
            type="checkbox"
            checked={acceptsEmailMarketing}
            onChange={(e) => setAcceptsEmailMarketing(e.target.checked)}
            className="mt-1 rounded border-gray-300"
          />
          <span>Email me about new products, restocks, and promotions.</span>
        </label>
        {error && <p className="text-sm text-red-600">{error}</p>}
        <button type="submit" disabled={loading} className="w-full py-3 bg-brand text-white font-medium rounded-lg hover:bg-brand/90 disabled:opacity-50">
          {loading ? 'Creating account...' : 'Create Account'}
        </button>
      </form>
      <p className="mt-6 text-center text-sm text-gray-500">
        Already have an account? <Link href="/account/login" className="text-brand hover:underline">Sign in</Link>
      </p>
    </div>
  );
}
