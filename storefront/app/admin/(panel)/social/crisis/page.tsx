'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { addToast } from '@/lib/toast';
import { 
  AlertTriangle, Bell, CheckCircle, Clock, AlertCircle,
  X, RefreshCw, Filter, TrendingDown, MessageSquare,
  Shield, Info
} from 'lucide-react';

interface CrisisAlert {
  id: number;
  severity: 'critical' | 'high' | 'medium' | 'low';
  alert_type: string;
  message: string;
  details: string | null;
  platform: string | null;
  post_id: number | null;
  is_resolved: boolean;
  resolved_at: string | null;
  resolved_by: string | null;
  created_at: string;
  acknowledged_at: string | null;
}

const SEVERITY_CONFIG = {
  critical: { 
    color: 'bg-red-100 text-red-800 border-red-200', 
    icon: AlertTriangle,
    label: 'Critical'
  },
  high: { 
    color: 'bg-orange-100 text-orange-800 border-orange-200', 
    icon: AlertCircle,
    label: 'High'
  },
  medium: { 
    color: 'bg-yellow-100 text-yellow-800 border-yellow-200', 
    icon: Bell,
    label: 'Medium'
  },
  low: { 
    color: 'bg-blue-100 text-blue-800 border-blue-200', 
    icon: Info,
    label: 'Low'
  },
};

const ALERT_TYPE_LABELS: Record<string, string> = {
  'negative_sentiment_spike': 'Negative Sentiment Spike',
  'high_volume_complaints': 'High Volume Complaints',
  'controversial_content': 'Controversial Content Detected',
  'engagement_drop': 'Engagement Drop',
  'platform_error': 'Platform Error',
  'security_concern': 'Security Concern',
  'brand_mention_crisis': 'Brand Mention Crisis',
};

export default function CrisisAlertsPage() {
  const [alerts, setAlerts] = useState<CrisisAlert[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterSeverity, setFilterSeverity] = useState<string>('');
  const [filterStatus, setFilterStatus] = useState<string>('active');
  const [showCreateModal, setShowCreateModal] = useState(false);

  useEffect(() => {
    loadAlerts();
  }, [filterSeverity, filterStatus]);

  async function loadAlerts() {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (filterSeverity) params.append('severity', filterSeverity);
      if (filterStatus) params.append('status', filterStatus);
      
      const data = await api.get<CrisisAlert[] | { alerts: CrisisAlert[] }>(`/api/admin/social/crisis-alerts?${params}`);
      setAlerts(Array.isArray(data) ? data : data.alerts ?? []);
    } catch (err) {
      addToast('Failed to load crisis alerts', 'error');
    } finally {
      setLoading(false);
    }
  }

  async function acknowledgeAlert(id: number) {
    try {
      await api.post(`/api/admin/social/crisis-alerts/${id}/acknowledge`, {});
      addToast('Alert acknowledged', 'success');
      loadAlerts();
    } catch (err) {
      addToast('Failed to acknowledge alert', 'error');
    }
  }

  async function resolveAlert(id: number, resolution: string) {
    try {
      await api.post(`/api/admin/social/crisis-alerts/${id}/resolve`, { resolution });
      addToast('Alert resolved', 'success');
      loadAlerts();
    } catch (err) {
      addToast('Failed to resolve alert', 'error');
    }
  }

  const activeAlerts = alerts.filter(a => !a.is_resolved);
  const resolvedAlerts = alerts.filter(a => a.is_resolved);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Shield className="h-6 w-6 text-red-600" />
            Crisis Alerts
          </h1>
          <p className="text-gray-600 mt-1">
            Monitor and respond to social media issues that need immediate attention
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button 
            onClick={loadAlerts}
            className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg"
            title="Refresh"
          >
            <RefreshCw className="h-5 w-5" />
          </button>
          {activeAlerts.length > 0 && (
            <div className="px-4 py-2 bg-red-100 text-red-700 rounded-lg font-medium">
              {activeAlerts.length} Active
            </div>
          )}
        </div>
      </div>

      {/* What are Crisis Alerts - Info Box */}
      <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
        <div className="flex items-start gap-3">
          <Info className="h-5 w-5 text-blue-600 mt-0.5" />
          <div>
            <h3 className="font-medium text-blue-900">What are Crisis Alerts?</h3>
            <p className="text-sm text-blue-800 mt-1">
              Crisis alerts are automated notifications that flag potential issues requiring immediate attention:
            </p>
            <ul className="text-sm text-blue-700 mt-2 space-y-1 ml-4">
              <li>• <strong>Negative sentiment spikes</strong> - Sudden increase in negative comments</li>
              <li>• <strong>High volume complaints</strong> - Multiple customers reporting same issue</li>
              <li>• <strong>Controversial content</strong> - AI-detected potentially problematic posts</li>
              <li>• <strong>Engagement drops</strong> - Unusual decrease in post performance</li>
              <li>• <strong>Platform errors</strong> - Failed posts or API issues</li>
            </ul>
            <p className="text-sm text-blue-800 mt-2">
              <strong>No Slack required</strong> - All alerts appear here in this dashboard.
            </p>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2">
          <Filter className="h-4 w-4 text-gray-500" />
          <span className="text-sm text-gray-600">Filter:</span>
        </div>
        <select 
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value)}
          className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm"
        >
          <option value="active">Active Only</option>
          <option value="resolved">Resolved</option>
          <option value="all">All Alerts</option>
        </select>
        <select 
          value={filterSeverity}
          onChange={(e) => setFilterSeverity(e.target.value)}
          className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm"
        >
          <option value="">All Severities</option>
          <option value="critical">Critical</option>
          <option value="high">High</option>
          <option value="medium">Medium</option>
          <option value="low">Low</option>
        </select>
      </div>

      {/* Alerts List */}
      {loading ? (
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        </div>
      ) : alerts.length === 0 ? (
        <div className="text-center py-12 bg-gray-50 rounded-xl">
          <CheckCircle className="mx-auto h-12 w-12 text-green-500" />
          <h3 className="mt-4 text-lg font-medium text-gray-900">No alerts found</h3>
          <p className="mt-2 text-gray-600">
            {filterStatus === 'active' 
              ? 'Great! No active crisis alerts at the moment.' 
              : 'No alerts match your filter criteria.'}
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {alerts.map(alert => {
            const severity = SEVERITY_CONFIG[alert.severity];
            const SeverityIcon = severity.icon;
            
            return (
              <div 
                key={alert.id}
                className={`border rounded-xl p-5 ${
                  alert.is_resolved 
                    ? 'bg-gray-50 border-gray-200' 
                    : 'bg-white border-gray-200 shadow-sm'
                }`}
              >
                <div className="flex items-start gap-4">
                  {/* Severity Badge */}
                  <div className={`p-3 rounded-lg ${severity.color}`}>
                    <SeverityIcon className="h-5 w-5" />
                  </div>

                  {/* Alert Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className={`px-2 py-0.5 rounded text-xs font-medium uppercase ${severity.color}`}>
                            {severity.label}
                          </span>
                          <span className="text-sm text-gray-500">
                            {ALERT_TYPE_LABELS[alert.alert_type] || alert.alert_type}
                          </span>
                          {alert.platform && (
                            <span className="text-sm text-gray-500 capitalize">
                              • {alert.platform}
                            </span>
                          )}
                        </div>
                        <h3 className={`mt-2 font-semibold ${alert.is_resolved ? 'text-gray-600' : 'text-gray-900'}`}>
                          {alert.message}
                        </h3>
                        {alert.details && (
                          <p className="mt-1 text-sm text-gray-600">{alert.details}</p>
                        )}
                        <div className="mt-3 flex items-center gap-4 text-sm text-gray-500">
                          <span className="flex items-center gap-1">
                            <Clock className="h-4 w-4" />
                            {new Date(alert.created_at).toLocaleString()}
                          </span>
                          {alert.acknowledged_at && (
                            <span className="text-yellow-600 flex items-center gap-1">
                              <Bell className="h-4 w-4" />
                              Acknowledged
                            </span>
                          )}
                          {alert.is_resolved && alert.resolved_by && (
                            <span className="text-green-600 flex items-center gap-1">
                              <CheckCircle className="h-4 w-4" />
                              Resolved by {alert.resolved_by}
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Actions */}
                      <div className="flex items-center gap-2">
                        {!alert.is_resolved && (
                          <>
                            {!alert.acknowledged_at && (
                              <button
                                onClick={() => acknowledgeAlert(alert.id)}
                                className="px-3 py-1.5 text-sm font-medium text-yellow-700 bg-yellow-100 hover:bg-yellow-200 rounded-lg"
                              >
                                Acknowledge
                              </button>
                            )}
                            <button
                              onClick={() => {
                                const resolution = prompt('Enter resolution notes:');
                                if (resolution) resolveAlert(alert.id, resolution);
                              }}
                              className="px-3 py-1.5 text-sm font-medium text-green-700 bg-green-100 hover:bg-green-200 rounded-lg"
                            >
                              Resolve
                            </button>
                          </>
                        )}
                        {alert.post_id && (
                          <a 
                            href={`/admin/social/outbox`}
                            className="px-3 py-1.5 text-sm font-medium text-blue-700 bg-blue-100 hover:bg-blue-200 rounded-lg"
                          >
                            View Post
                          </a>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Stats Summary */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-8">
        <StatCard 
          label="Critical"
          value={alerts.filter(a => a.severity === 'critical' && !a.is_resolved).length}
          color="red"
        />
        <StatCard 
          label="High Priority"
          value={alerts.filter(a => a.severity === 'high' && !a.is_resolved).length}
          color="orange"
        />
        <StatCard 
          label="Acknowledged"
          value={alerts.filter(a => a.acknowledged_at && !a.is_resolved).length}
          color="yellow"
        />
        <StatCard 
          label="Resolved Today"
          value={alerts.filter(a => {
            if (!a.is_resolved || !a.resolved_at) return false;
            const resolved = new Date(a.resolved_at);
            const today = new Date();
            return resolved.toDateString() === today.toDateString();
          }).length}
          color="green"
        />
      </div>
    </div>
  );
}

function StatCard({ label, value, color }: { label: string; value: number; color: string }) {
  const colorClasses: Record<string, string> = {
    red: 'bg-red-50 text-red-900',
    orange: 'bg-orange-50 text-orange-900',
    yellow: 'bg-yellow-50 text-yellow-900',
    green: 'bg-green-50 text-green-900',
  };

  return (
    <div className={`p-4 rounded-xl ${colorClasses[color]}`}>
      <p className="text-2xl font-bold">{value}</p>
      <p className="text-sm opacity-80">{label}</p>
    </div>
  );
}
