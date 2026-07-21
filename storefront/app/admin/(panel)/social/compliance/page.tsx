'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import {
  Shield, AlertTriangle, CheckCircle, XCircle, TrendingUp, 
  TrendingDown, Minus, RefreshCw, AlertOctagon, FileText,
  Image as ImageIcon, Link2, Hash, MessageSquare
} from 'lucide-react';

interface ComplianceScorecard {
  overall_grade: string;
  overall_score: number;
  period_days: number;
  total_posts_checked: number;
  violations_count: number;
  warnings_count: number;
  clean_count: number;
  auto_fixes_applied: number;
  by_platform: Record<string, {
    grade: string;
    posts: number;
    violations: number;
    warnings: number;
    clean: number;
  }>;
  trends: {
    dates: string[];
    violations: number[];
    warnings: number[];
    clean: number[];
  };
  top_violations: Array<{
    category: string;
    count: number;
    severity: string;
  }>;
  recent_issues: Array<{
    id: number;
    platform: string;
    content_preview: string;
    status: string;
    severity: string;
    checked_at: string;
    issues_count: number;
  }>;
}

export default function ComplianceDashboard() {
  const [data, setData] = useState<ComplianceScorecard | null>(null);
  const [loading, setLoading] = useState(true);
  const [days, setDays] = useState(30);

  useEffect(() => {
    loadScorecard();
  }, [days]);

  async function loadScorecard() {
    try {
      const res = await api.get<ComplianceScorecard>(`/api/admin/compliance/scorecard?days=${days}`);
      setData(res);
    } catch (e) {
      console.error('Failed to load scorecard:', e);
    } finally {
      setLoading(false);
    }
  }

  function getGradeColor(grade: string) {
    switch (grade) {
      case 'A': return 'text-emerald-500 bg-emerald-50';
      case 'B': return 'text-blue-500 bg-blue-50';
      case 'C': return 'text-yellow-500 bg-yellow-50';
      case 'D': return 'text-orange-500 bg-orange-50';
      case 'F': return 'text-red-500 bg-red-50';
      default: return 'text-gray-500 bg-gray-50';
    }
  }

  function getStatusIcon(status: string) {
    switch (status) {
      case 'clean': return <CheckCircle className="w-5 h-5 text-emerald-500" />;
      case 'warning': return <AlertTriangle className="w-5 h-5 text-yellow-500" />;
      case 'violation': return <XCircle className="w-5 h-5 text-red-500" />;
      default: return <Minus className="w-5 h-5 text-gray-400" />;
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="w-8 h-8 text-gray-400 animate-spin" />
      </div>
    );
  }

  if (!data) {
    return (
      <div className="text-center py-12">
        <AlertOctagon className="w-12 h-12 text-red-400 mx-auto mb-4" />
        <p className="text-gray-500">Failed to load compliance data</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Content Compliance</h1>
          <p className="text-gray-500 mt-1 max-w-2xl">
            Every post is automatically scanned for policy violations — banned keywords, ad policy breaches, and image safety — before it goes live.
            Posts are graded A–F based on clean/warning/violation ratios. Use the Outbox to re-check or auto-fix flagged posts.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <select
            value={days}
            onChange={(e) => setDays(Number(e.target.value))}
            className="px-3 py-2 border rounded-lg text-sm bg-white"
          >
            <option value={7}>Last 7 days</option>
            <option value={30}>Last 30 days</option>
            <option value={90}>Last 90 days</option>
          </select>
          <button
            onClick={loadScorecard}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <RefreshCw className="w-5 h-5 text-gray-600" />
          </button>
        </div>
      </div>

      {/* Overall Grade Card */}
      <div className="bg-gradient-to-br from-gray-900 to-gray-800 rounded-xl p-6 text-white">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-gray-400 text-sm">Overall Compliance Grade</p>
            <div className="flex items-baseline gap-3 mt-1">
              <span className="text-5xl font-bold">{data.overall_grade}</span>
              <span className="text-2xl text-gray-400">{data.overall_score}%</span>
            </div>
            <p className="text-gray-400 text-sm mt-2">
              Based on {data.total_posts_checked} posts checked in last {days} days
            </p>
          </div>
          <Shield className="w-16 h-16 text-emerald-400" />
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-4 gap-4">
        <div className="bg-white rounded-xl p-5 border">
          <div className="flex items-center gap-3 mb-3">
            <div className="p-2 bg-emerald-100 rounded-lg">
              <CheckCircle className="w-5 h-5 text-emerald-600" />
            </div>
            <span className="text-gray-600 text-sm">Clean Posts</span>
          </div>
          <p className="text-2xl font-bold text-gray-900">{data.clean_count}</p>
          <p className="text-sm text-emerald-600 mt-1">
            {Math.round((data.clean_count / data.total_posts_checked) * 100)}% pass rate
          </p>
        </div>

        <div className="bg-white rounded-xl p-5 border">
          <div className="flex items-center gap-3 mb-3">
            <div className="p-2 bg-yellow-100 rounded-lg">
              <AlertTriangle className="w-5 h-5 text-yellow-600" />
            </div>
            <span className="text-gray-600 text-sm">Warnings</span>
          </div>
          <p className="text-2xl font-bold text-gray-900">{data.warnings_count}</p>
          <p className="text-sm text-yellow-600 mt-1">Needs attention</p>
        </div>

        <div className="bg-white rounded-xl p-5 border">
          <div className="flex items-center gap-3 mb-3">
            <div className="p-2 bg-red-100 rounded-lg">
              <XCircle className="w-5 h-5 text-red-600" />
            </div>
            <span className="text-gray-600 text-sm">Violations</span>
          </div>
          <p className="text-2xl font-bold text-gray-900">{data.violations_count}</p>
          <p className="text-sm text-red-600 mt-1">Blocked from publishing</p>
        </div>

        <div className="bg-white rounded-xl p-5 border">
          <div className="flex items-center gap-3 mb-3">
            <div className="p-2 bg-blue-100 rounded-lg">
              <TrendingUp className="w-5 h-5 text-blue-600" />
            </div>
            <span className="text-gray-600 text-sm">Auto-Fixes</span>
          </div>
          <p className="text-2xl font-bold text-gray-900">{data.auto_fixes_applied}</p>
          <p className="text-sm text-blue-600 mt-1">Issues automatically resolved</p>
        </div>
      </div>

      {/* Platform Breakdown */}
      <div className="bg-white rounded-xl border">
        <div className="p-5 border-b">
          <h2 className="font-semibold text-gray-900">Platform Compliance</h2>
        </div>
        <div className="divide-y">
          {Object.entries(data.by_platform).map(([platform, stats]) => (
            <div key={platform} className="p-5 flex items-center justify-between">
              <div className="flex items-center gap-4">
                <span className={`w-10 h-10 rounded-lg flex items-center justify-center font-bold text-lg ${getGradeColor(stats.grade)}`}>
                  {stats.grade}
                </span>
                <div>
                  <p className="font-medium text-gray-900 capitalize">{platform}</p>
                  <p className="text-sm text-gray-500">{stats.posts} posts checked</p>
                </div>
              </div>
              <div className="flex items-center gap-6 text-sm">
                <div className="text-center">
                  <p className="font-semibold text-emerald-600">{stats.clean}</p>
                  <p className="text-gray-500 text-xs">Clean</p>
                </div>
                <div className="text-center">
                  <p className="font-semibold text-yellow-600">{stats.warnings}</p>
                  <p className="text-gray-500 text-xs">Warnings</p>
                </div>
                <div className="text-center">
                  <p className="font-semibold text-red-600">{stats.violations}</p>
                  <p className="text-gray-500 text-xs">Violations</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Top Violations */}
      <div className="grid grid-cols-2 gap-6">
        <div className="bg-white rounded-xl border">
          <div className="p-5 border-b">
            <h2 className="font-semibold text-gray-900">Top Violation Categories</h2>
          </div>
          <div className="p-5">
            {data.top_violations.length === 0 ? (
              <p className="text-center text-gray-500 py-4">No violations in this period</p>
            ) : (
              <div className="space-y-4">
                {data.top_violations.map((v) => (
                  <div key={v.category} className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      {v.category === 'spam' && <AlertTriangle className="w-4 h-4 text-yellow-500" />}
                      {v.category === 'sexual_content' && <AlertOctagon className="w-4 h-4 text-red-500" />}
                      {v.category === 'harassment' && <MessageSquare className="w-4 h-4 text-red-500" />}
                      {v.category === 'misinformation' && <FileText className="w-4 h-4 text-orange-500" />}
                      {v.category === 'hate_speech' && <AlertTriangle className="w-4 h-4 text-red-500" />}
                      {v.category === 'image_violation' && <ImageIcon className="w-4 h-4 text-red-500" />}
                      {v.category === 'unsafe_url' && <Link2 className="w-4 h-4 text-red-500" />}
                      <span className="text-gray-700 capitalize">{v.category.replace(/_/g, ' ')}</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className={`px-2 py-1 rounded text-xs font-medium ${
                        v.severity === 'critical' ? 'bg-red-100 text-red-700' : 'bg-yellow-100 text-yellow-700'
                      }`}>
                        {v.severity}
                      </span>
                      <span className="font-semibold text-gray-900">{v.count}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Recent Issues */}
        <div className="bg-white rounded-xl border">
          <div className="p-5 border-b">
            <h2 className="font-semibold text-gray-900">Recent Issues</h2>
          </div>
          <div className="divide-y">
            {data.recent_issues.length === 0 ? (
              <p className="text-center text-gray-500 py-8">No recent issues</p>
            ) : (
              data.recent_issues.slice(0, 5).map((issue) => (
                <div key={issue.id} className="p-4 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    {getStatusIcon(issue.status)}
                    <div>
                      <p className="text-sm text-gray-900 line-clamp-1">{issue.content_preview}</p>
                      <p className="text-xs text-gray-500 capitalize">{issue.platform} • {new Date(issue.checked_at).toLocaleDateString()}</p>
                    </div>
                  </div>
                  <span className={`px-2 py-1 rounded text-xs font-medium ${
                    issue.severity === 'critical' ? 'bg-red-100 text-red-700' :
                    issue.severity === 'warning' ? 'bg-yellow-100 text-yellow-700' :
                    'bg-emerald-100 text-emerald-700'
                  }`}>
                    {issue.issues_count} {issue.issues_count === 1 ? 'issue' : 'issues'}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
