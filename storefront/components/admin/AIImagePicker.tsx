'use client';

import { useState } from 'react';
import { Sparkles, Loader2, Image as ImageIcon, Copy, Check, ChevronDown, ChevronUp, ExternalLink, Info } from 'lucide-react';
import { api } from '@/lib/api';

interface Props {
  content: string;
  topic: string;
  /** 'social' = per enabled platform (default) | 'blog' = blog/website image set */
  context?: 'social' | 'blog';
  /** Not used for image selection in this mode — kept for API compatibility */
  onSelect?: (dataUrl: string, expertRole: string) => void;
  className?: string;
}

export function AIImagePicker({ content, topic, context = 'social', className = '' }: Props) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [imageConcepts, setImageConcepts] = useState('');
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function generate() {
    if (!content.trim() || !topic.trim()) return;
    setLoading(true);
    setImageConcepts('');
    setCopied(false);
    setError(null);
    try {
      const data = await api.post<{ image_concepts: string }>(
        '/api/admin/social/generate-images',
        { content, topic, context }
      );
      setImageConcepts(data.image_concepts);
    } catch (e: unknown) {
      setError((e as { detail?: string })?.detail ?? 'Failed to generate image concepts');
    } finally {
      setLoading(false);
    }
  }

  async function copyToClipboard() {
    try {
      await navigator.clipboard.writeText(imageConcepts);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      /* fallback — select the textarea */
    }
  }

  return (
    <div className={`rounded-xl border border-violet-200 bg-violet-50/50 overflow-hidden ${className}`}>
      {/* Header toggle */}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between px-4 py-3 text-sm font-medium text-violet-800 hover:bg-violet-100/60 transition-colors"
      >
        <span className="flex items-center gap-2">
          <ImageIcon size={15} className="text-violet-600" />
          ✨ Generate Image Prompts
          <span className="text-xs font-normal text-violet-500">
            — {imageConcepts
              ? 'ready to copy & paste into any image generator'
              : context === 'blog'
                ? 'hero · in-content · Pinterest — sized for web'
                : 'Facebook · Instagram carousel + story · LinkedIn · Threads'}
          </span>
          {imageConcepts && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-violet-200 text-violet-700 text-xs">
              <Check size={10} /> Ready
            </span>
          )}
        </span>
        {open ? <ChevronUp size={14} className="text-violet-400" /> : <ChevronDown size={14} className="text-violet-400" />}
      </button>

      {open && (
        <div className="border-t border-violet-200 px-4 pb-4 pt-3 space-y-3">

          {/* Info */}
          <div className="flex items-start gap-2 text-xs text-violet-700 bg-violet-100/60 rounded-lg px-3 py-2">
            <Info size={13} className="mt-0.5 shrink-0" />
            {context === 'blog' ? (
              <span>
                Generates <strong>3 website image prompts</strong> — a 1200×630 hero/OG image, a 1200×800
                in-content illustration, and a 1000×1500 Pinterest/vertical share image. All populated with
                your brand voice and the content above. Copy any prompt into DALL-E, Midjourney, or Firefly.
              </span>
            ) : (
              <span>
                Generates one prompt set <strong>per enabled platform</strong>, each with the correct image
                count, dimensions, and visual role — Facebook (1×1080px), Instagram feed carousel
                (3×4:5 portrait) + story (1×9:16), LinkedIn (1×16:9), Threads (1×square). All populated
                with your brand voice, values, and audience. Copy any prompt into DALL-E, Midjourney, or Firefly.
              </span>
            )}
          </div>

          {/* Generate button */}
          {!imageConcepts && !loading && (
            <button
              type="button"
              onClick={generate}
              disabled={!content.trim() || !topic.trim()}
              className="flex items-center gap-2 px-4 py-2 bg-violet-600 text-white text-sm font-medium rounded-lg hover:bg-violet-700 disabled:opacity-50 transition-colors"
            >
              <Sparkles size={14} />
              {context === 'blog' ? 'Generate Blog Image Prompts' : 'Generate Platform Image Prompts'}
            </button>
          )}

          {/* Loading */}
          {loading && (
            <div className="flex items-center gap-3 py-4">
              <Loader2 size={18} className="animate-spin text-violet-500 shrink-0" />
              <div>
                <p className="text-sm font-medium text-violet-800">Generating image prompts…</p>
                <p className="text-xs text-violet-500">{context === 'blog' ? 'Writing 3 website image prompts (hero, in-content, Pinterest)' : 'Writing per-platform prompts for all your enabled social platforms'} — usually 15–30s</p>
              </div>
            </div>
          )}

          {/* Error */}
          {error && (
            <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</p>
          )}

          {/* Output */}
          {imageConcepts && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <p className="text-xs font-semibold text-violet-800">
                  {context === 'blog' ? 'Blog / website image prompts (3 images):' : 'Platform image prompts — grouped by platform:'}
                </p>
                <div className="flex items-center gap-2">
                  <a
                    href="https://chat.openai.com"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1 text-xs text-violet-500 hover:text-violet-700 underline"
                    title="Open ChatGPT to generate images from these prompts"
                  >
                    ChatGPT <ExternalLink size={11} />
                  </a>
                  <button
                    type="button"
                    onClick={copyToClipboard}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                      copied
                        ? 'bg-green-600 text-white'
                        : 'bg-violet-600 text-white hover:bg-violet-700'
                    }`}
                  >
                    {copied ? <><Check size={12} /> Copied!</> : <><Copy size={12} /> Copy all</>}
                  </button>
                </div>
              </div>

              <textarea
                readOnly
                value={imageConcepts}
                rows={18}
                onClick={(e) => (e.target as HTMLTextAreaElement).select()}
                className="w-full px-3 py-2.5 rounded-lg border border-violet-200 bg-white text-xs font-mono text-gray-700 resize-y outline-none focus:border-violet-400 cursor-text leading-relaxed"
              />

              <div className="flex items-center justify-between">
                <p className="text-xs text-violet-500">
                  Click the box to select all · Copy any individual prompt and paste into DALL-E, Midjourney, or Firefly
                </p>
                <button
                  type="button"
                  onClick={generate}
                  disabled={loading}
                  className="text-xs text-violet-600 hover:text-violet-800 underline"
                >
                  Regenerate
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
