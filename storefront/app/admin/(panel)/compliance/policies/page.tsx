'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { addToast } from '@/lib/toast';
import { 
  Shield, AlertTriangle, CheckCircle, XCircle, Clock, 
  RefreshCw, FileText, ChevronDown, ChevronUp, Upload,
  ExternalLink, AlertCircle, FileUp, RotateCcw
} from 'lucide-react';

interface Policy {
  id: number;
  platform: string;
  policy_type: string;
  policy_name: string;
  source_url: string;
  is_active: boolean;
  active_version: string | null;
  active_approved_at: string | null;
  pending_version: string | null;
  pending_severity: string | null;
  pending_created_at: string | null;
  pending_count: number;
  failed_count: number;
}

interface PolicyVersion {
  id: number;
  version: string;
  status: 'active' | 'pending_review' | 'archived' | 'rejected' | 'failed_fetch';
  severity: 'critical' | 'warning' | 'info';
  severity_reason: string;
  change_summary: string;
  created_at: string;
  is_manual_upload: boolean;
  fetched_at: string | null;
  approved_by: string | null;
  approved_at: string | null;
}

interface PolicyDetail {
  id: number;
  version: string;
  content_text: string;
  content_html: string | null;
  status: string;
  severity: string;
  severity_reason: string;
  change_summary: string;
  added_keywords: string[];
  removed_keywords: string[];
  is_manual_upload: boolean;
  uploaded_by: string | null;
  created_at: string;
  approved_by: string | null;
  approved_at: string | null;
  approved_notes: string | null;
  platform: string;
  policy_name: string;
  diff_html?: string;
}

export default function CompliancePoliciesPage() {
  const [policies, setPolicies] = useState<Policy[]>([]);
  const [loading, setLoading] = useState(true);
  const [checking, setChecking] = useState<number | null>(null);
  const [expanded, setExpanded] = useState<number | null>(null);
  const [versions, setVersions] = useState<Record<number, PolicyVersion[]>>({});
  const [showDiff, setShowDiff] = useState<number | null>(null);
  const [diffData, setDiffData] = useState<PolicyDetail | null>(null);
  const [loadingDiff, setLoadingDiff] = useState(false);
  const [showUpload, setShowUpload] = useState<number | null>(null);
  const [uploadText, setUploadText] = useState('');
  const [uploadHtml, setUploadHtml] = useState('');
  const [uploadNotes, setUploadNotes] = useState('');
  const [uploading, setUploading] = useState(false);
  const [approving, setApproving] = useState<number | null>(null);
  const [rejecting, setRejecting] = useState<number | null>(null);
  const [rejectReason, setRejectReason] = useState('');

  useEffect(() => {
    loadPolicies();
  }, []);

  async function loadPolicies() {
    try {
      const data = await api.get<{ policies: Policy[] }>('/api/admin/compliance/policies');
      setPolicies(data.policies);
    } catch (e) {
      addToast('Failed to load policies', 'error');
    } finally {
      setLoading(false);
    }
  }

  async function checkPolicy(sourceId: number) {
    setChecking(sourceId);
    try {
      const data = await api.post<{ checked: boolean; changed: boolean; new_version_id?: number; message: string }>(
        `/api/admin/compliance/policies/${sourceId}/check`
      );
      if (data.changed) {
        addToast(`New policy version detected (ID: ${data.new_version_id})`, 'success');
        loadPolicies();
      } else {
        addToast(data.message, 'info');
      }
    } catch (e) {
      addToast('Check failed', 'error');
    } finally {
      setChecking(null);
    }
  }

  async function expandPolicy(sourceId: number) {
    if (expanded === sourceId) {
      setExpanded(null);
      return;
    }
    setExpanded(sourceId);
    
    if (!versions[sourceId]) {
      try {
        const data = await api.get<{ versions: PolicyVersion[] }>(`/api/admin/compliance/policies/${sourceId}/versions`);
        setVersions(prev => ({ ...prev, [sourceId]: data.versions }));
      } catch (e) {
        addToast('Failed to load versions', 'error');
      }
    }
  }

  async function viewDiff(versionId: number) {
    setShowDiff(versionId);
    setLoadingDiff(true);
    try {
      const data = await api.get<PolicyDetail>(`/api/admin/compliance/versions/${versionId}`);
      setDiffData(data);
    } catch (e) {
      addToast('Failed to load diff', 'error');
    } finally {
      setLoadingDiff(false);
    }
  }

  async function approveVersion(versionId: number, notes: string = '') {
    setApproving(versionId);
    try {
      await api.post(`/api/admin/compliance/versions/${versionId}/approve`, { notes });
      addToast('Policy version approved and activated', 'success');
      setShowDiff(null);
      setDiffData(null);
      loadPolicies();
      if (expanded) {
        expandPolicy(expanded);
      }
    } catch (e) {
      addToast('Approval failed', 'error');
    } finally {
      setApproving(null);
    }
  }

  async function rejectVersion(versionId: number) {
    if (!rejectReason || rejectReason.length < 10) {
      addToast('Rejection reason required (min 10 chars)', 'error');
      return;
    }
    setRejecting(versionId);
    try {
      await api.post(`/api/admin/compliance/versions/${versionId}/reject`, { reason: rejectReason });
      addToast('Policy version rejected', 'success');
      setShowDiff(null);
      setDiffData(null);
      setRejectReason('');
      loadPolicies();
      if (expanded) {
        expandPolicy(expanded);
      }
    } catch (e) {
      addToast('Rejection failed', 'error');
    } finally {
      setRejecting(null);
    }
  }

  async function uploadManual(sourceId: number) {
    if (!uploadText || uploadText.length < 100) {
      addToast('Content too short (min 100 chars)', 'error');
      return;
    }
    setUploading(true);
    try {
      const data = await api.post<{ uploaded: boolean; version_id: number }>('/api/admin/compliance/upload', {
        source_id: sourceId,
        content_text: uploadText,
        content_html: uploadHtml || null,
        notes: uploadNotes
      });
      addToast(`Manual upload successful (Version ID: ${data.version_id})`, 'success');
      setShowUpload(null);
      setUploadText('');
      setUploadHtml('');
      setUploadNotes('');
      loadPolicies();
    } catch (e: any) {
      addToast(e.message || 'Upload failed', 'error');
    } finally {
      setUploading(false);
    }
  }

  const severityBadge = (severity: string) => {
    const colors = {
      critical: 'bg-red-100 text-red-800 border-red-200',
      warning: 'bg-amber-100 text-amber-800 border-amber-200',
      info: 'bg-blue-100 text-blue-800 border-blue-200'
    };
    const icons = {
      critical: <AlertCircle size={14} className="inline mr-1" />,
      warning: <AlertTriangle size={14} className="inline mr-1" />,
      info: <CheckCircle size={14} className="inline mr-1" />
    };
    return (
      <span className={`px-2 py-1 rounded text-xs font-medium border ${colors[severity as keyof typeof colors] || colors.info}`}>
        {icons[severity as keyof typeof icons]}
        {severity.toUpperCase()}
      </span>
    );
  };

  const statusBadge = (status: string) => {
    const colors: Record<string, string> = {
      active: 'bg-green-100 text-green-800',
      pending_review: 'bg-amber-100 text-amber-800',
      archived: 'bg-gray-100 text-gray-600',
      rejected: 'bg-red-100 text-red-800',
      failed_fetch: 'bg-red-100 text-red-800'
    };
    return (
      <span className={`px-2 py-0.5 rounded text-xs font-medium ${colors[status] || 'bg-gray-100'}`}>
        {status.replace('_', ' ')}
      </span>
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw size={24} className="animate-spin text-gray-400" />
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Shield size={28} className="text-brand" />
            Policy Compliance Monitor
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            Track social platform policy changes. New versions require admin approval before activation.
          </p>
        </div>
        <button
          onClick={() => loadPolicies()}
          className="flex items-center gap-2 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200"
        >
          <RefreshCw size={16} />
          Refresh
        </button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-xl border border-gray-200">
          <div className="text-2xl font-bold text-gray-900">
            {policies.filter(p => p.pending_count > 0).length}
          </div>
          <div className="text-sm text-gray-500">Policies with Changes</div>
        </div>
        <div className="bg-white p-4 rounded-xl border border-gray-200">
          <div className="text-2xl font-bold text-red-600">
            {policies.filter(p => p.pending_severity === 'critical').length}
          </div>
          <div className="text-sm text-gray-500">Critical Changes</div>
        </div>
        <div className="bg-white p-4 rounded-xl border border-gray-200">
          <div className="text-2xl font-bold text-amber-600">
            {policies.reduce((sum, p) => sum + p.pending_count, 0)}
          </div>
          <div className="text-sm text-gray-500">Pending Review</div>
        </div>
        <div className="bg-white p-4 rounded-xl border border-gray-200">
          <div className="text-2xl font-bold text-gray-900">
            {policies.filter(p => p.failed_count > 0).length}
          </div>
          <div className="text-sm text-gray-500">Failed Checks</div>
        </div>
      </div>

      {/* Policy List */}
      <div className="space-y-3">
        {policies.map(policy => (
          <div key={policy.id} className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            {/* Main Row */}
            <button
              type="button"
              className="w-full p-4 flex items-center justify-between cursor-pointer hover:bg-gray-50 text-left"
              onClick={() => expandPolicy(policy.id)}
            >
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 rounded-lg bg-gray-100 flex items-center justify-center">
                  <FileText size={20} className="text-gray-600" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-gray-900">{policy.policy_name}</span>
                    <span className="text-xs text-gray-500 bg-gray-100 px-2 py-0.5 rounded">
                      {policy.platform}
                    </span>
                    {policy.pending_count > 0 && (
                      <span className="text-xs text-white bg-amber-500 px-2 py-0.5 rounded-full">
                        {policy.pending_count} pending
                      </span>
                    )}
                  </div>
                  <div className="text-sm text-gray-500">
                    Active: {policy.active_version || 'None'} 
                    {policy.active_approved_at && ` (approved ${new Date(policy.active_approved_at).toLocaleDateString()})`}
                  </div>
                </div>
              </div>
              
              <div className="flex items-center gap-3">
                {policy.pending_severity && severityBadge(policy.pending_severity)}
                <a 
                  href={policy.source_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-gray-400 hover:text-gray-600"
                  onClick={e => e.stopPropagation()}
                >
                  <ExternalLink size={18} />
                </a>
                <button
                  onClick={e => {
                    e.stopPropagation();
                    checkPolicy(policy.id);
                  }}
                  disabled={checking === policy.id}
                  className="flex items-center gap-1 px-3 py-1.5 bg-brand/10 text-brand rounded-lg hover:bg-brand/20 disabled:opacity-50"
                >
                  {checking === policy.id ? (
                    <RefreshCw size={14} className="animate-spin" />
                  ) : (
                    <RefreshCw size={14} />
                  )}
                  Check Now
                </button>
                {expanded === policy.id ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
              </div>
            </button>

            {/* Expanded Versions */}
            {expanded === policy.id && (
              <div className="border-t border-gray-100 p-4 bg-gray-50/50">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="font-medium text-gray-900">Version History</h3>
                  <button
                    onClick={() => setShowUpload(policy.id)}
                    className="flex items-center gap-1 text-sm text-brand hover:underline"
                  >
                    <Upload size={14} />
                    Manual Upload
                  </button>
                </div>
                
                {versions[policy.id]?.length === 0 ? (
                  <p className="text-sm text-gray-500">No versions tracked yet.</p>
                ) : (
                  <div className="space-y-2">
                    {versions[policy.id]?.map(version => (
                      <div 
                        key={version.id}
                        className={`p-3 rounded-lg border ${version.status === 'pending_review' ? 'bg-amber-50 border-amber-200' : 'bg-white border-gray-200'}`}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <span className="font-mono text-sm">{version.version}</span>
                            {statusBadge(version.status)}
                            {version.severity && version.status === 'pending_review' && severityBadge(version.severity)}
                            {version.is_manual_upload && (
                              <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded">
                                Manual
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-sm text-gray-500">
                              {new Date(version.created_at).toLocaleDateString()}
                            </span>
                            {version.status === 'pending_review' && (
                              <>
                                <button
                                  onClick={() => viewDiff(version.id)}
                                  className="px-3 py-1 text-sm bg-white border border-gray-300 rounded hover:bg-gray-50"
                                >
                                  View Changes
                                </button>
                                <button
                                  onClick={() => viewDiff(version.id)}
                                  className="px-3 py-1 text-sm bg-green-600 text-white rounded hover:bg-green-700"
                                >
                                  Approve
                                </button>
                              </>
                            )}
                          </div>
                        </div>
                        {version.change_summary && (
                          <p className="text-sm text-gray-600 mt-2">{version.change_summary}</p>
                        )}
                      </div>
                    ))}
                  </div>
                )}

                {/* Manual Upload Form */}
                {showUpload === policy.id && (
                  <div className="mt-4 p-4 bg-white rounded-lg border border-gray-200">
                    <h4 className="font-medium text-gray-900 mb-3">Manual Policy Upload</h4>
                    <p className="text-sm text-gray-500 mb-3">
                      Paste policy content when automated fetching is blocked. This creates a pending review version.
                    </p>
                    <textarea
                      value={uploadText}
                      onChange={e => setUploadText(e.target.value)}
                      placeholder="Paste plain text policy content here..."
                      className="w-full h-40 p-3 border border-gray-300 rounded-lg text-sm mb-3"
                    />
                    <textarea
                      value={uploadHtml}
                      onChange={e => setUploadHtml(e.target.value)}
                      placeholder="Optional: Paste original HTML..."
                      className="w-full h-20 p-3 border border-gray-300 rounded-lg text-sm mb-3"
                    />
                    <input
                      type="text"
                      value={uploadNotes}
                      onChange={e => setUploadNotes(e.target.value)}
                      placeholder="Notes about this upload..."
                      className="w-full p-3 border border-gray-300 rounded-lg text-sm mb-3"
                    />
                    <div className="flex gap-2">
                      <button
                        onClick={() => uploadManual(policy.id)}
                        disabled={uploading}
                        className="px-4 py-2 bg-brand text-white rounded-lg hover:bg-brand/90 disabled:opacity-50"
                      >
                        {uploading ? 'Uploading...' : 'Upload Policy'}
                      </button>
                      <button
                        onClick={() => setShowUpload(null)}
                        className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Diff Modal */}
      {showDiff && diffData && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-5xl w-full max-h-[90vh] overflow-y-auto">
            {/* Modal Header */}
            <div className="sticky top-0 bg-white border-b border-gray-200 p-6 flex items-center justify-between">
              <div>
                <h2 className="text-xl font-bold text-gray-900">
                  {diffData.platform} — {diffData.policy_name}
                </h2>
                <div className="flex items-center gap-3 mt-2">
                  <span className="font-mono text-sm bg-gray-100 px-2 py-1 rounded">
                    {diffData.version}
                  </span>
                  {severityBadge(diffData.severity)}
                  <span className="text-sm text-gray-500">
                    Detected {new Date(diffData.created_at).toLocaleString()}
                  </span>
                </div>
              </div>
              <button
                onClick={() => { setShowDiff(null); setDiffData(null); }}
                className="text-gray-400 hover:text-gray-600"
              >
                <XCircle size={24} />
              </button>
            </div>

            {/* Modal Content */}
            <div className="p-6 space-y-6">
              {/* AI Summary */}
              <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
                <h3 className="font-semibold text-blue-900 mb-2 flex items-center gap-2">
                  <AlertCircle size={18} />
                  Change Summary
                </h3>
                <p className="text-blue-800 whitespace-pre-line">{diffData.change_summary}</p>
                {diffData.severity_reason && (
                  <p className="text-sm text-blue-600 mt-2">
                    Severity reason: {diffData.severity_reason}
                  </p>
                )}
              </div>

              {/* Keywords */}
              {(diffData.added_keywords?.length > 0 || diffData.removed_keywords?.length > 0) && (
                <div className="grid grid-cols-2 gap-4">
                  {diffData.added_keywords?.length > 0 && (
                    <div className="bg-green-50 border border-green-200 rounded-xl p-4">
                      <h4 className="font-medium text-green-900 mb-2">New Topics</h4>
                      <div className="flex flex-wrap gap-2">
                        {diffData.added_keywords.map(k => (
                          <span key={k} className="px-2 py-1 bg-green-100 text-green-800 rounded text-sm">
                            #{k}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                  {diffData.removed_keywords?.length > 0 && (
                    <div className="bg-red-50 border border-red-200 rounded-xl p-4">
                      <h4 className="font-medium text-red-900 mb-2">Removed Topics</h4>
                      <div className="flex flex-wrap gap-2">
                        {diffData.removed_keywords.map(k => (
                          <span key={k} className="px-2 py-1 bg-red-100 text-red-800 rounded text-sm">
                            #{k}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Diff View */}
              {diffData.diff_html ? (
                <div>
                  <h3 className="font-semibold text-gray-900 mb-3">Side-by-Side Comparison</h3>
                  <div 
                    className="overflow-x-auto border border-gray-200 rounded-lg"
                    dangerouslySetInnerHTML={{ __html: diffData.diff_html }}
                  />
                </div>
              ) : (
                <div>
                  <h3 className="font-semibold text-gray-900 mb-3">Current Content</h3>
                  <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 max-h-96 overflow-y-auto">
                    <pre className="text-sm whitespace-pre-wrap">{diffData.content_text}</pre>
                  </div>
                </div>
              )}

              {/* Action Buttons */}
              <div className="sticky bottom-0 bg-white border-t border-gray-200 p-4 -mx-6 -mb-6 flex items-center justify-between">
                <div className="flex items-center gap-4">
                  {rejecting === showDiff ? (
                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        value={rejectReason}
                        onChange={e => setRejectReason(e.target.value)}
                        placeholder="Why are you rejecting this? (min 10 chars)"
                        className="px-3 py-2 border border-gray-300 rounded-lg text-sm w-80"
                      />
                      <button
                        onClick={() => rejectVersion(showDiff)}
                        disabled={!rejectReason || rejectReason.length < 10}
                        className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50"
                      >
                        Confirm Reject
                      </button>
                      <button
                        onClick={() => { setRejecting(null); setRejectReason(''); }}
                        className="text-gray-500 hover:text-gray-700"
                      >
                        Cancel
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => setRejecting(showDiff)}
                      className="px-4 py-2 border border-red-300 text-red-700 rounded-lg hover:bg-red-50"
                    >
                      Reject Version
                    </button>
                  )}
                </div>
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => { setShowDiff(null); setDiffData(null); }}
                    className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
                  >
                    Close
                  </button>
                  <button
                    onClick={() => approveVersion(showDiff, `Approved after review on ${new Date().toLocaleDateString()}`)}
                    disabled={approving === showDiff}
                    className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 flex items-center gap-2"
                  >
                    {approving === showDiff ? (
                      <RefreshCw size={16} className="animate-spin" />
                    ) : (
                      <CheckCircle size={16} />
                    )}
                    Approve & Activate
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
