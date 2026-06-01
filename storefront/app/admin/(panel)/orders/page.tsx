'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Search, Loader2 } from 'lucide-react';
import { api } from '@/lib/api';
import { formatCents } from '@/lib/format';

const STATUS_TABS = ['all', 'received', 'processing', 'shipped', 'delivered', 'cancelled'] as const;

const STATUS_BADGE: Record<string, string> = {
  received: 'bg-blue-100 text-blue-700',
  processing: 'bg-yellow-100 text-yellow-700',
  shipped: 'bg-purple-100 text-purple-700',
  delivered: 'bg-green-100 text-green-700',
  cancelled: 'bg-red-100 text-red-700',
  refunded: 'bg-gray-200 text-gray-700',
};

const PAYMENT_BADGE: Record<string, string> = {
  confirmed: 'bg-green-100 text-green-700',
  pending: 'bg-yellow-100 text-yellow-700',
  expired: 'bg-red-100 text-red-700',
};

export default function AdminOrders() {
  const router = useRouter();
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<string>('all');
  const [search, setSearch] = useState('');

  useEffect(() => {
    setLoading(true);
    const statusParam = activeTab === 'all' ? '' : `&status=${activeTab}`;
    api.get<{ orders: any[] }>(`/api/admin/orders?limit=200${statusParam}`)
      .then((data) => setOrders(data.orders))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [activeTab]);

  const filtered = search.trim()
    ? orders.filter((o) =>
        o.order_number.toLowerCase().includes(search.toLowerCase()) ||
        o.customer_name.toLowerCase().includes(search.toLowerCase()) ||
        o.customer_email.toLowerCase().includes(search.toLowerCase())
      )
    : orders;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <h1 className="text-2xl font-bold text-gray-900">Orders</h1>
      </div>

      {/* Controls Container */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 bg-white p-4 rounded-xl shadow-sm border border-gray-100">
        
        {/* Status tabs */}
        <div className="flex gap-1.5 overflow-x-auto pb-1 sm:pb-0 custom-scrollbar hide-scrollbar-on-mobile w-full lg:w-auto">
          {STATUS_TABS.map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all whitespace-nowrap ${
                activeTab === tab ? 'bg-gray-900 text-white shadow-md' : 'bg-gray-50 text-gray-600 hover:bg-gray-100 hover:text-gray-900 border border-gray-200'
              }`}
            >
              {tab.charAt(0).toUpperCase() + tab.slice(1)}
            </button>
          ))}
        </div>

        {/* Search */}
        <div className="relative w-full lg:w-80 flex-shrink-0">
          <Search size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Search orders..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 rounded-lg border border-gray-200 text-sm focus:border-brand focus:ring-1 focus:ring-brand outline-none transition-all"
          />
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto custom-scrollbar">
          <table className="w-full text-sm min-w-[800px]">
            <thead className="bg-gray-50/80 border-b border-gray-200">
              <tr>
                <th className="px-6 py-4 text-left font-semibold text-gray-600 whitespace-nowrap">Order</th>
                <th className="px-6 py-4 text-left font-semibold text-gray-600 whitespace-nowrap">Customer</th>
                <th className="px-6 py-4 text-left font-semibold text-gray-600 whitespace-nowrap">Status</th>
                <th className="px-6 py-4 text-left font-semibold text-gray-600 whitespace-nowrap">Payment</th>
                <th className="px-6 py-4 text-right font-semibold text-gray-600 whitespace-nowrap">Total</th>
                <th className="px-6 py-4 text-left font-semibold text-gray-600 whitespace-nowrap">Date</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading ? (
                [...Array(5)].map((_, i) => (
                  <tr key={i} className="animate-pulse">
                    <td className="px-6 py-4"><div className="h-4 bg-gray-200 rounded w-20"></div></td>
                    <td className="px-6 py-4"><div className="h-4 bg-gray-200 rounded w-32"></div></td>
                    <td className="px-6 py-4"><div className="h-5 bg-gray-200 rounded-full w-16"></div></td>
                    <td className="px-6 py-4"><div className="h-5 bg-gray-200 rounded-full w-20"></div></td>
                    <td className="px-6 py-4 flex justify-end"><div className="h-4 bg-gray-200 rounded w-16"></div></td>
                    <td className="px-6 py-4"><div className="h-4 bg-gray-200 rounded w-24"></div></td>
                  </tr>
                ))
              ) : filtered.length > 0 ? (
                filtered.map((order) => (
                  <tr
                    key={order.id}
                    onClick={() => router.push(`/admin/orders/${order.id}`)}
                    className="hover:bg-gray-50/80 cursor-pointer transition-colors group"
                  >
                    <td className="px-6 py-4 font-mono font-bold text-brand group-hover:text-brand-600 whitespace-nowrap">{order.order_number}</td>
                    <td className="px-6 py-4">
                      <div className="font-medium text-gray-900">{order.customer_name}</div>
                      <div className="text-gray-500 text-xs mt-0.5">{order.customer_email}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`capitalize px-2.5 py-1 rounded-full text-xs font-bold ${STATUS_BADGE[order.status] || 'bg-gray-100 text-gray-700'}`}>
                        {order.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex flex-col gap-1.5 items-start">
                        <span className={`capitalize px-2.5 py-1 rounded-full text-xs font-bold ${PAYMENT_BADGE[order.payment_status] || 'bg-gray-100 text-gray-700'}`}>
                          {order.payment_status}
                        </span>
                        <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold ${
                          order.payment_method === 'etransfer' ? 'bg-purple-100 text-purple-700' : 'bg-blue-100 text-blue-700'
                        }`}>
                          {order.payment_method === 'etransfer' ? 'e-Transfer' : 'Stripe'}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-right font-bold text-gray-900 whitespace-nowrap">{formatCents(order.total_cents)}</td>
                    <td className="px-6 py-4 text-gray-500 text-xs font-medium whitespace-nowrap">{new Date(order.created_at).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })}</td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-gray-400">
                    {search ? 'No matching orders found' : 'No orders yet'}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
