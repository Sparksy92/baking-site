'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';

interface ReturnRequest {
  id: number;
  order_number: string;
  customer_name: string;
  customer_email: string;
  status: string;
  reason: string;
  resolution: string;
  created_at: string;
}

export default function ReturnsPage() {
  const [returns, setReturns] = useState<ReturnRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [helpOpen, setHelpOpen] = useState(false);

  useEffect(() => { load(); }, []);

  async function load() {
    try {
      const data = await api.get<{ returns: ReturnRequest[]; total: number }>('/api/admin/returns');
      setReturns(data.returns ?? []);
    } catch {} finally { setLoading(false); }
  }

  async function updateStatus(id: number, status: string) {
    await api.patch(`/api/admin/returns/${id}`, { status });
    load();
  }

  if (loading) return <div className="text-gray-400">Loading...</div>;

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Returns</h1>
        <button onClick={() => setHelpOpen(!helpOpen)} className="text-xs text-blue-600 hover:underline mt-0.5">How do returns work?</button>
        {helpOpen && <p className="text-sm text-gray-500 mt-2 bg-blue-50 border border-blue-100 rounded-lg p-3">Customers can request returns from their account. Returned items go through a workflow: Pending → Approved/Rejected → Received → Refunded. Approving a return sends the customer shipping instructions. Marking as received triggers stock restoration.</p>}
      </div>
      {returns.length === 0 ? (
        <p className="text-gray-500">No return requests yet.</p>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Order</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Customer</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Reason</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Status</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {returns.map((r) => (
                <tr key={r.id}>
                  <td className="px-4 py-3 font-mono text-xs">{r.order_number}</td>
                  <td className="px-4 py-3">{r.customer_name}</td>
                  <td className="px-4 py-3 truncate max-w-[200px]">{r.reason}</td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                      r.status === 'pending' ? 'bg-yellow-100 text-yellow-700' :
                      r.status === 'approved' ? 'bg-blue-100 text-blue-700' :
                      r.status === 'received' ? 'bg-green-100 text-green-700' :
                      r.status === 'refunded' ? 'bg-purple-100 text-purple-700' :
                      'bg-red-100 text-red-700'
                    }`}>
                      {r.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 flex gap-1">
                    {r.status === 'pending' && (
                      <>
                        <button onClick={() => updateStatus(r.id, 'approved')} className="px-2 py-1 text-xs bg-blue-100 text-blue-700 rounded hover:bg-blue-200">Approve</button>
                        <button onClick={() => updateStatus(r.id, 'rejected')} className="px-2 py-1 text-xs bg-red-100 text-red-700 rounded hover:bg-red-200">Reject</button>
                      </>
                    )}
                    {r.status === 'approved' && (
                      <button onClick={() => updateStatus(r.id, 'received')} className="px-2 py-1 text-xs bg-green-100 text-green-700 rounded hover:bg-green-200">Mark Received</button>
                    )}
                    {r.status === 'received' && (
                      <button onClick={() => updateStatus(r.id, 'refunded')} className="px-2 py-1 text-xs bg-purple-100 text-purple-700 rounded hover:bg-purple-200">Refund</button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
