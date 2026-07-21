'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { addToast } from '@/lib/toast';
import {
  Crosshair, Plus, X, ChevronDown, ChevronUp,
  TrendingUp, AlertTriangle, Star, MessageSquare,
} from 'lucide-react';

type Competitor = {
  id: number;
  name: string;
  platform: string;
  platform_handle: string;
  profile_url: string | null;
  notes: string;
};

type CompetitorReport = {
  competitor: Competitor;
  period_days: number;
  stats: {
    posts_analyzed: number;
    avg_likes: number;
    avg_comments: number;
    avg_shares: number;
    avg_engagement_rate: number;
    best_post_likes: number;
  };
  content_mix: Record<string, number>;
  top_posts: { id: number; content: string; likes: number; comments: number; shares: number }[];
  response_opportunities: { id: number; content: string; our_takeaway: string }[];
};

const PLATFORMS = ['facebook', 'instagram', 'tiktok', 'youtube', 'x', 'linkedin'];

const PLATFORM_ICON: Record<string, string> = {
  facebook: '📘', instagram: '📸', tiktok: '🎵',
  youtube: '▶️', x: '𝕏', linkedin: '💼',
};

const THREAT_STYLES: Record<string, string> = {
  low: 'bg-green-100 text-green-700',
  medium: 'bg-amber-100 text-amber-700',
  high: 'bg-red-100 text-red-700',
};

export default function CompetitorsPage() {
  const [competitors, setCompetitors] = useState<Competitor[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [reports, setReports] = useState<Record<number, CompetitorReport | 'loading'>>({});

  // Add competitor form
  const [showAdd, setShowAdd] = useState(false);
  const [newName, setNewName] = useState('');
  const [newPlatform, setNewPlatform] = useState('instagram');
  const [newHandle, setNewHandle] = useState('');
  const [newUrl, setNewUrl] = useState('');
  const [newNotes, setNewNotes] = useState('');
  const [adding, setAdding] = useState(false);

  // Add post form
  const [addPostId, setAddPostId] = useState<number | null>(null);
  const [postContent, setPostContent] = useState('');
  const [postPostId, setPostPostId] = useState('');
  const [postLikes, setPostLikes] = useState('');
  const [postComments, setPostComments] = useState('');
  const [postShares, setPostShares] = useState('');
  const [postFollowers, setPostFollowers] = useState('');
  const [submittingPost, setSubmittingPost] = useState(false);

  function load() {
    setLoading(true);
    api.get<{ competitors: Competitor[] }>('/api/admin/social/competitors')
      .then((d) => setCompetitors(d.competitors))
      .catch(() => addToast('Failed to load competitors', 'error'))
      .finally(() => setLoading(false));
  }

  useEffect(() => { load(); }, []);

  async function addCompetitor() {
    if (!newName.trim() || !newHandle.trim()) { addToast('Name and handle required', 'error'); return; }
    setAdding(true);
    try {
      await api.post('/api/admin/social/competitors', {
        name: newName, platform: newPlatform,
        platform_handle: newHandle,
        profile_url: newUrl || null,
        notes: newNotes,
      });
      addToast('Competitor added', 'success');
      setShowAdd(false);
      setNewName(''); setNewHandle(''); setNewUrl(''); setNewNotes('');
      load();
    } catch { addToast('Failed to add competitor', 'error'); }
    finally { setAdding(false); }
  }

  async function expand(id: number) {
    if (expandedId === id) { setExpandedId(null); return; }
    setExpandedId(id);
    if (!reports[id]) {
      setReports((prev) => ({ ...prev, [id]: 'loading' }));
      try {
        const data = await api.get<CompetitorReport>(`/api/admin/social/competitors/${id}/report`);
        setReports((prev) => ({ ...prev, [id]: data }));
      } catch { addToast('Failed to load report', 'error'); setReports((prev) => { const n = {...prev}; delete n[id]; return n; }); }
    }
  }

  async function submitPost(competitorId: number) {
    if (!postContent.trim() || !postPostId.trim()) { addToast('Post ID and content required', 'error'); return; }
    setSubmittingPost(true);
    try {
      await api.post(`/api/admin/social/competitors/${competitorId}/posts`, {
        platform_post_id: postPostId,
        content: postContent,
        posted_at: new Date().toISOString(),
        likes: parseInt(postLikes) || 0,
        comments: parseInt(postComments) || 0,
        shares: parseInt(postShares) || 0,
        follower_count: parseInt(postFollowers) || null,
      });
      addToast('Post recorded & AI analysis queued', 'success');
      setAddPostId(null);
      setPostContent(''); setPostPostId(''); setPostLikes(''); setPostComments(''); setPostShares(''); setPostFollowers('');
      // Refresh report
      const data = await api.get<CompetitorReport>(`/api/admin/social/competitors/${competitorId}/report`);
      setReports((prev) => ({ ...prev, [competitorId]: data }));
    } catch { addToast('Failed to record post', 'error'); }
    finally { setSubmittingPost(false); }
  }

  return (
    <div className="max-w-3xl space-y-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Crosshair size={20} className="text-brand" />
            <h1 className="text-2xl font-bold text-gray-900">Competitor Tracking</h1>
          </div>
          <p className="text-sm text-gray-500">
            Monitor competitor social performance, extract insights, and spot response opportunities.
          </p>
        </div>
        <button
          onClick={() => setShowAdd((v) => !v)}
          className="flex items-center gap-2 px-4 py-2 bg-brand text-white text-sm font-medium rounded-xl hover:bg-brand/90"
        >
          <Plus size={15} /> Add Competitor
        </button>
      </div>

      {/* Add form */}
      {showAdd && (
        <div className="bg-white rounded-xl border border-brand/30 p-5 space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-gray-900">Track New Competitor</h2>
            <button onClick={() => setShowAdd(false)} className="text-gray-400 hover:text-gray-600"><X size={16} /></button>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-gray-600 block mb-1">Brand Name *</label>
              <input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="Acme Co" className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm outline-none focus:border-brand" />
            </div>
            <div>
              <label className="text-xs font-medium text-gray-600 block mb-1">Platform *</label>
              <select value={newPlatform} onChange={(e) => setNewPlatform(e.target.value)} className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm outline-none focus:border-brand">
                {PLATFORMS.map((p) => <option key={p} value={p}>{PLATFORM_ICON[p]} {p.charAt(0).toUpperCase() + p.slice(1)}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs font-medium text-gray-600 block mb-1">Handle *</label>
              <input value={newHandle} onChange={(e) => setNewHandle(e.target.value)} placeholder="@acmeco" className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm outline-none focus:border-brand" />
            </div>
            <div>
              <label className="text-xs font-medium text-gray-600 block mb-1">Profile URL</label>
              <input value={newUrl} onChange={(e) => setNewUrl(e.target.value)} placeholder="https://instagram.com/acmeco" className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm outline-none focus:border-brand" />
            </div>
            <div className="sm:col-span-2">
              <label className="text-xs font-medium text-gray-600 block mb-1">Notes</label>
              <input value={newNotes} onChange={(e) => setNewNotes(e.target.value)} placeholder="Key rival in streetwear segment…" className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm outline-none focus:border-brand" />
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <button onClick={() => setShowAdd(false)} className="px-4 py-1.5 text-sm text-gray-600 hover:text-gray-800">Cancel</button>
            <button onClick={addCompetitor} disabled={adding} className="px-5 py-1.5 bg-brand text-white text-sm font-medium rounded-lg hover:bg-brand/90 disabled:opacity-50">
              {adding ? 'Adding…' : 'Add Competitor'}
            </button>
          </div>
        </div>
      )}

      {loading ? (
        <div className="text-gray-400 text-sm py-8 text-center">Loading…</div>
      ) : competitors.length === 0 ? (
        <div className="bg-white rounded-xl border border-dashed border-gray-200 p-16 text-center">
          <Crosshair size={32} className="mx-auto text-gray-300 mb-3" />
          <p className="text-sm font-medium text-gray-500">No competitors tracked yet</p>
          <p className="text-xs text-gray-400 mt-1">Add competitors to benchmark your performance and discover response opportunities.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {competitors.map((c) => {
            const isExpanded = expandedId === c.id;
            const report = reports[c.id];
            return (
              <div key={c.id} className="bg-white rounded-xl border border-gray-200">
                <div className="p-4 flex items-center gap-3">
                  <div className="w-9 h-9 rounded-lg bg-gray-100 flex items-center justify-center text-sm shrink-0">
                    {PLATFORM_ICON[c.platform] ?? '?'}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-gray-900">{c.name}</p>
                    <p className="text-xs text-gray-400">{c.platform_handle} · {c.platform}</p>
                  </div>
                  <button
                    onClick={() => expand(c.id)}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-50 text-gray-600 text-xs font-medium rounded-lg hover:bg-gray-100 border border-gray-200"
                  >
                    {isExpanded ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
                    {isExpanded ? 'Collapse' : 'View Report'}
                  </button>
                </div>

                {isExpanded && (
                  <div className="border-t border-gray-100 p-4 space-y-4">
                    {report === 'loading' ? (
                      <p className="text-xs text-gray-400 text-center py-4">Loading report…</p>
                    ) : report ? (
                      <>
                        {/* Stats row */}
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                          {[
                            { label: 'Posts analysed', value: report.stats.posts_analyzed },
                            { label: 'Avg likes', value: report.stats.avg_likes.toFixed(0) },
                            { label: 'Avg comments', value: report.stats.avg_comments.toFixed(0) },
                            { label: 'Engagement rate', value: `${(report.stats.avg_engagement_rate * 100).toFixed(2)}%` },
                          ].map(({ label, value }) => (
                            <div key={label} className="bg-gray-50 rounded-lg px-3 py-2">
                              <p className="text-[10px] text-gray-400 font-medium uppercase tracking-wide">{label}</p>
                              <p className="text-lg font-bold text-gray-800">{value}</p>
                            </div>
                          ))}
                        </div>

                        {/* Content mix */}
                        {Object.keys(report.content_mix).length > 0 && (
                          <div>
                            <p className="text-xs font-semibold text-gray-700 mb-1.5">Content Mix</p>
                            <div className="flex flex-wrap gap-1.5">
                              {Object.entries(report.content_mix).map(([cat, cnt]) => (
                                <span key={cat} className="px-2.5 py-1 bg-indigo-50 text-indigo-700 text-xs rounded-full border border-indigo-100 font-medium">
                                  {cat} <span className="opacity-60">({cnt})</span>
                                </span>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Response opportunities */}
                        {report.response_opportunities.length > 0 && (
                          <div>
                            <p className="text-xs font-semibold text-gray-700 mb-1.5 flex items-center gap-1.5">
                              <MessageSquare size={12} className="text-amber-500" /> Response Opportunities
                            </p>
                            <div className="space-y-2">
                              {report.response_opportunities.slice(0, 3).map((opp) => (
                                <div key={opp.id} className="p-2.5 bg-amber-50 rounded-lg border border-amber-100">
                                  <p className="text-xs text-gray-700 mb-1 line-clamp-2">{opp.content}</p>
                                  {opp.our_takeaway && (
                                    <p className="text-xs text-amber-700 font-medium">💡 {opp.our_takeaway}</p>
                                  )}
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Top posts */}
                        {report.top_posts.length > 0 && (
                          <div>
                            <p className="text-xs font-semibold text-gray-700 mb-1.5 flex items-center gap-1.5">
                              <Star size={12} className="text-purple-500" /> Top Posts (last {report.period_days}d)
                            </p>
                            <div className="space-y-2">
                              {report.top_posts.map((post) => (
                                <div key={post.id} className="p-2.5 bg-gray-50 rounded-lg flex items-start gap-2">
                                  <p className="text-xs text-gray-700 flex-1 line-clamp-2">{post.content}</p>
                                  <div className="shrink-0 text-right text-[10px] text-gray-400 space-y-0.5">
                                    <p>❤️ {post.likes}</p>
                                    <p>💬 {post.comments}</p>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </>
                    ) : (
                      <p className="text-xs text-gray-400 text-center py-2">No data yet — record posts below.</p>
                    )}

                    {/* Add post form */}
                    {addPostId === c.id ? (
                      <div className="bg-gray-50 rounded-lg p-3 border border-gray-200 space-y-2.5">
                        <p className="text-xs font-semibold text-gray-700">Record Competitor Post</p>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                          <input value={postPostId} onChange={(e) => setPostPostId(e.target.value)} placeholder="Post ID (from URL) *" className="px-2.5 py-1.5 rounded-lg border border-gray-200 text-xs outline-none focus:border-brand" />
                          <div className="flex gap-1.5">
                            <input value={postLikes} onChange={(e) => setPostLikes(e.target.value)} placeholder="Likes" className="w-full px-2.5 py-1.5 rounded-lg border border-gray-200 text-xs outline-none focus:border-brand" type="number" min="0" />
                            <input value={postComments} onChange={(e) => setPostComments(e.target.value)} placeholder="Comments" className="w-full px-2.5 py-1.5 rounded-lg border border-gray-200 text-xs outline-none focus:border-brand" type="number" min="0" />
                            <input value={postShares} onChange={(e) => setPostShares(e.target.value)} placeholder="Shares" className="w-full px-2.5 py-1.5 rounded-lg border border-gray-200 text-xs outline-none focus:border-brand" type="number" min="0" />
                          </div>
                          <input value={postFollowers} onChange={(e) => setPostFollowers(e.target.value)} placeholder="Follower count (for engagement rate)" className="px-2.5 py-1.5 rounded-lg border border-gray-200 text-xs outline-none focus:border-brand" type="number" min="0" />
                        </div>
                        <textarea value={postContent} onChange={(e) => setPostContent(e.target.value)} placeholder="Paste post caption/text *" rows={3} className="w-full px-2.5 py-1.5 rounded-lg border border-gray-200 text-xs outline-none focus:border-brand resize-none" />
                        <div className="flex gap-2 justify-end">
                          <button onClick={() => setAddPostId(null)} className="px-3 py-1 text-xs text-gray-500 hover:text-gray-700">Cancel</button>
                          <button onClick={() => submitPost(c.id)} disabled={submittingPost} className="px-4 py-1 bg-brand text-white text-xs font-medium rounded-lg hover:bg-brand/90 disabled:opacity-50">
                            {submittingPost ? 'Recording…' : 'Record + Analyse'}
                          </button>
                        </div>
                      </div>
                    ) : (
                      <button onClick={() => setAddPostId(c.id)} className="flex items-center gap-1.5 text-xs text-brand hover:underline">
                        <Plus size={12} /> Record a competitor post
                      </button>
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
