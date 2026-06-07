'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { addToast } from '@/lib/toast';
import { 
  LayoutDashboard, AlertTriangle, CheckCircle, Clock, 
  TrendingUp, Users, DollarSign, BarChart3, ArrowUpRight,
  AlertCircle, MessageCircle, Share2, Bot, Calendar
} from 'lucide-react';
import Link from 'next/link';

interface DashboardData {
  health_score: number;
  summary: {
    drafts_pending: number;
    awaiting_approval: number;
    scheduled_today: number;
    published_today: number;
    failed_posts: number;
  };
  engagement: {
    unreplied_comments: number;
    unreplied_messages: number;
    avg_sentiment: string;
    engagement_rate: string;
  };
  crisis_alerts: {
    active_count: number;
    alerts: Array<{
      id: number;
      severity: string;
      message: string;
      created_at: string;
    }>;
  };
  revenue: {
    total_revenue_cents: number;
    social_orders_count: number;
    top_platform: string;
    avg_order_value_cents: number;
  };
  ai_activity: {
    drafts_submitted_24h: number;
    avg_confidence: number;
  };
}

interface GaryVeeScore {
  gary_vee_grade: string;
  total_posts_last_7_days: number;
  daily_average: number;
  platform_breakdown: Record<string, number>;
  recommendations: string[];
}

export default function SocialDashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [garyVee, setGaryVee] = useState<GaryVeeScore | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadDashboard();
  }, []);

  async function loadDashboard() {
    try {
      setLoading(true);
      const [dashData, garyData] = await Promise.all([
        api.get<DashboardData>('/api/admin/social/dashboard'),
        api.get<GaryVeeScore>('/api/admin/social/strategy/gary-vee-score').catch(() => null)
      ]);
      setData(dashData);
      setGaryVee(garyData);
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

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Social Dashboard</h1>
          <p className="text-gray-600 mt-1">Overview of your social media performance</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="px-4 py-2 bg-blue-50 rounded-lg">
            <span className="text-sm text-blue-700 font-medium">Health Score: </span>
            <span className={`text-lg font-bold ${
              data.health_score >= 80 ? 'text-green-600' : 
              data.health_score >= 60 ? 'text-yellow-600' : 'text-red-600'
            }`}>
              {data.health_score}%
            </span>
          </div>
          {garyVee && (
            <div className="px-4 py-2 bg-purple-50 rounded-lg">
              <span className="text-sm text-purple-700 font-medium">Gary Vee Grade: </span>
              <span className="text-lg font-bold text-purple-700">{garyVee.gary_vee_grade}</span>
            </div>
          )}
        </div>
      </div>

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
          label="Scheduled Today"
          value={data.summary.scheduled_today}
          href="/admin/social/outbox?status=scheduled"
          color="blue"
        />
        <QuickActionCard 
          icon={MessageCircle}
          label="Unreplied Comments"
          value={data.engagement.unreplied_comments}
          href="/admin/social/engagement"
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

      {/* Quick Links */}
      <div className="bg-gray-50 rounded-xl p-6">
        <h3 className="font-semibold text-gray-900 mb-4">Quick Actions</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Link 
            href="/admin/social/outbox"
            className="flex items-center gap-2 p-3 bg-white rounded-lg border border-gray-200 hover:border-blue-300 hover:shadow-sm transition-all"
          >
            <Share2 className="h-5 w-5 text-blue-600" />
            <span className="text-sm font-medium">Outbox</span>
          </Link>
          <Link 
            href="/admin/social/persona"
            className="flex items-center gap-2 p-3 bg-white rounded-lg border border-gray-200 hover:border-blue-300 hover:shadow-sm transition-all"
          >
            <Bot className="h-5 w-5 text-purple-600" />
            <span className="text-sm font-medium">Brand Persona</span>
          </Link>
          <Link 
            href="/admin/social/platforms"
            className="flex items-center gap-2 p-3 bg-white rounded-lg border border-gray-200 hover:border-blue-300 hover:shadow-sm transition-all"
          >
            <BarChart3 className="h-5 w-5 text-green-600" />
            <span className="text-sm font-medium">Platforms</span>
          </Link>
          <Link 
            href="/admin/pages"
            className="flex items-center gap-2 p-3 bg-white rounded-lg border border-gray-200 hover:border-blue-300 hover:shadow-sm transition-all"
          >
            <LayoutDashboard className="h-5 w-5 text-orange-600" />
            <span className="text-sm font-medium">Blog Posts</span>
          </Link>
        </div>
      </div>
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
