'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { addToast } from '@/lib/toast';
import { 
  TrendingUp, Calendar, Target, Clock, Edit2, Save, X,
  CheckCircle, AlertCircle, BarChart3
} from 'lucide-react';

interface PostingStrategy {
  platforms: Record<string, {
    posts_per_day: number;
    best_times: string[];
    content_mix: Record<string, number>;
    enabled: boolean;
  }>;
}

interface GaryVeeScore {
  gary_vee_grade: string;
  total_posts_last_7_days: number;
  daily_average: number;
  platform_breakdown: Record<string, number>;
  recommendations: string[];
}

interface DailyPlan {
  date: string;
  platform: string;
  target_posts: number;
  recommended_times: string[];
  content_suggestions: string[];
}

const CONTENT_TYPES = [
  { key: 'educational', label: 'Educational', description: 'Tips, how-tos, industry insights' },
  { key: 'inspirational', label: 'Inspirational', description: 'Motivational quotes, success stories' },
  { key: 'entertaining', label: 'Entertaining', description: 'Humor, memes, light content' },
  { key: 'promotional', label: 'Promotional', description: 'Products, sales, direct CTAs' },
  { key: 'engagement', label: 'Engagement', description: 'Polls, questions, community' },
  { key: 'behind_scenes', label: 'Behind the Scenes', description: 'Process, team, raw content' },
];

export default function StrategyPage() {
  const [strategy, setStrategy] = useState<PostingStrategy | null>(null);
  const [garyVee, setGaryVee] = useState<GaryVeeScore | null>(null);
  const [dailyPlan, setDailyPlan] = useState<DailyPlan | null>(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<any>(null);

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    try {
      setLoading(true);
      const [strategyData, garyData] = await Promise.all([
        api.get<PostingStrategy>('/api/admin/social/strategy'),
        api.get<GaryVeeScore>('/api/admin/social/strategy/gary-vee-score'),
      ]);
      setStrategy(strategyData);
      setGaryVee(garyData);
      
      // Load today's plan
      const today = new Date().toISOString().split('T')[0];
      const plan = await api.get<DailyPlan>(`/api/admin/social/strategy/daily-plan?date=${today}`).catch(() => null);
      setDailyPlan(plan);
    } catch (err) {
      addToast('Failed to load strategy data', 'error');
    } finally {
      setLoading(false);
    }
  }

  async function saveStrategy(platform: string, data: any) {
    try {
      await api.put('/api/admin/social/strategy', { [platform]: data });
      addToast('Strategy updated', 'success');
      setEditing(null);
      loadData();
    } catch (err) {
      addToast('Failed to update strategy', 'error');
    }
  }

  const startEditing = (platform: string, config: any) => {
    setEditing(platform);
    setEditForm({ ...config });
  };

  const cancelEditing = () => {
    setEditing(null);
    setEditForm(null);
  };

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
            <Target className="h-6 w-6 text-purple-600" />
            Posting Strategy
          </h1>
          <p className="text-gray-600 mt-1">
            Configure your social media posting schedule and content mix
          </p>
        </div>
        {garyVee && (
          <div className="px-4 py-2 bg-purple-100 rounded-lg">
            <span className="text-sm text-purple-700 font-medium">Gary Vee Grade: </span>
            <span className="text-xl font-bold text-purple-700">{garyVee.gary_vee_grade}</span>
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

      {/* Daily Plan */}
      {dailyPlan && (
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-6">
          <div className="flex items-center gap-3 mb-4">
            <Calendar className="h-5 w-5 text-blue-600" />
            <h2 className="font-semibold text-blue-900">Today's Recommended Plan</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <p className="text-sm text-blue-700 mb-1">Target Posts</p>
              <p className="text-2xl font-bold text-blue-900">{dailyPlan.target_posts}</p>
            </div>
            <div>
              <p className="text-sm text-blue-700 mb-1">Best Times</p>
              <div className="flex flex-wrap gap-1">
                {dailyPlan.recommended_times.map((time, i) => (
                  <span key={i} className="px-2 py-1 bg-white rounded text-sm text-blue-800">
                    {time}
                  </span>
                ))}
              </div>
            </div>
            <div>
              <p className="text-sm text-blue-700 mb-1">Content Ideas</p>
              <ul className="text-sm text-blue-800">
                {dailyPlan.content_suggestions.slice(0, 2).map((suggestion, i) => (
                  <li key={i} className="flex items-start gap-1">
                    <span>•</span>
                    <span className="truncate">{suggestion}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      )}

      {/* Platform Strategies */}
      <div className="space-y-4">
        <h2 className="text-lg font-semibold text-gray-900">Platform Configuration</h2>
        
        {strategy && Object.entries(strategy.platforms).map(([platform, config]) => (
          <div key={platform} className="bg-white rounded-xl border border-gray-200 p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-gray-100 rounded-lg flex items-center justify-center text-lg">
                  {platform === 'instagram' && '◉'}
                  {platform === 'facebook' && '𝕗'}
                  {platform === 'linkedin' && 'in'}
                  {platform === 'tiktok' && '♪'}
                  {platform === 'youtube' && '▶'}
                  {platform === 'x' && '𝕏'}
                </div>
                <div>
                  <h3 className="font-semibold text-gray-900 capitalize">{platform}</h3>
                  <p className="text-sm text-gray-600">
                    {config.enabled ? (
                      <span className="flex items-center gap-1 text-green-600">
                        <CheckCircle className="h-4 w-4" /> Enabled
                      </span>
                    ) : (
                      <span className="flex items-center gap-1 text-gray-500">
                        <X className="h-4 w-4" /> Disabled
                      </span>
                    )}
                  </p>
                </div>
              </div>
              
              {editing === platform ? (
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => saveStrategy(platform, editForm)}
                    className="px-3 py-1.5 text-sm font-medium text-green-700 bg-green-100 hover:bg-green-200 rounded-lg flex items-center gap-1"
                  >
                    <Save className="h-4 w-4" /> Save
                  </button>
                  <button
                    onClick={cancelEditing}
                    className="px-3 py-1.5 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg flex items-center gap-1"
                  >
                    <X className="h-4 w-4" /> Cancel
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => startEditing(platform, config)}
                  className="px-3 py-1.5 text-sm font-medium text-blue-700 bg-blue-100 hover:bg-blue-200 rounded-lg flex items-center gap-1"
                >
                  <Edit2 className="h-4 w-4" /> Edit
                </button>
              )}
            </div>

            {editing === platform ? (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Posts Per Day
                    </label>
                    <input
                      type="number"
                      min={1}
                      max={50}
                      value={editForm.posts_per_day}
                      onChange={(e) => setEditForm({ ...editForm, posts_per_day: parseInt(e.target.value) })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Enabled
                    </label>
                    <select
                      value={editForm.enabled ? 'true' : 'false'}
                      onChange={(e) => setEditForm({ ...editForm, enabled: e.target.value === 'true' })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                    >
                      <option value="true">Yes</option>
                      <option value="false">No</option>
                    </select>
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Best Times to Post (comma-separated, 24h format)
                  </label>
                  <input
                    type="text"
                    value={editForm.best_times?.join(', ') || ''}
                    onChange={(e) => setEditForm({ 
                      ...editForm, 
                      best_times: e.target.value.split(',').map(t => t.trim()).filter(Boolean) 
                    })}
                    placeholder="09:00, 12:00, 18:00"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  />
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <p className="text-sm text-gray-600 mb-1">Posts Per Day</p>
                  <p className="text-2xl font-bold text-gray-900">{config.posts_per_day}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-600 mb-1">Best Times</p>
                  <div className="flex flex-wrap gap-1">
                    {config.best_times?.slice(0, 3).map((time, i) => (
                      <span key={i} className="px-2 py-1 bg-gray-100 rounded text-sm text-gray-700 flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {time}
                      </span>
                    ))}
                  </div>
                </div>
                <div>
                  <p className="text-sm text-gray-600 mb-1">Content Mix</p>
                  <div className="text-sm text-gray-700">
                    {Object.entries(config.content_mix || {}).slice(0, 2).map(([type, pct]) => (
                      <div key={type} className="flex justify-between">
                        <span className="capitalize">{type.replace('_', ' ')}:</span>
                        <span className="font-medium">{pct}%</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Content Mix Guidelines */}
      <div className="bg-gray-50 rounded-xl p-6">
        <h3 className="font-semibold text-gray-900 mb-4">Gary Vee Content Mix Guidelines</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {CONTENT_TYPES.map((type) => (
            <div key={type.key} className="bg-white p-4 rounded-lg border border-gray-200">
              <h4 className="font-medium text-gray-900">{type.label}</h4>
              <p className="text-sm text-gray-600 mt-1">{type.description}</p>
            </div>
          ))}
        </div>
        <div className="mt-4 p-4 bg-blue-50 rounded-lg">
          <p className="text-sm text-blue-800">
            <strong>Pro Tip:</strong> Gary Vee recommends the 80/20 rule - 80% value (educational, inspirational, entertaining), 
            20% promotional. High-volume posting works best when you provide consistent value.
          </p>
        </div>
      </div>
    </div>
  );
}
