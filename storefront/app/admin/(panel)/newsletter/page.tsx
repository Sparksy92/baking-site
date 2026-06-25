'use client';

import { useEffect, useState } from 'react';
import { Download, Users, Mail } from 'lucide-react';
import { api } from '@/lib/api';
import { addToast } from '@/lib/toast';

interface Subscriber {
  id: number;
  email: string;
  is_active: boolean;
  source: string;
  created_at: string;
}

export default function AdminNewsletter() {
  const [subscribers, setSubscribers] = useState<Subscriber[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [activeOnly, setActiveOnly] = useState(true);
  const limit = 50;

  useEffect(() => {
    setLoading(true);
    api.get<{ subscribers: Subscriber[]; total: number }>(
      `/api/admin/newsletter/subscribers?page=${page}&limit=${limit}&active_only=${activeOnly}`
    )
      .then((data) => {
        setSubscribers(data.subscribers);
        setTotal(data.total);
      })
      .catch(() => addToast('Failed to load subscribers', 'error'))
      .finally(() => setLoading(false));
  }, [page, activeOnly]);

  function handleExport() {
    window.open('/api/admin/newsletter/subscribers/export', '_blank');
  }

  const totalPages = Math.ceil(total / limit);

  return (
    <div className="max-w-4xl">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Newsletter</h1>
          <p className="text-sm text-gray-500 mt-1">{total} subscriber{total !== 1 ? 's' : ''}</p>
        </div>
        <button
          onClick={handleExport}
          className="inline-flex items-center gap-2 bg-brand text-white px-4 py-2.5 rounded-lg text-sm font-medium hover:bg-brand/90 transition-colors"
        >
          <Download size={16} />
          Export CSV
        </button>
      </div>

      <div className="mb-4">
        <label className="inline-flex items-center gap-2 text-sm text-gray-600">
          <input
            type="checkbox"
            checked={activeOnly}
            onChange={(e) => { setActiveOnly(e.target.checked); setPage(1); }}
            className="rounded border-gray-300"
          />
          Active only
        </label>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-100">
              <th className="text-left px-4 py-3 font-semibold text-gray-700">
                <Mail size={14} className="inline mr-1.5 -mt-0.5" />Email
              </th>
              <th className="text-left px-4 py-3 font-semibold text-gray-700">Source</th>
              <th className="text-left px-4 py-3 font-semibold text-gray-700">Status</th>
              <th className="text-left px-4 py-3 font-semibold text-gray-700">Subscribed</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={4} className="px-4 py-8 text-center text-gray-400">Loading...</td></tr>
            ) : subscribers.length === 0 ? (
              <tr><td colSpan={4} className="px-4 py-8 text-center text-gray-400">
                <Users size={24} className="mx-auto mb-2 text-gray-300" />
                No subscribers yet
              </td></tr>
            ) : (
              subscribers.map((sub) => (
                <tr key={sub.id} className="border-t border-gray-50 hover:bg-gray-50/50">
                  <td className="px-4 py-3 font-medium text-gray-900">{sub.email}</td>
                  <td className="px-4 py-3 text-gray-500">{sub.source}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${
                      sub.is_active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'
                    }`}>
                      {sub.is_active ? 'Active' : 'Unsubscribed'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-500">
                    {new Date(sub.created_at + 'Z').toLocaleDateString()}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-between mt-4">
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page === 1}
            className="px-3 py-1.5 text-sm border border-gray-200 rounded-lg disabled:opacity-50 hover:bg-gray-50"
          >
            Previous
          </button>
          <span className="text-sm text-gray-500">Page {page} of {totalPages}</span>
          <button
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page === totalPages}
            className="px-3 py-1.5 text-sm border border-gray-200 rounded-lg disabled:opacity-50 hover:bg-gray-50"
          >
            Next
          </button>
        </div>
      )}
    </div>
  );
}
