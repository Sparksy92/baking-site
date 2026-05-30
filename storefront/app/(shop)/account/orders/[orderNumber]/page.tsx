'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { useCustomer } from '@/lib/customer';
import { api } from '@/lib/api';
import { formatCents } from '@/lib/format';

interface OrderDetail {
  order_number: string;
  status: string;
  payment_status: string;
  items: {
    product_name: string;
    variant_size: string;
    variant_color: string;
    quantity: number;
    unit_price_cents: number;
    line_total_cents: number;
  }[];
  subtotal_cents: number;
  discount_cents: number;
  shipping_cents: number;
  tax_cents: number;
  total_cents: number;
  promo_code: string | null;
  tracking_number: string | null;
  tracking_carrier: string | null;
  created_at: string;
}

const STATUS_BADGE: Record<string, string> = {
  received: 'bg-blue-100 text-blue-700',
  processing: 'bg-yellow-100 text-yellow-700',
  shipped: 'bg-purple-100 text-purple-700',
  delivered: 'bg-green-100 text-green-700',
  cancelled: 'bg-red-100 text-red-700',
  refunded: 'bg-gray-100 text-gray-700',
};

export default function AccountOrderDetailPage() {
  const router = useRouter();
  const params = useParams();
  const orderNumber = params.orderNumber as string;
  const { customer, loading: authLoading } = useCustomer();
  const [order, setOrder] = useState<OrderDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!authLoading && !customer) {
      router.push('/account/login');
    }
  }, [authLoading, customer, router]);

  useEffect(() => {
    if (customer && orderNumber) {
      api.get<OrderDetail>(`/api/customers/me/orders/${orderNumber}`)
        .then(setOrder)
        .catch(() => setError('Order not found'))
        .finally(() => setLoading(false));
    }
  }, [customer, orderNumber]);

  if (authLoading || loading) return <div className="text-center py-16 text-gray-400">Loading...</div>;
  if (!customer) return null;

  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      <Link href="/account" className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 mb-6">
        <ArrowLeft size={16} /> Back to orders
      </Link>

      {error ? (
        <p className="text-red-600">{error}</p>
      ) : order ? (
        <>
          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="text-xl font-bold text-gray-900 font-mono">{order.order_number}</h1>
              <p className="text-xs text-gray-400 mt-0.5">{new Date(order.created_at).toLocaleDateString('en-CA', { year: 'numeric', month: 'long', day: 'numeric' })}</p>
            </div>
            <span className={`capitalize px-3 py-1 rounded-lg text-sm font-medium ${STATUS_BADGE[order.status] || 'bg-gray-100 text-gray-700'}`}>
              {order.status}
            </span>
          </div>

          {order.tracking_number && (
            <div className="bg-purple-50 border border-purple-100 rounded-xl p-4 mb-6">
              <p className="text-sm font-medium text-purple-900">Tracking</p>
              <p className="text-sm text-purple-700 mt-0.5">{order.tracking_carrier} — {order.tracking_number}</p>
            </div>
          )}

          <div className="bg-white border border-gray-100 rounded-xl divide-y divide-gray-100 mb-6">
            {order.items.map((item, i) => (
              <div key={i} className="flex justify-between px-4 py-3">
                <div>
                  <p className="text-sm font-medium text-gray-900">{item.product_name}</p>
                  <p className="text-xs text-gray-500">{item.variant_size} / {item.variant_color} × {item.quantity}</p>
                </div>
                <span className="text-sm font-medium text-gray-900">{formatCents(item.line_total_cents)}</span>
              </div>
            ))}
          </div>

          <div className="bg-gray-50 rounded-xl p-4 space-y-2 text-sm">
            <div className="flex justify-between"><span className="text-gray-500">Subtotal</span><span>{formatCents(order.subtotal_cents)}</span></div>
            {order.discount_cents > 0 && (
              <div className="flex justify-between"><span className="text-gray-500">Discount{order.promo_code ? ` (${order.promo_code})` : ''}</span><span className="text-green-600">-{formatCents(order.discount_cents)}</span></div>
            )}
            <div className="flex justify-between"><span className="text-gray-500">Shipping</span><span>{order.shipping_cents === 0 ? 'Free' : formatCents(order.shipping_cents)}</span></div>
            <div className="flex justify-between"><span className="text-gray-500">Tax</span><span>{formatCents(order.tax_cents)}</span></div>
            <div className="flex justify-between font-bold text-base border-t border-gray-200 pt-2 mt-2"><span>Total</span><span>{formatCents(order.total_cents)}</span></div>
          </div>
        </>
      ) : null}
    </div>
  );
}
