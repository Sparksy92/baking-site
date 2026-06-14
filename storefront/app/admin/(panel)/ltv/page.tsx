'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { api } from '@/lib/api';
import { formatCents } from '@/lib/format';
import { Users, TrendingUp, ShoppingBag, RepeatIcon } from 'lucide-react';

interface LTVCustomer {
  customer_email: string;
  customer_name: string | null;
  customer_id: number | null;
  order_count: number;
  total_spent_cents: number;
  avg_order_value_cents: number;
  first_order_at: string;
  last_order_at: string;
}

interface LTVReport {
  summary: {
    total_customers: number;
    repeat_customers: number;
    total_revenue_cents: number;
    avg_order_value_cents: number;
  };
  customers: LTVCustomer[];
}

function StatCard({ icon: Icon, label, value }: { icon: any; label: string; value: string }) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5 flex items-center gap-4">
      <div className="w-10 h-10 rounded-lg bg-brand/10 flex items-center justify-center flex-shrink-0">
        <Icon size={18} className="text-brand" />
      </div>
      <div>
        <p className="text-xs text-gray-500 font-medium">{label}</p>
        <p className="text-xl font-bold text-gray-900">{value}</p>
      </div>
    </div>
  );
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-CA', { year: 'numeric', month: 'short', day: 'numeric' });
}

export default function LTVPage() {
  const [report, setReport] = useState<LTVReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [minOrders, setMinOrders] = useState(1);
  const [filterInput, setFilterInput] = useState('1');

  useEffect(() => {
    setLoading(true);
    api
      .get<LTVReport>(`/api/admin/reports/ltv?limit=200&min_orders=${minOrders}`)
      .then(setReport)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [minOrders]);

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Customer Lifetime Value</h1>
          <p className="text-sm text-gray-500 mt-1">All-time spend per customer, ranked by total revenue.</p>
        </div>
        <div className="flex items-center gap-2 text-sm">
          <label className="text-gray-600 font-medium">Min. orders</label>
          <input
            type="number"
            min={1}
            value={filterInput}
            onChange={(e) => setFilterInput(e.target.value)}
            onBlur={() => {
              const n = parseInt(filterInput, 10);
              if (!isNaN(n) && n >= 1) setMinOrders(n);
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                const n = parseInt(filterInput, 10);
                if (!isNaN(n) && n >= 1) setMinOrders(n);
              }
            }}
            className="w-16 px-2 py-1.5 border border-gray-200 rounded-lg text-sm text-center"
          />
        </div>
      </div>

      {/* Summary cards */}
      {report && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <StatCard icon={Users} label="Total Customers" value={report.summary.total_customers.toLocaleString()} />
          <StatCard icon={RepeatIcon} label="Repeat Buyers" value={report.summary.repeat_customers.toLocaleString()} />
          <StatCard icon={TrendingUp} label="Total Revenue" value={formatCents(report.summary.total_revenue_cents)} />
          <StatCard icon={ShoppingBag} label="Avg Order Value" value={formatCents(report.summary.avg_order_value_cents)} />
        </div>
      )}

      {/* Table */}
      {loading ? (
        <div className="text-gray-400 text-sm py-12 text-center">Loading…</div>
      ) : !report || report.customers.length === 0 ? (
        <div className="text-gray-400 text-sm py-12 text-center">No data yet.</div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50 text-xs font-semibold text-gray-500 uppercase tracking-wide">
                <th className="px-4 py-3 text-left">#</th>
                <th className="px-4 py-3 text-left">Customer</th>
                <th className="px-4 py-3 text-right">Orders</th>
                <th className="px-4 py-3 text-right">Total Spent</th>
                <th className="px-4 py-3 text-right">Avg Order</th>
                <th className="px-4 py-3 text-left hidden md:table-cell">First Order</th>
                <th className="px-4 py-3 text-left hidden md:table-cell">Last Order</th>
              </tr>
            </thead>
            <tbody>
              {report.customers.map((c, i) => (
                <tr key={c.customer_email} className="border-b border-gray-50 hover:bg-gray-50 transition-colors">
                  <td className="px-4 py-3 text-gray-400 font-mono text-xs">{i + 1}</td>
                  <td className="px-4 py-3">
                    {c.customer_id ? (
                      <Link
                        href={`/admin/store-credit?customer_id=${c.customer_id}`}
                        className="font-medium text-gray-900 hover:text-brand"
                      >
                        {c.customer_name ?? c.customer_email}
                      </Link>
                    ) : (
                      <span className="font-medium text-gray-900">{c.customer_name ?? c.customer_email}</span>
                    )}
                    {c.customer_name && (
                      <p className="text-xs text-gray-400">{c.customer_email}</p>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right font-semibold">{c.order_count}</td>
                  <td className="px-4 py-3 text-right font-bold text-gray-900">{formatCents(c.total_spent_cents)}</td>
                  <td className="px-4 py-3 text-right text-gray-600">{formatCents(c.avg_order_value_cents)}</td>
                  <td className="px-4 py-3 text-gray-500 hidden md:table-cell">{formatDate(c.first_order_at)}</td>
                  <td className="px-4 py-3 text-gray-500 hidden md:table-cell">{formatDate(c.last_order_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
