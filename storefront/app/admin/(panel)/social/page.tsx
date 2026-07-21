'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { addToast } from '@/lib/toast';
import { 
  LayoutDashboard, AlertTriangle, CheckCircle, Clock, 
  TrendingUp, Users, DollarSign, BarChart3, ArrowUpRight,
  AlertCircle, MessageCircle, Share2, Bot, Calendar, MessageSquare,
  Zap, Flame, TrendingDown, Minus
} from 'lucide-react';
import Link from 'next/link';

// Matches actual API response from dashboard_service.py
interface DashboardRaw {
  health_score: { score: number; status: string };
  content_pipeline: { drafts: number; scheduled: number; pending_approval: number; published_recent: number; published_today: number; failed: number };
  attention_needed: { unreplied_comments: number; pending_agent_approvals: number; pending_influencer_approvals: number; failed_posts: number; active_crisis_alerts: number };
  engagement: { total_events: number; avg_sentiment_score: number; reply_rate: number };
  revenue: { monetized_posts: number; attributed_orders: number; revenue_usd: number };
  ai_agent_activity: { total_actions: number };
  recommendations: { next_best_action: string };
  [key: string]: unknown;
}

// Normalized for the UI
interface DashboardData {
  health_score: number;
  summary: { drafts_pending: number; awaiting_approval: number; scheduled_today: number; published_today: number; failed_posts: number };
  engagement: { unreplied_comments: number; unreplied_messages: number; avg_sentiment: string; engagement_rate: string };
  crisis_alerts: { active_count: number; alerts: Array<{ id: number; severity: string; message: string; created_at: string }> };
  revenue: { total_revenue_cents: number; social_orders_count: number; top_platform: string; avg_order_value_cents: number };
  ai_activity: { drafts_submitted_24h: number; avg_confidence: number };
}

function normalizeDashboard(raw: DashboardRaw): DashboardData {
  const sentScore = raw.engagement?.avg_sentiment_score ?? 0;
  return {
    health_score: raw.health_score?.score ?? 0,
    summary: {
      drafts_pending: raw.content_pipeline?.drafts ?? 0,
      awaiting_approval: raw.content_pipeline?.pending_approval ?? 0,
      scheduled_today: raw.content_pipeline?.scheduled ?? 0,
      published_today: raw.content_pipeline?.published_today ?? raw.content_pipeline?.published_recent ?? 0,
      failed_posts: raw.content_pipeline?.failed ?? 0,
    },
    engagement: {
      unreplied_comments: raw.attention_needed?.unreplied_comments ?? 0,
      unreplied_messages: 0,
      avg_sentiment: sentScore > 0.3 ? 'positive' : sentScore < -0.2 ? 'negative' : 'neutral',
      engagement_rate: ((raw.engagement?.reply_rate ?? 0) * 100).toFixed(1),
    },
    crisis_alerts: {
      active_count: raw.attention_needed?.active_crisis_alerts ?? 0,
      alerts: [],
    },
    revenue: {
      total_revenue_cents: (raw.revenue?.revenue_usd ?? 0) * 100,
      social_orders_count: raw.revenue?.attributed_orders ?? 0,
      top_platform: 'n/a',
      avg_order_value_cents: 0,
    },
    ai_activity: {
      drafts_submitted_24h: raw.ai_agent_activity?.total_actions ?? 0,
      avg_confidence: 0,
    },
  };
}

interface GaryVeeScore {
  gary_vee_grade: string;
  total_posts_last_7_days: number;
  daily_average: number;
  platform_breakdown: Record<string, number>;
  recommendations: string[];
}

interface VelocityData {
  signal: 'green' | 'amber' | 'red';
  label: string;
  last_24h: number;
  last_7d: number;
  upcoming_scheduled: number;
  daily_target: number;
  weekly_target: number;
  weekly_ratio: number;
}

interface ViralAlert {
  post_id: number;
  platform: string;
  content_preview: string;
  published_at: string;
  total_engagement: number;
  likes: number;
  comments: number;
  shares: number;
  multiplier: number | null;
  severity: 'high' | 'medium' | 'info';
  action: string;
}

export default function SocialDashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [garyVee, setGaryVee] = useState<GaryVeeScore | null>(null);
  const [velocity, setVelocity] = useState<VelocityData | null>(null);
  const [viralAlerts, setViralAlerts] = useState<ViralAlert[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadDashboard();
  }, []);

  async function loadDashboard() {
    try {
      setLoading(true);
      const [rawDash, garyData, velocityData, viralData] = await Promise.all([
        api.get<DashboardRaw>('/api/admin/social/dashboard').catch(() => ({
          health_score: { score: 0, status: "offline" },
          content_pipeline: { drafts: 0, scheduled: 0, pending_approval: 0, published_recent: 0, published_today: 0, failed: 0 },
          attention_needed: { unreplied_comments: 0, pending_agent_approvals: 0, pending_influencer_approvals: 0, failed_posts: 0, active_crisis_alerts: 0 },
          engagement: { total_events: 0, avg_sentiment_score: 0.0, reply_rate: 0 },
          revenue: { monetized_posts: 0, attributed_orders: 0, revenue_usd: 0 },
          ai_agent_activity: { total_actions: 0 },
          recommendations: { next_best_action: "Please deploy and connect the Python API backend to activate the social features." }
        })),
        api.get<GaryVeeScore>('/api/admin/social/strategy/gary-vee-score').catch(() => null),
        api.get<VelocityData>('/api/admin/social/strategy/velocity').catch(() => null),
        api.get<{ alerts: ViralAlert[] }>('/api/admin/social/viral-alerts').catch(() => null),
      ]);
      setData(normalizeDashboard(rawDash));
      setGaryVee(garyData);
      setVelocity(velocityData);
      setViralAlerts(viralData?.alerts ?? []);
    } catch (err) {
      addToast('Failed to load dashboard', 'error');
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="text-center py-12">
        <AlertCircle className="mx-auto h-12 w-12 text-gray-400" />
        <p className="mt-4 text-gray-600">Failed to load dashboard data</p>
        <button 
          onClick={loadDashboard}
          className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
        >
          Retry
        </button>
      </div>
    );
  }

  const formatCurrency = (cents: number) => `$${(cents / 100).toFixed(2)}`;

  const PLATFORM_EMOJI: Record<string, string> = {
    facebook: '📘', instagram: '📸', tiktok: '🎵',
    youtube: '▶️', x: '𝕏', linkedin: '💼', pinterest: '📌', threads: '🧵',
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Social Dashboard</h1>
          <p className="text-gray-600 mt-1">Overview of your social media performance</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="px-4 py-2 bg-blue-50 rounded-lg text-right">
            <div className="flex items-center gap-2">
              <span className="text-sm text-blue-700 font-medium">Health Score:</span>
              <span className={`text-lg font-bold ${
                data.health_score >= 80 ? 'text-green-600' :
                data.health_score >= 60 ? 'text-yellow-600' : 'text-red-600'
              }`}>
                {data.health_score}%
              </span>
            </div>
            <p className="text-xs text-blue-500 mt-0.5">errors + volume + engagement</p>
          </div>
          {velocity && (
            <div className={`px-3 py-1.5 rounded-lg text-sm font-medium ${
              velocity.signal === 'green' ? 'bg-green-50 text-green-700' :
              velocity.signal === 'amber' ? 'bg-amber-50 text-amber-700' : 'bg-red-50 text-red-700'
            }`}>
              {velocity.signal === 'green' ? '🔥' : velocity.signal === 'amber' ? '⚠️' : '🚨'} {velocity.label}
            </div>
          )}
        </div>
      </div>

      {/* ── Viral Alert Banner ── */}
      {viralAlerts.length > 0 && (
        <div className="bg-orange-50 border border-orange-200 rounded-xl p-4">
          <div className="flex items-start gap-3">
            <Flame className="h-5 w-5 text-orange-500 mt-0.5 shrink-0" />
            <div className="flex-1">
              <h3 className="font-semibold text-orange-900">
                {viralAlerts.length} Post{viralAlerts.length > 1 ? 's' : ''} Going Viral — Engage Now!
              </h3>
              <div className="mt-2 space-y-2">
                {viralAlerts.slice(0, 3).map(alert => (
                  <div key={alert.post_id} className="flex items-start gap-3 text-sm">
                    <span className="text-lg leading-none">{PLATFORM_EMOJI[alert.platform] ?? '📄'}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-orange-800 font-medium truncate">{alert.content_preview}</p>
                      <p className="text-orange-600 text-xs mt-0.5">
                        {alert.multiplier ? `${alert.multiplier}× your average · ` : ''}
                        👍 {alert.likes} · 💬 {alert.comments} · 🔁 {alert.shares}
                      </p>
                    </div>
                    {alert.severity === 'high' && (
                      <span className="shrink-0 px-2 py-0.5 bg-red-100 text-red-700 rounded-full text-xs font-bold">HOT</span>
                    )}
                  </div>
                ))}
              </div>
              <p className="text-xs text-orange-700 mt-2 font-medium">👆 {viralAlerts[0].action}</p>
            </div>
          </div>
        </div>
      )}

      {/* Crisis Alerts Banner */}
      {data.crisis_alerts.active_count > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4">
          <div className="flex items-center gap-3">
            <AlertTriangle className="h-6 w-6 text-red-600" />
            <div className="flex-1">
              <h3 className="font-semibold text-red-900">
                {data.crisis_alerts.active_count} Active Crisis Alert{data.crisis_alerts.active_count > 1 ? 's' : ''}
              </h3>
              <div className="mt-2 space-y-1">
                {data.crisis_alerts.alerts.slice(0, 3).map(alert => (
                  <div key={alert.id} className="flex items-center gap-2 text-sm text-red-700">
                    <span className="px-2 py-0.5 bg-red-100 rounded text-xs font-medium uppercase">
                      {alert.severity}
                    </span>
                    <span>{alert.message}</span>
                    <span className="text-red-500 text-xs">
                      {new Date(alert.created_at).toLocaleTimeString()}
                    </span>
                  </div>
                ))}
              </div>
            </div>
            <Link 
              href="/admin/social/crisis"
              className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 text-sm"
            >
              View All
            </Link>
          </div>
        </div>
      )}

      {/* Quick Actions */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <QuickActionCard 
          icon={Clock}
          label="Awaiting Approval"
          value={data.summary.awaiting_approval}
          href="/admin/social/outbox?status=approved"
          color="yellow"
        />
        <QuickActionCard 
          icon={Calendar}
          label="Scheduled (Upcoming)"
          value={data.summary.scheduled_today}
          href="/admin/social/outbox?status=scheduled"
          color="blue"
        />
        <QuickActionCard 
          icon={MessageCircle}
          label="Unreplied Comments"
          value={data.engagement.unreplied_comments}
          href="/admin/social/inbox"
          color="purple"
        />
        <QuickActionCard 
          icon={CheckCircle}
          label="Published Today"
          value={data.summary.published_today}
          href="/admin/social/outbox?status=published"
          color="green"
        />
      </div>

      {/* ── Content Velocity Gauge ── */}
      {velocity && (
        <div className={`rounded-xl border p-4 flex items-center gap-4 ${
          velocity.signal === 'green' ? 'bg-green-50 border-green-200' :
          velocity.signal === 'amber' ? 'bg-amber-50 border-amber-200' :
          'bg-red-50 border-red-200'
        }`}>
          <div className={`p-3 rounded-xl ${
            velocity.signal === 'green' ? 'bg-green-100' :
            velocity.signal === 'amber' ? 'bg-amber-100' : 'bg-red-100'
          }`}>
            <Zap className={`h-6 w-6 ${
              velocity.signal === 'green' ? 'text-green-600' :
              velocity.signal === 'amber' ? 'text-amber-600' : 'text-red-600'
            }`} />
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <p className={`font-bold text-base ${
                velocity.signal === 'green' ? 'text-green-900' :
                velocity.signal === 'amber' ? 'text-amber-900' : 'text-red-900'
              }`}>
                Content Velocity: {velocity.label}
              </p>
            </div>
            <div className="flex items-center gap-4 mt-1 text-sm">
              <span className={velocity.signal === 'green' ? 'text-green-700' : velocity.signal === 'amber' ? 'text-amber-700' : 'text-red-700'}>
                <strong>{velocity.last_24h}</strong> posts last 24h (target {velocity.daily_target})
              </span>
              <span className={velocity.signal === 'green' ? 'text-green-700' : velocity.signal === 'amber' ? 'text-amber-700' : 'text-red-700'}>
                <strong>{velocity.last_7d}</strong> this week (target {velocity.weekly_target})
              </span>
              {velocity.upcoming_scheduled > 0 && (
                <span className={velocity.signal === 'green' ? 'text-green-600' : 'text-amber-600'}>
                  {velocity.upcoming_scheduled} upcoming scheduled
                </span>
              )}
            </div>
            {/* Progress bar */}
            <div className="mt-2 h-1.5 rounded-full bg-white/60 w-full max-w-xs">
              <div
                className={`h-1.5 rounded-full transition-all ${
                  velocity.signal === 'green' ? 'bg-green-500' :
                  velocity.signal === 'amber' ? 'bg-amber-500' : 'bg-red-500'
                }`}
                style={{ width: `${Math.min(100, Math.round(velocity.weekly_ratio * 100))}%` }}
              />
            </div>
          </div>
          <Link
            href="/admin/social/outbox"
            className={`shrink-0 text-xs font-medium px-3 py-1.5 rounded-lg ${
              velocity.signal === 'green' ? 'bg-green-600 text-white hover:bg-green-700' :
              velocity.signal === 'amber' ? 'bg-amber-600 text-white hover:bg-amber-700' :
              'bg-red-600 text-white hover:bg-red-700'
            }`}
          >
            {velocity.signal === 'green' ? 'Keep Going' : 'Post Now →'}
          </Link>
        </div>
      )}

      {/* Main Stats Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Revenue Card */}
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 bg-green-100 rounded-lg">
              <DollarSign className="h-5 w-5 text-green-600" />
            </div>
            <h3 className="font-semibold text-gray-900">Revenue from Social</h3>
          </div>
          <div className="space-y-3">
            <div>
              <p className="text-3xl font-bold text-gray-900">
                {formatCurrency(data.revenue.total_revenue_cents)}
              </p>
              <p className="text-sm text-gray-600">
                {data.revenue.social_orders_count} orders
              </p>
            </div>
            <div className="pt-3 border-t border-gray-100">
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Top Platform:</span>
                <span className="font-medium text-gray-900 capitalize">
                  {data.revenue.top_platform}
                </span>
              </div>
              <div className="flex justify-between text-sm mt-1">
                <span className="text-gray-600">Avg Order Value:</span>
                <span className="font-medium text-gray-900">
                  {formatCurrency(data.revenue.avg_order_value_cents)}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Engagement Card */}
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 bg-blue-100 rounded-lg">
              <Users className="h-5 w-5 text-blue-600" />
            </div>
            <h3 className="font-semibold text-gray-900">Engagement</h3>
          </div>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-2xl font-bold text-gray-900">
                  {data.engagement.unreplied_comments}
                </p>
                <p className="text-xs text-gray-600">Unreplied Comments</p>
              </div>
              <div>
                <p className="text-2xl font-bold text-gray-900">
                  {data.engagement.unreplied_messages}
                </p>
                <p className="text-xs text-gray-600">Unreplied Messages</p>
              </div>
            </div>
            <div className="pt-3 border-t border-gray-100">
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Avg Sentiment:</span>
                <span className={`font-medium ${
                  data.engagement.avg_sentiment === 'positive' ? 'text-green-600' :
                  data.engagement.avg_sentiment === 'negative' ? 'text-red-600' :
                  'text-yellow-600'
                }`}>
                  {data.engagement.avg_sentiment}
                </span>
              </div>
              <div className="flex justify-between text-sm mt-1">
                <span className="text-gray-600">Engagement Rate:</span>
                <span className="font-medium text-gray-900">
                  {data.engagement.engagement_rate}%
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* AI Activity Card */}
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 bg-purple-100 rounded-lg">
              <Bot className="h-5 w-5 text-purple-600" />
            </div>
            <h3 className="font-semibold text-gray-900">AI Activity</h3>
          </div>
          <div className="space-y-3">
            <div>
              <p className="text-3xl font-bold text-gray-900">
                {data.ai_activity.drafts_submitted_24h}
              </p>
              <p className="text-sm text-gray-600">
                Drafts created (last 24h)
              </p>
            </div>
            <div className="pt-3 border-t border-gray-100">
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">AI Confidence:</span>
                <span className="font-medium text-gray-900">
                  {Math.round(data.ai_activity.avg_confidence * 100)}%
                </span>
              </div>
              <div className="mt-3">
                <Link 
                  href="/admin/social/outbox"
                  className="text-sm text-blue-600 hover:text-blue-700 flex items-center gap-1"
                >
                  Review drafts <ArrowUpRight className="h-4 w-4" />
                </Link>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Gary Vee Section */}
      {garyVee && (
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 bg-purple-100 rounded-lg">
              <TrendingUp className="h-5 w-5 text-purple-600" />
            </div>
            <div>
              <h3 className="font-semibold text-gray-900">Gary Vee Posting Strategy</h3>
              <p className="text-sm text-gray-600">Last 7 days performance</p>
            </div>
            <div className="ml-auto">
              <span className={`px-3 py-1 rounded-full text-sm font-bold ${
                garyVee.gary_vee_grade === 'A' ? 'bg-green-100 text-green-700' :
                garyVee.gary_vee_grade === 'B' ? 'bg-blue-100 text-blue-700' :
                garyVee.gary_vee_grade === 'C' ? 'bg-yellow-100 text-yellow-700' :
                'bg-red-100 text-red-700'
              }`}>
                Grade {garyVee.gary_vee_grade}
              </span>
            </div>
          </div>
          
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
            <div className="text-center p-3 bg-gray-50 rounded-lg">
              <p className="text-2xl font-bold text-gray-900">{garyVee.total_posts_last_7_days}</p>
              <p className="text-xs text-gray-600">Total Posts (7d)</p>
            </div>
            <div className="text-center p-3 bg-gray-50 rounded-lg">
              <p className="text-2xl font-bold text-gray-900">{garyVee.daily_average.toFixed(1)}</p>
              <p className="text-xs text-gray-600">Daily Average</p>
            </div>
            {Object.entries(garyVee.platform_breakdown).slice(0, 2).map(([platform, count]) => (
              <div key={platform} className="text-center p-3 bg-gray-50 rounded-lg">
                <p className="text-2xl font-bold text-gray-900">{count}</p>
                <p className="text-xs text-gray-600 capitalize">{platform}</p>
              </div>
            ))}
          </div>

          {garyVee.recommendations.length > 0 && (
            <div className="bg-purple-50 rounded-lg p-4">
              <h4 className="font-medium text-purple-900 mb-2">Recommendations</h4>
              <ul className="space-y-1">
                {garyVee.recommendations.map((rec, i) => (
                  <li key={i} className="text-sm text-purple-800 flex items-start gap-2">
                    <span className="text-purple-600">•</span>
                    {rec}
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="mt-4 flex gap-3">
            <Link 
              href="/admin/social/strategy"
              className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 text-sm"
            >
              View Strategy
            </Link>
            <Link 
              href="/admin/social/ab-tests"
              className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 text-sm"
            >
              A/B Tests
            </Link>
          </div>
        </div>
      )}

      {/* Failed Posts Warning */}
      {data.summary.failed_posts > 0 && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4">
          <div className="flex items-center gap-3">
            <AlertCircle className="h-6 w-6 text-yellow-600" />
            <div className="flex-1">
              <h3 className="font-semibold text-yellow-900">
                {data.summary.failed_posts} Post{data.summary.failed_posts > 1 ? 's' : ''} Failed to Publish
              </h3>
              <p className="text-sm text-yellow-700 mt-1">
                Check the outbox for error details and retry options.
              </p>
            </div>
            <Link 
              href="/admin/social/outbox?status=failed"
              className="px-4 py-2 bg-yellow-600 text-white rounded-lg hover:bg-yellow-700 text-sm"
            >
              Review Failed
            </Link>
          </div>
        </div>
      )}

      {/* ── Empty-state onboarding ── shown when no content has been published yet */}
      {data.summary.published_today === 0 &&
       data.summary.scheduled_today === 0 &&
       data.summary.drafts_pending === 0 &&
       data.summary.awaiting_approval === 0 && (
        <div className="bg-gradient-to-br from-purple-50 to-blue-50 border border-purple-100 rounded-xl p-8 text-center">
          <div className="inline-flex items-center justify-center w-14 h-14 bg-white rounded-2xl shadow-sm mb-4">
            <Share2 className="h-7 w-7 text-purple-600" />
          </div>
          <h3 className="text-lg font-bold text-gray-900 mb-1">Ready to start posting?</h3>
          <p className="text-sm text-gray-600 mb-6 max-w-md mx-auto">
            Connect your social platforms, set your strategy, and let the AI start creating content for you.
          </p>
          <div className="flex flex-wrap justify-center gap-3">
            <Link href="/admin/social/platforms"
              className="inline-flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 text-sm font-medium">
              <Share2 className="h-4 w-4" /> Connect Platforms
            </Link>
            <Link href="/admin/social/strategy"
              className="inline-flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 text-gray-700 rounded-lg hover:bg-gray-50 text-sm font-medium">
              <BarChart3 className="h-4 w-4" /> Set Strategy
            </Link>
            <Link href="/admin/social/persona"
              className="inline-flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 text-gray-700 rounded-lg hover:bg-gray-50 text-sm font-medium">
              <Bot className="h-4 w-4" /> Brand Persona
            </Link>
          </div>
          <div className="mt-6 grid grid-cols-1 sm:grid-cols-3 gap-3 text-left max-w-xl mx-auto">
            <div className="bg-white rounded-lg p-3 border border-purple-100">
              <p className="text-xs font-bold text-purple-700 mb-1">Step 1</p>
              <p className="text-xs text-gray-600">Connect Instagram, TikTok, Facebook & more</p>
            </div>
            <div className="bg-white rounded-lg p-3 border border-blue-100">
              <p className="text-xs font-bold text-blue-700 mb-1">Step 2</p>
              <p className="text-xs text-gray-600">Set your posting schedule and content mix</p>
            </div>
            <div className="bg-white rounded-lg p-3 border border-green-100">
              <p className="text-xs font-bold text-green-700 mb-1">Step 3</p>
              <p className="text-xs text-gray-600">AI creates drafts — you approve in the Outbox</p>
            </div>
          </div>
        </div>
      )}

      {/* ── Contextual Attention Panel ── */}
      {(() => {
        const items: { href: string; icon: React.ElementType; label: string; value: string; color: string; cta: string }[] = [];
        if (data.summary.awaiting_approval > 0)
          items.push({ href: '/admin/social/outbox?status=approved', icon: CheckCircle, label: 'Awaiting Your Approval', value: `${data.summary.awaiting_approval} post${data.summary.awaiting_approval > 1 ? 's' : ''}`, color: 'blue', cta: 'Review now' });
        if (data.summary.failed_posts > 0)
          items.push({ href: '/admin/social/outbox?status=failed', icon: AlertCircle, label: 'Failed to Publish', value: `${data.summary.failed_posts} post${data.summary.failed_posts > 1 ? 's' : ''}`, color: 'red', cta: 'Retry' });
        if (data.engagement.unreplied_comments > 0)
          items.push({ href: '/admin/social/inbox', icon: MessageSquare, label: 'Unreplied Comments', value: `${data.engagement.unreplied_comments} comment${data.engagement.unreplied_comments > 1 ? 's' : ''}`, color: 'amber', cta: 'Reply' });
        if (data.summary.scheduled_today > 0)
          items.push({ href: '/admin/social/calendar', icon: Calendar, label: 'Scheduled Today', value: `${data.summary.scheduled_today} post${data.summary.scheduled_today > 1 ? 's' : ''}`, color: 'green', cta: 'View calendar' });
        if (items.length === 0) return null;
        const colorMap: Record<string, string> = {
          blue:  'bg-blue-50 border-blue-100 text-blue-800',
          red:   'bg-red-50 border-red-100 text-red-800',
          amber: 'bg-amber-50 border-amber-100 text-amber-800',
          green: 'bg-green-50 border-green-100 text-green-800',
        };
        const iconColorMap: Record<string, string> = {
          blue: 'text-blue-500', red: 'text-red-500', amber: 'text-amber-500', green: 'text-green-500',
        };
        return (
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <h3 className="text-sm font-semibold text-gray-900 mb-3">Needs Your Attention</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {items.map((item) => {
                const Icon = item.icon;
                return (
                  <Link key={item.href} href={item.href}
                    className={`flex items-center gap-3 p-3 rounded-lg border transition-all hover:shadow-sm ${colorMap[item.color]}`}>
                    <Icon className={`h-5 w-5 shrink-0 ${iconColorMap[item.color]}`} />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold">{item.value}</p>
                      <p className="text-xs opacity-75 truncate">{item.label}</p>
                    </div>
                    <ArrowUpRight className="h-3.5 w-3.5 shrink-0 opacity-50" />
                  </Link>
                );
              })}
            </div>
          </div>
        );
      })()}
    </div>
  );
}

function QuickActionCard({ 
  icon: Icon, 
  label, 
  value, 
  href, 
  color 
}: { 
  icon: React.ElementType; 
  label: string; 
  value: number; 
  href: string;
  color: 'yellow' | 'blue' | 'purple' | 'green';
}) {
  const colorClasses = {
    yellow: 'bg-yellow-50 text-yellow-700 hover:bg-yellow-100',
    blue: 'bg-blue-50 text-blue-700 hover:bg-blue-100',
    purple: 'bg-purple-50 text-purple-700 hover:bg-purple-100',
    green: 'bg-green-50 text-green-700 hover:bg-green-100',
  };

  return (
    <Link 
      href={href}
      className={`flex items-center gap-3 p-4 rounded-xl transition-colors ${colorClasses[color]}`}
    >
      <div className="p-2 bg-white rounded-lg shadow-sm">
        <Icon className="h-5 w-5" />
      </div>
      <div>
        <p className="text-2xl font-bold">{value}</p>
        <p className="text-sm opacity-80">{label}</p>
      </div>
    </Link>
  );
}
