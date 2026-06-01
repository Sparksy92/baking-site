'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { addToast } from '@/lib/toast';

const settingsMeta: Record<string, { label: string; hint?: string; type?: string }> = {
  brand_name: { label: 'Brand Name', hint: 'The name of your store (overrides .env).' },
  store_announcement: { label: 'Store Announcement', hint: 'Displayed at the top of the site. Leave empty to hide.' },
  order_number_prefix: { label: 'Order Number Prefix', hint: 'e.g. ELD, CC, MM' },
  shipping_flat_rate_cents: { label: 'Flat Rate Shipping (cents)', hint: 'e.g. 1200 = $12.00', type: 'number' },
  shipping_free_threshold_cents: { label: 'Free Shipping Threshold (cents)', hint: 'e.g. 15000 = $150.00', type: 'number' },
  tax_rate: { label: 'Tax Rate', hint: 'e.g. 0.13 = 13% HST', type: 'number' },
  analytics_id: { label: 'Google Analytics ID', hint: 'GA4 Measurement ID, e.g. G-XXXXXXXXXX. Leave empty to disable.' },
};

export default function AdminSettings() {
  const [settings, setSettings] = useState<{ key: string; value: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api.get<{ key: string; value: string }[]>('/api/admin/settings')
      .then((data) => {
        const dbMap = new Map(data.map(s => [s.key, s.value]));
        const fullSettings = Object.keys(settingsMeta).map(key => ({
          key,
          value: dbMap.get(key) || ''
        }));
        setSettings(fullSettings);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  function handleChange(key: string, value: string) {
    setSettings((prev) => prev.map((s) => (s.key === key ? { ...s, value } : s)));
  }

  async function handleSave() {
    setSaving(true);
    try {
      await api.put('/api/admin/settings', settings.map((s) => ({ key: s.key, value: s.value })));
      addToast('Settings saved', 'success');
    } catch {
      addToast('Failed to save settings', 'error');
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <div className="text-gray-400">Loading...</div>;

  return (
    <div className="max-w-2xl">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Settings</h1>
      <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-5">
        {settings.map((s) => {
          const meta = settingsMeta[s.key];
          return (
            <div key={s.key}>
              <label htmlFor={`setting-${s.key}`} className="text-sm font-medium text-gray-700 block mb-1">
                {meta?.label ?? s.key}
              </label>
              <input
                id={`setting-${s.key}`}
                type={meta?.type ?? 'text'}
                value={s.value}
                onChange={(e) => handleChange(s.key, e.target.value)}
                className="w-full px-4 py-2.5 rounded-lg border border-gray-200 focus:border-brand outline-none text-sm"
              />
              {meta?.hint && (
                <p className="mt-1 text-xs text-gray-400">{meta.hint}</p>
              )}
            </div>
          );
        })}
        <button onClick={handleSave} disabled={saving} className="mt-4 bg-brand text-white px-6 py-2.5 rounded-lg font-medium text-sm hover:bg-brand/90 disabled:opacity-50">
          {saving ? 'Saving...' : 'Save Settings'}
        </button>
      </div>
    </div>
  );
}
