'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { addToast } from '@/lib/toast';
import { Inbox, CheckCircle, XCircle, Send, Trash2, Pencil, X, ExternalLink } from 'lucide-react';

type SocialPost = {
  id: number;
  platform: string;
  content: string;
  image_url: string | null;
  status: string;
  page_title: string | null;
  page_slug: string | null;
  created_at: string;
  published_at: string | null;
  error_message: string | null;
};

const STATUS_STYLES: Record<string, string> = {
  draft:     'bg-yellow-100 text-yellow-800',
  approved:  'bg-blue-100 text-blue-800',
  published: 'bg-green-100 text-green-800',
  rejected:  'bg-red-100 text-red-800',
  scheduled: 'bg-purple-100 text-purple-800',
  failed:    'bg-red-200 text-red-900',
};

const PLATFORM_ICON: Record<string, string> = {
  facebook:  '𝕗',
  instagram: '◉',
  x:         '𝕏',
  linkedin:  'in',
  tiktok:    '♪',
  youtube:   '▶',
};

const PLATFORMS = ['', 'facebook', 'instagram', 'x', 'linkedin', 'tiktok'];
const STATUSES  = ['', 'draft', 'approved', 'published', 'rejected', 'failed'];

export default function OutboxPage() {
  const [posts, setPosts] = useState<SocialPost[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [filterPlatform, setFilterPlatform] = useState('');
  const [filterStatus, setFilterStatus] = useState('draft');
  const [editId, setEditId] = useState<number | null>(null);
  const [editContent, setEditContent] = useState('');
  const [busy, setBusy] = useState<Record<number, boolean>>({});

  async function load() {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (filterPlatform) params.set('platform', filterPlatform);
      if (filterStatus)   params.set('post_status', filterStatus);
      const data = await api.get<{ posts: SocialPost[]; total: number }>(
        `/api/admin/social/outbox?${params}`
      );
      setPosts(data.posts);
      setTotal(data.total);
    } catch {
      addToast('Failed to load outbox', 'error');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, [filterPlatform, filterStatus]); // eslint-disable-line

  async function approve(id: number) {
    setBusy((b) => ({ ...b, [id]: true }));
    try {
      await api.patch(`/api/admin/social/outbox/${id}`, { status: 'approved' });
      addToast('Approved', 'success');
      load();
    } catch { addToast('Failed', 'error'); }
    finally { setBusy((b) => ({ ...b, [id]: false })); }
  }

  async function reject(id: number) {
    setBusy((b) => ({ ...b, [id]: true }));
    try {
      await api.patch(`/api/admin/social/outbox/${id}`, { status: 'rejected' });
      addToast('Rejected', 'success');
      load();
    } catch { addToast('Failed', 'error'); }
    finally { setBusy((b) => ({ ...b, [id]: false })); }
  }

  async function publish(id: number) {
    setBusy((b) => ({ ...b, [id]: true }));
    try {
      await api.post(`/api/admin/social/outbox/${id}/publish`, {});
      addToast('Published', 'success');
      load();
    } catch (e: unknown) {
      const msg = (e as { detail?: string })?.detail ?? 'Failed to publish';
      addToast(msg, 'error');
    }
    finally { setBusy((b) => ({ ...b, [id]: false })); }
  }

  async function saveEdit(id: number) {
    setBusy((b) => ({ ...b, [id]: true }));
    try {
      await api.patch(`/api/admin/social/outbox/${id}`, { content: editContent });
      addToast('Saved', 'success');
      setEditId(null);
      load();
    } catch { addToast('Failed', 'error'); }
    finally { setBusy((b) => ({ ...b, [id]: false })); }
  }

  async function remove(id: number) {
    if (!confirm('Delete this draft?')) return;
    setBusy((b) => ({ ...b, [id]: true }));
    try {
      await api.delete(`/api/admin/social/outbox/${id}`);
      addToast('Deleted', 'success');
      load();
    } catch { addToast('Failed', 'error'); }
    finally { setBusy((b) => ({ ...b, [id]: false })); }
  }

  return (
    <div className="max-w-4xl space-y-6">
      <div>
        <div className="flex items-center gap-2 mb-1">
          <Inbox size={20} className="text-brand" />
          <h1 className="text-2xl font-bold text-gray-900">Social Outbox</h1>
        </div>
        <p className="text-sm text-gray-500">
          Review, edit and approve AI-generated social posts. Posts are created automatically when a blog post is published.
        </p>
      </div>

      {/* Filters */}
      <div className="flex gap-3 flex-wrap">
        <select
          value={filterPlatform}
          onChange={(e) => setFilterPlatform(e.target.value)}
          className="px-3 py-2 rounded-lg border border-gray-200 text-sm outline-none focus:border-brand"
        >
          <option value="">All Platforms</option>
          {PLATFORMS.filter(Boolean).map((p) => (
            <option key={p} value={p}>{p.charAt(0).toUpperCase() + p.slice(1)}</option>
          ))}
        </select>

        <select
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value)}
          className="px-3 py-2 rounded-lg border border-gray-200 text-sm outline-none focus:border-brand"
        >
          <option value="">All Statuses</option>
          {STATUSES.filter(Boolean).map((s) => (
            <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>
          ))}
        </select>

        <span className="ml-auto text-sm text-gray-400 self-center">{total} post{total !== 1 ? 's' : ''}</span>
      </div>

      {/* Posts */}
      {loading ? (
        <div className="text-gray-400 text-sm">Loading...</div>
      ) : posts.length === 0 ? (
        <div className="bg-white rounded-xl border border-dashed border-gray-200 p-16 text-center">
          <Inbox size={32} className="mx-auto text-gray-300 mb-3" />
          <p className="text-sm font-medium text-gray-500">No posts found</p>
          <p className="text-xs text-gray-400 mt-1">
            Publish a blog post to auto-generate social drafts, or adjust your filters.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {posts.map((post) => (
            <div key={post.id} className="bg-white rounded-xl border border-gray-200 p-5">
              <div className="flex items-start gap-3">
                {/* Platform icon */}
                <div className="w-9 h-9 rounded-lg bg-gray-100 flex items-center justify-center font-bold text-sm text-gray-600 shrink-0">
                  {PLATFORM_ICON[post.platform] ?? post.platform[0].toUpperCase()}
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-2">
                    <span className="text-sm font-semibold text-gray-900 capitalize">{post.platform}</span>
                    <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${STATUS_STYLES[post.status] ?? 'bg-gray-100 text-gray-600'}`}>
                      {post.status}
                    </span>
                    {post.page_title && (
                      <span className="text-xs text-gray-400">
                        from:{' '}
                        <a
                          href={`/blog/${post.page_slug}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="underline hover:text-brand inline-flex items-center gap-0.5"
                        >
                          {post.page_title} <ExternalLink size={10} />
                        </a>
                      </span>
                    )}
                    <span className="text-xs text-gray-300 ml-auto">
                      {new Date(post.created_at).toLocaleDateString()}
                    </span>
                  </div>

                  {/* Content — editable */}
                  {editId === post.id ? (
                    <div className="space-y-2">
                      <textarea
                        value={editContent}
                        onChange={(e) => setEditContent(e.target.value)}
                        rows={5}
                        className="w-full px-3 py-2 rounded-lg border border-brand text-sm resize-y outline-none"
                      />
                      <div className="flex gap-2">
                        <button
                          onClick={() => saveEdit(post.id)}
                          disabled={busy[post.id]}
                          className="px-4 py-1.5 bg-brand text-white text-xs font-medium rounded-lg hover:bg-brand/90 disabled:opacity-50"
                        >
                          Save
                        </button>
                        <button
                          onClick={() => setEditId(null)}
                          className="px-4 py-1.5 bg-gray-100 text-gray-600 text-xs font-medium rounded-lg hover:bg-gray-200"
                        >
                          <X size={12} className="inline mr-1" />Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    <p className="text-sm text-gray-700 whitespace-pre-wrap leading-relaxed">{post.content}</p>
                  )}

                  {post.error_message && (
                    <p className="mt-2 text-xs text-red-500">{post.error_message}</p>
                  )}
                </div>
              </div>

              {/* Action bar */}
              {post.status !== 'published' && post.status !== 'rejected' && editId !== post.id && (
                <div className="flex gap-2 mt-4 pt-4 border-t border-gray-100">
                  {post.status === 'draft' && (
                    <button
                      onClick={() => approve(post.id)}
                      disabled={busy[post.id]}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 text-blue-700 text-xs font-medium rounded-lg hover:bg-blue-100 disabled:opacity-50"
                    >
                      <CheckCircle size={13} /> Approve
                    </button>
                  )}
                  {(post.status === 'draft' || post.status === 'approved') && (
                    <button
                      onClick={() => publish(post.id)}
                      disabled={busy[post.id]}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-green-50 text-green-700 text-xs font-medium rounded-lg hover:bg-green-100 disabled:opacity-50"
                    >
                      <Send size={13} /> Publish
                    </button>
                  )}
                  <button
                    onClick={() => { setEditId(post.id); setEditContent(post.content); }}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-50 text-gray-600 text-xs font-medium rounded-lg hover:bg-gray-100"
                  >
                    <Pencil size={13} /> Edit
                  </button>
                  <button
                    onClick={() => reject(post.id)}
                    disabled={busy[post.id]}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-red-50 text-red-600 text-xs font-medium rounded-lg hover:bg-red-100 disabled:opacity-50"
                  >
                    <XCircle size={13} /> Reject
                  </button>
                  <button
                    onClick={() => remove(post.id)}
                    disabled={busy[post.id]}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-50 text-gray-400 text-xs font-medium rounded-lg hover:bg-red-50 hover:text-red-500 disabled:opacity-50 ml-auto"
                  >
                    <Trash2 size={13} /> Delete
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
