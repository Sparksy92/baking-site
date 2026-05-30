'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Package, MapPin, Settings, LogOut } from 'lucide-react';
import { useCustomer } from '@/lib/customer';
import { api, type CustomerOrder } from '@/lib/api';
import { formatCents } from '@/lib/format';

const STATUS_BADGE: Record<string, string> = {
  received: 'bg-blue-100 text-blue-700',
  processing: 'bg-yellow-100 text-yellow-700',
  shipped: 'bg-purple-100 text-purple-700',
  delivered: 'bg-green-100 text-green-700',
  cancelled: 'bg-red-100 text-red-700',
};

export default function AccountPage() {
  const router = useRouter();
  const { customer, loading: authLoading, logout } = useCustomer();
  const [orders, setOrders] = useState<CustomerOrder[]>([]);
  const [ordersLoading, setOrdersLoading] = useState(true);

  useEffect(() => {
    if (!authLoading && !customer) {
      router.push('/account/login');
    }
  }, [authLoading, customer, router]);

  useEffect(() => {
    if (customer) {
      api.get<{ orders: CustomerOrder[] }>('/api/customers/me/orders')
        .then((data) => setOrders(data.orders))
        .catch(() => {})
        .finally(() => setOrdersLoading(false));
    }
  }, [customer]);

  async function handleLogout() {
    await logout();
    router.push('/');
  }

  if (authLoading) return <div className="text-center py-16 text-gray-400">Loading...</div>;
  if (!customer) return null;

  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Hi, {customer.first_name}</h1>
          <p className="text-sm text-gray-500 mt-0.5">{customer.email}</p>
        </div>
        <button onClick={handleLogout} className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700">
          <LogOut size={16} /> Sign out
        </button>
      </div>

      {/* Quick links */}
      <div className="grid grid-cols-3 gap-3 mb-8">
        <Link href="/account" className="flex items-center gap-2 p-4 bg-brand/5 border border-brand/10 rounded-xl text-sm font-medium text-brand">
          <Package size={18} /> Orders
        </Link>
        <Link href="/account/addresses" className="flex items-center gap-2 p-4 bg-gray-50 border border-gray-100 rounded-xl text-sm font-medium text-gray-700 hover:bg-gray-100">
          <MapPin size={18} /> Addresses
        </Link>
        <Link href="/account/settings" className="flex items-center gap-2 p-4 bg-gray-50 border border-gray-100 rounded-xl text-sm font-medium text-gray-700 hover:bg-gray-100">
          <Settings size={18} /> Settings
        </Link>
      </div>

      {/* Order history */}
      <h2 className="text-lg font-bold text-gray-900 mb-4">Order History</h2>
      {ordersLoading ? (
        <p className="text-gray-400 py-8 text-center">Loading orders...</p>
      ) : orders.length === 0 ? (
        <div className="text-center py-12 bg-gray-50 rounded-xl">
          <p className="text-gray-500 mb-4">No orders yet</p>
          <Link href="/" className="text-brand hover:underline font-medium text-sm">Start shopping</Link>
        </div>
      ) : (
        <div className="space-y-3">
          {orders.map((order) => (
            <Link
              key={order.order_number}
              href={`/order-lookup?order=${order.order_number}`}
              className="block p-4 bg-white border border-gray-100 rounded-xl hover:border-gray-200 transition-colors"
            >
              <div className="flex items-center justify-between">
                <div>
                  <span className="font-mono font-medium text-sm">{order.order_number}</span>
                  <span className="text-xs text-gray-400 ml-2">{order.item_count} item{order.item_count !== 1 ? 's' : ''}</span>
                </div>
                <span className="font-medium text-sm">{formatCents(order.total_cents)}</span>
              </div>
              <div className="flex items-center justify-between mt-2">
                <span className={`capitalize px-2 py-0.5 rounded text-xs font-medium ${STATUS_BADGE[order.status] || 'bg-gray-100 text-gray-700'}`}>
                  {order.status}
                </span>
                <span className="text-xs text-gray-400">{new Date(order.created_at).toLocaleDateString()}</span>
              </div>
              {order.tracking_number && (
                <p className="text-xs text-gray-500 mt-1">{order.tracking_carrier} — {order.tracking_number}</p>
              )}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
