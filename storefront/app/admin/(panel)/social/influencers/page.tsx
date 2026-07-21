'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { addToast } from '@/lib/toast';
import {
  Users, Plus, ExternalLink, CheckCircle, XCircle, Clock,
  TrendingUp, Mail, Link, ChevronDown, ChevronUp, Copy,
} from 'lucide-react';

type Influencer = {
  id: number;
  name: string;
  platform: string;
  handle: string;
  follower_count: number | null;
  engagement_rate: number | null;
  niche: string;
  email: string;
  is_active: boolean;
};

type Collaboration = {
  id: number;
  campaign_name: string;
  status: string;
  compensation_cents: number;
  posts_delivered: number;
  revenue_attributed_cents: number;
  roi_percent: number | null;
  tracking_code: string;
  portal_token: string | null;
  start_date: string | null;
  end_date: string | null;
};

type Submission = {
  id: number;
  content_type: string;
  caption: string;
  media_urls: string;
  status: string;
  submitted_at: string;
  reviewed_at: string | null;
  feedback: string | null;
  submitted_by_name: string | null;
};

const PLATFORM_ICONS: Record<string, string> = {
  instagram: '◉', facebook: '𝕗', tiktok: '♪', youtube: '▶', x: '𝕏', linkedin: 'in',
};

const STATUS_STYLES: Record<string, string> = {
  proposed: 'bg-gray-100 text-gray-700',
  active: 'bg-green-100 text-green-800',
  completed: 'bg-blue-100 text-blue-800',
  cancelled: 'bg-red-100 text-red-700',
  pending: 'bg-amber-100 text-amber-800',
  approved: 'bg-green-100 text-green-800',
  rejected: 'bg-red-100 text-red-700',
  revision_requested: 'bg-purple-100 text-purple-800',
};

export default function InfluencersPage() {
  const [influencers, setInfluencers] = useState<Influencer[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [collabs, setCollabs] = useState<Record<number, Collaboration[]>>({});
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [submissionsLoading, setSubmissionsLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'influencers' | 'submissions'>('influencers');

  // New influencer form
  const [showAddForm, setShowAddForm] = useState(false);
  const [newInf, setNewInf] = useState({ name: '', platform: 'instagram', handle: '', follower_count: '', engagement_rate: '', niche: '', email: '' });
  const [addingInf, setAddingInf] = useState(false);

  // New collaboration form
  const [collabForId, setCollabForId] = useState<number | null>(null);
  const [newCollab, setNewCollab] = useState({ campaign_name: '', compensation_cents: '', start_date: '', end_date: '', content_requirements: '', deliverables: '{"posts":1}' });
  const [addingCollab, setAddingCollab] = useState(false);

  // Portal link state
  const [portalLinks, setPortalLinks] = useState<Record<number, string>>({});

  useEffect(() => { loadInfluencers(); }, []);

  async function loadInfluencers() {
    setLoading(true);
    try {
      const data = await api.get<{ influencers: Influencer[] } | Influencer[]>('/api/admin/social/influencers');
      const list = Array.isArray(data) ? data : (data as any).influencers ?? [];
      setInfluencers(list);
    } catch { addToast('Failed to load influencers', 'error'); }
    finally { setLoading(false); }
  }

  async function loadCollabs(influencerId: number) {
    try {
      const data = await api.get<{ collaborations: Collaboration[] }>(`/api/admin/social/influencers/${influencerId}/collaborations`);
      setCollabs((prev) => ({ ...prev, [influencerId]: data.collaborations ?? [] }));
    } catch { /* silent */ }
  }

  async function loadSubmissions() {
    setSubmissionsLoading(true);
    try {
      const data = await api.get<{ submissions: Submission[] }>('/api/admin/social/influencers/submissions');
      setSubmissions(data.submissions ?? []);
    } catch { addToast('Failed to load submissions', 'error'); }
    finally { setSubmissionsLoading(false); }
  }

  async function addInfluencer() {
    if (!newInf.name || !newInf.handle) { addToast('Name and handle required', 'error'); return; }
    setAddingInf(true);
    try {
      await api.post('/api/admin/social/influencers', {
        ...newInf,
        follower_count: newInf.follower_count ? parseInt(newInf.follower_count) : null,
        engagement_rate: newInf.engagement_rate ? parseFloat(newInf.engagement_rate) : null,
      });
      addToast('Influencer added', 'success');
      setShowAddForm(false);
      setNewInf({ name: '', platform: 'instagram', handle: '', follower_count: '', engagement_rate: '', niche: '', email: '' });
      loadInfluencers();
    } catch { addToast('Failed to add influencer', 'error'); }
    finally { setAddingInf(false); }
  }

  async function addCollaboration(influencerId: number) {
    if (!newCollab.campaign_name) { addToast('Campaign name required', 'error'); return; }
    setAddingCollab(true);
    try {
      let deliverables: any = { posts: 1 };
      try { deliverables = JSON.parse(newCollab.deliverables); } catch { /* use default */ }
      await api.post('/api/admin/social/influencers/collaborations', {
        influencer_id: influencerId,
        campaign_name: newCollab.campaign_name,
        compensation_cents: parseInt(newCollab.compensation_cents) || 0,
        start_date: newCollab.start_date || null,
        end_date: newCollab.end_date || null,
        content_requirements: newCollab.content_requirements,
        deliverables,
      });
      addToast('Collaboration created', 'success');
      setCollabForId(null);
      setNewCollab({ campaign_name: '', compensation_cents: '', start_date: '', end_date: '', content_requirements: '', deliverables: '{"posts":1}' });
      loadCollabs(influencerId);
    } catch { addToast('Failed to create collaboration', 'error'); }
    finally { setAddingCollab(false); }
  }

  async function getPortalLink(collabId: number) {
    try {
      const data = await api.post<{ portal_url: string }>(`/api/admin/social/influencers/collaborations/${collabId}/portal-token`, {});
      setPortalLinks((prev) => ({ ...prev, [collabId]: data.portal_url }));
    } catch { addToast('Failed to generate portal link', 'error'); }
  }

  async function reviewSubmission(subId: number, decision: 'approved' | 'rejected' | 'revision_requested', feedback = '') {
    try {
      await api.post(`/api/admin/social/influencers/submissions/${subId}/review`, { decision, feedback });
      addToast(`Submission ${decision}`, 'success');
      loadSubmissions();
    } catch { addToast('Review failed', 'error'); }
  }

  function toggleExpand(id: number) {
    if (expandedId === id) { setExpandedId(null); return; }
    setExpandedId(id);
    loadCollabs(id);
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Users className="h-6 w-6 text-purple-600" />
            Influencer Management
          </h1>
          <p className="text-gray-500 text-sm mt-1">Manage collaborations, content submissions, and ROI tracking</p>
        </div>
        <button onClick={() => setShowAddForm(!showAddForm)}
          className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white text-sm font-medium rounded-lg hover:bg-purple-700">
          <Plus size={16} /> Add Influencer
        </button>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-100 p-1 rounded-lg w-fit">
        <button onClick={() => setActiveTab('influencers')}
          className={`px-4 py-1.5 text-sm font-medium rounded-md transition-colors ${activeTab === 'influencers' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>
          Influencers
        </button>
        <button onClick={() => { setActiveTab('submissions'); loadSubmissions(); }}
          className={`px-4 py-1.5 text-sm font-medium rounded-md transition-colors ${activeTab === 'submissions' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>
          Submissions Review
        </button>
      </div>

      {/* Add Influencer Form */}
      {showAddForm && (
        <div className="bg-white border border-gray-200 rounded-xl p-5 space-y-4">
          <h3 className="text-sm font-semibold text-gray-900">Add New Influencer</h3>
          <div className="grid grid-cols-2 gap-3">
            <input value={newInf.name} onChange={(e) => setNewInf({ ...newInf, name: e.target.value })}
              placeholder="Full name" className="px-3 py-2 border border-gray-200 rounded-lg text-sm outline-none focus:border-purple-400" />
            <input value={newInf.handle} onChange={(e) => setNewInf({ ...newInf, handle: e.target.value })}
              placeholder="@handle" className="px-3 py-2 border border-gray-200 rounded-lg text-sm outline-none focus:border-purple-400" />
            <select value={newInf.platform} onChange={(e) => setNewInf({ ...newInf, platform: e.target.value })}
              className="px-3 py-2 border border-gray-200 rounded-lg text-sm outline-none focus:border-purple-400">
              {['instagram','tiktok','youtube','facebook','x','linkedin'].map((p) => (
                <option key={p} value={p}>{p.charAt(0).toUpperCase() + p.slice(1)}</option>
              ))}
            </select>
            <input value={newInf.niche} onChange={(e) => setNewInf({ ...newInf, niche: e.target.value })}
              placeholder="Niche (e.g. fashion, fitness)" className="px-3 py-2 border border-gray-200 rounded-lg text-sm outline-none focus:border-purple-400" />
            <input value={newInf.follower_count} onChange={(e) => setNewInf({ ...newInf, follower_count: e.target.value })}
              type="number" placeholder="Follower count" className="px-3 py-2 border border-gray-200 rounded-lg text-sm outline-none focus:border-purple-400" />
            <input value={newInf.engagement_rate} onChange={(e) => setNewInf({ ...newInf, engagement_rate: e.target.value })}
              type="number" step="0.1" placeholder="Engagement rate %" className="px-3 py-2 border border-gray-200 rounded-lg text-sm outline-none focus:border-purple-400" />
            <input value={newInf.email} onChange={(e) => setNewInf({ ...newInf, email: e.target.value })}
              type="email" placeholder="Email" className="px-3 py-2 border border-gray-200 rounded-lg text-sm outline-none focus:border-purple-400 col-span-2" />
          </div>
          <div className="flex gap-2 justify-end">
            <button onClick={() => setShowAddForm(false)} className="px-4 py-2 text-sm text-gray-500 hover:text-gray-700">Cancel</button>
            <button onClick={addInfluencer} disabled={addingInf}
              className="px-4 py-2 bg-purple-600 text-white text-sm font-medium rounded-lg hover:bg-purple-700 disabled:opacity-50">
              {addingInf ? 'Adding…' : 'Add'}
            </button>
          </div>
        </div>
      )}

      {/* Influencers Tab */}
      {activeTab === 'influencers' && (
        loading ? (
          <div className="flex items-center justify-center h-40">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600" />
          </div>
        ) : influencers.length === 0 ? (
          <div className="text-center py-16 bg-gray-50 rounded-xl">
            <Users className="mx-auto h-12 w-12 text-gray-300" />
            <p className="mt-3 text-gray-500">No influencers yet. Add your first collaborator.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {influencers.map((inf) => (
              <div key={inf.id} className="bg-white border border-gray-200 rounded-xl overflow-hidden">
                {/* Row */}
                <button
                  type="button"
                  className="w-full flex items-center gap-4 p-4 cursor-pointer hover:bg-gray-50 text-left"
                  onClick={() => toggleExpand(inf.id)}>
                  <span className="text-2xl w-8 text-center">{PLATFORM_ICONS[inf.platform] ?? '◉'}</span>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-gray-900 text-sm">{inf.name}</p>
                    <p className="text-xs text-gray-500">@{inf.handle} · {inf.niche || 'No niche'}</p>
                  </div>
                  <div className="flex items-center gap-4 text-xs text-gray-500 shrink-0">
                    {inf.follower_count && (
                      <span className="font-medium text-gray-700">{inf.follower_count.toLocaleString()} followers</span>
                    )}
                    {inf.engagement_rate && (
                      <span>{inf.engagement_rate.toFixed(1)}% eng.</span>
                    )}
                    {inf.email && <Mail size={13} className="text-gray-400" />}
                    {expandedId === inf.id ? <ChevronUp size={16} className="text-gray-400" /> : <ChevronDown size={16} className="text-gray-400" />}
                  </div>
                </button>

                {/* Expanded: Collaborations */}
                {expandedId === inf.id && (
                  <div className="border-t border-gray-100 p-4 space-y-4 bg-gray-50">
                    <div className="flex items-center justify-between">
                      <h4 className="text-xs font-semibold text-gray-700 uppercase tracking-wide">Collaborations</h4>
                      <button onClick={() => setCollabForId(collabForId === inf.id ? null : inf.id)}
                        className="flex items-center gap-1 text-xs text-purple-600 hover:text-purple-800 font-medium">
                        <Plus size={12} /> New Campaign
                      </button>
                    </div>

                    {/* New Collab Form */}
                    {collabForId === inf.id && (
                      <div className="bg-white border border-purple-100 rounded-lg p-3 space-y-2">
                        <input value={newCollab.campaign_name} onChange={(e) => setNewCollab({ ...newCollab, campaign_name: e.target.value })}
                          placeholder="Campaign name" className="w-full px-2.5 py-1.5 border border-gray-200 rounded-lg text-xs outline-none focus:border-purple-400" />
                        <div className="grid grid-cols-2 gap-2">
                          <input value={newCollab.compensation_cents} onChange={(e) => setNewCollab({ ...newCollab, compensation_cents: e.target.value })}
                            type="number" placeholder="Compensation (¢)" className="px-2.5 py-1.5 border border-gray-200 rounded-lg text-xs outline-none focus:border-purple-400" />
                          <input value={newCollab.deliverables} onChange={(e) => setNewCollab({ ...newCollab, deliverables: e.target.value })}
                            placeholder='Deliverables JSON: {"posts":2}' className="px-2.5 py-1.5 border border-gray-200 rounded-lg text-xs outline-none focus:border-purple-400 font-mono" />
                          <input value={newCollab.start_date} onChange={(e) => setNewCollab({ ...newCollab, start_date: e.target.value })}
                            type="date" className="px-2.5 py-1.5 border border-gray-200 rounded-lg text-xs outline-none focus:border-purple-400" />
                          <input value={newCollab.end_date} onChange={(e) => setNewCollab({ ...newCollab, end_date: e.target.value })}
                            type="date" className="px-2.5 py-1.5 border border-gray-200 rounded-lg text-xs outline-none focus:border-purple-400" />
                        </div>
                        <textarea value={newCollab.content_requirements} onChange={(e) => setNewCollab({ ...newCollab, content_requirements: e.target.value })}
                          rows={2} placeholder="Content requirements / brief for influencer…"
                          className="w-full px-2.5 py-1.5 border border-gray-200 rounded-lg text-xs outline-none focus:border-purple-400 resize-none" />
                        <div className="flex gap-2 justify-end">
                          <button onClick={() => setCollabForId(null)} className="px-3 py-1 text-xs text-gray-500">Cancel</button>
                          <button onClick={() => addCollaboration(inf.id)} disabled={addingCollab}
                            className="px-3 py-1 bg-purple-600 text-white text-xs font-medium rounded-lg hover:bg-purple-700 disabled:opacity-50">
                            {addingCollab ? 'Creating…' : 'Create'}
                          </button>
                        </div>
                      </div>
                    )}

                    {/* Collab list */}
                    {(collabs[inf.id] ?? []).length === 0 ? (
                      <p className="text-xs text-gray-400 italic py-2">No collaborations yet</p>
                    ) : (
                      <div className="space-y-2">
                        {(collabs[inf.id] ?? []).map((c) => (
                          <div key={c.id} className="bg-white border border-gray-100 rounded-lg p-3 space-y-2">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-medium text-xs text-gray-900">{c.campaign_name}</span>
                              <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium ${STATUS_STYLES[c.status] ?? ''}`}>
                                {c.status}
                              </span>
                              <span className="text-xs text-gray-500 ml-auto">
                                ${((c.compensation_cents ?? 0) / 100).toFixed(2)} comp · {c.posts_delivered} posts delivered
                              </span>
                            </div>
                            {(c.revenue_attributed_cents ?? 0) > 0 && (
                              <p className="text-xs text-green-700 flex items-center gap-1">
                                <TrendingUp size={11} />
                                ${(c.revenue_attributed_cents / 100).toFixed(2)} attributed · {c.roi_percent ?? 0}% ROI
                              </p>
                            )}
                            {/* Portal link */}
                            <div className="flex items-center gap-2 flex-wrap">
                              <button onClick={() => getPortalLink(c.id)}
                                className="flex items-center gap-1 text-xs text-purple-600 hover:text-purple-800 font-medium">
                                <Link size={11} /> {portalLinks[c.id] ? 'Refresh link' : 'Get portal link'}
                              </button>
                              {portalLinks[c.id] && (
                                <div className="flex items-center gap-1.5 flex-1 min-w-0">
                                  <code className="text-[10px] text-gray-600 bg-gray-100 px-2 py-0.5 rounded truncate flex-1">
                                    {portalLinks[c.id]}
                                  </code>
                                  <button onClick={() => { navigator.clipboard.writeText(portalLinks[c.id]); addToast('Copied!', 'success'); }}
                                    className="shrink-0 text-gray-400 hover:text-gray-600">
                                    <Copy size={12} />
                                  </button>
                                  <a href={portalLinks[c.id]} target="_blank" rel="noopener noreferrer" className="shrink-0 text-gray-400 hover:text-gray-600">
                                    <ExternalLink size={12} />
                                  </a>
                                </div>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )
      )}

      {/* Submissions Tab */}
      {activeTab === 'submissions' && (
        submissionsLoading ? (
          <div className="flex items-center justify-center h-40">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600" />
          </div>
        ) : submissions.length === 0 ? (
          <div className="text-center py-16 bg-gray-50 rounded-xl">
            <Clock className="mx-auto h-12 w-12 text-gray-300" />
            <p className="mt-3 text-gray-500">No submissions to review</p>
          </div>
        ) : (
          <div className="space-y-3">
            {submissions.map((sub) => {
              let mediaUrls: string[] = [];
              try { mediaUrls = JSON.parse(sub.media_urls || '[]'); } catch { /* */ }
              return (
                <div key={sub.id} className="bg-white border border-gray-200 rounded-xl p-4 space-y-3">
                  <div className="flex items-center gap-3 flex-wrap">
                    <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium ${STATUS_STYLES[sub.status] ?? 'bg-gray-100 text-gray-600'}`}>
                      {sub.status}
                    </span>
                    <span className="text-xs text-gray-500 font-medium uppercase">{sub.content_type}</span>
                    {sub.submitted_by_name && (
                      <span className="text-xs text-gray-500">by {sub.submitted_by_name}</span>
                    )}
                    <span className="text-xs text-gray-400 ml-auto">
                      {new Date(sub.submitted_at).toLocaleString()}
                    </span>
                  </div>

                  <p className="text-sm text-gray-800 whitespace-pre-wrap">{sub.caption}</p>

                  {mediaUrls.length > 0 && (
                    <div className="flex flex-wrap gap-2">
                      {mediaUrls.map((url, i) => (
                        <a key={i} href={url} target="_blank" rel="noopener noreferrer"
                          className="flex items-center gap-1 text-xs text-indigo-600 hover:underline">
                          <ExternalLink size={11} /> Media {i + 1}
                        </a>
                      ))}
                    </div>
                  )}

                  {sub.feedback && (
                    <p className="text-xs text-gray-500 italic bg-gray-50 px-3 py-2 rounded-lg">
                      Feedback: {sub.feedback}
                    </p>
                  )}

                  {sub.status === 'pending' && (
                    <div className="flex gap-2 pt-1">
                      <button onClick={() => reviewSubmission(sub.id, 'approved')}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-green-50 text-green-700 text-xs font-medium rounded-lg hover:bg-green-100 border border-green-100">
                        <CheckCircle size={12} /> Approve
                      </button>
                      <button onClick={() => reviewSubmission(sub.id, 'revision_requested', 'Please revise and resubmit.')}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-purple-50 text-purple-700 text-xs font-medium rounded-lg hover:bg-purple-100 border border-purple-100">
                        <Clock size={12} /> Request Revision
                      </button>
                      <button onClick={() => reviewSubmission(sub.id, 'rejected')}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-red-50 text-red-600 text-xs font-medium rounded-lg hover:bg-red-100 border border-red-100">
                        <XCircle size={12} /> Reject
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )
      )}
    </div>
  );
}
