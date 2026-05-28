import { useEffect, useState } from 'react';
import { api } from '../../lib/api';
import { formatCents } from '../../lib/format';

export default function AdminDashboard() {
  const [stats, setStats] = useState<{ total_orders: number; pending: number; recent_revenue: number } | null>(null);

  useEffect(() => {
    async function load() {
      try {
        const orders = await api.get<{ orders: { total_cents: number; status: string }[]; total: number }>('/api/admin/orders?limit=200');
        const total_orders = orders.total;
        const pending = orders.orders.filter((o) => o.status === 'pending').length;
        const recent_revenue = orders.orders.reduce((sum, o) => sum + o.total_cents, 0);
        setStats({ total_orders, pending, recent_revenue });
      } catch {
        // Silently fail for now
      }
    }
    load();
  }, []);

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Dashboard</h1>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <StatCard label="Total Orders" value={stats?.total_orders?.toString() ?? '—'} />
        <StatCard label="Pending" value={stats?.pending?.toString() ?? '—'} />
        <StatCard label="Revenue" value={stats ? formatCents(stats.recent_revenue) : '—'} />
      </div>

      <div className="mt-8 bg-white rounded-xl border border-gray-200 p-6">
        <h2 className="font-semibold text-gray-900 mb-3">Quick Links</h2>
        <ul className="space-y-2 text-sm text-gray-600">
          <li><a href="/admin/products/new" className="text-accent hover:underline">Create Product</a></li>
          <li><a href="/admin/orders" className="text-accent hover:underline">View Orders</a></li>
          <li><a href="/admin/collections" className="text-accent hover:underline">Manage Collections</a></li>
        </ul>
      </div>
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5">
      <p className="text-sm text-gray-500">{label}</p>
      <p className="mt-1 text-2xl font-bold text-gray-900">{value}</p>
    </div>
  );
}
