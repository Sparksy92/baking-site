'use client';

import { useEffect, useState, useRef } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { CheckCircle2, Package, Truck, ArrowRight, Receipt } from 'lucide-react';
import { api, type OrderLookup } from '@/lib/api';
import { formatCents } from '@/lib/format';
import { cart } from '@/lib/cart';

export default function ConfirmationPage() {
  const params = useParams<{ orderNumber: string }>();
  const searchParams = useSearchParams();
  const orderNumber = params.orderNumber;
  const [order, setOrder] = useState<OrderLookup | null>(null);
  const [loading, setLoading] = useState(true);
  const [emailUsed, setEmailUsed] = useState('');
  const cartCleared = useRef(false);

  useEffect(() => {
    if (!orderNumber) return;

    let email = '';
    try {
      const pending = sessionStorage.getItem('pending_order');
      if (pending) {
        const data = JSON.parse(pending);
        if (data.order_number === orderNumber && data.email) {
          email = data.email;
          setEmailUsed(email);
        }
      }
    } catch { /* ignore */ }

    if (email) {
      api.get<OrderLookup>(`/api/orders/${orderNumber}?email=${encodeURIComponent(email)}`)
        .then((data) => {
          setOrder(data);
          if (!cartCleared.current) {
            cart.clear();
            sessionStorage.removeItem('pending_order');
            cartCleared.current = true;
          }
        })
        .catch(() => {})
        .finally(() => setLoading(false));
    } else {
      setLoading(false);
    }

    if (!cartCleared.current && searchParams.get('session_id')) {
      cart.clear();
      sessionStorage.removeItem('pending_order');
      cartCleared.current = true;
    }
  }, [orderNumber, searchParams]);

  if (loading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="animate-pulse flex flex-col items-center">
          <div className="w-16 h-16 bg-gray-200 rounded-full mb-4"></div>
          <div className="h-6 bg-gray-200 rounded w-48 mb-2"></div>
          <div className="h-4 bg-gray-200 rounded w-32"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-gray-50/50 min-h-screen py-12 sm:py-20">
      <div className="max-w-3xl mx-auto px-4">
        
        {/* Header Section */}
        <div className="text-center mb-10">
          <div className="inline-flex items-center justify-center w-20 h-20 bg-green-100 rounded-full mb-6 shadow-sm shadow-green-100 ring-8 ring-green-50">
            <CheckCircle2 className="text-green-600 w-10 h-10" />
          </div>
          <h1 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-3 tracking-tight">Thank you for your order!</h1>
          <p className="text-lg text-gray-600">
            Order <strong className="text-gray-900">#{orderNumber}</strong> has been confirmed.
          </p>
          {emailUsed && (
            <p className="mt-2 text-sm text-gray-500">
              We've sent a confirmation email to <span className="font-medium text-gray-700">{emailUsed}</span>.
            </p>
          )}
        </div>

        {order ? (
          <div className="bg-white rounded-3xl shadow-xl shadow-gray-200/40 border border-gray-100 overflow-hidden">
            
            {/* Status Bar */}
            <div className="bg-gray-50/80 px-6 py-4 border-b border-gray-100 flex flex-col sm:flex-row gap-4 justify-between sm:items-center text-sm">
              <div className="flex items-center gap-2">
                <Receipt size={18} className="text-gray-400" />
                <span className="text-gray-600">Payment: <span className="font-semibold text-gray-900 capitalize">{order.payment_status}</span></span>
              </div>
              <div className="flex items-center gap-2">
                <Package size={18} className="text-gray-400" />
                <span className="text-gray-600">Fulfillment: <span className="font-semibold text-gray-900 capitalize">{order.status}</span></span>
              </div>
              {order.tracking_number && (
                <div className="flex items-center gap-2">
                  <Truck size={18} className="text-brand" />
                  <span className="text-gray-600">Tracking: <span className="font-semibold text-brand">{order.tracking_carrier} {order.tracking_number}</span></span>
                </div>
              )}
            </div>

            {/* Items List */}
            <div className="p-6 sm:p-8 border-b border-gray-100">
              <h2 className="text-lg font-bold text-gray-900 mb-6">Order Summary</h2>
              <div className="space-y-6">
                {order.items.map((item, idx) => (
                  <div key={idx} className="flex justify-between gap-4 group">
                    <div className="flex gap-4 items-start">
                      <div className="w-12 h-12 rounded-xl bg-gray-50 border border-gray-100 flex items-center justify-center flex-shrink-0 text-gray-400 font-bold text-xs">
                        {item.quantity}x
                      </div>
                      <div>
                        <h3 className="font-semibold text-gray-900">{item.product_name}</h3>
                        <p className="text-sm text-gray-500 capitalize mt-0.5">{item.variant_size} / {item.variant_color}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <span className="font-semibold text-gray-900">{formatCents(item.line_total_cents)}</span>
                      {item.quantity > 1 && (
                        <p className="text-xs text-gray-400 mt-0.5">{formatCents(item.unit_price_cents)} each</p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Price Breakdown */}
            <div className="p-6 sm:p-8 bg-gray-50/30">
              <div className="max-w-xs ml-auto space-y-3 text-sm">
                <div className="flex justify-between text-gray-600">
                  <span>Subtotal</span>
                  <span className="font-medium text-gray-900">{formatCents(order.subtotal_cents)}</span>
                </div>
                <div className="flex justify-between text-gray-600">
                  <span>Shipping</span>
                  <span className="font-medium text-gray-900">{order.shipping_cents === 0 ? 'Free' : formatCents(order.shipping_cents)}</span>
                </div>
                {order.tax_cents > 0 && (
                  <div className="flex justify-between text-gray-600">
                    <span>Tax</span>
                    <span className="font-medium text-gray-900">{formatCents(order.tax_cents)}</span>
                  </div>
                )}
                <div className="flex justify-between items-center pt-4 mt-4 border-t border-gray-200">
                  <span className="font-bold text-gray-900">Total</span>
                  <span className="text-xl font-black text-gray-900">{formatCents(order.total_cents)}</span>
                </div>
              </div>
            </div>

          </div>
        ) : (
          <div className="bg-white rounded-3xl p-8 text-center shadow-sm border border-gray-100">
            <p className="text-gray-600 mb-4">We couldn't load your order details automatically, but your order is confirmed!</p>
            <p className="text-sm text-gray-500">Check your email for the full receipt.</p>
          </div>
        )}

        <div className="mt-10 text-center">
          <Link href="/" className="inline-flex items-center gap-2 px-8 py-4 bg-brand text-white rounded-xl font-bold hover:bg-brand/90 transition-all hover:-translate-y-0.5 hover:shadow-lg hover:shadow-brand/20 active:scale-[0.98]">
            Continue Shopping <ArrowRight size={18} />
          </Link>
        </div>

      </div>
    </div>
  );
}
