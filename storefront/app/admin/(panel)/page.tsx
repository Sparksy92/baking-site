'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { formatCents } from '@/lib/format';
import { TrendingUp, ShoppingCart, Users, Mail, AlertTriangle } from 'lucide-react';

interface DashboardStats {
  total_orders: number;
  total_revenue_cents: number;
  pending_orders: number;
  processing_orders: number;
  shipped_orders: number;
  monthly_revenue_cents: number;
  monthly_orders: number;
  weekly_revenue_cents: number;
  weekly_orders: number;
  top_products: { product_name: string; units_sold: number; revenue_cents: number }[];
  low_stock: { product_name: string; size: string; color: string; stock_quantity: number }[];
  customer_count: number;
  subscriber_count: number;
}

export default function AdminDashboard() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get<DashboardStats>('/api/admin/dashboard/stats')
      .then(setStats)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="text-gray-400">Loading dashboard...</div>;

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Dashboard</h1>

      {/* Key metrics */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <StatCard icon={ShoppingCart} label="Total Orders" value={stats?.total_orders?.toString() ?? '0'} />
        <StatCard icon={TrendingUp} label="Total Revenue" value={stats ? formatCents(stats.total_revenue_cents) : '$0'} />
        <StatCard icon={Users} label="Customers" value={stats?.customer_count?.toString() ?? '0'} />
        <StatCard icon={Mail} label="Subscribers" value={stats?.subscriber_count?.toString() ?? '0'} />
      </div>

      {/* Period stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h2 className="text-sm font-semibold text-gray-600 mb-3">This Month</h2>
          <div className="flex justify-between items-end">
            <div>
              <p className="text-2xl font-bold text-gray-900">{stats ? formatCents(stats.monthly_revenue_cents) : '$0'}</p>
              <p className="text-xs text-gray-500 mt-1">{stats?.monthly_orders ?? 0} orders</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h2 className="text-sm font-semibold text-gray-600 mb-3">Last 7 Days</h2>
          <div className="flex justify-between items-end">
            <div>
              <p className="text-2xl font-bold text-gray-900">{stats ? formatCents(stats.weekly_revenue_cents) : '$0'}</p>
              <p className="text-xs text-gray-500 mt-1">{stats?.weekly_orders ?? 0} orders</p>
            </div>
          </div>
        </div>
      </div>

      {/* Order status breakdown */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4 text-center">
          <p className="text-2xl font-bold text-yellow-700">{stats?.pending_orders ?? 0}</p>
          <p className="text-xs text-yellow-600 mt-1">Received</p>
        </div>
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 text-center">
          <p className="text-2xl font-bold text-blue-700">{stats?.processing_orders ?? 0}</p>
          <p className="text-xs text-blue-600 mt-1">Processing</p>
        </div>
        <div className="bg-green-50 border border-green-200 rounded-xl p-4 text-center">
          <p className="text-2xl font-bold text-green-700">{stats?.shipped_orders ?? 0}</p>
          <p className="text-xs text-green-600 mt-1">Shipped</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Top products */}
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h2 className="font-semibold text-gray-900 mb-3">Top Products (30 days)</h2>
          {stats && stats.top_products.length > 0 ? (
            <div className="space-y-2">
              {stats.top_products.map((p, i) => (
                <div key={i} className="flex justify-between items-center text-sm">
                  <span className="text-gray-700 truncate flex-1">{p.product_name}</span>
                  <span className="text-gray-500 ml-2">{p.units_sold} sold</span>
                  <span className="text-gray-900 font-medium ml-3 w-20 text-right">{formatCents(p.revenue_cents)}</span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-gray-400">No sales data yet</p>
          )}
        </div>

        {/* Low stock */}
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h2 className="font-semibold text-gray-900 mb-3 flex items-center gap-1.5">
            <AlertTriangle size={16} className="text-orange-500" /> Low Stock
          </h2>
          {stats && stats.low_stock.length > 0 ? (
            <div className="space-y-2">
              {stats.low_stock.map((v, i) => (
                <div key={i} className="flex justify-between items-center text-sm">
                  <span className="text-gray-700 truncate flex-1">{v.product_name}</span>
                  <span className="text-gray-500 ml-2">{v.size}/{v.color}</span>
                  <span className={`ml-3 font-medium ${v.stock_quantity === 0 ? 'text-red-600' : 'text-orange-600'}`}>
                    {v.stock_quantity} left
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-gray-400">All stock levels healthy</p>
          )}
        </div>
      </div>

      {/* Quick Links */}
      <div className="mt-6 bg-white rounded-xl border border-gray-200 p-5">
        <h2 className="font-semibold text-gray-900 mb-3">Quick Links</h2>
        <div className="flex flex-wrap gap-3">
          <a href="/admin/products/new" className="px-3 py-1.5 text-sm bg-gray-100 rounded-lg hover:bg-gray-200 text-gray-700">+ New Product</a>
          <a href="/admin/orders" className="px-3 py-1.5 text-sm bg-gray-100 rounded-lg hover:bg-gray-200 text-gray-700">View Orders</a>
          <a href="/admin/collections" className="px-3 py-1.5 text-sm bg-gray-100 rounded-lg hover:bg-gray-200 text-gray-700">Collections</a>
          <a href="/admin/categories" className="px-3 py-1.5 text-sm bg-gray-100 rounded-lg hover:bg-gray-200 text-gray-700">Categories</a>
        </div>
      </div>
    </div>
  );
}

function StatCard({ icon: Icon, label, value }: { icon: React.ComponentType<{ size?: number }>; label: string; value: string }) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5">
      <div className="flex items-center gap-2 mb-1">
        <Icon size={14} />
        <p className="text-xs text-gray-500">{label}</p>
      </div>
      <p className="text-2xl font-bold text-gray-900">{value}</p>
    </div>
  );
}
