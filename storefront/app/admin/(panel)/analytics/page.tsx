'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { formatCents } from '@/lib/format';

interface Funnel {
  period_days: number;
  product_viewed: number;
  add_to_cart: number;
  checkout_started: number;
  checkout_completed: number;
  view_to_cart_rate: number;
  cart_to_checkout_rate: number;
  checkout_to_purchase_rate: number;
}

interface SalesReport {
  order_count: number;
  gross_revenue_cents: number;
  net_revenue_cents: number;
  average_order_value_cents: number;
  units_sold: number;
  refund_count: number;
  total_refunded_cents: number;
  unique_customers: number;
  repeat_customers: number;
  repeat_customer_rate: number;
  utm_attribution: { utm_source: string; utm_medium: string; orders: number; revenue_cents: number }[];
}

export default function AnalyticsPage() {
  const [funnel, setFunnel] = useState<Funnel | null>(null);
  const [report, setReport] = useState<SalesReport | null>(null);
  const [days, setDays] = useState(30);

  useEffect(() => {
    api.get<Funnel>(`/api/admin/analytics/funnel?days=${days}`).then(setFunnel).catch(() => {});
    const from = new Date(Date.now() - days * 86400000).toISOString().split('T')[0];
    const to = new Date().toISOString().split('T')[0];
    api.get<SalesReport>(`/api/admin/reports/sales?from_date=${from}&to_date=${to}`).then(setReport).catch(() => {});
  }, [days]);

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Analytics</h1>
        <select value={days} onChange={(e) => setDays(Number(e.target.value))} className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm">
          <option value={7}>Last 7 days</option>
          <option value={30}>Last 30 days</option>
          <option value={90}>Last 90 days</option>
          <option value={365}>Last year</option>
        </select>
      </div>

      {/* Revenue Stats */}
      {report && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <Stat label="Gross Revenue" value={formatCents(report.gross_revenue_cents)} />
          <Stat label="Net Revenue" value={formatCents(report.net_revenue_cents)} />
          <Stat label="Orders" value={report.order_count.toString()} />
          <Stat label="AOV" value={formatCents(report.average_order_value_cents)} />
          <Stat label="Units Sold" value={report.units_sold.toString()} />
          <Stat label="Refunds" value={`${report.refund_count} (${formatCents(report.total_refunded_cents)})`} />
          <Stat label="Unique Customers" value={report.unique_customers.toString()} />
          <Stat label="Repeat Rate" value={`${report.repeat_customer_rate}%`} />
        </div>
      )}

      {/* Conversion Funnel */}
      {funnel && (
        <div className="bg-white rounded-xl border border-gray-200 p-5 mb-6">
          <h2 className="font-semibold text-gray-900 mb-4">Conversion Funnel</h2>
          <div className="grid grid-cols-4 gap-4">
            <FunnelStep label="Views" count={funnel.product_viewed} rate={null} />
            <FunnelStep label="Add to Cart" count={funnel.add_to_cart} rate={funnel.view_to_cart_rate} />
            <FunnelStep label="Checkout Started" count={funnel.checkout_started} rate={funnel.cart_to_checkout_rate} />
            <FunnelStep label="Purchased" count={funnel.checkout_completed} rate={funnel.checkout_to_purchase_rate} />
          </div>
        </div>
      )}

      {/* UTM Attribution */}
      {report && report.utm_attribution.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h2 className="font-semibold text-gray-900 mb-3">Marketing Attribution</h2>
          <div className="space-y-2">
            {report.utm_attribution.map((u, i) => (
              <div key={i} className="flex justify-between text-sm">
                <span className="text-gray-700">{u.utm_source}/{u.utm_medium}</span>
                <span className="text-gray-500">{u.orders} orders</span>
                <span className="font-medium">{formatCents(u.revenue_cents)}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4">
      <p className="text-xs text-gray-500">{label}</p>
      <p className="text-xl font-bold text-gray-900 mt-1">{value}</p>
    </div>
  );
}

function FunnelStep({ label, count, rate }: { label: string; count: number; rate: number | null }) {
  return (
    <div className="text-center">
      <p className="text-2xl font-bold text-gray-900">{count}</p>
      <p className="text-xs text-gray-500 mt-1">{label}</p>
      {rate !== null && <p className="text-xs text-green-600 mt-0.5">{rate}%</p>}
    </div>
  );
}
