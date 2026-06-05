'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { api } from '@/lib/api';

interface Page {
  id: number;
  title: string;
  slug: string;
  page_type: string;
  status: string;
  created_at: string;
}

export default function PagesPage() {
  const [pages, setPages] = useState<Page[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ title: '', slug: '', content_html: '', page_type: 'page', status: 'draft' });
  const [helpOpen, setHelpOpen] = useState(false);

  useEffect(() => { load(); }, []);

  async function load() {
    try {
      const data = await api.get<{ pages: Page[] }>('/api/admin/pages');
      setPages(data.pages ?? []);
    } catch {} finally { setLoading(false); }
  }

  async function create() {
    await api.post('/api/admin/pages', form);
    setShowForm(false);
    setForm({ title: '', slug: '', content_html: '', page_type: 'page', status: 'draft' });
    load();
  }

  async function remove(id: number) {
    if (!confirm('Delete this page?')) return;
    await api.delete(`/api/admin/pages/${id}`);
    load();
  }

  if (loading) return <div className="text-gray-400">Loading...</div>;

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Pages & Blog</h1>
          <button onClick={() => setHelpOpen(!helpOpen)} className="text-xs text-blue-600 hover:underline mt-0.5">What are pages?</button>
          {helpOpen && <p className="text-sm text-gray-500 mt-2 bg-blue-50 border border-blue-100 rounded-lg p-3">Create static pages (About Us, Shipping Policy, FAQ) or blog posts. Pages are accessible at /pages/[slug] on the storefront. Set status to "published" to make them visible.</p>}
        </div>
        <button onClick={() => setShowForm(!showForm)} className="px-4 py-2 bg-brand text-white rounded-lg text-sm font-medium">+ New Page</button>
      </div>

      {showForm && (
        <div className="bg-white rounded-xl border border-gray-200 p-4 mb-4 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <input placeholder="Title" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} className="border border-gray-200 rounded px-3 py-1.5 text-sm" />
            <input placeholder="slug" value={form.slug} onChange={(e) => setForm({ ...form, slug: e.target.value })} className="border border-gray-200 rounded px-3 py-1.5 text-sm" />
            <select value={form.page_type} onChange={(e) => setForm({ ...form, page_type: e.target.value })} className="border border-gray-200 rounded px-3 py-1.5 text-sm">
              <option value="page">Page</option>
              <option value="blog_post">Blog Post</option>
            </select>
            <select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })} className="border border-gray-200 rounded px-3 py-1.5 text-sm">
              <option value="draft">Draft</option>
              <option value="published">Published</option>
            </select>
          </div>
          <textarea placeholder="HTML Content" value={form.content_html} onChange={(e) => setForm({ ...form, content_html: e.target.value })} rows={4} className="w-full border border-gray-200 rounded px-3 py-1.5 text-sm" />
          <button onClick={create} className="px-4 py-2 bg-green-600 text-white rounded text-sm">Create</button>
        </div>
      )}

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Title</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Type</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Status</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {pages.map((p) => (
              <tr key={p.id}>
                <td className="px-4 py-3 font-medium">{p.title}</td>
                <td className="px-4 py-3 text-gray-500">{p.page_type}</td>
                <td className="px-4 py-3">
                  <span className={`px-2 py-0.5 rounded text-xs ${p.status === 'published' ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'}`}>
                    {p.status}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-3">
                    <Link href={`/admin/pages/${p.id}`} className="text-xs text-brand hover:underline font-medium">Edit</Link>
                    <button onClick={() => remove(p.id)} className="text-xs text-red-600 hover:underline">Delete</button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
