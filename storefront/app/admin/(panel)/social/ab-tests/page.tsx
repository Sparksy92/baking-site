'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { addToast } from '@/lib/toast';
import { 
  BarChart3, Plus, Play, Pause, RotateCcw, CheckCircle, XCircle,
  Clock, Target, TrendingUp, AlertCircle, ChevronDown, ChevronUp
} from 'lucide-react';
import Link from 'next/link';

interface ABVariant {
  id: number;
  variant_name: string;
  content: string;
  image_url: string | null;
  engagement_score: number | null;
  reach_count: number | null;
  published_at: string | null;
}

interface ABTest {
  id: number;
  name: string;
  platform: string;
  test_type: 'headline' | 'image' | 'cta' | 'time';
  status: 'draft' | 'running' | 'completed' | 'cancelled';
  metric_criteria: string;
  duration_hours: number;
  started_at: string | null;
  completed_at: string | null;
  winner_variant_id: number | null;
  created_by: string;
  created_at: string;
  variants: ABVariant[];
}

const PLATFORM_ICONS: Record<string, string> = {
  instagram: '◉',
  facebook: '𝕗',
  linkedin: 'in',
  tiktok: '♪',
  youtube: '▶',
  x: '𝕏',
};

const TEST_TYPE_LABELS: Record<string, string> = {
  headline: 'Headline Test',
  image: 'Image Test',
  cta: 'Call-to-Action Test',
  time: 'Timing Test',
};

const STATUS_STYLES: Record<string, string> = {
  draft: 'bg-gray-100 text-gray-800',
  running: 'bg-green-100 text-green-800',
  completed: 'bg-blue-100 text-blue-800',
  cancelled: 'bg-red-100 text-red-800',
};

export default function ABTestsPage() {
  const [tests, setTests] = useState<ABTest[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [expandedTest, setExpandedTest] = useState<number | null>(null);

  // Form state
  const [formData, setFormData] = useState({
    name: '',
    platform: 'instagram',
    test_type: 'headline',
    metric_criteria: 'engagement',
    duration_hours: 48,
    variants: [
      { variant_name: 'Variant A', content: '', image_url: '' },
      { variant_name: 'Variant B', content: '', image_url: '' },
    ],
  });

  useEffect(() => {
    loadTests();
  }, []);

  async function loadTests() {
    try {
      setLoading(true);
      const data = await api.get<ABTest[] | { tests: ABTest[] }>('/api/admin/social/ab-tests');
      setTests(Array.isArray(data) ? data : data.tests ?? []);
    } catch (err) {
      addToast('Failed to load A/B tests', 'error');
    } finally {
      setLoading(false);
    }
  }

  async function createTest(e: React.FormEvent) {
    e.preventDefault();
    try {
      await api.post('/api/admin/social/ab-tests', formData);
      addToast('A/B test created', 'success');
      setShowCreateModal(false);
      setFormData({
        name: '',
        platform: 'instagram',
        test_type: 'headline',
        metric_criteria: 'engagement',
        duration_hours: 48,
        variants: [
          { variant_name: 'Variant A', content: '', image_url: '' },
          { variant_name: 'Variant B', content: '', image_url: '' },
        ],
      });
      loadTests();
    } catch (err) {
      addToast('Failed to create A/B test', 'error');
    }
  }

  async function startTest(id: number) {
    try {
      await api.post(`/api/admin/social/ab-tests/${id}/start`, {});
      addToast('A/B test started', 'success');
      loadTests();
    } catch (err) {
      addToast('Failed to start test', 'error');
    }
  }

  async function cancelTest(id: number) {
    if (!confirm('Are you sure you want to cancel this test?')) return;
    try {
      await api.post(`/api/admin/social/ab-tests/${id}/cancel`, {});
      addToast('A/B test cancelled', 'success');
      loadTests();
    } catch (err) {
      addToast('Failed to cancel test', 'error');
    }
  }

  const addVariant = () => {
    if (formData.variants.length >= 4) {
      addToast('Maximum 4 variants allowed', 'error');
      return;
    }
    setFormData({
      ...formData,
      variants: [...formData.variants, { variant_name: `Variant ${String.fromCharCode(67 + formData.variants.length - 2)}`, content: '', image_url: '' }],
    });
  };

  const removeVariant = (index: number) => {
    if (formData.variants.length <= 2) {
      addToast('Minimum 2 variants required', 'error');
      return;
    }
    setFormData({
      ...formData,
      variants: formData.variants.filter((_, i) => i !== index),
    });
  };

  const updateVariant = (index: number, field: string, value: string) => {
    const newVariants = [...formData.variants];
    newVariants[index] = { ...newVariants[index], [field]: value };
    setFormData({ ...formData, variants: newVariants });
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <BarChart3 className="h-6 w-6 text-blue-600" />
            A/B Testing
          </h1>
          <p className="text-gray-600 mt-1">
            Test different content variations to optimize performance
          </p>
        </div>
        <button
          onClick={() => setShowCreateModal(true)}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-2"
        >
          <Plus className="h-5 w-5" />
          Create Test
        </button>
      </div>

      {/* Info Box */}
      <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
        <div className="flex items-start gap-3">
          <AlertCircle className="h-5 w-5 text-blue-600 mt-0.5" />
          <div>
            <h3 className="font-medium text-blue-900">How A/B Testing Works</h3>
            <p className="text-sm text-blue-800 mt-1">
              Create multiple variations of your post and let the system automatically test which performs better.
              Variants are scheduled at optimal times and the winner is determined by your chosen metric 
              (engagement, reach, clicks, or revenue).
            </p>
          </div>
        </div>
      </div>

      {/* Tests List */}
      {loading ? (
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        </div>
      ) : tests.length === 0 ? (
        <div className="text-center py-12 bg-gray-50 rounded-xl">
          <BarChart3 className="mx-auto h-12 w-12 text-gray-400" />
          <h3 className="mt-4 text-lg font-medium text-gray-900">No A/B tests yet</h3>
          <p className="mt-2 text-gray-600">Create your first test to optimize your content</p>
          <button
            onClick={() => setShowCreateModal(true)}
            className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            Create Test
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          {tests.map((test) => (
            <div key={test.id} className="bg-white rounded-xl border border-gray-200 overflow-hidden">
              {/* Test Header */}
              <div 
                className="p-4 cursor-pointer hover:bg-gray-50"
                onClick={() => setExpandedTest(expandedTest === test.id ? null : test.id)}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span className="text-2xl">{PLATFORM_ICONS[test.platform] || '◉'}</span>
                    <div>
                      <h3 className="font-semibold text-gray-900">{test.name}</h3>
                      <div className="flex items-center gap-2 text-sm text-gray-600">
                        <span>{TEST_TYPE_LABELS[test.test_type]}</span>
                        <span>•</span>
                        <span className="capitalize">{test.platform}</span>
                        <span>•</span>
                        <span className="flex items-center gap-1">
                          <Target className="h-3 w-3" />
                          {test.metric_criteria}
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className={`px-3 py-1 rounded-full text-sm font-medium ${STATUS_STYLES[test.status]}`}>
                      {test.status.charAt(0).toUpperCase() + test.status.slice(1)}
                    </span>
                    {expandedTest === test.id ? (
                      <ChevronUp className="h-5 w-5 text-gray-400" />
                    ) : (
                      <ChevronDown className="h-5 w-5 text-gray-400" />
                    )}
                  </div>
                </div>
              </div>

              {/* Expanded Details */}
              {expandedTest === test.id && (
                <div className="border-t border-gray-200 p-4">
                  {/* Test Info */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                    <div>
                      <p className="text-sm text-gray-600">Duration</p>
                      <p className="font-medium">{test.duration_hours} hours</p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-600">Variants</p>
                      <p className="font-medium">{test.variants.length}</p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-600">Created</p>
                      <p className="font-medium">{new Date(test.created_at).toLocaleDateString()}</p>
                    </div>
                    {test.winner_variant_id && (
                      <div>
                        <p className="text-sm text-gray-600">Winner</p>
                        <p className="font-medium text-green-600 flex items-center gap-1">
                          <CheckCircle className="h-4 w-4" />
                          Variant {test.variants.find(v => v.id === test.winner_variant_id)?.variant_name || 'TBD'}
                        </p>
                      </div>
                    )}
                  </div>

                  {/* Variants */}
                  <h4 className="font-medium text-gray-900 mb-3">Variants</h4>
                  <div className="space-y-3">
                    {test.variants.map((variant, index) => (
                      <div 
                        key={variant.id} 
                        className={`p-4 rounded-lg border ${
                          test.winner_variant_id === variant.id 
                            ? 'border-green-300 bg-green-50' 
                            : 'border-gray-200 bg-gray-50'
                        }`}
                      >
                        <div className="flex items-start gap-3">
                          <div className="font-medium text-gray-700 min-w-[80px]">
                            {variant.variant_name}
                            {test.winner_variant_id === variant.id && (
                              <span className="ml-2 px-2 py-0.5 bg-green-200 text-green-800 text-xs rounded-full">
                                Winner
                              </span>
                            )}
                          </div>
                          <div className="flex-1">
                            <p className="text-gray-900">{variant.content}</p>
                            {variant.image_url && (
                              <img 
                                src={variant.image_url} 
                                alt="" 
                                className="mt-2 h-20 w-20 object-cover rounded"
                              />
                            )}
                          </div>
                          {variant.engagement_score !== null && (
                            <div className="text-right">
                              <p className="text-lg font-bold text-gray-900">
                                {variant.engagement_score.toFixed(1)}
                              </p>
                              <p className="text-xs text-gray-600">Engagement Score</p>
                              {variant.reach_count && (
                                <p className="text-xs text-gray-600">
                                  {variant.reach_count.toLocaleString()} reach
                                </p>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Actions */}
                  <div className="mt-4 flex items-center gap-3">
                    {test.status === 'draft' && (
                      <button
                        onClick={() => startTest(test.id)}
                        className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 flex items-center gap-2"
                      >
                        <Play className="h-4 w-4" />
                        Start Test
                      </button>
                    )}
                    {test.status === 'running' && (
                      <button
                        onClick={() => cancelTest(test.id)}
                        className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 flex items-center gap-2"
                      >
                        <Pause className="h-4 w-4" />
                        Cancel
                      </button>
                    )}
                    {test.status === 'completed' && test.winner_variant_id && (
                      <Link
                        href={`/admin/social/outbox?create=true&content=${encodeURIComponent(test.variants.find(v => v.id === test.winner_variant_id)?.content || '')}`}
                        className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-2"
                      >
                        <TrendingUp className="h-4 w-4" />
                        Use Winner
                      </Link>
                    )}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Create Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold text-gray-900">Create A/B Test</h2>
              <button
                onClick={() => setShowCreateModal(false)}
                className="p-2 hover:bg-gray-100 rounded-lg"
              >
                <XCircle className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={createTest} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Test Name</label>
                <input
                  type="text"
                  required
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="e.g., Summer Collection Headline Test"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Platform</label>
                  <select
                    value={formData.platform}
                    onChange={(e) => setFormData({ ...formData, platform: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  >
                    <option value="instagram">Instagram</option>
                    <option value="facebook">Facebook</option>
                    <option value="linkedin">LinkedIn</option>
                    <option value="tiktok">TikTok</option>
                    <option value="x">X/Twitter</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Test Type</label>
                  <select
                    value={formData.test_type}
                    onChange={(e) => setFormData({ ...formData, test_type: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  >
                    <option value="headline">Headline</option>
                    <option value="image">Image</option>
                    <option value="cta">Call-to-Action</option>
                    <option value="time">Timing</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Success Metric</label>
                  <select
                    value={formData.metric_criteria}
                    onChange={(e) => setFormData({ ...formData, metric_criteria: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  >
                    <option value="engagement">Engagement</option>
                    <option value="reach">Reach</option>
                    <option value="clicks">Clicks</option>
                    <option value="revenue">Revenue</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Duration (hours)</label>
                  <input
                    type="number"
                    min={24}
                    max={168}
                    value={formData.duration_hours}
                    onChange={(e) => setFormData({ ...formData, duration_hours: parseInt(e.target.value) })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  />
                </div>
              </div>

              {/* Variants */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="block text-sm font-medium text-gray-700">Variants</label>
                  <button
                    type="button"
                    onClick={addVariant}
                    className="text-sm text-blue-600 hover:text-blue-700"
                  >
                    + Add Variant
                  </button>
                </div>
                <div className="space-y-3">
                  {formData.variants.map((variant, index) => (
                    <div key={index} className="p-3 border border-gray-200 rounded-lg">
                      <div className="flex items-center gap-2 mb-2">
                        <input
                          type="text"
                          value={variant.variant_name}
                          onChange={(e) => updateVariant(index, 'variant_name', e.target.value)}
                          className="font-medium text-sm border-none p-0 focus:ring-0"
                        />
                        {index >= 2 && (
                          <button
                            type="button"
                            onClick={() => removeVariant(index)}
                            className="text-red-600 hover:text-red-700 text-sm"
                          >
                            Remove
                          </button>
                        )}
                      </div>
                      <textarea
                        value={variant.content}
                        onChange={(e) => updateVariant(index, 'content', e.target.value)}
                        placeholder={`Enter ${formData.test_type === 'headline' ? 'headline' : 'content'} for ${variant.variant_name}...`}
                        required
                        rows={2}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                      />
                      <input
                        type="url"
                        value={variant.image_url}
                        onChange={(e) => updateVariant(index, 'image_url', e.target.value)}
                        placeholder="Image URL (optional)"
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm mt-2"
                      />
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                >
                  Create Test
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
