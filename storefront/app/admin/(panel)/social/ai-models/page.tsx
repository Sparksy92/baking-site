'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { addToast } from '@/lib/toast';
import { Bot, ChevronDown, ChevronUp, RotateCcw, Save, CheckCircle, AlertTriangle, Info, Zap } from 'lucide-react';

type AIModelConfig = {
  task_type: string;
  task_label: string;
  provider: string;
  model: string;
  temperature: number;
  max_tokens: number;
  is_db_override: boolean;
  enabled: boolean;
  error?: string;
};

type ProvidersResponse = {
  available: string[];
  labels: Record<string, string>;
  all_providers: string[];
};

const PROVIDER_COLORS: Record<string, string> = {
  openrouter: 'bg-violet-100 text-violet-800 border-violet-200',
  openai:     'bg-green-100 text-green-800 border-green-200',
  anthropic:  'bg-orange-100 text-orange-800 border-orange-200',
  gemini:     'bg-blue-100 text-blue-800 border-blue-200',
  unconfigured: 'bg-gray-100 text-gray-500 border-gray-200',
};

const PROVIDER_DOTS: Record<string, string> = {
  openrouter: 'bg-violet-500',
  openai:     'bg-green-500',
  anthropic:  'bg-orange-500',
  gemini:     'bg-blue-500',
};

const MODEL_SUGGESTIONS: Record<string, string[]> = {
  openrouter: [
    'openai/gpt-4o',
    'openai/gpt-4o-mini',
    'anthropic/claude-3-5-sonnet',
    'anthropic/claude-3-haiku',
    'google/gemini-pro-1.5',
    'meta-llama/llama-3.1-70b-instruct',
    'mistralai/mistral-large',
  ],
  openai: [
    'gpt-4o',
    'gpt-4o-mini',
    'gpt-4-turbo',
    'gpt-3.5-turbo',
  ],
  anthropic: [
    'claude-3-5-sonnet-20241022',
    'claude-3-opus-20240229',
    'claude-3-haiku-20240307',
  ],
  gemini: [
    'gemini-1.5-pro',
    'gemini-1.5-flash',
    'gemini-1.0-pro',
  ],
};

const TEMP_HINTS: Record<string, string> = {
  '0.0–0.3': 'Factual / deterministic',
  '0.4–0.6': 'Balanced',
  '0.7–0.9': 'Creative (recommended for social)',
  '1.0–1.5': 'Very creative / unpredictable',
};

export default function AIModelsPage() {
  const [configs, setConfigs] = useState<AIModelConfig[]>([]);
  const [providerInfo, setProviderInfo] = useState<ProvidersResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [expandedTask, setExpandedTask] = useState<string | null>(null);
  const [edits, setEdits] = useState<Record<string, Partial<AIModelConfig>>>({});
  const [saving, setSaving] = useState<Record<string, boolean>>({});
  const [resetting, setResetting] = useState<Record<string, boolean>>({});

  useEffect(() => {
    loadAll();
  }, []);

  async function loadAll() {
    setLoading(true);
    try {
      const [cfgData, provData] = await Promise.all([
        api.get<{ configs: AIModelConfig[]; provider_labels: Record<string, string> }>('/api/admin/social/ai-models'),
        api.get<ProvidersResponse>('/api/admin/social/ai-models/providers'),
      ]);
      setConfigs(cfgData.configs);
      setProviderInfo(provData);
    } catch {
      addToast('Failed to load AI model configs', 'error');
    } finally {
      setLoading(false);
    }
  }

  function getEdit(task_type: string, field: keyof AIModelConfig, fallback: any) {
    return edits[task_type]?.[field] ?? fallback;
  }

  function setEdit(task_type: string, field: keyof AIModelConfig, value: any) {
    setEdits((prev) => ({
      ...prev,
      [task_type]: { ...(prev[task_type] ?? {}), [field]: value },
    }));
  }

  async function save(cfg: AIModelConfig) {
    const patch = edits[cfg.task_type];
    if (!patch || Object.keys(patch).length === 0) {
      addToast('No changes to save', 'error');
      return;
    }
    setSaving((p) => ({ ...p, [cfg.task_type]: true }));
    try {
      await api.patch(`/api/admin/social/ai-models/${cfg.task_type}`, patch);
      addToast(`${cfg.task_label} updated`, 'success');
      setEdits((p) => { const n = { ...p }; delete n[cfg.task_type]; return n; });
      await loadAll();
    } catch (e: any) {
      addToast(e?.detail ?? 'Save failed', 'error');
    } finally {
      setSaving((p) => ({ ...p, [cfg.task_type]: false }));
    }
  }

  async function reset(cfg: AIModelConfig) {
    setResetting((p) => ({ ...p, [cfg.task_type]: true }));
    try {
      await api.patch(`/api/admin/social/ai-models/${cfg.task_type}`, {
        provider: 'auto',
        model: '',
      });
      addToast(`${cfg.task_label} reset to defaults`, 'success');
      setEdits((p) => { const n = { ...p }; delete n[cfg.task_type]; return n; });
      await loadAll();
    } catch (e: any) {
      addToast(e?.detail ?? 'Reset failed', 'error');
    } finally {
      setResetting((p) => ({ ...p, [cfg.task_type]: false }));
    }
  }

  function tempHint(t: number): string {
    if (t <= 0.3) return 'Factual / deterministic';
    if (t <= 0.6) return 'Balanced';
    if (t <= 0.9) return 'Creative — good for social';
    return 'Very creative / unpredictable';
  }

  if (loading) return <div className="text-gray-400 text-sm py-10 text-center">Loading AI model configs…</div>;

  const available = providerInfo?.available ?? [];
  const labels = providerInfo?.labels ?? {};

  return (
    <div className="max-w-4xl space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
            <Bot size={20} className="text-brand" /> AI Model Management
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            Configure which AI model handles each workflow step. Changes take effect on the next generation.
          </p>
        </div>
      </div>

      {/* Provider status */}
      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Provider Status</h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {(providerInfo?.all_providers ?? []).map((p) => {
            const isAvailable = available.includes(p);
            return (
              <div key={p} className={`flex items-center gap-2.5 px-3 py-2.5 rounded-lg border text-sm ${isAvailable ? PROVIDER_COLORS[p] : 'bg-gray-50 text-gray-400 border-gray-200'}`}>
                <span className={`w-2 h-2 rounded-full shrink-0 ${isAvailable ? (PROVIDER_DOTS[p] ?? 'bg-gray-400') : 'bg-gray-300'}`} />
                <div className="min-w-0">
                  <p className="font-medium text-xs truncate">{labels[p] ?? p}</p>
                  <p className="text-[10px] opacity-70">{isAvailable ? 'API key set ✓' : 'No key set'}</p>
                </div>
              </div>
            );
          })}
        </div>
        {available.length === 0 && (
          <div className="mt-3 flex items-start gap-2 p-3 bg-red-50 border border-red-200 rounded-lg">
            <AlertTriangle size={14} className="text-red-500 shrink-0 mt-0.5" />
            <p className="text-xs text-red-700">
              No AI providers configured. Add at least one key to your <strong>.env</strong> file:{' '}
              <code className="font-mono">OPENROUTER_API_KEY</code>, <code className="font-mono">OPENAI_API_KEY</code>,{' '}
              <code className="font-mono">ANTHROPIC_API_KEY</code>, or <code className="font-mono">GEMINI_API_KEY</code>.
            </p>
          </div>
        )}
        {available.length > 0 && !available.includes('openrouter') && (
          <div className="mt-3 flex items-start gap-2 p-3 bg-violet-50 border border-violet-200 rounded-lg">
            <Zap size={14} className="text-violet-500 shrink-0 mt-0.5" />
            <p className="text-xs text-violet-700">
              <strong>Tip:</strong> Add an <code className="font-mono">OPENROUTER_API_KEY</code> to access every model
              (GPT-4o, Claude, Gemini, Llama) through a single key at{' '}
              <a href="https://openrouter.ai" target="_blank" rel="noopener noreferrer" className="underline">openrouter.ai</a>.
            </p>
          </div>
        )}
      </div>

      {/* Task configs */}
      <div className="space-y-3">
        {configs.map((cfg) => {
          const isExpanded = expandedTask === cfg.task_type;
          const hasEdits = Object.keys(edits[cfg.task_type] ?? {}).length > 0;
          const currentProvider = getEdit(cfg.task_type, 'provider', cfg.provider);
          const suggestions = MODEL_SUGGESTIONS[currentProvider] ?? [];

          return (
            <div key={cfg.task_type} className={`bg-white rounded-xl border transition-colors ${hasEdits ? 'border-brand/40' : 'border-gray-200'}`}>
              {/* Row header */}
              <button
                className="w-full flex items-center gap-4 px-5 py-4 text-left"
                onClick={() => setExpandedTask(isExpanded ? null : cfg.task_type)}
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-semibold text-gray-900">{cfg.task_label}</span>
                    {cfg.is_db_override && (
                      <span className="text-[10px] font-medium px-1.5 py-0.5 bg-brand/10 text-brand rounded-full border border-brand/20">
                        custom
                      </span>
                    )}
                    {hasEdits && (
                      <span className="text-[10px] font-medium px-1.5 py-0.5 bg-amber-100 text-amber-700 rounded-full border border-amber-200">
                        unsaved
                      </span>
                    )}
                    {cfg.error && (
                      <span className="text-[10px] font-medium px-1.5 py-0.5 bg-red-100 text-red-600 rounded-full border border-red-200">
                        no provider
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2 mt-1 flex-wrap">
                    <span className={`text-[11px] font-medium px-2 py-0.5 rounded-full border ${PROVIDER_COLORS[cfg.provider] ?? PROVIDER_COLORS.unconfigured}`}>
                      {labels[cfg.provider] ?? cfg.provider}
                    </span>
                    <code className="text-xs text-gray-500 font-mono">{cfg.model || '—'}</code>
                    <span className="text-xs text-gray-400">temp {cfg.temperature} · {cfg.max_tokens} tokens</span>
                  </div>
                </div>
                {isExpanded ? <ChevronUp size={16} className="text-gray-400 shrink-0" /> : <ChevronDown size={16} className="text-gray-400 shrink-0" />}
              </button>

              {/* Expanded editor */}
              {isExpanded && (
                <div className="border-t border-gray-100 px-5 pb-5 pt-4 space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {/* Provider */}
                    <div>
                      <label className="text-xs font-medium text-gray-700 block mb-1.5">Provider</label>
                      <select
                        value={currentProvider}
                        onChange={(e) => {
                          setEdit(cfg.task_type, 'provider', e.target.value);
                          setEdit(cfg.task_type, 'model', '');
                        }}
                        className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm outline-none focus:border-brand bg-white"
                      >
                        <option value="auto">auto (use highest priority available)</option>
                        {(providerInfo?.all_providers ?? []).map((p) => (
                          <option key={p} value={p} disabled={!available.includes(p)}>
                            {labels[p] ?? p}{!available.includes(p) ? ' — no key set' : ''}
                          </option>
                        ))}
                      </select>
                      {currentProvider !== 'auto' && !available.includes(currentProvider) && (
                        <p className="text-xs text-red-500 mt-1 flex items-center gap-1">
                          <AlertTriangle size={11} /> No API key set for this provider
                        </p>
                      )}
                    </div>

                    {/* Model */}
                    <div>
                      <label className="text-xs font-medium text-gray-700 block mb-1.5">
                        Model <span className="text-gray-400 font-normal">(leave blank for default)</span>
                      </label>
                      <input
                        type="text"
                        value={getEdit(cfg.task_type, 'model', cfg.model)}
                        onChange={(e) => setEdit(cfg.task_type, 'model', e.target.value)}
                        placeholder={`default for ${currentProvider}`}
                        list={`models-${cfg.task_type}`}
                        className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm outline-none focus:border-brand font-mono"
                      />
                      {suggestions.length > 0 && (
                        <datalist id={`models-${cfg.task_type}`}>
                          {suggestions.map((m) => <option key={m} value={m} />)}
                        </datalist>
                      )}
                      {suggestions.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-1.5">
                          {suggestions.slice(0, 4).map((m) => (
                            <button
                              key={m}
                              type="button"
                              onClick={() => setEdit(cfg.task_type, 'model', m)}
                              className="text-[10px] px-2 py-0.5 bg-gray-100 hover:bg-brand/10 hover:text-brand text-gray-600 rounded-full font-mono transition-colors"
                            >
                              {m}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {/* Temperature */}
                    <div>
                      <label className="text-xs font-medium text-gray-700 block mb-1.5">
                        Temperature — <span className="text-gray-400 font-normal">{tempHint(Number(getEdit(cfg.task_type, 'temperature', cfg.temperature)))}</span>
                      </label>
                      <div className="flex items-center gap-3">
                        <input
                          type="range"
                          min="0" max="1.5" step="0.05"
                          value={getEdit(cfg.task_type, 'temperature', cfg.temperature)}
                          onChange={(e) => setEdit(cfg.task_type, 'temperature', parseFloat(e.target.value))}
                          className="flex-1 accent-brand"
                        />
                        <span className="text-sm font-mono text-gray-700 w-10 text-right">
                          {Number(getEdit(cfg.task_type, 'temperature', cfg.temperature)).toFixed(2)}
                        </span>
                      </div>
                    </div>

                    {/* Max tokens */}
                    <div>
                      <label className="text-xs font-medium text-gray-700 block mb-1.5">Max Tokens</label>
                      <input
                        type="number"
                        min="50"
                        max="8000"
                        step="50"
                        value={getEdit(cfg.task_type, 'max_tokens', cfg.max_tokens)}
                        onChange={(e) => setEdit(cfg.task_type, 'max_tokens', parseInt(e.target.value, 10))}
                        className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm outline-none focus:border-brand font-mono"
                      />
                      <p className="text-xs text-gray-400 mt-1">
                        ~{Math.round(Number(getEdit(cfg.task_type, 'max_tokens', cfg.max_tokens)) * 0.75)} words max output
                      </p>
                    </div>
                  </div>

                  {/* Info box */}
                  <div className="flex items-start gap-2 p-3 bg-gray-50 rounded-lg border border-gray-100">
                    <Info size={13} className="text-gray-400 shrink-0 mt-0.5" />
                    <p className="text-xs text-gray-500">
                      <strong>task:</strong> <code className="font-mono">{cfg.task_type}</code> ·{' '}
                      {cfg.is_db_override ? 'Using your custom override.' : 'Using system default — override above to customise.'}
                    </p>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2 pt-1">
                    <button
                      onClick={() => save(cfg)}
                      disabled={saving[cfg.task_type] || !hasEdits}
                      className="flex items-center gap-1.5 px-4 py-2 bg-brand text-white text-xs font-medium rounded-lg hover:bg-brand/90 disabled:opacity-50"
                    >
                      <Save size={13} /> {saving[cfg.task_type] ? 'Saving…' : 'Save Changes'}
                    </button>
                    {cfg.is_db_override && (
                      <button
                        onClick={() => reset(cfg)}
                        disabled={resetting[cfg.task_type]}
                        className="flex items-center gap-1.5 px-4 py-2 bg-gray-100 text-gray-600 text-xs font-medium rounded-lg hover:bg-gray-200 disabled:opacity-50"
                      >
                        <RotateCcw size={13} /> {resetting[cfg.task_type] ? 'Resetting…' : 'Reset to Default'}
                      </button>
                    )}
                    {hasEdits && (
                      <button
                        onClick={() => setEdits((p) => { const n = { ...p }; delete n[cfg.task_type]; return n; })}
                        className="text-xs text-gray-400 hover:text-gray-600 px-2 py-2"
                      >
                        Discard
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Help footer */}
      <div className="bg-blue-50 border border-blue-100 rounded-xl p-4 text-xs text-blue-700 space-y-1.5">
        <p className="font-semibold text-blue-900">How to get API keys</p>
        <p>🟣 <strong>OpenRouter</strong> (recommended) — <a href="https://openrouter.ai/keys" target="_blank" rel="noopener noreferrer" className="underline">openrouter.ai/keys</a> · Free tier available · Access all models · Add <code className="font-mono">OPENROUTER_API_KEY</code> to .env</p>
        <p>🟢 <strong>OpenAI</strong> — <a href="https://platform.openai.com/api-keys" target="_blank" rel="noopener noreferrer" className="underline">platform.openai.com/api-keys</a> · Add <code className="font-mono">OPENAI_API_KEY</code> to .env</p>
        <p>🟠 <strong>Anthropic</strong> — <a href="https://console.anthropic.com" target="_blank" rel="noopener noreferrer" className="underline">console.anthropic.com</a> · Add <code className="font-mono">ANTHROPIC_API_KEY</code> to .env</p>
        <p>🔵 <strong>Google Gemini</strong> — <a href="https://aistudio.google.com/app/apikey" target="_blank" rel="noopener noreferrer" className="underline">aistudio.google.com/app/apikey</a> · Add <code className="font-mono">GEMINI_API_KEY</code> to .env</p>
      </div>
    </div>
  );
}
