'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { useCustomer } from '@/lib/customer';
import { api, ApiError } from '@/lib/api';

export default function AccountSettingsPage() {
  const router = useRouter();
  const { customer, loading: authLoading, refresh } = useCustomer();

  // Profile fields
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [phone, setPhone] = useState('');
  const [profileMsg, setProfileMsg] = useState('');
  const [profileSaving, setProfileSaving] = useState(false);

  // Password fields
  const [currentPw, setCurrentPw] = useState('');
  const [newPw, setNewPw] = useState('');
  const [pwMsg, setPwMsg] = useState('');
  const [pwSaving, setPwSaving] = useState(false);

  useEffect(() => {
    if (!authLoading && !customer) router.push('/account/login');
  }, [authLoading, customer, router]);

  useEffect(() => {
    if (customer) {
      setFirstName(customer.first_name);
      setLastName(customer.last_name);
      setPhone(customer.phone || '');
    }
  }, [customer]);

  async function handleProfileSave(e: React.FormEvent) {
    e.preventDefault();
    setProfileMsg('');
    setProfileSaving(true);
    try {
      await api.patch('/api/customers/me', {
        first_name: firstName,
        last_name: lastName,
        phone: phone || null,
      });
      await refresh();
      setProfileMsg('Profile updated.');
    } catch (err) {
      setProfileMsg(err instanceof ApiError ? err.detail : 'Update failed');
    } finally {
      setProfileSaving(false);
    }
  }

  async function handlePasswordChange(e: React.FormEvent) {
    e.preventDefault();
    setPwMsg('');
    setPwSaving(true);
    try {
      await api.post('/api/customers/me/change-password', {
        current_password: currentPw,
        new_password: newPw,
      });
      setPwMsg('Password updated.');
      setCurrentPw('');
      setNewPw('');
    } catch (err) {
      setPwMsg(err instanceof ApiError ? err.detail : 'Failed to change password');
    } finally {
      setPwSaving(false);
    }
  }

  if (authLoading || !customer) return null;

  const inputClass = "w-full px-4 py-3 rounded-lg border border-gray-200 focus:border-brand focus:ring-0 outline-none text-sm";

  return (
    <div className="max-w-lg mx-auto px-4 py-8">
      <Link href="/account" className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 mb-4">
        <ArrowLeft size={14} /> Back to Account
      </Link>

      <h1 className="text-2xl font-bold text-gray-900 mb-8">Account Settings</h1>

      {/* Profile */}
      <section className="mb-10">
        <h2 className="text-sm font-semibold text-gray-900 mb-4">Profile</h2>
        <form onSubmit={handleProfileSave} className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">First name</label>
              <input type="text" value={firstName} onChange={(e) => setFirstName(e.target.value)} required className={inputClass} />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Last name</label>
              <input type="text" value={lastName} onChange={(e) => setLastName(e.target.value)} required className={inputClass} />
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Email</label>
            <input type="email" value={customer.email} disabled className={`${inputClass} bg-gray-50 text-gray-400`} />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Phone (optional)</label>
            <input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} className={inputClass} />
          </div>
          {profileMsg && <p className={`text-sm ${profileMsg.includes('fail') ? 'text-red-600' : 'text-green-600'}`}>{profileMsg}</p>}
          <button type="submit" disabled={profileSaving} className="px-5 py-2.5 bg-brand text-white text-sm font-medium rounded-lg hover:bg-brand/90 disabled:opacity-50">
            {profileSaving ? 'Saving...' : 'Save Profile'}
          </button>
        </form>
      </section>

      {/* Password */}
      <section>
        <h2 className="text-sm font-semibold text-gray-900 mb-4">Change Password</h2>
        <form onSubmit={handlePasswordChange} className="space-y-3">
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Current password</label>
            <input type="password" value={currentPw} onChange={(e) => setCurrentPw(e.target.value)} required className={inputClass} autoComplete="current-password" />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">New password</label>
            <input type="password" value={newPw} onChange={(e) => setNewPw(e.target.value)} required minLength={8} className={inputClass} autoComplete="new-password" />
            <p className="mt-1 text-xs text-gray-500">Minimum 8 characters</p>
          </div>
          {pwMsg && <p className={`text-sm ${pwMsg.includes('fail') || pwMsg.includes('incorrect') ? 'text-red-600' : 'text-green-600'}`}>{pwMsg}</p>}
          <button type="submit" disabled={pwSaving} className="px-5 py-2.5 bg-gray-900 text-white text-sm font-medium rounded-lg hover:bg-gray-800 disabled:opacity-50">
            {pwSaving ? 'Updating...' : 'Change Password'}
          </button>
        </form>
      </section>
    </div>
  );
}
