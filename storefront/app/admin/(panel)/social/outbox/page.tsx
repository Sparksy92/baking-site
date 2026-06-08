'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { addToast } from '@/lib/toast';
import { Inbox, CheckCircle, XCircle, Send, Trash2, Pencil, X, ExternalLink, Hash, Sparkles, AlertTriangle, Plus } from 'lucide-react';

type SocialPost = {
  id: number;
  platform: string;
  content: string;
  hashtags: string | null;  // JSON array of hashtags
  image_url: string | null;
  status: string;
  page_title: string | null;
  page_slug: string | null;
  created_at: string;
  published_at: string | null;
  error_message: string | null;
};

type PlatformConfig = {
  platform: string;
  max_hashtags: number;
  max_caption_chars: number;
  hashtag_mode: string;
};

function parseHashtags(raw: string | null): string[] {
  if (!raw) return [];
  try { return JSON.parse(raw); } catch { return []; }
}

function formatHashtags(tags: string[]): string {
  return JSON.stringify(tags);
}

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
  const [editHashtags, setEditHashtags] = useState<string[]>([]);
  const [hashtagInput, setHashtagInput] = useState('');
  const [suggesting, setSuggesting] = useState(false);
  const [platformConfigs, setPlatformConfigs] = useState<Record<string, PlatformConfig>>({});
  const [busy, setBusy] = useState<Record<number, boolean>>({});
  const [showCreate, setShowCreate] = useState(false);
  const [newPlatform, setNewPlatform] = useState('instagram');
  const [newContent, setNewContent] = useState('');
  const [newHashtags, setNewHashtags] = useState<string[]>([]);
  const [newHashtagInput, setNewHashtagInput] = useState('');
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    api.get<PlatformConfig[]>('/api/admin/social/platforms')
      .then((cfgs) => {
        const map: Record<string, PlatformConfig> = {};
        cfgs.forEach((c) => { map[c.platform] = c; });
        setPlatformConfigs(map);
      })
      .catch(console.error);
  }, []);

  async function createPost() {
    if (!newContent.trim()) { addToast('Content is required', 'error'); return; }
    setCreating(true);
    try {
      await api.post('/api/admin/social/outbox', {
        platform: newPlatform,
        content: newContent,
        hashtags: newHashtags.length > 0 ? formatHashtags(newHashtags) : null,
      });
      addToast('Draft created', 'success');
      setShowCreate(false);
      setNewContent('');
      setNewHashtags([]);
      setFilterStatus('draft');
      load();
    } catch { addToast('Failed to create post', 'error'); }
    finally { setCreating(false); }
  }

  async function suggestNewHashtags() {
    setSuggesting(true);
    try {
      const data = await api.post<{ hashtags: string[]; note: string }>(
        '/api/admin/social/hashtags/suggest',
        { content: newContent, platform: newPlatform }
      );
      setNewHashtags(data.hashtags);
    } catch { addToast('Failed to suggest', 'error'); }
    finally { setSuggesting(false); }
  }

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
      await api.patch(`/api/admin/social/outbox/${id}`, {
        content: editContent,
        hashtags: formatHashtags(editHashtags),
      });
      addToast('Saved', 'success');
      setEditId(null);
      load();
    } catch { addToast('Failed', 'error'); }
    finally { setBusy((b) => ({ ...b, [id]: false })); }
  }

  async function suggestHashtags(post: SocialPost) {
    setSuggesting(true);
    try {
      const data = await api.post<{ hashtags: string[]; note: string }>(
        '/api/admin/social/hashtags/suggest',
        { content: editContent || post.content, platform: post.platform }
      );
      setEditHashtags(data.hashtags);
      if (data.note) addToast(data.note, 'info');
    } catch { addToast('Failed to suggest hashtags', 'error'); }
    finally { setSuggesting(false); }
  }

  function addHashtag() {
    const tag = hashtagInput.trim();
    if (!tag) return;
    const formatted = tag.startsWith('#') ? tag : `#${tag}`;
    if (!editHashtags.includes(formatted)) {
      setEditHashtags([...editHashtags, formatted]);
    }
    setHashtagInput('');
  }

  function removeHashtag(tag: string) {
    setEditHashtags(editHashtags.filter((t) => t !== tag));
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
          Review, edit and approve social posts. Create manually or auto-generate from blog posts and products.
        </p>
      </div>

      {/* New Post button + Filters */}
      <div className="flex gap-3 flex-wrap">
        <button
          onClick={() => setShowCreate(!showCreate)}
          className="flex items-center gap-1.5 px-4 py-2 bg-brand text-white text-sm font-medium rounded-lg hover:bg-brand/90"
        >
          <Plus size={16} /> New Post
        </button>
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

      {/* Create Post Form */}
      {showCreate && (
        <div className="bg-white rounded-xl border border-brand/30 p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-gray-900">New Post</h2>
            <button onClick={() => setShowCreate(false)} className="text-gray-400 hover:text-gray-600">
              <X size={16} />
            </button>
          </div>

          {/* Platform picker */}
          <div>
            <label className="text-xs font-medium text-gray-600 block mb-1">Platform</label>
            <div className="flex gap-2">
              {PLATFORMS.filter(Boolean).map((p) => (
                <button
                  key={p}
                  onClick={() => setNewPlatform(p)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                    newPlatform === p
                      ? 'bg-brand text-white border-brand'
                      : 'bg-white text-gray-600 border-gray-200 hover:border-brand'
                  }`}
                >
                  {PLATFORM_ICON[p] ?? ''} {p.charAt(0).toUpperCase() + p.slice(1)}
                </button>
              ))}
            </div>
          </div>

          {/* Content */}
          <div>
            <label className="text-xs font-medium text-gray-600 block mb-1">Content</label>
            {(() => {
              const cfg = platformConfigs[newPlatform];
              const maxChars = cfg?.max_caption_chars ?? 2200;
              const charCount = newContent.length + newHashtags.join(' ').length + (newHashtags.length > 0 ? 2 : 0);
              const overLimit = charCount > maxChars;
              return (
                <div className="relative">
                  <textarea
                    value={newContent}
                    onChange={(e) => setNewContent(e.target.value)}
                    rows={4}
                    className={`w-full px-3 py-2 rounded-lg border text-sm resize-y outline-none ${
                      overLimit ? 'border-red-400' : 'border-gray-200 focus:border-brand'
                    }`}
                    placeholder={`Write your ${newPlatform} post...`}
                  />
                  <span className={`absolute bottom-2 right-3 text-xs ${overLimit ? 'text-red-500' : 'text-gray-400'}`}>
                    {charCount}/{maxChars}
                  </span>
                </div>
              );
            })()}
          </div>

          {/* Hashtags */}
          {platformConfigs[newPlatform]?.hashtag_mode !== 'none' && (
            <div className="bg-gray-50 rounded-lg p-3 space-y-2">
              <div className="flex items-center gap-2">
                <Hash size={14} className="text-gray-500" />
                <span className="text-xs font-medium text-gray-600">Hashtags</span>
                <span className="text-xs text-gray-400">
                  {newHashtags.length}/{platformConfigs[newPlatform]?.max_hashtags ?? 5} max
                </span>
                <button
                  onClick={suggestNewHashtags}
                  disabled={suggesting || !newContent.trim()}
                  className="ml-auto flex items-center gap-1 px-2 py-1 bg-purple-50 text-purple-700 text-xs font-medium rounded-md hover:bg-purple-100 disabled:opacity-50"
                >
                  <Sparkles size={12} /> {suggesting ? 'Suggesting...' : 'AI Suggest'}
                </button>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {newHashtags.map((tag) => (
                  <span key={tag} className="inline-flex items-center gap-1 px-2 py-0.5 bg-brand/10 text-brand text-xs font-medium rounded-full">
                    {tag}
                    <button onClick={() => setNewHashtags(newHashtags.filter((t) => t !== tag))} className="hover:text-red-500"><X size={10} /></button>
                  </span>
                ))}
              </div>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={newHashtagInput}
                  onChange={(e) => setNewHashtagInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      const t = newHashtagInput.trim();
                      if (t) {
                        const f = t.startsWith('#') ? t : `#${t}`;
                        if (!newHashtags.includes(f)) setNewHashtags([...newHashtags, f]);
                        setNewHashtagInput('');
                      }
                    }
                  }}
                  placeholder="Add hashtag..."
                  className="flex-1 px-2.5 py-1.5 rounded-md border border-gray-200 text-xs outline-none focus:border-brand font-mono"
                />
                <button
                  onClick={() => {
                    const t = newHashtagInput.trim();
                    if (t) {
                      const f = t.startsWith('#') ? t : `#${t}`;
                      if (!newHashtags.includes(f)) setNewHashtags([...newHashtags, f]);
                      setNewHashtagInput('');
                    }
                  }}
                  className="px-3 py-1.5 bg-gray-200 text-gray-600 text-xs font-medium rounded-md hover:bg-gray-300"
                >
                  Add
                </button>
              </div>
            </div>
          )}

          {/* Submit */}
          <div className="flex gap-2 pt-2 border-t border-gray-100">
            <button
              onClick={createPost}
              disabled={creating || !newContent.trim()}
              className="px-5 py-2 bg-brand text-white text-sm font-medium rounded-lg hover:bg-brand/90 disabled:opacity-50"
            >
              {creating ? 'Creating...' : 'Create Draft'}
            </button>
            <button
              onClick={() => setShowCreate(false)}
              className="px-4 py-2 bg-gray-100 text-gray-600 text-sm font-medium rounded-lg hover:bg-gray-200"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

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
                    <div className="space-y-3">
                      {/* Caption editor with char count */}
                      {(() => {
                        const cfg = platformConfigs[post.platform];
                        const maxChars = cfg?.max_caption_chars ?? 2200;
                        const charCount = editContent.length + editHashtags.join(' ').length + (editHashtags.length > 0 ? 2 : 0);
                        const overLimit = charCount > maxChars;
                        return (
                          <>
                            <div className="relative">
                              <textarea
                                value={editContent}
                                onChange={(e) => setEditContent(e.target.value)}
                                rows={5}
                                className={`w-full px-3 py-2 rounded-lg border text-sm resize-y outline-none ${
                                  overLimit ? 'border-red-400' : 'border-brand'
                                }`}
                              />
                              <span className={`absolute bottom-2 right-3 text-xs ${
                                overLimit ? 'text-red-500 font-semibold' : 'text-gray-400'
                              }`}>
                                {charCount}/{maxChars}
                              </span>
                            </div>
                            {overLimit && (
                              <div className="flex items-center gap-1 text-xs text-red-500">
                                <AlertTriangle size={12} /> Over character limit for {post.platform}
                              </div>
                            )}
                          </>
                        );
                      })()}

                      {/* Hashtag editor */}
                      {platformConfigs[post.platform]?.hashtag_mode !== 'none' && (
                        <div className="bg-gray-50 rounded-lg p-3 space-y-2">
                          <div className="flex items-center gap-2">
                            <Hash size={14} className="text-gray-500" />
                            <span className="text-xs font-medium text-gray-600">Hashtags</span>
                            <span className="text-xs text-gray-400">
                              {editHashtags.length}/{platformConfigs[post.platform]?.max_hashtags ?? 5} max
                            </span>
                            <button
                              onClick={() => suggestHashtags(post)}
                              disabled={suggesting}
                              className="ml-auto flex items-center gap-1 px-2 py-1 bg-purple-50 text-purple-700 text-xs font-medium rounded-md hover:bg-purple-100 disabled:opacity-50"
                            >
                              <Sparkles size={12} /> {suggesting ? 'Suggesting...' : 'AI Suggest'}
                            </button>
                          </div>
                          {/* Tag pills */}
                          <div className="flex flex-wrap gap-1.5">
                            {editHashtags.map((tag) => (
                              <span
                                key={tag}
                                className="inline-flex items-center gap-1 px-2 py-0.5 bg-brand/10 text-brand text-xs font-medium rounded-full"
                              >
                                {tag}
                                <button onClick={() => removeHashtag(tag)} className="hover:text-red-500">
                                  <X size={10} />
                                </button>
                              </span>
                            ))}
                          </div>
                          {/* Add hashtag input */}
                          <div className="flex gap-2">
                            <input
                              type="text"
                              value={hashtagInput}
                              onChange={(e) => setHashtagInput(e.target.value)}
                              onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addHashtag(); } }}
                              placeholder="Add hashtag..."
                              className="flex-1 px-2.5 py-1.5 rounded-md border border-gray-200 text-xs outline-none focus:border-brand font-mono"
                            />
                            <button
                              onClick={addHashtag}
                              className="px-3 py-1.5 bg-gray-200 text-gray-600 text-xs font-medium rounded-md hover:bg-gray-300"
                            >
                              Add
                            </button>
                          </div>
                        </div>
                      )}

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
                    <div>
                      <p className="text-sm text-gray-700 whitespace-pre-wrap leading-relaxed">{post.content}</p>
                      {parseHashtags(post.hashtags).length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-2">
                          {parseHashtags(post.hashtags).map((tag) => (
                            <span key={tag} className="text-xs text-brand font-medium">{tag}</span>
                          ))}
                        </div>
                      )}
                    </div>
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
                    onClick={() => { setEditId(post.id); setEditContent(post.content); setEditHashtags(parseHashtags(post.hashtags)); }}
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
