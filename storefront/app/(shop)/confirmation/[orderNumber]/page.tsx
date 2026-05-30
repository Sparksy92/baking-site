'use client';

import { useEffect, useState, useRef } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { CheckCircle } from 'lucide-react';
import { api, type OrderLookup } from '@/lib/api';
import { formatCents } from '@/lib/format';
import { cart } from '@/lib/cart';

export default function ConfirmationPage() {
  const params = useParams<{ orderNumber: string }>();
  const searchParams = useSearchParams();
  const orderNumber = params.orderNumber;
  const [order, setOrder] = useState<OrderLookup | null>(null);
  const cartCleared = useRef(false);

  useEffect(() => {
    if (!orderNumber) return;

    // Try to get email from sessionStorage (set during checkout)
    let email = '';
    try {
      const pending = sessionStorage.getItem('pending_order');
      if (pending) {
        const data = JSON.parse(pending);
        if (data.order_number === orderNumber && data.email) {
          email = data.email;
        }
      }
    } catch { /* ignore */ }

    if (email) {
      // Look up order with email
      api.get<OrderLookup>(`/api/orders/${orderNumber}?email=${encodeURIComponent(email)}`)
        .then((data) => {
          setOrder(data);
          if (!cartCleared.current) {
            cart.clear();
            sessionStorage.removeItem('pending_order');
            cartCleared.current = true;
          }
        })
        .catch(() => {});
    }

    // Always clear cart when arriving from Stripe redirect with session_id
    if (!cartCleared.current && searchParams.get('session_id')) {
      cart.clear();
      sessionStorage.removeItem('pending_order');
      cartCleared.current = true;
    }
  }, [orderNumber, searchParams]);

  return (
    <div className="max-w-2xl mx-auto px-4 py-12 text-center">
      <CheckCircle size={48} className="mx-auto text-green-500 mb-4" />
      <h1 className="text-2xl font-bold text-gray-900">Order Confirmed</h1>
      <p className="mt-2 text-gray-600">
        Order <strong>{orderNumber}</strong> has been placed successfully.
      </p>
      <p className="mt-1 text-sm text-gray-500">A confirmation email is on its way.</p>

      {order && (
        <div className="mt-8 text-left bg-gray-50 rounded-xl p-6 space-y-3">
          <div className="flex justify-between text-sm"><span>Status</span><span className="font-medium capitalize">{order.status}</span></div>
          <div className="flex justify-between text-sm"><span>Payment</span><span className="font-medium capitalize">{order.payment_status}</span></div>
          <div className="flex justify-between text-sm"><span>Total</span><span className="font-bold">{formatCents(order.total_cents)}</span></div>
          {order.tracking_number && (
            <div className="flex justify-between text-sm"><span>Tracking</span><span className="font-medium">{order.tracking_carrier} — {order.tracking_number}</span></div>
          )}
        </div>
      )}

      <Link href="/" className="inline-block mt-8 px-6 py-3 bg-brand text-white rounded-lg font-medium hover:bg-brand/90">
        Continue Shopping
      </Link>
    </div>
  );
}
