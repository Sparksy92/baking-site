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
  about_content:                { section: 'Homestead Content',         label: 'About Us Content',             hint: 'About page biography/intro copy.', type: 'textarea' },
  faq_content:                  { section: 'Homestead Content',         label: 'FAQ Copy',                     hint: 'Plain text FAQ question/answer copy.', type: 'textarea' },
  pickup_instructions:          { section: 'Homestead Content',         label: 'Pickup Instructions',          hint: 'Instructions for customer custom order pickups.', type: 'textarea' },
  payment_instructions:         { section: 'Homestead Content',         label: 'Payment Instructions',         hint: 'Instructions on e-Transfer details and prepayment terms.', type: 'textarea' },
  allergy_disclaimer:           { section: 'Homestead Content',         label: 'Allergy Disclaimer',           hint: 'Disclaimer text regarding cross-contamination.', type: 'textarea' },
  preorder_instructions:        { section: 'Homestead Content',         label: 'Preorder Instructions',        hint: 'Information regarding lead times and ordering cycles.', type: 'textarea' },
};

const SECTION_ORDER = ['Brand Identity', 'SEO Defaults', 'Analytics & Verification', 'Store', 'Homestead Content'];

export default function AdminSettings() {
  const [settings, setSettings] = useState<{ key: string; value: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [dbLoading, setDbLoading] = useState(false);

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

  async function handleDbSetup(force: boolean = false) {
    if (force && !confirm('Are you sure you want to re-run database setup? This will re-apply default tables and seed items.')) {
      return;
    }
    setDbLoading(true);
    try {
      const res = await api.post<{ success: boolean; message: string }>('/api/admin/db/setup', { force });
      addToast(res.message || 'Database setup completed', 'success');
      
      // Reload settings if database was forced reset
      if (force) {
        const data = await api.get<{ key: string; value: string }[]>('/api/admin/settings');
        const dbMap = new Map(data.map(s => [s.key, s.value]));
        const fullSettings = Object.keys(settingsMeta).map(key => ({
          key,
          value: dbMap.get(key) || ''
        }));
        setSettings(fullSettings);
      }
    } catch (err: any) {
      console.error(err);
      addToast(err.message || 'Failed to initialize database', 'error');
    } finally {
      setDbLoading(false);
    }
  }

  if (loading) return <div className="text-gray-400">Loading...</div>;

  const settingsBySection = SECTION_ORDER.map((section) => ({
    section,
    items: settings.filter((s) => settingsMeta[s.key]?.section === section),
  }));

  return (
    <div className="max-w-2xl space-y-8 pb-12">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Settings</h1>
      </div>

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
                  {meta?.type === 'textarea' ? (
                    <textarea
                      id={`setting-${s.key}`}
                      value={s.value}
                      onChange={(e) => handleChange(s.key, e.target.value)}
                      rows={5}
                      className="w-full px-4 py-2.5 rounded-lg border border-gray-200 focus:border-brand outline-none text-sm resize-none"
                    />
                  ) : (
                    <input
                      id={`setting-${s.key}`}
                      type={meta?.type ?? 'text'}
                      value={s.value}
                      onChange={(e) => handleChange(s.key, e.target.value)}
                      className="w-full px-4 py-2.5 rounded-lg border border-gray-200 focus:border-brand outline-none text-sm"
                    />
                  )}
                  {meta?.hint && (
                    <p className="mt-1 text-xs text-gray-400">{meta.hint}</p>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      ))}

      <div className="flex items-center justify-between">
        <button onClick={handleSave} disabled={saving} className="bg-brand text-white px-6 py-2.5 rounded-lg font-medium text-sm hover:bg-brand/90 disabled:opacity-50 transition-colors shadow-sm">
          {saving ? 'Saving...' : 'Save Settings'}
        </button>
      </div>

      {/* Database Maintenance Section */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-3">Database Maintenance</h2>
        <p className="text-xs text-gray-500 mb-4 leading-relaxed">
          Initialize database tables, default categories, site settings, and menu items. Safe setup will skip initialization if the database is already configured. Re-run setup will safely re-apply schema definitions and missing seed values.
        </p>
        <div className="flex flex-wrap items-center gap-3">
          <button
            onClick={() => handleDbSetup(false)}
            disabled={dbLoading}
            className="bg-brand text-white px-5 py-2.5 rounded-lg font-semibold text-xs hover:bg-brand/90 disabled:opacity-50 transition-colors"
          >
            {dbLoading ? 'Processing...' : 'Run Setup (Safe)'}
          </button>
          <button
            onClick={() => handleDbSetup(true)}
            disabled={dbLoading}
            className="border border-brand/20 text-brand bg-brand/5 hover:bg-brand/10 px-5 py-2.5 rounded-lg font-semibold text-xs disabled:opacity-50 transition-colors"
          >
            {dbLoading ? 'Processing...' : 'Re-run Setup'}
          </button>
        </div>
      </div>
    </div>
  );
}
