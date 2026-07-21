'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { addToast } from '@/lib/toast';

type Feed = {
  id: number;
  name: string;
  url: string;
  platform: string;
  is_active: boolean;
  auto_publish: boolean;
  max_posts_per_day: number;
  posts_today: number;
  last_checked_at: string | null;
  created_at: string;
};

type FeedStats = {
  feed: Feed & { content_template: string; category: string };
  total_items_posted: number;
  recent_items: {
    id: number;
    title: string;
    url: string;
    posted_at: string;
    status: string | null;
    engagement_score: number | null;
  }[];
};

const PLATFORMS = ['facebook', 'instagram', 'x', 'linkedin', 'tiktok', 'youtube', 'pinterest'];

const PLATFORM_ICON: Record<string, string> = {
  facebook: '𝕗', instagram: '◉', x: '𝕏', linkedin: 'in',
  tiktok: '♪', youtube: '▶', pinterest: '𝕻',
};

const PLATFORM_COLOR: Record<string, string> = {
  facebook: 'bg-blue-100 text-blue-800',
  instagram: 'bg-pink-100 text-pink-800',
  x: 'bg-gray-100 text-gray-800',
  linkedin: 'bg-sky-100 text-sky-800',
  tiktok: 'bg-black text-white',
  youtube: 'bg-red-100 text-red-800',
  pinterest: 'bg-rose-100 text-rose-800',
};

const DEFAULT_TEMPLATE = '📰 {title}\n\n{url}';

const BLANK_FORM = {
  name: '',
  url: '',
  platform: 'instagram',
  content_template: DEFAULT_TEMPLATE,
  auto_publish: false,
  max_posts_per_day: 3,
  category: 'educational',
};

export default function RssPage() {
  const [feeds, setFeeds] = useState<Feed[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ ...BLANK_FORM });
  const [saving, setSaving] = useState(false);
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [stats, setStats] = useState<Record<number, FeedStats>>({});
  const [busy, setBusy] = useState<Record<number, string>>({});

  async function load() {
    try {
      const data = await api.get<{ feeds: Feed[] }>('/api/admin/rss/feeds');
      setFeeds(data.feeds);
    } catch { addToast('Failed to load RSS feeds', 'error'); }
    finally { setLoading(false); }
  }

  useEffect(() => { load(); }, []);

  async function loadStats(id: number) {
    try {
      const data = await api.get<FeedStats>(`/api/admin/rss/feeds/${id}/stats`);
      setStats((s) => ({ ...s, [id]: data }));
    } catch { /* silent */ }
  }

  function toggle(id: number) {
    if (expandedId === id) { setExpandedId(null); return; }
    setExpandedId(id);
    if (!stats[id]) loadStats(id);
  }

  async function createFeed(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      await api.post('/api/admin/rss/feeds', form);
      addToast('RSS feed created', 'success');
      setShowForm(false);
      setForm({ ...BLANK_FORM });
      load();
    } catch (err: any) {
      addToast(err?.message ?? 'Failed to create feed', 'error');
    } finally { setSaving(false); }
  }

  async function patchFeed(id: number, patch: { is_active?: boolean; auto_publish?: boolean; max_posts_per_day?: number }) {
    try {
      await api.patch(`/api/admin/rss/feeds/${id}`, patch);
      setFeeds((fs) => fs.map((f) => (f.id === id ? { ...f, ...patch } : f)));
    } catch (err: any) {
      addToast(err?.message ?? 'Update failed', 'error');
    }
  }

  async function checkNow(id: number) {
    setBusy((b) => ({ ...b, [id]: 'check' }));
    try {
      const result = await api.post<any>(`/api/admin/rss/feeds/${id}/check`, {});
      addToast(
        result.posts_created > 0
          ? `✅ ${result.posts_created} new post${result.posts_created !== 1 ? 's' : ''} created`
          : 'No new items found',
        'success',
      );
      load();
      if (stats[id]) loadStats(id);
    } catch (err: any) {
      addToast(err?.message ?? 'Check failed', 'error');
    } finally { setBusy((b) => ({ ...b, [id]: '' })); }
  }

  async function deleteFeed(id: number) {
    if (!confirm('Delete this RSS feed? All tracked items will be removed.')) return;
    try {
      await api.delete(`/api/admin/rss/feeds/${id}`);
      addToast('Feed deleted', 'success');
      setFeeds((fs) => fs.filter((f) => f.id !== id));
      if (expandedId === id) setExpandedId(null);
    } catch (err: any) {
      addToast(err?.message ?? 'Delete failed', 'error');
    }
  }

  async function checkAll() {
    try {
      const result = await api.post<any>('/api/admin/rss/check-all', {});
      addToast(
        `Checked ${result.feeds_checked} feed${result.feeds_checked !== 1 ? 's' : ''} — ${result.total_posts_created} posts created`,
        'success',
      );
      load();
    } catch (err: any) {
      addToast(err?.message ?? 'Check all failed', 'error');
    }
  }

  const activeFeedsCount = feeds.filter((f) => f.is_active).length;
  const autoPublishCount = feeds.filter((f) => f.auto_publish).length;

  if (loading) return <div className="text-gray-400 text-sm">Loading…</div>;

  return (
    <div className="max-w-3xl space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">RSS Auto-Publish</h1>
          <p className="text-sm text-gray-500 mt-1">
            Monitor RSS/Atom feeds and automatically create social posts from new items.
          </p>
        </div>
        <div className="flex gap-2">
          <button onClick={checkAll}
            className="px-3 py-2 border border-gray-200 rounded-xl text-sm text-gray-700 hover:bg-gray-50 font-medium">
            Check All Now
          </button>
          <button onClick={() => setShowForm((v) => !v)}
            className="px-4 py-2 bg-indigo-600 text-white rounded-xl text-sm font-semibold hover:bg-indigo-700">
            + Add Feed
          </button>
        </div>
      </div>

      {/* Stats bar */}
      {feeds.length > 0 && (
        <div className="grid grid-cols-3 gap-4">
          {[
            { label: 'Total feeds', value: feeds.length },
            { label: 'Active', value: activeFeedsCount },
            { label: 'Auto-publish on', value: autoPublishCount },
          ].map((s) => (
            <div key={s.label} className="bg-white border border-gray-100 rounded-xl p-4 text-center shadow-sm">
              <p className="text-2xl font-bold text-gray-900">{s.value}</p>
              <p className="text-xs text-gray-400 mt-0.5">{s.label}</p>
            </div>
          ))}
        </div>
      )}

      {/* Create form */}
      {showForm && (
        <form onSubmit={createFeed} className="bg-white border border-gray-200 rounded-2xl p-6 space-y-4 shadow-sm">
          <h2 className="font-semibold text-gray-900">New RSS Feed</h2>

          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <label className="text-xs text-gray-500 font-medium block mb-1">Feed Name *</label>
              <input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="e.g. Company Blog"
                className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm outline-none focus:border-indigo-400" />
            </div>

            <div className="col-span-2">
              <label className="text-xs text-gray-500 font-medium block mb-1">RSS / Atom URL *</label>
              <input required type="url" value={form.url} onChange={(e) => setForm({ ...form, url: e.target.value })}
                placeholder="https://example.com/feed.xml"
                className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm outline-none focus:border-indigo-400 font-mono" />
            </div>

            <div>
              <label className="text-xs text-gray-500 font-medium block mb-1">Platform</label>
              <select value={form.platform} onChange={(e) => setForm({ ...form, platform: e.target.value })}
                className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm outline-none focus:border-indigo-400">
                {PLATFORMS.map((p) => (
                  <option key={p} value={p}>{p.charAt(0).toUpperCase() + p.slice(1)}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-xs text-gray-500 font-medium block mb-1">Max posts / day</label>
              <input type="number" min={1} max={20} value={form.max_posts_per_day}
                onChange={(e) => setForm({ ...form, max_posts_per_day: parseInt(e.target.value) || 3 })}
                className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm outline-none focus:border-indigo-400" />
            </div>

            <div className="col-span-2">
              <label className="text-xs text-gray-500 font-medium block mb-1">
                Post template{' '}
                <span className="text-gray-400 font-normal">— variables: {'{'}<code>title</code>{'}'} {'{'}<code>url</code>{'}'} {'{'}<code>description</code>{'}'}</span>
              </label>
              <textarea rows={3} value={form.content_template}
                onChange={(e) => setForm({ ...form, content_template: e.target.value })}
                className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm outline-none focus:border-indigo-400 font-mono resize-none" />
            </div>

            <div className="flex items-center gap-2">
              <input type="checkbox" id="auto_publish" checked={form.auto_publish}
                onChange={(e) => setForm({ ...form, auto_publish: e.target.checked })}
                className="rounded" />
              <label htmlFor="auto_publish" className="text-sm text-gray-700">Auto-publish immediately</label>
            </div>
          </div>

          <div className="flex gap-3 pt-1">
            <button type="button" onClick={() => setShowForm(false)}
              className="flex-1 py-2 border border-gray-200 text-gray-600 text-sm font-medium rounded-xl hover:bg-gray-50">
              Cancel
            </button>
            <button type="submit" disabled={saving}
              className="flex-1 py-2 bg-indigo-600 text-white text-sm font-semibold rounded-xl hover:bg-indigo-700 disabled:opacity-50">
              {saving ? 'Creating…' : 'Create Feed'}
            </button>
          </div>
        </form>
      )}

      {/* Feed list */}
      {feeds.length === 0 ? (
        <div className="bg-white border border-dashed border-gray-200 rounded-2xl p-12 text-center">
          <p className="text-4xl mb-3">📡</p>
          <p className="text-gray-700 font-semibold">No RSS feeds yet</p>
          <p className="text-gray-400 text-sm mt-1">Add a feed to start auto-posting blog or news content to social media.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {feeds.map((feed) => {
            const isOpen = expandedId === feed.id;
            const feedStats = stats[feed.id];
            const isBusy = busy[feed.id] === 'check';

            return (
              <div key={feed.id} className="bg-white border border-gray-100 rounded-2xl overflow-hidden shadow-sm">
                {/* Row */}
                <div className="flex items-center gap-4 px-5 py-4">
                  <span className={`w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold shrink-0 ${PLATFORM_COLOR[feed.platform] ?? 'bg-gray-100 text-gray-600'}`}>
                    {PLATFORM_ICON[feed.platform] ?? feed.platform[0].toUpperCase()}
                  </span>

                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-gray-900 text-sm truncate">{feed.name}</p>
                    <p className="text-xs text-gray-400 truncate">{feed.url}</p>
                  </div>

                  <div className="flex items-center gap-3 shrink-0">
                    {/* posts today badge */}
                    <span className="text-xs text-gray-500 hidden sm:block">
                      {feed.posts_today}/{feed.max_posts_per_day} today
                    </span>

                    {/* auto-publish badge */}
                    {feed.auto_publish && (
                      <span className="text-xs bg-green-100 text-green-700 font-medium px-2 py-0.5 rounded-full hidden sm:block">
                        auto
                      </span>
                    )}

                    {/* Active toggle */}
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input type="checkbox" className="sr-only peer" checked={feed.is_active}
                        onChange={(e) => patchFeed(feed.id, { is_active: e.target.checked })} />
                      <div className="w-9 h-5 bg-gray-200 peer-checked:bg-indigo-600 rounded-full transition-colors after:content-[''] after:absolute after:top-0.5 after:left-0.5 after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:after:translate-x-4" />
                    </label>

                    <button onClick={() => toggle(feed.id)}
                      className="text-xs text-gray-400 hover:text-gray-700 px-2 py-1 border border-gray-200 rounded-lg">
                      {isOpen ? '▲' : '▼'}
                    </button>
                  </div>
                </div>

                {/* Expanded */}
                {isOpen && (
                  <div className="border-t border-gray-100 bg-gray-50 px-5 py-5 space-y-5">
                    {/* Controls */}
                    <div className="flex flex-wrap gap-3 items-center">
                      <div className="flex items-center gap-2">
                        <input type="checkbox" id={`ap-${feed.id}`} checked={feed.auto_publish}
                          onChange={(e) => patchFeed(feed.id, { auto_publish: e.target.checked })}
                          className="rounded" />
                        <label htmlFor={`ap-${feed.id}`} className="text-sm text-gray-700">Auto-publish</label>
                      </div>

                      <div className="flex items-center gap-2">
                        <label className="text-sm text-gray-700">Max/day</label>
                        <select value={feed.max_posts_per_day}
                          onChange={(e) => patchFeed(feed.id, { max_posts_per_day: parseInt(e.target.value) })}
                          className="px-2 py-1 border border-gray-200 rounded-lg text-sm outline-none focus:border-indigo-400">
                          {[1, 2, 3, 5, 10, 20].map((n) => (
                            <option key={n} value={n}>{n}</option>
                          ))}
                        </select>
                      </div>

                      <div className="ml-auto flex gap-2">
                        <button onClick={() => checkNow(feed.id)} disabled={isBusy}
                          className="px-3 py-1.5 border border-gray-200 text-sm text-gray-700 rounded-lg hover:bg-white disabled:opacity-50">
                          {isBusy ? 'Checking…' : '↻ Check Now'}
                        </button>
                        <button onClick={() => deleteFeed(feed.id)}
                          className="px-3 py-1.5 border border-red-100 text-sm text-red-600 rounded-lg hover:bg-red-50">
                          Delete
                        </button>
                      </div>
                    </div>

                    {/* Stats */}
                    {feedStats ? (
                      <div>
                        <div className="grid grid-cols-3 gap-3 mb-4">
                          {[
                            { label: 'Total posted', value: feedStats.total_items_posted },
                            { label: 'Today', value: feed.posts_today },
                            {
                              label: 'Last checked',
                              value: feed.last_checked_at
                                ? new Date(feed.last_checked_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                                : '—',
                            },
                          ].map((s) => (
                            <div key={s.label} className="bg-white border border-gray-100 rounded-xl p-3 text-center">
                              <p className="text-lg font-bold text-gray-900">{s.value}</p>
                              <p className="text-xs text-gray-400">{s.label}</p>
                            </div>
                          ))}
                        </div>

                        {feedStats.recent_items.length > 0 && (
                          <div className="space-y-2">
                            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Recent items</p>
                            {feedStats.recent_items.slice(0, 6).map((item) => (
                              <div key={item.id} className="flex items-start gap-3 bg-white border border-gray-100 rounded-xl px-4 py-3">
                                <div className="flex-1 min-w-0">
                                  <a href={item.url} target="_blank" rel="noreferrer"
                                    className="text-sm text-gray-800 font-medium hover:text-indigo-600 line-clamp-1">
                                    {item.title}
                                  </a>
                                  <p className="text-xs text-gray-400 mt-0.5">
                                    {new Date(item.posted_at).toLocaleDateString()}
                                  </p>
                                </div>
                                {item.status && (
                                  <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full shrink-0">
                                    {item.status}
                                  </span>
                                )}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    ) : (
                      <p className="text-sm text-gray-400">Loading stats…</p>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
