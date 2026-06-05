'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { addToast } from '@/lib/toast';

type SettingMeta = { label: string; hint?: string; type?: string; section: string };

const settingsMeta: Record<string, SettingMeta> = {
  brand_name:                   { section: 'Brand Identity',            label: 'Brand Name',                   hint: 'The display name of your store.' },
  brand_tagline:                { section: 'Brand Identity',            label: 'Tagline',                      hint: 'Short brand tagline shown in hero and metadata.' },
  store_announcement:           { section: 'Brand Identity',            label: 'Announcement Bar Text',        hint: 'Shown at the top of the site. Leave empty to hide.' },
  default_og_image:             { section: 'SEO Defaults',              label: 'Default Social Share Image',   hint: 'Absolute URL or /path used when no page-specific OG image is set.' },
  twitter_handle:               { section: 'SEO Defaults',              label: 'Twitter / X Handle',           hint: 'Without @, e.g. terraSupplyCo' },
  brand_abbreviation:           { section: 'SEO Defaults',              label: 'Brand Abbreviation',           hint: 'Short uppercase watermark shown on hero, e.g. TERRA, DFL, CC.' },
  blog_section_name:            { section: 'SEO Defaults',              label: 'Blog Section Name',            hint: 'Name for the blog/articles section, e.g. Field Notes, Blog, News.' },
  store_domain:                 { section: 'SEO Defaults',              label: 'Store Domain',                 hint: 'Full canonical domain including https://, e.g. https://yourbrand.com' },
  analytics_id:                 { section: 'Analytics & Verification',  label: 'Google Analytics ID',          hint: 'GA4 Measurement ID, e.g. G-XXXXXXXXXX. Leave empty to disable.' },
  google_verification:          { section: 'Analytics & Verification',  label: 'Google Search Console Token', hint: 'Meta tag verification token from Google Search Console.' },
  facebook_pixel_id:            { section: 'Analytics & Verification',  label: 'Facebook Pixel ID',            hint: 'Meta Pixel ID for Facebook/Instagram ads tracking.' },
  order_number_prefix:          { section: 'Store',                     label: 'Order Number Prefix',          hint: 'e.g. ELD, CC, DFL' },
  shipping_flat_rate_cents:     { section: 'Store',                     label: 'Flat Rate Shipping (cents)',   hint: 'e.g. 1200 = $12.00', type: 'number' },
  shipping_free_threshold_cents:{ section: 'Store',                     label: 'Free Shipping Threshold (cents)', hint: 'e.g. 7500 = $75.00', type: 'number' },
  tax_rate:                     { section: 'Store',                     label: 'Tax Rate',                     hint: 'e.g. 0.13 = 13% HST', type: 'number' },
};

const SECTION_ORDER = ['Brand Identity', 'SEO Defaults', 'Analytics & Verification', 'Store'];

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

  const settingsBySection = SECTION_ORDER.map((section) => ({
    section,
    items: settings.filter((s) => settingsMeta[s.key]?.section === section),
  }));

  return (
    <div className="max-w-2xl space-y-8">
      <h1 className="text-2xl font-bold text-gray-900">Settings</h1>
      {settingsBySection.map(({ section, items }) => (
        <div key={section} className="bg-white rounded-xl border border-gray-200 p-6">
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-5">{section}</h2>
          <div className="space-y-5">
            {items.map((s) => {
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
          </div>
        </div>
      ))}
      <button onClick={handleSave} disabled={saving} className="bg-brand text-white px-6 py-2.5 rounded-lg font-medium text-sm hover:bg-brand/90 disabled:opacity-50">
        {saving ? 'Saving...' : 'Save Settings'}
      </button>
    </div>
  );
}
