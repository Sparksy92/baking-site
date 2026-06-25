'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Plus, Trash2, Star } from 'lucide-react';
import { useCustomer } from '@/lib/customer';
import { api, type CustomerAddress } from '@/lib/api';

const PROVINCES = [
  { value: 'AB', label: 'Alberta' }, { value: 'BC', label: 'British Columbia' },
  { value: 'MB', label: 'Manitoba' }, { value: 'NB', label: 'New Brunswick' },
  { value: 'NL', label: 'Newfoundland and Labrador' }, { value: 'NS', label: 'Nova Scotia' },
  { value: 'NT', label: 'Northwest Territories' }, { value: 'NU', label: 'Nunavut' },
  { value: 'ON', label: 'Ontario' }, { value: 'PE', label: 'Prince Edward Island' },
  { value: 'QC', label: 'Quebec' }, { value: 'SK', label: 'Saskatchewan' },
  { value: 'YT', label: 'Yukon' },
];

export default function AddressesPage() {
  const router = useRouter();
  const { customer, loading: authLoading } = useCustomer();
  const [addresses, setAddresses] = useState<CustomerAddress[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  // Form fields
  const [label, setLabel] = useState('Home');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [line1, setLine1] = useState('');
  const [line2, setLine2] = useState('');
  const [city, setCity] = useState('');
  const [province, setProvince] = useState('');
  const [postalCode, setPostalCode] = useState('');
  const [phone, setPhone] = useState('');
  const [isDefault, setIsDefault] = useState(false);

  useEffect(() => {
    if (!authLoading && !customer) router.push('/account/login');
  }, [authLoading, customer, router]);

  useEffect(() => {
    if (customer) loadAddresses();
  }, [customer]);

  async function loadAddresses() {
    try {
      const data = await api.get<CustomerAddress[]>('/api/customers/me/addresses');
      setAddresses(data);
    } catch { /* ignore */ }
    setLoading(false);
  }

  function resetForm() {
    setLabel('Home');
    setFirstName(customer?.first_name || '');
    setLastName(customer?.last_name || '');
    setLine1(''); setLine2(''); setCity('');
    setProvince('ON'); setPostalCode(''); setPhone('');
    setIsDefault(false); setError('');
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      await api.post('/api/customers/me/addresses', {
        label, first_name: firstName, last_name: lastName,
        line1, line2: line2 || null, city, province,
        postal_code: postalCode, country: 'CA', phone: phone || null,
        is_default: isDefault,
      });
      resetForm();
      setShowForm(false);
      await loadAddresses();
    } catch {
      setError('Failed to save address');
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: number) {
    if (!confirm('Delete this address?')) return;
    await api.delete(`/api/customers/me/addresses/${id}`);
    await loadAddresses();
  }

  async function handleSetDefault(id: number) {
    await api.patch(`/api/customers/me/addresses/${id}`, { is_default: true });
    await loadAddresses();
  }

  if (authLoading || !customer) return null;

  const inputClass = "w-full px-4 py-3 rounded-lg border border-gray-200 focus:border-brand focus:ring-0 outline-none text-sm";

  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      <Link href="/account" className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 mb-4">
        <ArrowLeft size={14} /> Back to Account
      </Link>

      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Saved Addresses</h1>
        <button
          onClick={() => { resetForm(); setShowForm(!showForm); }}
          className="flex items-center gap-1.5 text-sm font-medium text-brand hover:text-brand/80"
        >
          <Plus size={16} /> Add Address
        </button>
      </div>

      {/* Add form */}
      {showForm && (
        <form onSubmit={handleCreate} className="bg-gray-50 rounded-xl p-5 mb-6 space-y-3">
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Label</label>
              <input type="text" value={label} onChange={(e) => setLabel(e.target.value)} className={inputClass} />
            </div>
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
            <label htmlFor="address" className="block text-xs font-medium text-gray-600 mb-1">Address</label>
            <input id="address" name="address" type="text" value={line1} onChange={(e) => setLine1(e.target.value)} required className={inputClass} />
          </div>
          <input type="text" placeholder="Apt / Suite (optional)" value={line2} onChange={(e) => setLine2(e.target.value)} className={inputClass} />
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="city" className="block text-xs font-medium text-gray-600 mb-1">City</label>
              <input id="city" name="city" type="text" value={city} onChange={(e) => setCity(e.target.value)} required className={inputClass} />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Province</label>
              <select value={province} onChange={(e) => setProvince(e.target.value)} required className={inputClass}>
                <option value="" disabled>Select</option>
                {PROVINCES.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="postal" className="block text-xs font-medium text-gray-600 mb-1">Postal code</label>
              <input id="postal" name="postal" type="text" value={postalCode} onChange={(e) => setPostalCode(e.target.value)} required className={inputClass} />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Phone (optional)</label>
              <input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} className={inputClass} />
            </div>
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={isDefault} onChange={(e) => setIsDefault(e.target.checked)} className="rounded border-gray-300" />
            Set as default address
          </label>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <div className="flex gap-2">
            <button type="submit" disabled={saving} className="px-5 py-2.5 bg-brand text-white text-sm font-medium rounded-lg hover:bg-brand/90 disabled:opacity-50">
              {saving ? 'Saving...' : 'Save Address'}
            </button>
            <button type="button" onClick={() => setShowForm(false)} className="px-5 py-2.5 text-sm text-gray-600 hover:text-gray-800">Cancel</button>
          </div>
        </form>
      )}

      {/* Address list */}
      {loading ? (
        <p className="text-gray-400 py-8 text-center">Loading...</p>
      ) : addresses.length === 0 ? (
        <p className="text-gray-400 py-8 text-center">No saved addresses</p>
      ) : (
        <div className="space-y-3">
          {addresses.map((addr) => (
            <div key={addr.id} className="p-4 bg-white border border-gray-100 rounded-xl flex justify-between">
              <div className="text-sm">
                <div className="flex items-center gap-2 mb-1">
                  <span className="font-medium text-gray-900">{addr.label}</span>
                  {addr.is_default && <span className="text-xs text-brand font-medium flex items-center gap-0.5"><Star size={10} /> Default</span>}
                </div>
                <p>{addr.first_name} {addr.last_name}</p>
                <p className="text-gray-500">{addr.line1}{addr.line2 ? `, ${addr.line2}` : ''}</p>
                <p className="text-gray-500">{addr.city}, {addr.province} {addr.postal_code}</p>
                {addr.phone && <p className="text-gray-500">{addr.phone}</p>}
              </div>
              <div className="flex flex-col gap-1">
                {!addr.is_default && (
                  <button onClick={() => handleSetDefault(addr.id)} className="text-xs text-brand hover:underline">Set default</button>
                )}
                <button onClick={() => handleDelete(addr.id)} className="text-gray-400 hover:text-red-500"><Trash2 size={14} /></button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
