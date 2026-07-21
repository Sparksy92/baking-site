'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import Link from 'next/link';
import {
  FileText, CheckCircle, Clock, AlertTriangle, RefreshCw,
  ExternalLink, ChevronRight, Shield, Globe, XCircle,
  AlertOctagon, Upload, Info
} from 'lucide-react';

interface Policy {
  id: number;
  platform: string;
  policy_type: string;
  policy_name: string;
  source_url: string;
  is_active: boolean;
  fetch_cron: string;
  active_version_id: number | null;
  active_version: string | null;
  active_approved_at: string | null;
  pending_version_id: number | null;
  pending_version: string | null;
  pending_severity: string | null;
  pending_created_at: string | null;
  pending_count: number;
  failed_count: number;
}

export default function PoliciesPage() {
  const [policies, setPolicies] = useState<Policy[]>([]);
  const [loading, setLoading] = useState(true);
  const [checking, setChecking] = useState<number | null>(null);

  useEffect(() => {
    loadPolicies();
  }, []);

  async function loadPolicies() {
    try {
      const res = await api.get<{ policies: Policy[] }>('/api/admin/compliance/policies');
      setPolicies(res.policies);
    } catch (e) {
      console.error('Failed to load policies:', e);
    } finally {
      setLoading(false);
    }
  }

  async function checkPolicy(sourceId: number) {
    setChecking(sourceId);
    try {
      await api.post(`/api/admin/compliance/policies/${sourceId}/check`);
      await loadPolicies();
    } catch (e) {
      console.error('Check failed:', e);
    } finally {
      setChecking(null);
    }
  }

  function getPlatformIcon(platform: string) {
    switch (platform.toLowerCase()) {
      case 'facebook': return (
        <svg viewBox="0 0 24 24" className="w-6 h-6" fill="#1877F2"><path d="M24 12.073C24 5.405 18.627 0 12 0S0 5.405 0 12.073C0 18.1 4.388 23.094 10.125 24v-8.437H7.078v-3.49h3.047V9.41c0-3.025 1.792-4.697 4.533-4.697 1.312 0 2.686.236 2.686.236v2.97h-1.513c-1.491 0-1.956.93-1.956 1.887v2.267h3.328l-.532 3.49h-2.796V24C19.612 23.094 24 18.1 24 12.073z"/></svg>
      );
      case 'instagram': return (
        <svg viewBox="0 0 24 24" className="w-6 h-6"><defs><radialGradient id="ig" cx="30%" cy="107%" r="150%"><stop offset="0%" stopColor="#fdf497"/><stop offset="5%" stopColor="#fdf497"/><stop offset="45%" stopColor="#fd5949"/><stop offset="60%" stopColor="#d6249f"/><stop offset="90%" stopColor="#285AEB"/></radialGradient></defs><path fill="url(#ig)" d="M12 0C8.74 0 8.333.015 7.053.072 5.775.132 4.905.333 4.14.63c-.789.306-1.459.717-2.126 1.384S.935 3.35.63 4.14C.333 4.905.131 5.775.072 7.053.012 8.333 0 8.74 0 12c0 3.259.014 3.668.072 4.948.06 1.277.261 2.148.558 2.913.306.788.717 1.459 1.384 2.126.667.666 1.336 1.079 2.126 1.384.766.296 1.636.499 2.913.558C8.333 23.988 8.74 24 12 24s3.667-.015 4.947-.072c1.277-.06 2.148-.262 2.913-.558.788-.306 1.459-.718 2.126-1.384.666-.667 1.079-1.335 1.384-2.126.296-.765.499-1.636.558-2.913.06-1.28.072-1.689.072-4.948 0-3.259-.015-3.667-.072-4.947-.06-1.277-.262-2.149-.558-2.913-.306-.789-.718-1.459-1.384-2.126C21.319 1.347 20.651.935 19.86.63c-.765-.297-1.636-.499-2.913-.558C15.667.012 15.26 0 12 0zm0 2.16c3.203 0 3.585.016 4.85.071 1.17.055 1.805.249 2.227.415.562.217.96.477 1.382.896.419.42.679.819.896 1.381.164.422.36 1.057.413 2.227.057 1.266.07 1.646.07 4.85s-.015 3.585-.074 4.85c-.061 1.17-.256 1.805-.421 2.227-.224.562-.479.96-.899 1.382-.419.419-.824.679-1.38.896-.42.164-1.065.36-2.235.413-1.274.057-1.649.07-4.859.07-3.211 0-3.586-.015-4.859-.074-1.171-.061-1.816-.256-2.236-.421-.569-.224-.96-.479-1.379-.899-.421-.419-.69-.824-.9-1.38-.165-.42-.359-1.065-.42-2.235-.045-1.26-.061-1.649-.061-4.844 0-3.196.016-3.586.061-4.861.061-1.17.255-1.814.42-2.234.21-.57.479-.96.9-1.381.419-.419.81-.689 1.379-.898.42-.166 1.051-.361 2.221-.421 1.275-.045 1.65-.06 4.859-.06l.045.03zm0 3.678c-3.405 0-6.162 2.76-6.162 6.162 0 3.405 2.76 6.162 6.162 6.162 3.405 0 6.162-2.76 6.162-6.162 0-3.405-2.76-6.162-6.162-6.162zM12 16c-2.21 0-4-1.79-4-4s1.79-4 4-4 4 1.79 4 4-1.79 4-4 4zm7.846-10.405c0 .795-.646 1.44-1.44 1.44-.795 0-1.44-.646-1.44-1.44 0-.794.646-1.439 1.44-1.439.793-.001 1.44.645 1.44 1.439z"/></svg>
      );
      case 'x': case 'twitter': return (
        <svg viewBox="0 0 24 24" className="w-6 h-6" fill="#000"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.744l7.73-8.835L1.254 2.25H8.08l4.259 5.63 5.905-5.63zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>
      );
      case 'linkedin': return (
        <svg viewBox="0 0 24 24" className="w-6 h-6" fill="#0A66C2"><path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.064 2.064 0 112.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/></svg>
      );
      case 'tiktok': return (
        <svg viewBox="0 0 24 24" className="w-6 h-6" fill="#000"><path d="M19.59 6.69a4.83 4.83 0 01-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 01-2.88 2.5 2.89 2.89 0 01-2.89-2.89 2.89 2.89 0 012.89-2.89c.28 0 .54.04.79.1V9.01a6.33 6.33 0 00-.79-.05 6.34 6.34 0 00-6.34 6.34 6.34 6.34 0 006.34 6.34 6.34 6.34 0 006.33-6.34V8.73a8.27 8.27 0 004.84 1.55V6.82a4.85 4.85 0 01-1.07-.13z"/></svg>
      );
      case 'youtube': return (
        <svg viewBox="0 0 24 24" className="w-6 h-6" fill="#FF0000"><path d="M23.498 6.186a3.016 3.016 0 00-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 00.502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 002.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 002.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/></svg>
      );
      case 'pinterest': return (
        <svg viewBox="0 0 24 24" className="w-6 h-6" fill="#E60023"><path d="M12 0C5.373 0 0 5.372 0 12c0 5.084 3.163 9.426 7.627 11.174-.105-.949-.2-2.405.042-3.441.218-.937 1.407-5.965 1.407-5.965s-.359-.719-.359-1.782c0-1.668.967-2.914 2.171-2.914 1.023 0 1.518.769 1.518 1.69 0 1.029-.655 2.568-.994 3.995-.283 1.194.599 2.169 1.777 2.169 2.133 0 3.772-2.249 3.772-5.495 0-2.873-2.064-4.882-5.012-4.882-3.414 0-5.418 2.561-5.418 5.207 0 1.031.397 2.138.893 2.738a.36.36 0 01.083.345l-.333 1.36c-.053.22-.174.267-.402.161-1.499-.698-2.436-2.889-2.436-4.649 0-3.785 2.75-7.262 7.929-7.262 4.163 0 7.398 2.967 7.398 6.931 0 4.136-2.607 7.464-6.227 7.464-1.216 0-2.359-.632-2.75-1.378l-.748 2.853c-.271 1.043-1.002 2.35-1.492 3.146C9.57 23.812 10.763 24 12 24c6.627 0 12-5.373 12-12S18.627 0 12 0z"/></svg>
      );
      case 'threads': return (
        <svg viewBox="0 0 24 24" className="w-6 h-6" fill="#000"><path d="M12.186 24h-.007c-3.581-.024-6.334-1.205-8.184-3.509C2.35 18.44 1.5 15.586 1.472 12.01v-.017c.028-3.579.879-6.43 2.525-8.482C5.845 1.205 8.6.024 12.18 0h.014c2.746.02 5.043.725 6.826 2.098 1.677 1.29 2.858 3.13 3.509 5.467l-2.04.569c-1.104-3.96-3.898-5.984-8.304-6.015-2.91.022-5.11.936-6.54 2.717C4.307 6.504 3.616 8.914 3.589 12c.027 3.086.718 5.496 2.057 7.164 1.43 1.783 3.631 2.698 6.54 2.717 2.623-.02 4.358-.631 5.8-2.045 1.647-1.613 1.618-3.593 1.09-4.798-.31-.71-.873-1.3-1.634-1.75-.192 1.352-.622 2.446-1.284 3.272-.886 1.102-2.14 1.704-3.73 1.79-1.202.065-2.361-.218-3.259-.801-1.063-.689-1.685-1.74-1.752-2.964-.065-1.19.408-2.285 1.33-3.082.88-.76 2.119-1.207 3.583-1.291a13.853 13.853 0 013.02.142c-.126-.742-.375-1.332-.75-1.757-.513-.586-1.312-.883-2.378-.89h-.016c-.845 0-1.956.8-2.562 1.608l-1.688-1.144C8.578 5.483 10.29 4.371 12.03 4.345c1.637.013 2.976.474 3.978 1.37.94.84 1.549 2.02 1.824 3.498.292.097.58.208.854.336 1.514.708 2.558 1.787 3.033 3.12.76 2.134.348 4.933-1.853 7.071-1.671 1.62-3.868 2.54-6.68 2.26z"/></svg>
      );
      default: return <Globe className="w-6 h-6 text-gray-400" />;
    }
  }

  // Three states:
  // 1. WORKING   — is_active=true, active_version present
  // 2. NOT_YET   — is_active=true, no active version yet (just click Check Now)
  // 3. MANUAL    — is_active=false (platform blocks scraping, needs manual upload)
  type PolicyState = 'working' | 'pending_change' | 'fetch_failed' | 'not_yet' | 'manual';

  function getPolicyState(policy: Policy): PolicyState {
    if (!policy.is_active) return 'manual';
    if (policy.pending_count > 0) return 'pending_change';
    if (policy.failed_count > 0 && !policy.active_version) return 'fetch_failed';
    if (policy.active_version) return 'working';
    return 'not_yet';
  }

  function getStatusBadge(state: PolicyState, policy: Policy) {
    switch (state) {
      case 'working': return (
        <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-emerald-100 text-emerald-700 text-xs font-medium">
          <CheckCircle className="w-3 h-3" />
          Tracking live
        </span>
      );
      case 'pending_change': return (
        <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-orange-100 text-orange-700 text-xs font-medium">
          <AlertTriangle className="w-3 h-3" />
          {policy.pending_count} change{policy.pending_count > 1 ? 's' : ''} to review
        </span>
      );
      case 'fetch_failed': return (
        <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-red-100 text-red-700 text-xs font-medium">
          <XCircle className="w-3 h-3" />
          Fetch failed
        </span>
      );
      case 'not_yet': return (
        <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-amber-100 text-amber-700 text-xs font-medium">
          <Clock className="w-3 h-3" />
          Not yet fetched
        </span>
      );
      case 'manual': return (
        <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-slate-100 text-slate-600 text-xs font-medium">
          <Upload className="w-3 h-3" />
          Manual upload only
        </span>
      );
    }
  }

  function getCardBorder(state: PolicyState) {
    switch (state) {
      case 'working': return 'border-emerald-200 bg-white';
      case 'pending_change': return 'border-orange-200 bg-white';
      case 'fetch_failed': return 'border-red-200 bg-white';
      case 'not_yet': return 'border-amber-200 bg-amber-50/30';
      case 'manual': return 'border-slate-200 bg-slate-50/50';
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="w-8 h-8 text-gray-400 animate-spin" />
      </div>
    );
  }

  const hasPending = policies.some(p => p.pending_count > 0);
  const manualPolicies = policies.filter(p => !p.is_active);
  const autoPolicies = policies.filter(p => p.is_active);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Platform Policies</h1>
          <p className="text-gray-500 mt-1 max-w-2xl">
            Tracks the official community guidelines and ad policies for every platform you use.
            The system fetches each policy page weekly — if Facebook or Instagram quietly changes a rule, you’ll see a pending alert here to review and approve before it affects your content checks.
          </p>
          <p className="text-xs text-amber-700 bg-amber-50 border border-amber-100 rounded-lg px-3 py-2 mt-3 inline-flex items-start gap-2 max-w-2xl">
            <span className="mt-0.5">&#9888;</span>
            <span><strong>First-time setup:</strong> Click <strong>Check Now</strong> on each platform to fetch the baseline policy version. Until the first fetch completes, compliance checks use built-in default rules only.</span>
          </p>
        </div>
        <button
          onClick={loadPolicies}
          className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
        >
          <RefreshCw className="w-5 h-5 text-gray-600" />
        </button>
      </div>

      {/* Alert Banner */}
      {hasPending && (
        <div className="bg-orange-50 border border-orange-200 rounded-xl p-4 flex items-center gap-3">
          <AlertTriangle className="w-5 h-5 text-orange-600" />
          <div>
            <p className="font-medium text-orange-900">Policy updates pending review</p>
            <p className="text-sm text-orange-700">
              {policies.filter(p => p.pending_count > 0).length} platforms have policy changes that need approval
            </p>
          </div>
        </div>
      )}

      {/* Policies Grid */}
      <div className="space-y-3">
        {[...autoPolicies, ...manualPolicies].map((policy) => {
          const state = getPolicyState(policy);
          return (
            <div
              key={policy.id}
              className={`rounded-xl border p-5 transition-shadow hover:shadow-sm ${getCardBorder(state)}`}
            >
              <div className="flex items-start justify-between gap-4">
                {/* Left: icon + info */}
                <div className="flex items-start gap-4 min-w-0">
                  <div className="shrink-0 mt-0.5">{getPlatformIcon(policy.platform)}</div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="font-semibold text-gray-900 capitalize">{policy.platform}</h3>
                      {getStatusBadge(state, policy)}
                    </div>
                    <p className="text-sm text-gray-500 mt-0.5">{policy.policy_name}</p>

                    {/* State-specific sub-text */}
                    {state === 'working' && (
                      <p className="text-xs text-emerald-700 mt-1.5">
                        ✓ Policy fetched and active — compliance checks use this version.
                        {policy.active_approved_at && (
                          <> Last updated {new Date(policy.active_approved_at).toLocaleDateString()}.</>
                        )}
                        {' '}Re-checks automatically every Monday.
                      </p>
                    )}
                    {state === 'not_yet' && (
                      <p className="text-xs text-amber-700 mt-1.5">
                        ⚡ No baseline fetched yet. Click <strong>Check Now</strong> to fetch the current policy.
                        Until then, compliance checks fall back to built-in default rules.
                      </p>
                    )}
                    {state === 'fetch_failed' && (
                      <p className="text-xs text-red-700 mt-1.5">
                        The last fetch attempt failed. Click <strong>Check Now</strong> to retry,
                        or <a href={policy.source_url} target="_blank" rel="noopener noreferrer" className="underline">view the policy directly ↗</a> and upload it manually.
                      </p>
                    )}
                    {state === 'manual' && (
                      <div className="mt-2 p-3 bg-slate-100 rounded-lg text-xs text-slate-700 max-w-xl">
                        <p className="font-medium text-slate-800 mb-1">⛔ Auto-fetch blocked by platform</p>
                        <p>
                          X/Twitter uses Cloudflare bot protection that blocks all automated requests.
                          This is permanent — no workaround without a full headless browser service.
                          You need to copy the policy text manually once and paste it via <strong>Upload Policy Text</strong>.
                          Compliance checks will use your uploaded version until you update it again.
                        </p>
                        <a
                          href={policy.source_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 mt-2 text-slate-600 hover:text-slate-900 underline"
                        >
                          <ExternalLink className="w-3 h-3" />
                          Open X Rules & Policies to copy
                        </a>
                      </div>
                    )}

                    {/* Active version info for working state */}
                    {policy.active_version && state === 'working' && (
                      <p className="text-xs text-gray-400 mt-1 font-mono">v{policy.active_version}</p>
                    )}
                  </div>
                </div>

                {/* Right: actions */}
                <div className="flex items-center gap-2 shrink-0">
                  {state === 'manual' ? (
                    <>
                      <Link
                        href={`/admin/social/policies/${policy.id}`}
                        className="px-3 py-2 text-sm text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors flex items-center gap-2"
                      >
                        <Upload className="w-4 h-4" />
                        Upload Policy
                      </Link>
                    </>
                  ) : (
                    <>
                      <button
                        onClick={() => checkPolicy(policy.id)}
                        disabled={checking === policy.id}
                        className="px-3 py-2 text-sm text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors flex items-center gap-2 disabled:opacity-50"
                      >
                        <RefreshCw className={`w-4 h-4 ${checking === policy.id ? 'animate-spin' : ''}`} />
                        {checking === policy.id ? 'Checking…' : 'Check Now'}
                      </button>
                      <Link
                        href={`/admin/social/policies/${policy.id}`}
                        className="px-3 py-2 text-sm bg-gray-900 text-white hover:bg-gray-800 rounded-lg transition-colors flex items-center gap-2"
                      >
                        View Details
                        <ChevronRight className="w-4 h-4" />
                      </Link>
                    </>
                  )}
                </div>
              </div>

              {/* Pending change inline alert */}
              {state === 'pending_change' && policy.pending_version && (
                <div className="mt-4 p-4 bg-orange-50 border border-orange-200 rounded-lg flex items-start gap-3">
                  <AlertOctagon className="w-5 h-5 text-orange-600 mt-0.5 shrink-0" />
                  <div className="flex-1">
                    <p className="font-medium text-orange-900 text-sm">
                      Policy updated — version {policy.pending_version} needs your approval
                    </p>
                    <p className="text-xs text-orange-700 mt-1">
                      Severity: <span className="font-medium capitalize">{policy.pending_severity || 'unknown'}</span>
                      {' · '}Detected {new Date(policy.pending_created_at || '').toLocaleString()}
                    </p>
                    <div className="flex items-center gap-2 mt-3">
                      <Link
                        href={`/admin/social/policies/${policy.id}?version=${policy.pending_version_id}`}
                        className="px-3 py-1.5 text-sm bg-orange-600 text-white hover:bg-orange-700 rounded-lg transition-colors"
                      >
                        Review & Approve
                      </Link>
                      <span className="text-xs text-orange-600">Compliance checks still use the previous approved version until you approve.</span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Empty State */}
      {policies.length === 0 && (
        <div className="text-center py-12 bg-white rounded-xl border">
          <Shield className="w-12 h-12 text-gray-300 mx-auto mb-4" />
          <h3 className="font-medium text-gray-900">No policies configured</h3>
          <p className="text-gray-500 text-sm mt-1">
            Policy monitoring will be set up automatically with platform connections
          </p>
        </div>
      )}
    </div>
  );
}
