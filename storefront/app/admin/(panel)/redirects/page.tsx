'use client';

import { useEffect, useState } from 'react';
import { Trash2, Plus, ToggleLeft, ToggleRight } from 'lucide-react';
import { api } from '@/lib/api';
import { addToast } from '@/lib/toast';

interface Redirect {
  id: number;
  from_path: string;
  to_path: string;
  status_code: number;
  is_active: boolean;
  created_at: string;
}

const inputClass = 'px-3 py-2 rounded-lg border border-gray-200 focus:border-brand outline-none text-sm';

export default function AdminRedirects() {
  const [redirects, setRedirects] = useState<Redirect[]>([]);
  const [loading, setLoading] = useState(true);
  const [fromPath, setFromPath] = useState('');
  const [toPath, setToPath] = useState('');
  const [statusCode, setStatusCode] = useState<301 | 302>(301);
  const [adding, setAdding] = useState(false);

  function load() {
    api.get<Redirect[]>('/api/admin/redirects')
      .then(setRedirects)
      .catch(console.error)
      .finally(() => setLoading(false));
  }

  useEffect(load, []);

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    if (!fromPath.trim() || !toPath.trim()) return;
    setAdding(true);
    try {
      await api.post('/api/admin/redirects', { from_path: fromPath.trim(), to_path: toPath.trim(), status_code: statusCode });
      setFromPath('');
      setToPath('');
      addToast('Redirect created', 'success');
      load();
    } catch (err: any) {
      addToast(err?.detail || 'Failed to create redirect', 'error');
    } finally {
      setAdding(false);
    }
  }

  async function toggleActive(r: Redirect) {
    try {
      await api.patch(`/api/admin/redirects/${r.id}`, { is_active: !r.is_active });
      setRedirects((prev) => prev.map((x) => x.id === r.id ? { ...x, is_active: !r.is_active } : x));
    } catch {
      addToast('Failed to update redirect', 'error');
    }
  }

  async function handleDelete(id: number) {
    if (!confirm('Delete this redirect?')) return;
    try {
      await api.delete(`/api/admin/redirects/${id}`);
      setRedirects((prev) => prev.filter((r) => r.id !== id));
      addToast('Redirect deleted', 'success');
    } catch {
      addToast('Failed to delete redirect', 'error');
    }
  }

  return (
    <div className="max-w-4xl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">URL Redirects</h1>
        <p className="text-sm text-gray-500 mt-1">Manage 301/302 redirects. Use this when a product or page URL changes to preserve SEO rankings.</p>
      </div>

      {/* Add form */}
      <form onSubmit={handleAdd} className="bg-white rounded-xl border border-gray-200 p-5 mb-6">
        <h2 className="text-sm font-semibold text-gray-700 mb-4">Add Redirect</h2>
        <div className="flex flex-col sm:flex-row gap-3 items-end">
          <div className="flex-1">
            <label className="text-xs font-medium text-gray-500 block mb-1">From path</label>
            <input
              value={fromPath}
              onChange={(e) => setFromPath(e.target.value)}
              placeholder="/old-product-slug"
              required
              className={`${inputClass} w-full font-mono`}
            />
          </div>
          <div className="flex-1">
            <label className="text-xs font-medium text-gray-500 block mb-1">To path</label>
            <input
              value={toPath}
              onChange={(e) => setToPath(e.target.value)}
              placeholder="/new-product-slug"
              required
              className={`${inputClass} w-full font-mono`}
            />
          </div>
          <div>
            <label className="text-xs font-medium text-gray-500 block mb-1">Type</label>
            <select value={statusCode} onChange={(e) => setStatusCode(Number(e.target.value) as 301 | 302)} className={`${inputClass} bg-white`}>
              <option value={301}>301 — Permanent</option>
              <option value={302}>302 — Temporary</option>
            </select>
          </div>
          <button type="submit" disabled={adding} className="flex items-center gap-2 bg-brand text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-brand/90 disabled:opacity-50 whitespace-nowrap">
            <Plus size={15} /> Add
          </button>
        </div>
        <p className="text-xs text-gray-400 mt-3">Use 301 for permanent moves (product renames, slug changes). Use 302 only for temporary moves.</p>
      </form>

      {/* List */}
      {loading ? (
        <div className="text-gray-400 text-sm">Loading…</div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-4 py-3 text-left font-medium text-gray-600">From</th>
                <th className="px-4 py-3 text-left font-medium text-gray-600">To</th>
                <th className="px-4 py-3 text-center font-medium text-gray-600">Code</th>
                <th className="px-4 py-3 text-center font-medium text-gray-600">Active</th>
                <th className="px-4 py-3 text-right font-medium text-gray-600">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {redirects.map((r) => (
                <tr key={r.id} className={`hover:bg-gray-50 ${!r.is_active ? 'opacity-40' : ''}`}>
                  <td className="px-4 py-3 font-mono text-xs text-gray-700">{r.from_path}</td>
                  <td className="px-4 py-3 font-mono text-xs text-gray-500">{r.to_path}</td>
                  <td className="px-4 py-3 text-center">
                    <span className={`px-2 py-0.5 rounded text-xs font-medium ${r.status_code === 301 ? 'bg-blue-100 text-blue-700' : 'bg-yellow-100 text-yellow-700'}`}>
                      {r.status_code}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <button onClick={() => toggleActive(r)} className="text-gray-500 hover:text-brand transition-colors" title={r.is_active ? 'Disable' : 'Enable'}>
                      {r.is_active ? <ToggleRight size={20} className="text-brand" /> : <ToggleLeft size={20} />}
                    </button>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button onClick={() => handleDelete(r.id)} className="text-gray-400 hover:text-red-500 transition-colors" title="Delete">
                      <Trash2 size={15} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {redirects.length === 0 && (
            <p className="text-center text-gray-400 py-8 text-sm">No redirects yet. Add one above when a URL changes.</p>
          )}
        </div>
      )}
    </div>
  );
}
