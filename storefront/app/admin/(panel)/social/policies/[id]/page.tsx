'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import Link from 'next/link';
import { useParams, useSearchParams } from 'next/navigation';
import {
  ArrowLeft, CheckCircle, XCircle, RefreshCw, Clock, FileText,
  AlertTriangle, ChevronRight, Globe, Check, X, ExternalLink,
  GitCompare, User, Calendar
} from 'lucide-react';

interface PolicyVersion {
  id: number;
  platform: string;
  policy_type: string;
  policy_name: string;
  source_url?: string;
  version: string;
  status: 'active' | 'pending_review' | 'rejected' | 'superseded' | 'failed_fetch';
  severity: string | null;
  content_text: string;
  content_hash: string;
  fetch_error?: string | null;
  diff_html?: string;
  previous_content_text?: string;
  created_at: string;
  approved_at: string | null;
  approved_by: string | null;
  change_summary: string | null;
  audit_log: Array<{
    id: number;
    action: string;
    performed_by: string;
    performed_at: string;
    notes: string | null;
  }>;
}

export default function PolicyDetailPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const sourceId = params.id as string;
  const versionId = searchParams.get('version');
  
  const [versions, setVersions] = useState<PolicyVersion[]>([]);
  const [selectedVersion, setSelectedVersion] = useState<PolicyVersion | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  useEffect(() => {
    loadVersions();
  }, [sourceId]);

  useEffect(() => {
    if (versionId && versions.length > 0) {
      const v = versions.find(v => v.id === Number(versionId));
      if (v) setSelectedVersion(v);
    } else if (versions.length > 0 && !selectedVersion) {
      // Default to pending version if exists, otherwise active
      const pending = versions.find(v => v.status === 'pending_review');
      const active = versions.find(v => v.status === 'active');
      setSelectedVersion(pending || active || versions[0]);
    }
  }, [versions, versionId]);

  async function loadVersions() {
    try {
      const res = await api.get<{ versions: PolicyVersion[] }>(
        `/api/admin/compliance/policies/${sourceId}/versions`
      );
      setVersions(res.versions);
    } catch (e) {
      console.error('Failed to load versions:', e);
    } finally {
      setLoading(false);
    }
  }

  async function loadVersionDetails(versionId: number) {
    try {
      const res = await api.get<PolicyVersion>(`/api/admin/compliance/versions/${versionId}`);
      setSelectedVersion(res);
    } catch (e) {
      console.error('Failed to load version details:', e);
    }
  }

  async function approveVersion(versionId: number) {
    setActionLoading('approve');
    try {
      await api.post(`/api/admin/compliance/versions/${versionId}/approve`, {});
      await loadVersions();
      await loadVersionDetails(versionId);
    } catch (e) {
      console.error('Approve failed:', e);
      alert('Approve failed: ' + (e instanceof Error ? e.message : String(e)));
    } finally {
      setActionLoading(null);
    }
  }

  async function rejectVersion(versionId: number) {
    const reason = window.prompt('Reason for rejection (required):');
    if (!reason || reason.trim().length < 10) {
      alert('Please provide a reason of at least 10 characters.');
      return;
    }
    setActionLoading('reject');
    try {
      await api.post(`/api/admin/compliance/versions/${versionId}/reject`, { reason });
      await loadVersions();
      await loadVersionDetails(versionId);
    } catch (e) {
      console.error('Reject failed:', e);
      alert('Reject failed: ' + (e instanceof Error ? e.message : String(e)));
    } finally {
      setActionLoading(null);
    }
  }

  async function rollbackToVersion(versionId: number) {
    const reason = window.prompt('Reason for rollback (required):');
    if (!reason || reason.trim().length < 10) {
      alert('Please provide a reason of at least 10 characters.');
      return;
    }
    setActionLoading('rollback');
    try {
      await api.post(`/api/admin/compliance/versions/${versionId}/rollback`, { reason });
      await loadVersions();
      await loadVersionDetails(versionId);
    } catch (e) {
      console.error('Rollback failed:', e);
      alert('Rollback failed: ' + (e instanceof Error ? e.message : String(e)));
    } finally {
      setActionLoading(null);
    }
  }

  function getStatusBadge(status: string) {
    switch (status) {
      case 'active':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-emerald-100 text-emerald-700 text-xs font-medium">
            <CheckCircle className="w-3 h-3" />
            Active
          </span>
        );
      case 'pending_review':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-orange-100 text-orange-700 text-xs font-medium">
            <Clock className="w-3 h-3" />
            Pending Review
          </span>
        );
      case 'rejected':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-red-100 text-red-700 text-xs font-medium">
            <XCircle className="w-3 h-3" />
            Rejected
          </span>
        );
      case 'superseded':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-gray-100 text-gray-600 text-xs font-medium">
            <RefreshCw className="w-3 h-3" />
            Superseded
          </span>
        );
      case 'failed_fetch':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-red-100 text-red-700 text-xs font-medium">
            <XCircle className="w-3 h-3" />
            Fetch Failed
          </span>
        );
      default:
        return null;
    }
  }

  function getSeverityBadge(severity: string | null) {
    if (!severity) return null;
    const colors = {
      critical: 'bg-red-100 text-red-700',
      high: 'bg-orange-100 text-orange-700',
      medium: 'bg-yellow-100 text-yellow-700',
      low: 'bg-blue-100 text-blue-700',
      info: 'bg-gray-100 text-gray-700'
    };
    return (
      <span className={`px-2 py-1 rounded text-xs font-medium capitalize ${colors[severity as keyof typeof colors] || colors.info}`}>
        {severity} severity
      </span>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="w-8 h-8 text-gray-400 animate-spin" />
      </div>
    );
  }

  const activeVersion = versions.find(v => v.status === 'active');
  const pendingVersion = versions.find(v => v.status === 'pending_review');

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link
          href="/admin/social/policies"
          className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
        >
          <ArrowLeft className="w-5 h-5 text-gray-600" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            {selectedVersion?.platform ? (
              <span className="capitalize">{selectedVersion.platform}</span>
            ) : 'Policy Details'}
          </h1>
          <p className="text-gray-500 text-sm">
            {selectedVersion?.policy_name}
          </p>
        </div>
      </div>

      {/* Version Selector */}
      {versions.length > 1 && (
        <div className="flex items-center gap-2 overflow-x-auto pb-2">
          <span className="text-sm text-gray-500 whitespace-nowrap">Version:</span>
          {versions.map((v) => (
            <button
              key={v.id}
              onClick={() => {
                setSelectedVersion(v);
                loadVersionDetails(v.id);
              }}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors whitespace-nowrap ${
                selectedVersion?.id === v.id
                  ? 'bg-gray-900 text-white'
                  : 'bg-white border hover:bg-gray-50'
              }`}
            >
              v{v.version}
              {v.status === 'active' && (
                <span className="ml-1.5 text-xs">(active)</span>
              )}
              {v.status === 'pending_review' && (
                <span className="ml-1.5 text-orange-400">●</span>
              )}
            </button>
          ))}
        </div>
      )}

      {selectedVersion && (
        <>
          {/* Version Header */}
          <div className="bg-white rounded-xl border p-5">
            <div className="flex items-start justify-between">
              <div>
                <div className="flex items-center gap-3 mb-2">
                  {getStatusBadge(selectedVersion.status)}
                  {getSeverityBadge(selectedVersion.severity)}
                </div>
                <h2 className="text-lg font-semibold text-gray-900">
                  Version {selectedVersion.version}
                </h2>
                {selectedVersion.change_summary && (
                  <p className="text-gray-600 mt-1">{selectedVersion.change_summary}</p>
                )}
                <div className="flex items-center gap-4 mt-3 text-sm text-gray-500">
                  <span className="flex items-center gap-1">
                    <Calendar className="w-4 h-4" />
                    Created {new Date(selectedVersion.created_at).toLocaleString()}
                  </span>
                  {selectedVersion.approved_by && (
                    <span className="flex items-center gap-1">
                      <User className="w-4 h-4" />
                      Approved by {selectedVersion.approved_by}
                    </span>
                  )}
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center gap-2">
                {selectedVersion.status === 'pending_review' && (
                  <>
                    <button
                      onClick={() => rejectVersion(selectedVersion.id)}
                      disabled={actionLoading === 'reject'}
                      className="px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-50 flex items-center gap-2"
                    >
                      <X className="w-4 h-4" />
                      Reject
                    </button>
                    <button
                      onClick={() => approveVersion(selectedVersion.id)}
                      disabled={actionLoading === 'approve'}
                      className="px-4 py-2 text-sm font-medium text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg transition-colors disabled:opacity-50 flex items-center gap-2"
                    >
                      <Check className="w-4 h-4" />
                      {actionLoading === 'approve' ? 'Approving...' : 'Approve'}
                    </button>
                  </>
                )}
                {selectedVersion.status === 'superseded' && (
                  <button
                    onClick={() => rollbackToVersion(selectedVersion.id)}
                    disabled={actionLoading === 'rollback'}
                    className="px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 rounded-lg transition-colors disabled:opacity-50 flex items-center gap-2"
                  >
                    <RefreshCw className="w-4 h-4" />
                    Rollback
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Fetch failure explanation */}
          {selectedVersion.status === 'failed_fetch' && (
            <div className="bg-red-50 border border-red-200 rounded-xl p-5 space-y-3">
              <div className="flex items-start gap-3">
                <AlertTriangle className="w-5 h-5 text-red-500 mt-0.5 shrink-0" />
                <div className="flex-1">
                  <p className="font-semibold text-red-800">Policy fetch failed</p>
                  {selectedVersion.fetch_error && (
                    <p className="text-sm text-red-700 mt-1 font-mono">{selectedVersion.fetch_error}</p>
                  )}
                  <p className="text-sm text-red-700 mt-2">
                    Most social platforms block automated scraping — their policy pages require a real browser with JavaScript and cookies.
                    This is normal and expected. Until the fetch succeeds, compliance checks use built-in default rules for this platform.
                  </p>
                  <div className="mt-3 flex items-center gap-3">
                    {selectedVersion.source_url && (
                      <a
                        href={selectedVersion.source_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-red-700 bg-white border border-red-200 rounded-lg hover:bg-red-50 transition-colors"
                      >
                        <ExternalLink className="w-4 h-4" />
                        View Policy Directly
                      </a>
                    )}
                    <span className="text-xs text-red-600">Retries automatically each Monday — or click Check Now on the Policies page.</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Diff Viewer */}
          {selectedVersion.diff_html && (
            <div className="bg-white rounded-xl border overflow-hidden">
              <div className="px-5 py-3 bg-gray-50 border-b flex items-center gap-2">
                <GitCompare className="w-5 h-5 text-gray-600" />
                <h3 className="font-semibold text-gray-900">Changes from Previous Version</h3>
              </div>
              <div 
                className="p-5 overflow-x-auto"
                dangerouslySetInnerHTML={{ __html: selectedVersion.diff_html }}
              />
            </div>
          )}

          {/* Current Policy Text */}
          <div className="bg-white rounded-xl border overflow-hidden">
            <div className="px-5 py-3 bg-gray-50 border-b flex items-center justify-between">
              <div className="flex items-center gap-2">
                <FileText className="w-5 h-5 text-gray-600" />
                <h3 className="font-semibold text-gray-900">Policy Content</h3>
              </div>
              <span className="text-xs text-gray-500 font-mono">{selectedVersion.content_hash.slice(0, 8)}</span>
            </div>
            <div className="p-5">
              <pre className="whitespace-pre-wrap text-sm text-gray-700 font-mono leading-relaxed">
                {selectedVersion.content_text}
              </pre>
            </div>
          </div>

          {/* Audit Log */}
          {selectedVersion.audit_log && selectedVersion.audit_log.length > 0 && (
            <div className="bg-white rounded-xl border">
              <div className="px-5 py-3 bg-gray-50 border-b">
                <h3 className="font-semibold text-gray-900">Audit Log</h3>
              </div>
              <div className="divide-y">
                {selectedVersion.audit_log.map((log) => (
                  <div key={log.id} className="p-4 flex items-start gap-3">
                    {log.action === 'approved' && <CheckCircle className="w-5 h-5 text-emerald-500 mt-0.5" />}
                    {log.action === 'rejected' && <XCircle className="w-5 h-5 text-red-500 mt-0.5" />}
                    {log.action === 'created' && <FileText className="w-5 h-5 text-blue-500 mt-0.5" />}
                    {log.action === 'rollback' && <RefreshCw className="w-5 h-5 text-orange-500 mt-0.5" />}
                    <div>
                      <p className="text-sm">
                        <span className="font-medium capitalize">{log.action}</span>
                        {' '}by {log.performed_by}
                      </p>
                      <p className="text-xs text-gray-500">
                        {new Date(log.performed_at).toLocaleString()}
                      </p>
                      {log.notes && (
                        <p className="text-sm text-gray-600 mt-1">{log.notes}</p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}

      {/* No Data State */}
      {!selectedVersion && !loading && (
        <div className="text-center py-12 bg-white rounded-xl border">
          <FileText className="w-12 h-12 text-gray-300 mx-auto mb-4" />
          <p className="text-gray-500">No version data available</p>
        </div>
      )}
    </div>
  );
}
