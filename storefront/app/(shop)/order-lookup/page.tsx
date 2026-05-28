'use client';

import { useState } from 'react';
import { api, type OrderLookup as OrderLookupType } from '@/lib/api';
import { formatCents } from '@/lib/format';

export default function OrderLookupPage() {
  const [orderNumber, setOrderNumber] = useState('');
  const [email, setEmail] = useState('');
  const [order, setOrder] = useState<OrderLookupType | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const data = await api.get<OrderLookupType>(
        `/api/orders/${orderNumber.trim()}?email=${encodeURIComponent(email.trim())}`
      );
      setOrder(data);
    } catch {
      setError('Order not found. Check your order number and email.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="max-w-lg mx-auto px-4 py-12">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Track Your Order</h1>
      <form onSubmit={handleSubmit} className="space-y-4">
        <input type="text" placeholder="Order number (e.g. ELD-A3X7)" value={orderNumber} onChange={(e) => setOrderNumber(e.target.value)} required className="w-full px-4 py-3 rounded-lg border border-gray-200 focus:border-brand outline-none text-sm" />
        <input type="email" placeholder="Email used at checkout" value={email} onChange={(e) => setEmail(e.target.value)} required className="w-full px-4 py-3 rounded-lg border border-gray-200 focus:border-brand outline-none text-sm" />
        {error && <p className="text-sm text-red-600">{error}</p>}
        <button type="submit" disabled={loading} className="w-full py-3 bg-brand text-white font-medium rounded-lg hover:bg-brand/90 disabled:opacity-50">
          {loading ? 'Looking up...' : 'Find Order'}
        </button>
      </form>

      {order && (
        <div className="mt-8 bg-gray-50 rounded-xl p-6 space-y-3">
          <h2 className="font-bold text-gray-900">{order.order_number}</h2>
          <div className="flex justify-between text-sm"><span>Status</span><span className="capitalize font-medium">{order.status}</span></div>
          <div className="flex justify-between text-sm"><span>Payment</span><span className="capitalize font-medium">{order.payment_status}</span></div>
          <div className="flex justify-between text-sm"><span>Total</span><span className="font-bold">{formatCents(order.total_cents)}</span></div>
          {order.tracking_number && (
            <div className="flex justify-between text-sm"><span>Tracking</span><span>{order.tracking_carrier} — {order.tracking_number}</span></div>
          )}
          <div className="pt-3 border-t border-gray-200">
            <h3 className="text-sm font-semibold mb-2">Items</h3>
            {order.items.map((item, i) => (
              <div key={i} className="flex justify-between text-sm py-1">
                <span>{item.product_name} ({item.variant_size}/{item.variant_color}) x{item.quantity}</span>
                <span>{formatCents(item.line_total_cents)}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
