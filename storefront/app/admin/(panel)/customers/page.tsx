'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Download, Search, Users } from 'lucide-react';
import { api } from '@/lib/api';
import { formatCents } from '@/lib/format';

type CustomerListItem = {
  id: number;
  email: string;
  first_name: string;
  last_name: string;
  phone: string | null;
  is_active: number;
  customer_type: string;
  marketing_email_status: string;
  created_source: string;
  last_login: string | null;
  created_at: string;
  order_count: number;
  lifetime_spend_cents: number;
  last_order_at: string | null;
  tags: string[];
};

const CUSTOMER_TYPES = [
  { value: '', label: 'All types' },
  { value: 'registered', label: 'Registered' },
  { value: 'guest', label: 'Guest' },
  { value: 'newsletter_only', label: 'Newsletter only' },
  { value: 'wholesale', label: 'Wholesale' },
  { value: 'admin_created', label: 'Admin created' },
  { value: 'imported', label: 'Imported' },
  { value: 'test', label: 'Test' },
];

const MARKETING_STATUSES = [
  { value: '', label: 'All marketing' },
  { value: 'subscribed', label: 'Subscribed' },
  { value: 'unsubscribed', label: 'Unsubscribed' },
  { value: 'non_subscribed', label: 'Non-subscribed' },
  { value: 'suppressed', label: 'Suppressed' },
  { value: 'bounced', label: 'Bounced' },
];

function badgeClass(value: string) {
  if (value === 'subscribed') return 'bg-green-100 text-green-700';
  if (value === 'unsubscribed' || value === 'suppressed' || value === 'bounced') return 'bg-red-100 text-red-700';
  return 'bg-gray-100 text-gray-600';
}

function label(value: string) {
  return value.replace(/_/g, ' ');
}

export default function AdminCustomersPage() {
  const router = useRouter();
  const [customers, setCustomers] = useState<CustomerListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [type, setType] = useState('');
  const [marketing, setMarketing] = useState('');
  const [active, setActive] = useState('active');
  const [total, setTotal] = useState(0);

  const query = useMemo(() => {
    const params = new URLSearchParams({ limit: '200' });
    if (search.trim()) params.set('q', search.trim());
    if (type) params.set('customer_type', type);
    if (marketing) params.set('marketing_status', marketing);
    if (active === 'active') params.set('is_active', 'true');
    if (active === 'inactive') params.set('is_active', 'false');
    return params.toString();
  }, [search, type, marketing, active]);

  useEffect(() => {
    setLoading(true);
    api.get<{ customers: CustomerListItem[]; total: number }>(`/api/admin/customers?${query}`)
      .then((data) => {
        setCustomers(data.customers);
        setTotal(data.total);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [query]);

  function exportCsv() {
    window.open(`/api/admin/customers/export?${query}`, '_blank');
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Customers</h1>
          <p className="text-sm text-gray-500 mt-1">{total} customer{total === 1 ? '' : 's'}</p>
        </div>
        <button
          onClick={exportCsv}
          className="inline-flex items-center justify-center gap-2 bg-brand text-white px-4 py-2.5 rounded-lg text-sm font-medium hover:bg-brand/90"
        >
          <Download size={16} />
          Export CSV
        </button>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 space-y-3">
        <div className="relative">
          <Search size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search name, email, or phone..."
            className="w-full pl-10 pr-4 py-2.5 rounded-lg border border-gray-200 text-sm focus:border-brand focus:ring-1 focus:ring-brand outline-none"
          />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <select value={type} onChange={(e) => setType(e.target.value)} className="border border-gray-200 rounded-lg px-3 py-2 text-sm">
            {CUSTOMER_TYPES.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
          </select>
          <select value={marketing} onChange={(e) => setMarketing(e.target.value)} className="border border-gray-200 rounded-lg px-3 py-2 text-sm">
            {MARKETING_STATUSES.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
          </select>
          <select value={active} onChange={(e) => setActive(e.target.value)} className="border border-gray-200 rounded-lg px-3 py-2 text-sm">
            <option value="all">All account states</option>
            <option value="active">Active accounts</option>
            <option value="inactive">Inactive accounts</option>
          </select>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm min-w-[980px]">
            <thead className="bg-gray-50/80 border-b border-gray-200">
              <tr>
                <th className="px-6 py-4 text-left font-semibold text-gray-600">Customer</th>
                <th className="px-6 py-4 text-left font-semibold text-gray-600">Type</th>
                <th className="px-6 py-4 text-left font-semibold text-gray-600">Marketing</th>
                <th className="px-6 py-4 text-right font-semibold text-gray-600">Orders</th>
                <th className="px-6 py-4 text-right font-semibold text-gray-600">Lifetime spend</th>
                <th className="px-6 py-4 text-left font-semibold text-gray-600">Last order</th>
                <th className="px-6 py-4 text-left font-semibold text-gray-600">Tags</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading ? (
                <tr><td colSpan={7} className="px-6 py-12 text-center text-gray-400">Loading customers...</td></tr>
              ) : customers.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center text-gray-400">
                    <Users size={24} className="mx-auto mb-2 text-gray-300" />
                    No customers found
                  </td>
                </tr>
              ) : (
                customers.map((customer) => (
                  <tr
                    key={customer.id}
                    onClick={() => router.push(`/admin/customers/${customer.id}`)}
                    className="hover:bg-gray-50 cursor-pointer"
                  >
                    <td className="px-6 py-4">
                      <div className="font-medium text-gray-900">
                        {customer.first_name} {customer.last_name}
                        {!customer.is_active && <span className="ml-2 text-xs text-red-600">Inactive</span>}
                      </div>
                      <div className="text-xs text-gray-500 mt-0.5">{customer.email}</div>
                    </td>
                    <td className="px-6 py-4 text-gray-600 capitalize">{label(customer.customer_type)}</td>
                    <td className="px-6 py-4">
                      <span className={`inline-flex px-2.5 py-1 rounded-full text-xs font-medium ${badgeClass(customer.marketing_email_status)}`}>
                        {label(customer.marketing_email_status)}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right font-medium">{customer.order_count}</td>
                    <td className="px-6 py-4 text-right font-bold text-gray-900">{formatCents(customer.lifetime_spend_cents)}</td>
                    <td className="px-6 py-4 text-gray-500">{customer.last_order_at ? new Date(customer.last_order_at).toLocaleDateString() : '-'}</td>
                    <td className="px-6 py-4">
                      <div className="flex flex-wrap gap-1">
                        {customer.tags.slice(0, 3).map((tag) => (
                          <span key={tag} className="bg-gray-100 text-gray-600 rounded-full px-2 py-0.5 text-xs">{tag}</span>
                        ))}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
