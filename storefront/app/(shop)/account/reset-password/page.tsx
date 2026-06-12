'use client';

import { useState } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { api, ApiError } from '@/lib/api';

export default function ResetPasswordPage() {
  const searchParams = useSearchParams();
  const token = searchParams.get('token') || '';
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [done, setDone] = useState(false);
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
      await api.post('/api/customers/reset-password', { token, new_password: password });
      setDone(true);
    } catch (err) {
      setError(err instanceof ApiError ? err.detail : 'Reset failed');
    } finally {
      setLoading(false);
    }
  }

  const inputClass = "w-full px-4 py-3 rounded-lg border border-gray-200 focus:border-brand focus:ring-0 outline-none text-sm";

  if (!token) {
    return (
      <div className="max-w-sm mx-auto px-4 py-16 text-center">
        <p className="text-red-600 mb-4">Invalid reset link.</p>
        <Link href="/account/forgot-password" className="text-brand hover:underline font-medium text-sm">Request a new one</Link>
      </div>
    );
  }

  return (
    <div className="max-w-sm mx-auto px-4 py-16">
      <h1 className="text-2xl font-bold text-gray-900 text-center mb-8">Set New Password</h1>
      {done ? (
        <div className="text-center">
          <p className="text-gray-600 mb-6">Your password has been reset.</p>
          <Link href="/account/login" className="text-brand hover:underline font-medium">Sign In</Link>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">New password</label>
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={8} className={inputClass} autoComplete="new-password" />
            <p className="mt-1 text-xs text-gray-500">Minimum 8 characters</p>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Confirm new password</label>
            <input type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} required minLength={8} className={inputClass} autoComplete="new-password" />
          </div>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <button type="submit" disabled={loading} className="w-full py-3 bg-brand text-white font-medium rounded-lg hover:bg-brand/90 disabled:opacity-50">
            {loading ? 'Resetting...' : 'Reset Password'}
          </button>
        </form>
      )}
    </div>
  );
}
