'use client';

import { useEffect, useState } from 'react';
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
  const [aiPrompt, setAiPrompt] = useState('');
  const [aiLoading, setAiLoading] = useState(false);
  const [syncLoading, setSyncLoading] = useState(false);

  useEffect(() => { load(); }, []);

  async function load() {
    try {
      const data = await api.get<{ pages: Page[] }>('/api/admin/pages');
      setPages(data.pages ?? []);
    } catch {} finally { setLoading(false); }
  }

  async function create() {
    try {
      const payload = { ...form };
      if (!payload.slug && payload.title) {
        payload.slug = payload.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)+/g, '');
      }
      if (!payload.title || !payload.slug) {
        alert('Title and slug are required.');
        return;
      }
      await api.post('/api/admin/pages', payload);
      setShowForm(false);
      setForm({ title: '', slug: '', content_html: '', page_type: 'page', status: 'draft' });
      load();
    } catch (e: any) {
      alert(e?.detail || e?.message || 'Failed to save page. Ensure the slug is unique.');
    }
  }

  async function remove(id: number) {
    if (!confirm('Delete this page?')) return;
    await api.delete(`/api/admin/pages/${id}`);
    load();
  }

  async function generateAI() {
    if (!aiPrompt) return;
    setAiLoading(true);
    try {
      const data = await api.post<{ content: string }>('/api/admin/pages/generate-ai', { prompt: aiPrompt });
      setForm({ ...form, content_html: data.content, page_type: 'blog_post' });
      setAiPrompt('');
    } catch (e) {
      alert('Failed to generate post. Make sure API keys are configured.');
    } finally {
      setAiLoading(false);
    }
  }

  async function syncSocials() {
    setSyncLoading(true);
    try {
      await api.post('/api/admin/pages/sync-social', {});
      load();
      alert('Social media sync complete!');
    } catch (e) {
      alert('Sync failed. Make sure Meta tokens are configured.');
    } finally {
      setSyncLoading(false);
    }
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
        <div className="flex gap-2">
          <button onClick={syncSocials} disabled={syncLoading} className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition-colors disabled:opacity-50">
            {syncLoading ? 'Syncing...' : 'Sync Socials'}
          </button>
          <button onClick={() => setShowForm(!showForm)} className="px-4 py-2 bg-brand text-white rounded-lg text-sm font-medium">+ New Page</button>
        </div>
      </div>

      {showForm && (
        <div className="bg-white rounded-xl border border-gray-200 p-4 mb-4 space-y-3">
          <div className="flex gap-2 p-3 bg-purple-50 rounded-lg border border-purple-100 mb-2 items-center">
            <span className="text-xl">✨</span>
            <input 
              placeholder="AI Assistant: What happened today? (e.g. Finished 3rd at Shannonville...)" 
              value={aiPrompt} 
              onChange={(e) => setAiPrompt(e.target.value)}
              className="flex-1 bg-white border border-purple-200 rounded px-3 py-1.5 text-sm outline-none focus:border-purple-400"
              onKeyDown={(e) => e.key === 'Enter' && generateAI()}
            />
            <button 
              onClick={generateAI} 
              disabled={aiLoading || !aiPrompt}
              className="px-3 py-1.5 bg-purple-600 hover:bg-purple-700 text-white rounded text-sm font-medium disabled:opacity-50 transition-colors"
            >
              {aiLoading ? 'Generating...' : 'Generate Draft'}
            </button>
          </div>
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
          <textarea placeholder="Write your post here... (Plain text is automatically formatted into paragraphs. You can also use HTML if you prefer.)" value={form.content_html} onChange={(e) => setForm({ ...form, content_html: e.target.value })} rows={6} className="w-full border border-gray-200 rounded px-3 py-2 text-sm" />
          <button onClick={create} className="px-4 py-2 bg-green-600 text-white rounded text-sm font-medium">Publish Post</button>
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
                  <button onClick={() => remove(p.id)} className="text-xs text-red-600 hover:underline">Delete</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
