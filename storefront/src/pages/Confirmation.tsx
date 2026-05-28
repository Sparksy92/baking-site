import { useEffect, useState } from 'react';
import { useParams, useSearchParams, Link } from 'react-router-dom';
import { api, type OrderLookup } from '../lib/api';
import { formatCents } from '../lib/format';
import { CheckCircle } from 'lucide-react';

export default function Confirmation() {
  const { orderNumber } = useParams<{ orderNumber: string }>();
  const [searchParams] = useSearchParams();
  const email = searchParams.get('email') || '';
  const [order, setOrder] = useState<OrderLookup | null>(null);
  const [, setLoading] = useState(true);

  useEffect(() => {
    if (!orderNumber || !email) { setLoading(false); return; }
    api.get<OrderLookup>(`/api/orders/${orderNumber}?email=${encodeURIComponent(email)}`)
      .then(setOrder)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [orderNumber, email]);

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

      <Link to="/" className="inline-block mt-8 px-6 py-3 bg-brand text-white rounded-lg font-medium hover:bg-brand/90">
        Continue Shopping
      </Link>
    </div>
  );
}
