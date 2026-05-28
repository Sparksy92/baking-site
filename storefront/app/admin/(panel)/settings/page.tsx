'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';

export default function AdminSettings() {
  const [settings, setSettings] = useState<{ key: string; value: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api.get<{ key: string; value: string }[]>('/api/admin/settings')
      .then(setSettings)
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
    } catch { /* Handle error */ }
    finally { setSaving(false); }
  }

  if (loading) return <div className="text-gray-400">Loading...</div>;

  return (
    <div className="max-w-2xl">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Settings</h1>
      <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-4">
        {settings.map((s) => (
          <div key={s.key}>
            <label className="text-sm font-medium text-gray-700 block mb-1">{s.key}</label>
            <input type="text" value={s.value} onChange={(e) => handleChange(s.key, e.target.value)} className="w-full px-4 py-2.5 rounded-lg border border-gray-200 focus:border-brand outline-none text-sm" />
          </div>
        ))}
        <button onClick={handleSave} disabled={saving} className="mt-4 bg-brand text-white px-6 py-2.5 rounded-lg font-medium text-sm hover:bg-brand/90 disabled:opacity-50">
          {saving ? 'Saving...' : 'Save Settings'}
        </button>
      </div>
    </div>
  );
}
