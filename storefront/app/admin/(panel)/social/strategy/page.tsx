'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { addToast } from '@/lib/toast';
import { 
  TrendingUp, Calendar,
  BarChart3, Zap, Swords
} from 'lucide-react';

interface GaryVeeScore {
  gary_vee_grade: string;
  total_posts_last_7_days: number;
  daily_average: number;
  platform_breakdown: Record<string, number>;
  recommendations: string[];
}

interface DailyPlanRaw {
  date: string;
  total_target: number;
  total_needed: number;
  by_platform: Record<string, {
    target_posts: number;
    already_scheduled: number;
    needed: number;
    optimal_slots: string[];
    content_mix: Record<string, number>;
  }>;
}

interface DailyPlan {
  date: string;
  target_posts: number;
  recommended_times: string[];
  platform_mix: { platform: string; types: { type: string; pct: number }[] }[];
}

interface ContentMixHealth {
  status: 'healthy' | 'warning' | 'danger' | 'no_data' | 'insufficient_data';
  message: string;
  total_posts_analysed: number;
  promotional_pct: number;
  value_pct: number;
  type_breakdown: Record<string, number>;
  suggestions: string[];
  gary_vee_target: { value_pct: number; promotional_pct: number };
}

interface VelocityData {
  signal: 'green' | 'amber' | 'red';
  label: string;
  last_24h: number;
  last_7d: number;
  weekly_target: number;
  weekly_ratio: number;
}


export default function StrategyPage() {
  const [garyVee, setGaryVee] = useState<GaryVeeScore | null>(null);
  const [dailyPlan, setDailyPlan] = useState<DailyPlan | null>(null);
  const [mixHealth, setMixHealth] = useState<ContentMixHealth | null>(null);
  const [velocity, setVelocity] = useState<VelocityData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    try {
      setLoading(true);
      const [garyData, mixData, velocityData] = await Promise.all([
        api.get<GaryVeeScore>('/api/admin/social/strategy/gary-vee-score'),
        api.get<ContentMixHealth>('/api/admin/social/strategy/content-mix-health').catch(() => null),
        api.get<VelocityData>('/api/admin/social/strategy/velocity').catch(() => null),
      ]);
      setGaryVee(garyData);
      setMixHealth(mixData);
      setVelocity(velocityData);
      
      // Load today's plan
      const today = new Date().toISOString().split('T')[0];
      const rawPlan = await api.get<DailyPlanRaw>(`/api/admin/social/strategy/daily-plan?date=${today}`).catch(() => null);
      if (rawPlan && rawPlan.by_platform) {
        const allSlots: string[] = [];
        const platformMix: DailyPlan['platform_mix'] = [];
        for (const [plat, info] of Object.entries(rawPlan.by_platform)) {
          allSlots.push(...(info.optimal_slots || []).map(s => {
            const d = new Date(s);
            return `${plat} ${d.getUTCHours().toString().padStart(2,'0')}:${d.getUTCMinutes().toString().padStart(2,'0')}`;
          }));
          const topTypes = Object.entries(info.content_mix || {})
            .sort((a, b) => (b[1] as number) - (a[1] as number))
            .slice(0, 3)
            .map(([type, pct]) => ({ type, pct: Math.round((pct as number) <= 1 ? (pct as number) * 100 : (pct as number)) }));
          if (topTypes.length) platformMix.push({ platform: plat, types: topTypes });
        }
        setDailyPlan({
          date: rawPlan.date,
          target_posts: rawPlan.total_target,
          recommended_times: allSlots,
          platform_mix: platformMix,
        });
      } else {
        setDailyPlan(null);
      }
    } catch (err) {
      addToast('Failed to load strategy data', 'error');
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

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <BarChart3 className="h-6 w-6 text-purple-600" />
            Content Analytics
          </h1>
          <p className="text-gray-600 mt-1">
            Gary Vee performance metrics, velocity tracking, and content mix health. Configure per-platform scheduling on the <a href="/admin/social/platforms" className="text-purple-600 underline hover:text-purple-800">Platforms</a> page.
          </p>
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

      {/* Gary Vee Score Card */}
      {garyVee && (
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-purple-100 rounded-lg">
                <TrendingUp className="h-5 w-5 text-purple-600" />
              </div>
              <div>
                <h2 className="font-semibold text-gray-900">Gary Vee Performance Score</h2>
                <p className="text-sm text-gray-600">Based on last 7 days of posting activity</p>
              </div>
            </div>
            <div className={`px-4 py-2 rounded-full font-bold text-lg ${
              garyVee.gary_vee_grade === 'A' ? 'bg-green-100 text-green-700' :
              garyVee.gary_vee_grade === 'B' ? 'bg-blue-100 text-blue-700' :
              garyVee.gary_vee_grade === 'C' ? 'bg-yellow-100 text-yellow-700' :
              'bg-red-100 text-red-700'
            }`}>
              Grade {garyVee.gary_vee_grade}
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
              <h3 className="font-medium text-purple-900 mb-2">Recommendations to Improve</h3>
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
        </div>
      )}

      {/* ── Content Velocity Strip ── */}
      {velocity && (
        <div className={`rounded-xl border px-5 py-3 flex items-center gap-4 ${
          velocity.signal === 'green' ? 'bg-green-50 border-green-200' :
          velocity.signal === 'amber' ? 'bg-amber-50 border-amber-200' :
          'bg-red-50 border-red-200'
        }`}>
          <Zap className={`h-5 w-5 shrink-0 ${
            velocity.signal === 'green' ? 'text-green-600' :
            velocity.signal === 'amber' ? 'text-amber-600' : 'text-red-600'
          }`} />
          <div className="flex-1">
            <span className={`font-semibold text-sm ${
              velocity.signal === 'green' ? 'text-green-900' :
              velocity.signal === 'amber' ? 'text-amber-900' : 'text-red-900'
            }`}>
              Velocity: {velocity.label}
            </span>
            <span className="ml-3 text-sm text-gray-600">
              {velocity.last_7d} posts this week · target {velocity.weekly_target}
            </span>
          </div>
          <div className="w-32 h-2 bg-white/70 rounded-full overflow-hidden">
            <div
              className={`h-2 rounded-full ${
                velocity.signal === 'green' ? 'bg-green-500' :
                velocity.signal === 'amber' ? 'bg-amber-500' : 'bg-red-500'
              }`}
              style={{ width: `${Math.min(100, Math.round(velocity.weekly_ratio * 100))}%` }}
            />
          </div>
          <span className={`text-xs font-bold ${
            velocity.signal === 'green' ? 'text-green-700' :
            velocity.signal === 'amber' ? 'text-amber-700' : 'text-red-700'
          }`}>
            {Math.round(velocity.weekly_ratio * 100)}%
          </span>
        </div>
      )}

      {/* ── Jab Jab Jab Right Hook Enforcer ── */}
      {mixHealth && (
        <div className={`rounded-xl border p-5 space-y-3 ${
          mixHealth.status === 'danger'           ? 'bg-red-50 border-red-200' :
          mixHealth.status === 'warning'          ? 'bg-amber-50 border-amber-200' :
          mixHealth.status === 'no_data'          ? 'bg-gray-50 border-gray-200' :
          mixHealth.status === 'insufficient_data'? 'bg-gray-50 border-gray-200' :
          'bg-green-50 border-green-200'
        }`}>
          <div className="flex items-start gap-3">
            <Swords className={`h-5 w-5 mt-0.5 shrink-0 ${
              mixHealth.status === 'danger'            ? 'text-red-500' :
              mixHealth.status === 'warning'           ? 'text-amber-500' :
              mixHealth.status === 'no_data'           ? 'text-gray-400' :
              mixHealth.status === 'insufficient_data' ? 'text-gray-400' : 'text-green-600'
            }`} />
            <div className="flex-1">
              <h3 className={`font-semibold text-sm ${
                mixHealth.status === 'danger'            ? 'text-red-900' :
                mixHealth.status === 'warning'           ? 'text-amber-900' :
                mixHealth.status === 'no_data'           ? 'text-gray-600' :
                mixHealth.status === 'insufficient_data' ? 'text-gray-600' : 'text-green-900'
              }`}>
                Jab · Jab · Jab · Right Hook — Content Mix Health
              </h3>
              <p className={`text-sm mt-0.5 ${
                mixHealth.status === 'danger'            ? 'text-red-800' :
                mixHealth.status === 'warning'           ? 'text-amber-800' :
                mixHealth.status === 'no_data'           ? 'text-gray-500' :
                mixHealth.status === 'insufficient_data' ? 'text-gray-500' : 'text-green-800'
              }`}>
                {mixHealth.message}
              </p>
            </div>
          </div>

          {/* Visual ratio bars — only shown when there are enough posts to be meaningful */}
          {mixHealth.total_posts_analysed >= 5 && (
            <div className="space-y-1.5">
              <div className="flex items-center gap-2 text-xs">
                <span className="w-20 text-gray-600">Value</span>
                <div className="flex-1 h-2 bg-white/60 rounded-full overflow-hidden">
                  <div className="h-2 bg-green-500 rounded-full" style={{ width: `${mixHealth.value_pct}%` }} />
                </div>
                <span className="w-10 text-right font-bold text-green-700">{mixHealth.value_pct}%</span>
              </div>
              <div className="flex items-center gap-2 text-xs">
                <span className="w-20 text-gray-600">Promotional</span>
                <div className="flex-1 h-2 bg-white/60 rounded-full overflow-hidden">
                  <div className={`h-2 rounded-full ${
                    mixHealth.promotional_pct > 30 ? 'bg-red-500' : 'bg-amber-400'
                  }`} style={{ width: `${mixHealth.promotional_pct}%` }} />
                </div>
                <span className={`w-10 text-right font-bold ${
                  mixHealth.promotional_pct > 30 ? 'text-red-700' : 'text-amber-700'
                }`}>{mixHealth.promotional_pct}%</span>
              </div>
              <p className="text-xs text-gray-400">Target: 80% value · 20% promotional · {mixHealth.total_posts_analysed} posts analysed (last 30 days)</p>
            </div>
          )}

          {/* Suggestions */}
          {mixHealth.suggestions.length > 0 && (
            <ul className="space-y-1">
              {mixHealth.suggestions.map((s, i) => (
                <li key={i} className="text-xs text-gray-700 flex items-start gap-1.5">
                  <span className="text-gray-400 mt-0.5">•</span>{s}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {/* Daily Plan */}
      {dailyPlan && (
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-6 space-y-4">
          <div className="flex items-center gap-3">
            <Calendar className="h-5 w-5 text-blue-600" />
            <div>
              <h2 className="font-semibold text-blue-900">Today's Recommended Plan</h2>
              <p className="text-xs text-blue-600 mt-0.5">Enabled platforms only — adjust cadence on the <a href="/admin/social/platforms" className="underline hover:text-blue-800">Platforms</a> page.</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <p className="text-sm text-blue-700 mb-1">Target Posts Today</p>
              <p className="text-3xl font-bold text-blue-900">{dailyPlan.target_posts}</p>
              <p className="text-xs text-blue-500 mt-0.5">across {dailyPlan.platform_mix.length} active platform{dailyPlan.platform_mix.length !== 1 ? 's' : ''}</p>
            </div>
            <div>
              <p className="text-sm text-blue-700 mb-2">Optimal Posting Times</p>
              <div className="flex flex-wrap gap-1">
                {dailyPlan.recommended_times.map((time, i) => (
                  <span key={i} className="px-2 py-1 bg-white border border-blue-100 rounded text-xs text-blue-800 font-mono">
                    {time}
                  </span>
                ))}
              </div>
            </div>
          </div>

          {dailyPlan.platform_mix.length > 0 && (
            <div>
              <p className="text-sm text-blue-700 mb-2">Content Type Mix (from your strategy settings)</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                {dailyPlan.platform_mix.map(({ platform, types }) => (
                  <div key={platform} className="bg-white border border-blue-100 rounded-lg p-3">
                    <p className="text-xs font-semibold text-blue-900 capitalize mb-2">{platform}</p>
                    <div className="space-y-1">
                      {types.map(({ type, pct }) => (
                        <div key={type} className="flex items-center justify-between gap-2">
                          <span className="text-xs text-gray-600 capitalize">{type.replace('_', ' ')}</span>
                          <span className="text-xs font-medium text-blue-700 shrink-0">{pct}%</span>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

    </div>
  );
}
