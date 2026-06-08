'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { addToast } from '@/lib/toast';
import { Bot, Info } from 'lucide-react';

type Persona = {
  id?: number;
  name: string;
  voice: string;
  audience: string;
  values_text: string;
  words_to_use: string;
  words_to_avoid: string;
};

const EMPTY: Persona = {
  name: 'Default',
  voice: '',
  audience: '',
  values_text: '',
  words_to_use: '',
  words_to_avoid: '',
};

type FieldMeta = { label: string; hint: string; rows: number };

const FIELDS: { key: keyof Persona; meta: FieldMeta }[] = [
  {
    key: 'voice',
    meta: {
      label: 'Brand Voice',
      hint: 'Describe how your brand speaks. e.g. "Bold and direct. We speak for the land. Unapologetically Indigenous."',
      rows: 3,
    },
  },
  {
    key: 'audience',
    meta: {
      label: 'Target Audience',
      hint: 'Who are you writing for? e.g. "Indigenous youth aged 18–35 who value culture, community, and authenticity."',
      rows: 2,
    },
  },
  {
    key: 'values_text',
    meta: {
      label: 'Brand Values',
      hint: 'Core values to weave into every piece of content. e.g. "Land, sovereignty, community, resilience, pride."',
      rows: 2,
    },
  },
  {
    key: 'words_to_use',
    meta: {
      label: 'Words & Phrases to Use',
      hint: 'Comma-separated. e.g. "authentic, sovereign, rooted, community, reclaim"',
      rows: 2,
    },
  },
  {
    key: 'words_to_avoid',
    meta: {
      label: 'Words & Phrases to Never Use',
      hint: 'Comma-separated. These will be explicitly excluded from all AI-generated content. e.g. "exotic, tribal, primitive, discount, cheap"',
      rows: 2,
    },
  },
];

export default function PersonaPage() {
  const [persona, setPersona] = useState<Persona>(EMPTY);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api.get<Persona>('/api/admin/social/persona')
      .then(setPersona)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  function handleChange(key: keyof Persona, value: string) {
    setPersona((prev) => ({ ...prev, [key]: value }));
  }

  async function handleSave() {
    setSaving(true);
    try {
      await api.patch('/api/admin/social/persona', {
        name: persona.name,
        voice: persona.voice,
        audience: persona.audience,
        values_text: persona.values_text,
        words_to_use: persona.words_to_use,
        words_to_avoid: persona.words_to_avoid,
      });
      addToast('Brand persona saved', 'success');
    } catch {
      addToast('Failed to save persona', 'error');
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <div className="text-gray-400">Loading...</div>;

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <div className="flex items-center gap-2 mb-1">
          <Bot size={20} className="text-brand" />
          <h1 className="text-2xl font-bold text-gray-900">Brand Persona</h1>
        </div>
        <p className="text-sm text-gray-500">
          Define your brand&apos;s voice and identity. This persona is injected into every AI content
          generation call — blog posts, social captions, and all platforms. Change it once, it
          affects everything.
        </p>
      </div>

      <div className="bg-blue-50 border border-blue-100 rounded-xl p-4 flex gap-3 text-sm text-blue-700">
        <Info size={16} className="mt-0.5 shrink-0" />
        <span>
          The more specific you are here, the better your AI-generated content will sound. Vague
          personas produce generic content. Specific personas produce on-brand content.
        </span>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-6">
        <div>
          <label className="text-sm font-medium text-gray-700 block mb-1">Persona Name</label>
          <input
            type="text"
            value={persona.name}
            onChange={(e) => handleChange('name', e.target.value)}
            className="w-full px-4 py-2.5 rounded-lg border border-gray-200 focus:border-brand outline-none text-sm"
            placeholder="e.g. Default, Elder Brand Voice, Summer Campaign"
          />
          <p className="mt-1 text-xs text-gray-400">Internal label only. Not used in AI prompts.</p>
        </div>

        {FIELDS.map(({ key, meta }) => (
          <div key={key}>
            <label className="text-sm font-medium text-gray-700 block mb-1">{meta.label}</label>
            <textarea
              value={(persona[key] as string) ?? ''}
              onChange={(e) => handleChange(key, e.target.value)}
              rows={meta.rows}
              className="w-full px-4 py-2.5 rounded-lg border border-gray-200 focus:border-brand outline-none text-sm resize-y"
              placeholder={meta.hint}
            />
            <p className="mt-1 text-xs text-gray-400">{meta.hint}</p>
          </div>
        ))}
      </div>

      <button
        onClick={handleSave}
        disabled={saving}
        className="bg-brand text-white px-6 py-2.5 rounded-lg font-medium text-sm hover:bg-brand/90 disabled:opacity-50"
      >
        {saving ? 'Saving...' : 'Save Persona'}
      </button>
    </div>
  );
}
