import { useEffect, useState } from 'react';
import { api } from '../../lib/api';
import { formatCents } from '../../lib/format';

export default function AdminOrders() {
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get<{ orders: any[] }>('/api/admin/orders?limit=100')
      .then((data) => setOrders(data.orders))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="text-gray-400">Loading orders...</div>;

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Orders</h1>

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="px-4 py-3 text-left font-medium text-gray-600">Order</th>
              <th className="px-4 py-3 text-left font-medium text-gray-600">Customer</th>
              <th className="px-4 py-3 text-left font-medium text-gray-600">Status</th>
              <th className="px-4 py-3 text-left font-medium text-gray-600">Payment</th>
              <th className="px-4 py-3 text-right font-medium text-gray-600">Total</th>
              <th className="px-4 py-3 text-left font-medium text-gray-600">Date</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {orders.map((order) => (
              <tr key={order.id} className="hover:bg-gray-50">
                <td className="px-4 py-3 font-mono font-medium">{order.order_number}</td>
                <td className="px-4 py-3 text-gray-600">{order.customer_name}</td>
                <td className="px-4 py-3">
                  <span className="capitalize px-2 py-0.5 bg-gray-100 rounded text-xs font-medium">
                    {order.status}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <span className="capitalize px-2 py-0.5 bg-gray-100 rounded text-xs font-medium">
                    {order.payment_status}
                  </span>
                </td>
                <td className="px-4 py-3 text-right font-medium">{formatCents(order.total_cents)}</td>
                <td className="px-4 py-3 text-gray-500 text-xs">{new Date(order.created_at).toLocaleDateString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {orders.length === 0 && (
          <p className="text-center text-gray-400 py-8">No orders yet</p>
        )}
      </div>
    </div>
  );
}
