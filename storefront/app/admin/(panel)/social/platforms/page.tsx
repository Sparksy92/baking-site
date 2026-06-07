'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { addToast } from '@/lib/toast';
import {
  CheckCircle, XCircle, Clock, AlertCircle, ChevronDown, ChevronUp, ExternalLink,
} from 'lucide-react';

type Platform = {
  id: number;
  platform: string;
  display_name: string;
  enabled: boolean;
  prompt_template: string;
  hashtag_bank: string;
  auto_publish: boolean;
  account_id: string | null;
  setup_status: 'not_configured' | 'pending_review' | 'active' | 'error';
  setup_notes: string | null;
};

type SaveState = Record<string, boolean>;

const STATUS_META: Record<Platform['setup_status'], { label: string; icon: React.ElementType; color: string }> = {
  active:          { label: 'Active',           icon: CheckCircle,  color: 'text-green-600' },
  pending_review:  { label: 'Pending Review',   icon: Clock,        color: 'text-yellow-600' },
  not_configured:  { label: 'Not Configured',   icon: XCircle,      color: 'text-gray-400' },
  error:           { label: 'Error',            icon: AlertCircle,  color: 'text-red-500' },
};

const PLATFORM_LINKS: Record<string, string> = {
  facebook:  'https://developers.facebook.com',
  instagram: 'https://developers.facebook.com',
  x:         'https://developer.twitter.com',
  linkedin:  'https://developer.linkedin.com',
  tiktok:    'https://developers.tiktok.com',
  youtube:   'https://console.cloud.google.com',
};

const PLATFORM_ICONS: Record<string, string> = {
  facebook:  '𝕗',
  instagram: '◉',
  x:         '𝕏',
  linkedin:  'in',
  tiktok:    '♪',
  youtube:   '▶',
};

export default function PlatformsPage() {
  const [platforms, setPlatforms] = useState<Platform[]>([]);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [saving, setSaving] = useState<SaveState>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get<Platform[]>('/api/admin/social/platforms')
      .then(setPlatforms)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  function toggle(platform: string) {
    setExpanded((prev) => ({ ...prev, [platform]: !prev[platform] }));
  }

  function update(platform: string, field: keyof Platform, value: unknown) {
    setPlatforms((prev) =>
      prev.map((p) => (p.platform === platform ? { ...p, [field]: value } : p))
    );
  }

  async function save(p: Platform) {
    setSaving((prev) => ({ ...prev, [p.platform]: true }));
    try {
      await api.patch(`/api/admin/social/platforms/${p.platform}`, {
        enabled: p.enabled,
        prompt_template: p.prompt_template,
        hashtag_bank: p.hashtag_bank,
        auto_publish: p.auto_publish,
        account_id: p.account_id,
      });
      addToast(`${p.display_name} saved`, 'success');
    } catch {
      addToast(`Failed to save ${p.display_name}`, 'error');
    } finally {
      setSaving((prev) => ({ ...prev, [p.platform]: false }));
    }
  }

  if (loading) return <div className="text-gray-400">Loading...</div>;

  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Social Platforms</h1>
        <p className="text-sm text-gray-500 mt-1">
          Enable platforms, customise prompts and hashtags, and control auto-publishing.
          Credentials are managed via environment variables — never entered here.
        </p>
      </div>

      <div className="space-y-3">
        {platforms.map((p) => {
          const isOpen = !!expanded[p.platform];
          const statusMeta = STATUS_META[p.setup_status];
          const StatusIcon = statusMeta.icon;
          const isYoutube = p.platform === 'youtube';

          return (
            <div key={p.platform} className="bg-white rounded-xl border border-gray-200 overflow-hidden">
              {/* Platform header row */}
              <div className="flex items-center gap-4 px-5 py-4">
                <div className="w-9 h-9 rounded-lg bg-gray-100 flex items-center justify-center font-bold text-sm text-gray-600 shrink-0">
                  {PLATFORM_ICONS[p.platform] ?? p.display_name[0]}
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-gray-900 text-sm">{p.display_name}</span>
                    <span className={`flex items-center gap-1 text-xs font-medium ${statusMeta.color}`}>
                      <StatusIcon size={12} />
                      {statusMeta.label}
                    </span>
                  </div>
                  {p.setup_notes && p.setup_status !== 'active' && (
                    <p className="text-xs text-gray-400 mt-0.5 truncate">{p.setup_notes}</p>
                  )}
                </div>

                {/* Enable toggle — disabled for youtube and unconfigured platforms */}
                <label className={`relative inline-flex items-center cursor-pointer ${isYoutube ? 'opacity-40 cursor-not-allowed' : ''}`}>
                  <input
                    type="checkbox"
                    className="sr-only peer"
                    checked={p.enabled}
                    disabled={isYoutube}
                    onChange={(e) => update(p.platform, 'enabled', e.target.checked)}
                  />
                  <div className="w-10 h-5 bg-gray-200 peer-checked:bg-brand rounded-full transition-colors after:content-[''] after:absolute after:top-0.5 after:left-0.5 after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:after:translate-x-5" />
                </label>

                <button
                  onClick={() => toggle(p.platform)}
                  className="text-gray-400 hover:text-gray-600 ml-1"
                  aria-label={isOpen ? 'Collapse' : 'Expand'}
                >
                  {isOpen ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                </button>
              </div>

              {/* Expanded config */}
              {isOpen && (
                <div className="border-t border-gray-100 px-5 py-5 space-y-5 bg-gray-50">

                  {/* Setup instructions banner */}
                  {p.setup_notes && (
                    <div className="bg-amber-50 border border-amber-100 rounded-lg p-3 flex items-start gap-2 text-sm text-amber-800">
                      <AlertCircle size={15} className="mt-0.5 shrink-0" />
                      <div>
                        <span>{p.setup_notes}</span>
                        {PLATFORM_LINKS[p.platform] && (
                          <a
                            href={PLATFORM_LINKS[p.platform]}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="ml-2 inline-flex items-center gap-1 underline text-amber-700 hover:text-amber-900"
                          >
                            Open developer portal <ExternalLink size={11} />
                          </a>
                        )}
                      </div>
                    </div>
                  )}

                  {!isYoutube && (
                    <>
                      {/* Prompt template */}
                      <div>
                        <label className="text-sm font-medium text-gray-700 block mb-1">
                          Custom Prompt Template
                        </label>
                        <textarea
                          rows={4}
                          value={p.prompt_template}
                          onChange={(e) => update(p.platform, 'prompt_template', e.target.value)}
                          className="w-full px-4 py-2.5 rounded-lg border border-gray-200 focus:border-brand outline-none text-sm resize-y bg-white"
                          placeholder={`Leave blank to use the built-in ${p.display_name} prompt template. The brand persona and voice are always applied on top.`}
                        />
                        <p className="mt-1 text-xs text-gray-400">
                          Override the AI instructions for {p.display_name} only. Brand persona is always injected regardless.
                        </p>
                      </div>

                      {/* Hashtag bank */}
                      <div>
                        <label className="text-sm font-medium text-gray-700 block mb-1">
                          Hashtag Bank
                        </label>
                        <textarea
                          rows={3}
                          value={p.hashtag_bank}
                          onChange={(e) => update(p.platform, 'hashtag_bank', e.target.value)}
                          className="w-full px-4 py-2.5 rounded-lg border border-gray-200 focus:border-brand outline-none text-sm resize-y bg-white font-mono"
                          placeholder={'#indigenous\n#streetwear\n#nativefashion'}
                        />
                        <p className="mt-1 text-xs text-gray-400">
                          One hashtag per line. These are appended to every generated post for this platform.
                        </p>
                      </div>

                      {/* Auto-publish toggle */}
                      <div className="flex items-center justify-between py-2 border-t border-gray-200">
                        <div>
                          <p className="text-sm font-medium text-gray-700">Auto-Publish</p>
                          <p className="text-xs text-gray-400">
                            When on, posts go live immediately when a blog is published. When off, posts land in the Outbox for manual approval.
                          </p>
                        </div>
                        <label className="relative inline-flex items-center cursor-pointer ml-4 shrink-0">
                          <input
                            type="checkbox"
                            className="sr-only peer"
                            checked={p.auto_publish}
                            onChange={(e) => update(p.platform, 'auto_publish', e.target.checked)}
                          />
                          <div className="w-10 h-5 bg-gray-200 peer-checked:bg-brand rounded-full transition-colors after:content-[''] after:absolute after:top-0.5 after:left-0.5 after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:after:translate-x-5" />
                        </label>
                      </div>

                      {/* X/Twitter cost warning */}
                      {p.platform === 'x' && (
                        <div className="bg-red-50 border border-red-100 rounded-lg p-3 text-sm text-red-700 flex gap-2">
                          <AlertCircle size={15} className="mt-0.5 shrink-0" />
                          X / Twitter API write access requires a paid Basic plan ($100/month). Enable only if your client has subscribed.
                        </div>
                      )}

                      {/* LinkedIn/TikTok setup reminder */}
                      {(p.platform === 'linkedin' || p.platform === 'tiktok') && (
                        <div className="bg-blue-50 border border-blue-100 rounded-lg p-3 text-sm text-blue-700 flex gap-2">
                          <Clock size={15} className="mt-0.5 shrink-0" />
                          {p.platform === 'tiktok'
                            ? 'TikTok app review can take 1–4 weeks. Submit your app at developers.tiktok.com now to avoid delays.'
                            : 'LinkedIn app review takes 1–2 weeks. Register at developer.linkedin.com and request Share on LinkedIn permissions.'}
                        </div>
                      )}

                      <button
                        onClick={() => save(p)}
                        disabled={saving[p.platform]}
                        className="bg-brand text-white px-5 py-2 rounded-lg font-medium text-sm hover:bg-brand/90 disabled:opacity-50"
                      >
                        {saving[p.platform] ? 'Saving...' : `Save ${p.display_name}`}
                      </button>
                    </>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
