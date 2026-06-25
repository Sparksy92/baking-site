'use client';

import { useCallback, useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Truck, Save, RotateCcw } from 'lucide-react';
import { api } from '@/lib/api';
import { formatCents } from '@/lib/format';

interface OrderItem {
  id: number;
  product_name: string;
  variant_size: string;
  variant_color: string;
  quantity: number;
  unit_price_cents: number;
  line_total_cents: number;
}

interface OrderDetail {
  id: number;
  order_number: string;
  status: string;
  payment_status: string;
  payment_method: string;
  customer_name: string;
  customer_email: string;
  shipping_address_line1: string;
  shipping_address_line2: string | null;
  shipping_address_city: string;
  shipping_address_province: string;
  shipping_address_postal: string;
  shipping_address_country: string;
  subtotal_cents: number;
  discount_cents: number;
  shipping_cents: number;
  tax_cents: number;
  total_cents: number;
  promo_code: string | null;
  tracking_carrier: string | null;
  tracking_number: string | null;
  customer_notes: string | null;
  admin_notes: string | null;
  stripe_session_id: string | null;
  stripe_payment_intent_id: string | null;
  refund_amount_cents: number | null;
  stripe_refund_id: string | null;
  refunded_at: string | null;
  refund_reason: string | null;
  created_at: string;
  updated_at: string;
}

const ORDER_STATUSES = ['received', 'processing', 'shipped', 'delivered', 'cancelled', 'refunded'] as const;
const CARRIERS = ['Canada Post', 'UPS', 'FedEx', 'Purolator', 'Other'] as const;

export default function AdminOrderDetail() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const [order, setOrder] = useState<OrderDetail | null>(null);
  const [items, setItems] = useState<OrderItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');

  // Editable fields
  const [status, setStatus] = useState('');
  const [paymentStatus, setPaymentStatus] = useState('');
  const [trackingCarrier, setTrackingCarrier] = useState('');
  const [trackingNumber, setTrackingNumber] = useState('');
  const [adminNotes, setAdminNotes] = useState('');

  // Refund state
  const [showRefund, setShowRefund] = useState(false);
  const [refundType, setRefundType] = useState<'full' | 'partial'>('full');
  const [refundAmount, setRefundAmount] = useState('');
  const [refundReason, setRefundReason] = useState('requested_by_customer');
  const [refunding, setRefunding] = useState(false);

  const fetchOrder = useCallback(async () => {
    const data = await api.get<{ order: OrderDetail; items: OrderItem[] }>(`/api/admin/orders/${params.id}`);
    setOrder(data.order);
    setItems(data.items);
    setStatus(data.order.status);
    setPaymentStatus(data.order.payment_status);
    setTrackingCarrier(data.order.tracking_carrier || '');
    setTrackingNumber(data.order.tracking_number || '');
    setAdminNotes(data.order.admin_notes || '');
  }, [params.id]);

  useEffect(() => {
    fetchOrder()
      .catch(() => router.push('/admin/orders'))
      .finally(() => setLoading(false));
  }, [fetchOrder, router]);

  async function handleSave() {
    if (!order) return;
    setSaving(true);
    setMessage('');
    try {
      const updates: Record<string, string> = {};
      if (status !== order.status) updates.status = status;
      if (paymentStatus !== order.payment_status) updates.payment_status = paymentStatus;
      if (trackingCarrier !== (order.tracking_carrier || '')) updates.tracking_carrier = trackingCarrier;
      if (trackingNumber !== (order.tracking_number || '')) updates.tracking_number = trackingNumber;
      if (adminNotes !== (order.admin_notes || '')) updates.admin_notes = adminNotes;

      if (Object.keys(updates).length === 0) {
        setMessage('No changes to save.');
        setSaving(false);
        return;
      }

      await api.patch(`/api/admin/orders/${order.id}`, updates);
      setMessage('Order updated successfully.');
      await fetchOrder();
    } catch {
      setMessage('Failed to update order.');
    } finally {
      setSaving(false);
    }
  }

  async function handleRefund() {
    if (!order) return;
    setRefunding(true);
    setMessage('');
    try {
      const body: Record<string, unknown> = { reason: refundReason };
      if (refundType === 'partial' && refundAmount) {
        body.amount_cents = parseInt(refundAmount, 10);
      }
      await api.post(`/api/admin/orders/${order.id}/refund`, body);
      setMessage('Refund processed successfully.');
      setShowRefund(false);
      await fetchOrder();
    } catch (err: unknown) {
      const detail = err instanceof Error ? err.message : 'Refund failed.';
      setMessage(`Failed: ${detail}`);
    } finally {
      setRefunding(false);
    }
  }

  if (loading) return <div className="text-gray-400">Loading order...</div>;
  if (!order) return null;

  return (
    <div className="max-w-4xl">
      <Link href="/admin/orders" className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 mb-4">
        <ArrowLeft size={14} /> Back to Orders
      </Link>

      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{order.order_number}</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            {new Date(order.created_at).toLocaleDateString('en-CA', { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
          </p>
        </div>
        <div className="flex gap-2">
          <span className={`px-2.5 py-1 rounded text-xs font-medium ${
            order.payment_method === 'etransfer' ? 'bg-purple-100 text-purple-700' : 'bg-blue-100 text-blue-700'
          }`}>
            Method: {order.payment_method === 'etransfer' ? 'e-Transfer' : 'Stripe'}
          </span>
          <span className={`px-2.5 py-1 rounded text-xs font-medium ${
            order.payment_status === 'confirmed' ? 'bg-green-100 text-green-700' :
            order.payment_status === 'expired' ? 'bg-red-100 text-red-700' :
            'bg-yellow-100 text-yellow-700'
          }`}>
            Status: {order.payment_status}
          </span>
        </div>
      </div>

      {message && (
        <div className={`mb-4 px-4 py-2 rounded text-sm ${message.includes('Failed') ? 'bg-red-50 text-red-700' : 'bg-green-50 text-green-700'}`}>
          {message}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left column — order info */}
        <div className="lg:col-span-2 space-y-6">
          {/* Items */}
          <section className="bg-white rounded-xl border border-gray-200 p-5">
            <h2 className="font-semibold text-gray-900 mb-3">Items</h2>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100">
                  <th className="text-left py-2 font-medium text-gray-600">Product</th>
                  <th className="text-center py-2 font-medium text-gray-600">Qty</th>
                  <th className="text-right py-2 font-medium text-gray-600">Unit</th>
                  <th className="text-right py-2 font-medium text-gray-600">Total</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item) => (
                  <tr key={item.id} className="border-b border-gray-50">
                    <td className="py-2">
                      <span className="font-medium">{item.product_name}</span>
                      <span className="text-gray-500 ml-1">({item.variant_size} / {item.variant_color})</span>
                    </td>
                    <td className="py-2 text-center">{item.quantity}</td>
                    <td className="py-2 text-right">{formatCents(item.unit_price_cents)}</td>
                    <td className="py-2 text-right font-medium">{formatCents(item.line_total_cents)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="mt-3 pt-3 border-t border-gray-100 space-y-1 text-sm">
              <div className="flex justify-between"><span className="text-gray-600">Subtotal</span><span>{formatCents(order.subtotal_cents)}</span></div>
              {order.discount_cents > 0 && (
                <div className="flex justify-between text-green-600"><span>Discount{order.promo_code ? ` (${order.promo_code})` : ''}</span><span>-{formatCents(order.discount_cents)}</span></div>
              )}
              <div className="flex justify-between"><span className="text-gray-600">Shipping</span><span>{order.shipping_cents === 0 ? 'Free' : formatCents(order.shipping_cents)}</span></div>
              {order.tax_cents > 0 && (
                <div className="flex justify-between"><span className="text-gray-600">Tax</span><span>{formatCents(order.tax_cents)}</span></div>
              )}
              <div className="flex justify-between font-bold text-base pt-1 border-t border-gray-200"><span>Total</span><span>{formatCents(order.total_cents)}</span></div>
            </div>
          </section>

          {/* Customer */}
          <section className="bg-white rounded-xl border border-gray-200 p-5">
            <h2 className="font-semibold text-gray-900 mb-3">Customer</h2>
            <div className="text-sm space-y-1">
              <p className="font-medium">{order.customer_name}</p>
              <p className="text-gray-600">{order.customer_email}</p>
            </div>
            <h3 className="font-medium text-gray-900 mt-4 mb-1 text-sm">Shipping Address</h3>
            <div className="text-sm text-gray-600 space-y-0.5">
              <p>{order.shipping_address_line1}</p>
              {order.shipping_address_line2 && <p>{order.shipping_address_line2}</p>}
              <p>{order.shipping_address_city}, {order.shipping_address_province} {order.shipping_address_postal}</p>
              <p>{order.shipping_address_country}</p>
            </div>
            {order.customer_notes && (
              <div className="mt-4 bg-amber-50 border border-amber-200 rounded-lg p-3">
                <h3 className="font-medium text-amber-900 mb-1 text-sm">Customer Notes</h3>
                <p className="text-sm text-amber-800">{order.customer_notes}</p>
              </div>
            )}
          </section>

          {/* Customer Notes */}
          {order.customer_notes && (
            <section className="bg-amber-50 rounded-xl border border-amber-200 p-5">
              <h2 className="font-semibold text-amber-900 mb-2 text-sm">Customer Notes</h2>
              <p className="text-sm text-amber-800 whitespace-pre-wrap">{order.customer_notes}</p>
            </section>
          )}

          {/* Stripe Info */}
          {(order.stripe_session_id || order.stripe_payment_intent_id) && (
            <section className="bg-white rounded-xl border border-gray-200 p-5">
              <h2 className="font-semibold text-gray-900 mb-3">Stripe</h2>
              <div className="text-sm text-gray-600 space-y-1">
                {order.stripe_session_id && <p><span className="font-medium text-gray-900">Session:</span> <code className="text-xs bg-gray-100 px-1.5 py-0.5 rounded">{order.stripe_session_id}</code></p>}
                {order.stripe_payment_intent_id && <p><span className="font-medium text-gray-900">Payment Intent:</span> <code className="text-xs bg-gray-100 px-1.5 py-0.5 rounded">{order.stripe_payment_intent_id}</code></p>}
              </div>
            </section>
          )}
        </div>

        {/* Right column — actions */}
        <div className="space-y-6">
          {/* Status */}
          <section className="bg-white rounded-xl border border-gray-200 p-5 space-y-4">
            <div>
              <h2 className="font-semibold text-gray-900 mb-2">Fulfillment Status</h2>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:border-brand outline-none"
              >
                {ORDER_STATUSES.map((s) => (
                  <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>
                ))}
              </select>
            </div>
            <div>
              <h2 className="font-semibold text-gray-900 mb-2">Payment Status</h2>
              <select
                value={paymentStatus}
                onChange={(e) => setPaymentStatus(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:border-brand outline-none"
              >
                <option value="pending">Pending</option>
                <option value="confirmed">Confirmed</option>
                <option value="failed">Failed</option>
                <option value="refunded">Refunded</option>
              </select>
            </div>
          </section>

          {/* Tracking */}
          <section className="bg-white rounded-xl border border-gray-200 p-5">
            <h2 className="font-semibold text-gray-900 mb-3 flex items-center gap-1.5"><Truck size={16} /> Tracking</h2>
            <div className="space-y-3">
              <select
                value={trackingCarrier}
                onChange={(e) => setTrackingCarrier(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:border-brand outline-none"
              >
                <option value="">Select carrier...</option>
                {CARRIERS.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
              <input
                type="text"
                placeholder="Tracking number"
                value={trackingNumber}
                onChange={(e) => setTrackingNumber(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:border-brand outline-none"
              />
            </div>
          </section>

          {/* Admin Notes */}
          <section className="bg-white rounded-xl border border-gray-200 p-5">
            <h2 className="font-semibold text-gray-900 mb-3">Admin Notes</h2>
            <textarea
              value={adminNotes}
              onChange={(e) => setAdminNotes(e.target.value)}
              placeholder="Internal notes (not shown to customer)..."
              rows={4}
              className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:border-brand outline-none resize-none"
            />
          </section>

          {/* Save */}
          <button
            onClick={handleSave}
            disabled={saving}
            className="w-full flex items-center justify-center gap-2 py-2.5 bg-brand text-white rounded-lg font-medium text-sm hover:bg-brand/90 disabled:opacity-50"
          >
            <Save size={16} />
            {saving ? 'Saving...' : 'Save Changes'}
          </button>

          {/* Refund */}
          {order.payment_status === 'confirmed' && order.status !== 'refunded' && (
            <section className="bg-white rounded-xl border border-red-200 p-5">
              <h2 className="font-semibold text-red-700 mb-3 flex items-center gap-1.5"><RotateCcw size={16} /> Refund</h2>
              {order.stripe_payment_intent_id ? (
                !showRefund ? (
                  <button
                    onClick={() => setShowRefund(true)}
                    className="w-full py-2 border border-red-300 text-red-700 rounded-lg text-sm font-medium hover:bg-red-50 transition"
                  >
                    Issue Refund
                  </button>
                ) : (
                  <div className="space-y-3">
                    <div className="flex gap-2">
                      <button
                        onClick={() => { setRefundType('full'); setRefundAmount(''); }}
                        className={`flex-1 py-1.5 rounded text-xs font-medium border ${
                          refundType === 'full' ? 'bg-red-50 border-red-300 text-red-700' : 'border-gray-200 text-gray-600'
                        }`}
                      >
                        Full ({formatCents(order.total_cents)})
                      </button>
                      <button
                        onClick={() => setRefundType('partial')}
                        className={`flex-1 py-1.5 rounded text-xs font-medium border ${
                          refundType === 'partial' ? 'bg-red-50 border-red-300 text-red-700' : 'border-gray-200 text-gray-600'
                        }`}
                      >
                        Partial
                      </button>
                    </div>

                    {refundType === 'partial' && (
                      <input
                        type="number"
                        min="1"
                        max={order.total_cents}
                        placeholder="Amount in cents"
                        value={refundAmount}
                        onChange={(e) => setRefundAmount(e.target.value)}
                        className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:border-red-400 outline-none"
                      />
                    )}

                    <select
                      value={refundReason}
                      onChange={(e) => setRefundReason(e.target.value)}
                      className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:border-red-400 outline-none bg-white"
                    >
                      <option value="requested_by_customer">Requested by customer</option>
                      <option value="duplicate">Duplicate charge</option>
                      <option value="fraudulent">Fraudulent</option>
                    </select>

                    <div className="flex gap-2">
                      <button
                        onClick={() => setShowRefund(false)}
                        className="flex-1 py-2 border border-gray-200 text-gray-600 rounded-lg text-sm hover:bg-gray-50"
                      >
                        Cancel
                      </button>
                      <button
                        onClick={handleRefund}
                        disabled={refunding || (refundType === 'partial' && !refundAmount)}
                        className="flex-1 py-2 bg-red-600 text-white rounded-lg text-sm font-medium hover:bg-red-700 disabled:opacity-50"
                      >
                        {refunding ? 'Processing...' : 'Confirm Refund'}
                      </button>
                    </div>
                  </div>
                )
              ) : (
                <p className="text-xs text-gray-500">No Stripe payment intent — refund manually via Stripe dashboard.</p>
              )}
            </section>
          )}

          {/* Show refund info if already refunded */}
          {order.status === 'refunded' && order.refund_amount_cents && (
            <section className="bg-red-50 rounded-xl border border-red-200 p-5">
              <h2 className="font-semibold text-red-700 mb-2 flex items-center gap-1.5"><RotateCcw size={16} /> Refunded</h2>
              <div className="text-sm space-y-1">
                <p><span className="font-medium">Amount:</span> {formatCents(order.refund_amount_cents)}</p>
                {order.refund_reason && <p><span className="font-medium">Reason:</span> {order.refund_reason.replace(/_/g, ' ')}</p>}
                {order.refunded_at && <p><span className="font-medium">Date:</span> {new Date(order.refunded_at).toLocaleDateString('en-CA')}</p>}
                {order.stripe_refund_id && <p><span className="font-medium">Stripe ID:</span> <code className="text-xs bg-red-100 px-1.5 py-0.5 rounded">{order.stripe_refund_id}</code></p>}
              </div>
            </section>
          )}
        </div>
      </div>
    </div>
  );
}
