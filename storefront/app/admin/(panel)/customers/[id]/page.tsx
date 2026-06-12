'use client';

import { useCallback, useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, KeyRound, Save, UserCheck, UserX } from 'lucide-react';
import { api, ApiError } from '@/lib/api';
import { formatCents } from '@/lib/format';

type CustomerDetail = {
  customer: {
    id: number;
    email: string;
    first_name: string;
    last_name: string;
    phone: string | null;
    is_active: number;
    customer_type: string;
    marketing_email_status: string;
    marketing_email_source: string | null;
    marketing_email_consented_at: string | null;
    internal_note: string | null;
    loyalty_points: number;
    lifetime_points: number;
    store_credit_cents: number;
    order_count: number;
    lifetime_spend_cents: number;
    last_order_at: string | null;
    last_login: string | null;
    created_at: string;
  };
  addresses: Array<Record<string, string | number | null>>;
  orders: Array<{ id: number; order_number: string; status: string; payment_status: string; total_cents: number; created_at: string }>;
  segments: Array<{ id: number; name: string; slug: string }>;
  tags: string[];
  store_credit_transactions: Array<Record<string, string | number | null>>;
  loyalty_transactions: Array<Record<string, string | number | null>>;
  consent_events: Array<Record<string, string | number | null>>;
  notes: Array<{ id: number; note: string; created_by: string | null; created_at: string }>;
};

const CUSTOMER_TYPES = ['registered', 'guest', 'newsletter_only', 'wholesale', 'admin_created', 'imported', 'test'];
const MARKETING_STATUSES = ['subscribed', 'unsubscribed', 'non_subscribed', 'suppressed', 'bounced'];

function label(value: string) {
  return value.replace(/_/g, ' ');
}

export default function AdminCustomerDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const [data, setData] = useState<CustomerDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [resetMessage, setResetMessage] = useState('');
  const [resetUrl, setResetUrl] = useState('');
  const [resetSending, setResetSending] = useState(false);

  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [phone, setPhone] = useState('');
  const [customerType, setCustomerType] = useState('registered');
  const [marketingStatus, setMarketingStatus] = useState('non_subscribed');
  const [marketingSource, setMarketingSource] = useState('admin');
  const [internalNote, setInternalNote] = useState('');
  const [tagsInput, setTagsInput] = useState('');
  const [newNote, setNewNote] = useState('');

  const load = useCallback(async () => {
    const result = await api.get<CustomerDetail>(`/api/admin/customers/${params.id}`);
    setData(result);
    setFirstName(result.customer.first_name);
    setLastName(result.customer.last_name);
    setPhone(result.customer.phone || '');
    setCustomerType(result.customer.customer_type);
    setMarketingStatus(result.customer.marketing_email_status);
    setMarketingSource(result.customer.marketing_email_source || 'admin');
    setInternalNote(result.customer.internal_note || '');
    setTagsInput(result.tags.join(', '));
  }, [params.id]);

  useEffect(() => {
    load()
      .catch(() => router.push('/admin/customers'))
      .finally(() => setLoading(false));
  }, [load, router]);

  async function saveProfile() {
    setSaving(true);
    setMessage('');
    try {
      await api.patch(`/api/admin/customers/${params.id}`, {
        first_name: firstName,
        last_name: lastName,
        phone: phone || null,
        customer_type: customerType,
        marketing_email_status: marketingStatus,
        marketing_email_source: marketingSource || 'admin',
        internal_note: internalNote,
      });
      const tags = tagsInput.split(',').map((tag) => tag.trim()).filter(Boolean);
      await api.put(`/api/admin/customers/${params.id}/tags`, { tags });
      setMessage('Customer updated.');
      await load();
    } catch (err) {
      setMessage(err instanceof ApiError ? err.detail : 'Failed to update customer.');
    } finally {
      setSaving(false);
    }
  }

  async function toggleActive() {
    if (!data) return;
    const action = data.customer.is_active ? 'deactivate' : 'activate';
    await api.post(`/api/admin/customers/${params.id}/${action}`);
    await load();
  }

  async function createResetToken() {
    if (!data) return;
    if (!confirm(`Send a password reset email to ${data.customer.email}?`)) return;
    setResetMessage('');
    setResetUrl('');
    setResetSending(true);
    try {
      const result = await api.post<{ email_sent: boolean; email_error: string | null; reset_url: string | null }>(`/api/admin/customers/${params.id}/password-reset`);
      setResetMessage(result.email_sent ? 'Password reset email sent.' : 'Reset token created, but email failed to send.');
      if (result.reset_url) setResetUrl(result.reset_url);
      await load();
    } catch (err) {
      setResetMessage(err instanceof ApiError ? err.detail : 'Failed to create password reset.');
    } finally {
      setResetSending(false);
    }
  }

  async function addNote() {
    if (!newNote.trim()) return;
    await api.post(`/api/admin/customers/${params.id}/notes`, { note: newNote.trim() });
    setNewNote('');
    await load();
  }

  if (loading) return <div className="text-gray-400">Loading customer...</div>;
  if (!data) return null;

  const customer = data.customer;

  return (
    <div className="space-y-6">
      <Link href="/admin/customers" className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700">
        <ArrowLeft size={14} />
        Customers
      </Link>

      <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{customer.first_name} {customer.last_name}</h1>
          <p className="text-sm text-gray-500 mt-1">{customer.email}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={toggleActive}
            className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium ${
              customer.is_active ? 'bg-red-50 text-red-700 hover:bg-red-100' : 'bg-green-50 text-green-700 hover:bg-green-100'
            }`}
          >
            {customer.is_active ? <UserX size={16} /> : <UserCheck size={16} />}
            {customer.is_active ? 'Deactivate' : 'Activate'}
          </button>
          <button
            onClick={createResetToken}
            disabled={resetSending}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium bg-gray-900 text-white hover:bg-gray-800"
          >
            <KeyRound size={16} />
            {resetSending ? 'Sending...' : 'Send Reset Email'}
          </button>
        </div>
      </div>

      {resetMessage && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4 text-sm text-yellow-900">
          {resetMessage}
          {resetUrl && (
            <div className="mt-2">
              <span className="text-xs text-yellow-800">Dev reset link: </span>
              <span className="font-mono break-all">{resetUrl}</span>
            </div>
          )}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Stat label="Orders" value={String(customer.order_count)} />
        <Stat label="Lifetime Spend" value={formatCents(customer.lifetime_spend_cents)} />
        <Stat label="Store Credit" value={formatCents(customer.store_credit_cents || 0)} />
        <Stat label="Loyalty Points" value={String(customer.loyalty_points || 0)} />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1.2fr)_minmax(360px,0.8fr)] gap-6">
        <section className="bg-white rounded-xl border border-gray-200 p-5 space-y-4">
          <h2 className="font-semibold text-gray-900">Profile</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <Field label="First name" value={firstName} onChange={setFirstName} />
            <Field label="Last name" value={lastName} onChange={setLastName} />
            <Field label="Phone" value={phone} onChange={setPhone} />
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Customer type</label>
              <select value={customerType} onChange={(e) => setCustomerType(e.target.value)} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm capitalize">
                {CUSTOMER_TYPES.map((option) => <option key={option} value={option}>{label(option)}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Email marketing</label>
              <select value={marketingStatus} onChange={(e) => setMarketingStatus(e.target.value)} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm capitalize">
                {MARKETING_STATUSES.map((option) => <option key={option} value={option}>{label(option)}</option>)}
              </select>
            </div>
            <Field label="Marketing source" value={marketingSource} onChange={setMarketingSource} />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Tags</label>
            <input value={tagsInput} onChange={(e) => setTagsInput(e.target.value)} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" placeholder="vip, repeat buyer, wholesale" />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Internal note</label>
            <textarea value={internalNote} onChange={(e) => setInternalNote(e.target.value)} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm min-h-24" />
          </div>
          {message && <p className="text-sm text-gray-600">{message}</p>}
          <button onClick={saveProfile} disabled={saving} className="inline-flex items-center gap-2 bg-brand text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-brand/90 disabled:opacity-50">
            <Save size={16} />
            {saving ? 'Saving...' : 'Save Customer'}
          </button>
        </section>

        <section className="space-y-4">
          <InfoBlock title="Account">
            <Info label="Status" value={customer.is_active ? 'Active' : 'Inactive'} />
            <Info label="Created" value={new Date(customer.created_at).toLocaleDateString()} />
            <Info label="Last login" value={customer.last_login ? new Date(customer.last_login).toLocaleString() : '-'} />
            <Info label="Last order" value={customer.last_order_at ? new Date(customer.last_order_at).toLocaleDateString() : '-'} />
          </InfoBlock>

          <InfoBlock title="Segments">
            {data.segments.length === 0 ? <p className="text-sm text-gray-400">No segments</p> : data.segments.map((segment) => (
              <span key={segment.id} className="inline-flex mr-1 mb-1 bg-blue-50 text-blue-700 rounded-full px-2 py-1 text-xs">{segment.name}</span>
            ))}
          </InfoBlock>
        </section>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <Panel title="Recent Orders">
          {data.orders.length === 0 ? <Empty text="No orders yet" /> : data.orders.map((order) => (
            <Link key={order.id} href={`/admin/orders/${order.id}`} className="flex items-center justify-between py-3 border-b border-gray-50 last:border-0">
              <div>
                <p className="font-mono text-sm font-medium text-brand">{order.order_number}</p>
                <p className="text-xs text-gray-500">{order.status} · {new Date(order.created_at).toLocaleDateString()}</p>
              </div>
              <span className="text-sm font-bold text-gray-900">{formatCents(order.total_cents)}</span>
            </Link>
          ))}
        </Panel>

        <Panel title="Saved Addresses">
          {data.addresses.length === 0 ? <Empty text="No saved addresses" /> : data.addresses.map((address) => (
            <div key={String(address.id)} className="py-3 border-b border-gray-50 last:border-0 text-sm">
              <p className="font-medium text-gray-900">{address.label}{address.is_default ? ' · Default' : ''}</p>
              <p className="text-gray-600">{address.line1}{address.line2 ? `, ${address.line2}` : ''}</p>
              <p className="text-gray-500">{address.city}, {address.province} {address.postal_code}</p>
            </div>
          ))}
        </Panel>

        <Panel title="Consent Ledger">
          {data.consent_events.length === 0 ? <Empty text="No consent events" /> : data.consent_events.map((event) => (
            <div key={String(event.id)} className="py-3 border-b border-gray-50 last:border-0 text-sm">
              <p className="font-medium text-gray-900">{label(String(event.status))}</p>
              <p className="text-xs text-gray-500">{event.source} · {new Date(String(event.created_at)).toLocaleString()}</p>
            </div>
          ))}
        </Panel>

        <Panel title="Staff Notes">
          <div className="flex gap-2 mb-3">
            <input value={newNote} onChange={(e) => setNewNote(e.target.value)} placeholder="Add a note..." className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm" />
            <button onClick={addNote} className="bg-gray-900 text-white rounded-lg px-4 py-2 text-sm">Add</button>
          </div>
          {data.notes.length === 0 ? <Empty text="No notes yet" /> : data.notes.map((note) => (
            <div key={note.id} className="py-3 border-b border-gray-50 last:border-0 text-sm">
              <p className="text-gray-800">{note.note}</p>
              <p className="text-xs text-gray-500 mt-1">{note.created_by || 'admin'} · {new Date(note.created_at).toLocaleString()}</p>
            </div>
          ))}
        </Panel>
      </div>
    </div>
  );
}

function Field({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return (
    <div>
      <label className="block text-xs font-medium text-gray-600 mb-1">{label}</label>
      <input value={value} onChange={(e) => onChange(e.target.value)} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" />
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-white border border-gray-200 rounded-xl p-4">
      <p className="text-xs text-gray-500">{label}</p>
      <p className="text-xl font-bold text-gray-900 mt-1">{value}</p>
    </div>
  );
}

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="bg-white rounded-xl border border-gray-200 p-5">
      <h2 className="font-semibold text-gray-900 mb-3">{title}</h2>
      {children}
    </section>
  );
}

function InfoBlock({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="bg-white rounded-xl border border-gray-200 p-5">
      <h2 className="font-semibold text-gray-900 mb-3">{title}</h2>
      <div className="space-y-2">{children}</div>
    </section>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4 text-sm">
      <span className="text-gray-500">{label}</span>
      <span className="text-gray-900 text-right">{value}</span>
    </div>
  );
}

function Empty({ text }: { text: string }) {
  return <p className="text-sm text-gray-400 py-2">{text}</p>;
}
