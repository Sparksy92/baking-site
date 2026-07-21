'use client';

import {
  X, Sparkles, ChevronDown, ChevronUp, AlertTriangle,
  ImageIcon, Film, Layers, Plus, Hash,
} from 'lucide-react';
import { AIImagePicker } from '@/components/admin/AIImagePicker';
import type { PlatformConfig } from './useOutboxState';

const PLATFORMS = ['facebook', 'instagram', 'x', 'linkedin', 'tiktok', 'youtube', 'pinterest', 'threads'];

const PLATFORM_ICON: Record<string, string> = {
  facebook: '𝕗', instagram: '◉', x: '𝕏', linkedin: 'in', tiktok: '♪', youtube: '▶', pinterest: '𝕻', threads: '@',
};

const CONTENT_TYPES: Record<string, { value: string; label: string; icon: string; hint: string }[]> = {
  facebook:  [
    { value: 'feed',  label: 'Feed Post', icon: '📄', hint: 'Standard post — text, image, or link' },
    { value: 'reel',  label: 'Reel',      icon: '🎬', hint: 'Short video with algorithmic reach boost' },
    { value: 'story', label: 'Story',     icon: '⏱️', hint: 'Ephemeral image — expires after 24 hours. Requires an image URL.' },
  ],
  instagram: [
    { value: 'feed',  label: 'Feed Post', icon: '📷', hint: 'Image post on your Instagram grid' },
    { value: 'reel',  label: 'Reel',      icon: '🎬', hint: 'Short video — highest organic reach on Instagram' },
    { value: 'story', label: 'Story',     icon: '⏱️', hint: 'Ephemeral image — expires after 24 hours. Requires an image URL.' },
  ],
  linkedin: [
    { value: 'feed',  label: 'Text Post',  icon: '📝', hint: 'Text post — up to 3,000 characters' },
    { value: 'image', label: 'Image Post', icon: '🖼️', hint: 'Image with commentary — highest engagement on LinkedIn' },
    { value: 'video', label: 'Video Post', icon: '🎬', hint: 'Native video — auto-plays in feed' },
  ],
  tiktok: [
    { value: 'feed',  label: 'Video',        icon: '🎵', hint: 'Standard TikTok video — posted to creator inbox for review' },
    { value: 'short', label: 'TikTok Short', icon: '⚡', hint: 'Short-form video (≤60s) — published directly with video.publish scope' },
  ],
  youtube: [
    { value: 'feed',  label: 'Video',         icon: '▶️', hint: 'Standard YouTube video upload' },
    { value: 'short', label: 'YouTube Short', icon: '⚡', hint: 'YouTube Short (≤60s) — auto-adds #Shorts tag for feed eligibility' },
  ],
  pinterest: [
    { value: 'feed',  label: 'Image Pin', icon: '📌', hint: 'Standard image Pin — requires an image URL' },
    { value: 'video', label: 'Video Pin', icon: '🎬', hint: 'Video Pin — requires a video URL' },
  ],
  threads: [
    { value: 'feed',  label: 'Thread', icon: '@',  hint: 'Text post up to 500 characters — image optional' },
    { value: 'video', label: 'Video',  icon: '🎬', hint: 'Video post — up to 5 minutes' },
  ],
  _default: [
    { value: 'feed', label: 'Feed Post', icon: '📄', hint: 'Standard post' },
  ],
};

type Props = {
  platformConfigs: Record<string, PlatformConfig>;
  newPlatform: string; setNewPlatform: (v: string) => void;
  newContent: string; setNewContent: (v: string) => void;
  newContentType: string; setNewContentType: (v: string) => void;
  newImageUrl: string; setNewImageUrl: (v: string) => void;
  newAdditionalImageUrls: string[]; setNewAdditionalImageUrls: (v: string[]) => void;
  newVideoUrl: string; setNewVideoUrl: (v: string) => void;
  newThumbOffset: string; setNewThumbOffset: (v: string) => void;
  newStrategyContentType: string; setNewStrategyContentType: (v: string) => void;
  newHashtags: string[]; setNewHashtags: (v: string[]) => void;
  newHashtagInput: string; setNewHashtagInput: (v: string) => void;
  showAiGenerate: boolean; setShowAiGenerate: (v: boolean) => void;
  aiTopic: string; setAiTopic: (v: string) => void;
  aiExtraContext: string; setAiExtraContext: (v: string) => void;
  aiGenerating: boolean;
  aiGeneratedTopic: string;
  creating: boolean;
  suggesting: boolean;
  mediaPickerTarget: 'image' | 'video' | 'carousel';
  setMediaPickerTarget: (v: 'image' | 'video' | 'carousel') => void;
  setShowMediaPicker: (v: boolean) => void;
  onClose: () => void;
  onGenerate: () => void;
  onSuggestHashtags: () => void;
  onCreate: () => void;
};

export function CreatePostForm({
  platformConfigs,
  newPlatform, setNewPlatform,
  newContent, setNewContent,
  newContentType, setNewContentType,
  newImageUrl, setNewImageUrl,
  newAdditionalImageUrls, setNewAdditionalImageUrls,
  newVideoUrl, setNewVideoUrl,
  newThumbOffset, setNewThumbOffset,
  newStrategyContentType, setNewStrategyContentType,
  newHashtags, setNewHashtags,
  newHashtagInput, setNewHashtagInput,
  showAiGenerate, setShowAiGenerate,
  aiTopic, setAiTopic,
  aiExtraContext, setAiExtraContext,
  aiGenerating,
  aiGeneratedTopic,
  creating,
  suggesting,
  setMediaPickerTarget,
  setShowMediaPicker,
  onClose,
  onGenerate,
  onSuggestHashtags,
  onCreate,
}: Props) {
  const enabledPlatforms = PLATFORMS.filter((p) => platformConfigs[p]?.enabled);
  const cfg = platformConfigs[newPlatform];
  const maxChars = cfg?.max_caption_chars ?? 2200;
  const charCount = newContent.length + newHashtags.join(' ').length + (newHashtags.length > 0 ? 2 : 0);
  const overLimit = charCount > maxChars;
  const selectedType = (CONTENT_TYPES[newPlatform] ?? CONTENT_TYPES['_default']).find((t) => t.value === newContentType);

  function addNewHashtag() {
    const t = newHashtagInput.trim();
    if (!t) return;
    const f = t.startsWith('#') ? t : `#${t}`;
    if (!newHashtags.includes(f)) setNewHashtags([...newHashtags, f]);
    setNewHashtagInput('');
  }

  return (
    <div className="bg-white rounded-xl border border-brand/30 p-5 space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-gray-900">New Post</h2>
        <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X size={16} /></button>
      </div>

      {/* Platform picker */}
      <div>
        <label className="text-xs font-medium text-gray-600 block mb-1">Platform</label>
        {enabledPlatforms.length === 0 ? (
          <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
            No platforms are enabled. Go to <strong>Social → Platforms</strong> to enable at least one.
          </p>
        ) : (
          <div className="flex gap-2 flex-wrap">
            {enabledPlatforms.map((p) => (
              <button
                key={p}
                onClick={() => { setNewPlatform(p); setNewContentType('feed'); setNewAdditionalImageUrls([]); setNewStrategyContentType(''); }}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                  newPlatform === p ? 'bg-brand text-white border-brand' : 'bg-white text-gray-600 border-gray-200 hover:border-brand'
                }`}
              >
                {PLATFORM_ICON[p] ?? ''} {p.charAt(0).toUpperCase() + p.slice(1)}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* AI Generate panel */}
      <div className="rounded-xl border border-purple-200 bg-purple-50/60 overflow-hidden">
        <button
          type="button"
          onClick={() => setShowAiGenerate(!showAiGenerate)}
          className="w-full flex items-center justify-between px-4 py-3 text-sm font-medium text-purple-800 hover:bg-purple-100/60 transition-colors"
        >
          <span className="flex items-center gap-2">
            <Sparkles size={15} className="text-purple-600" />
            ✨ Generate with AI
            <span className="text-xs font-normal text-purple-500">— describe a topic and let AI write the post</span>
          </span>
          {showAiGenerate ? <ChevronUp size={14} className="text-purple-400" /> : <ChevronDown size={14} className="text-purple-400" />}
        </button>

        {showAiGenerate && (
          <div className="px-4 pb-4 space-y-3 border-t border-purple-200 pt-3">
            <div>
              <label className="text-xs font-medium text-purple-800 block mb-1">
                Topic or moment <span className="text-purple-400 font-normal">— what do you want to post about?</span>
              </label>
              <input
                type="text"
                value={aiTopic}
                onChange={(e) => setAiTopic(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); onGenerate(); } }}
                placeholder={`e.g. "Indigenous fashion week", "our new hoodie drop", "summer styling tips"`}
                className="w-full px-3 py-2 rounded-lg border border-purple-200 text-sm outline-none focus:border-purple-400 bg-white"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-purple-800 block mb-1">
                Extra context <span className="text-purple-400 font-normal">(optional)</span>
              </label>
              <input
                type="text"
                value={aiExtraContext}
                onChange={(e) => setAiExtraContext(e.target.value)}
                placeholder={`e.g. "mention the 20% off sale", "keep it under 150 chars"`}
                className="w-full px-3 py-2 rounded-lg border border-purple-200 text-sm outline-none focus:border-purple-400 bg-white"
              />
            </div>
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={onGenerate}
                disabled={aiGenerating || !aiTopic.trim()}
                className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white text-sm font-medium rounded-lg hover:bg-purple-700 disabled:opacity-50 transition-colors"
              >
                <Sparkles size={14} />
                {aiGenerating ? 'Researching trends & writing…' : `Generate for ${newPlatform.charAt(0).toUpperCase() + newPlatform.slice(1)}`}
              </button>
              {aiGenerating && <span className="text-xs text-purple-600 animate-pulse">Searching internet trends…</span>}
            </div>
            <p className="text-xs text-purple-400">
              The AI searches current internet trends on your topic, then writes a platform-native post in your brand voice. You can edit before saving.
            </p>
          </div>
        )}
      </div>

      {/* Content */}
      <div>
        <label className="text-xs font-medium text-gray-600 block mb-1">
          Content
          {newContent && (
            <button
              type="button"
              onClick={() => { setNewContent(''); setShowAiGenerate(true); }}
              className="ml-2 text-purple-500 hover:text-purple-700 font-normal"
            >
              ↩ regenerate with AI
            </button>
          )}
        </label>
        <div className="relative">
          <textarea
            value={newContent}
            onChange={(e) => setNewContent(e.target.value)}
            rows={4}
            className={`w-full px-3 py-2 rounded-lg border text-sm resize-y outline-none ${
              overLimit ? 'border-red-400' : 'border-gray-200 focus:border-brand'
            }`}
            placeholder={`Write your ${newPlatform} post… or use ✨ AI Generate above`}
          />
          <span className={`absolute bottom-2 right-3 text-xs ${overLimit ? 'text-red-500' : 'text-gray-400'}`}>
            {charCount}/{maxChars}
          </span>
        </div>
      </div>

      {/* AI Image Picker */}
      {newContent && aiGeneratedTopic && (
        <AIImagePicker content={newContent} topic={aiGeneratedTopic} />
      )}

      {/* Post type + Media */}
      <div className="space-y-3">
        <div>
          <label className="text-xs font-medium text-gray-600 block mb-1">Post Type</label>
          <div className="flex gap-2 flex-wrap">
            {(CONTENT_TYPES[newPlatform] ?? CONTENT_TYPES['_default']).map(({ value, label, icon, hint }) => (
              <button
                key={value}
                onClick={() => setNewContentType(value)}
                title={hint}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                  newContentType === value ? 'bg-brand text-white border-brand' : 'bg-white text-gray-600 border-gray-200 hover:border-brand'
                }`}
              >
                {icon} {label}
              </button>
            ))}
          </div>
          {selectedType && <p className="text-xs text-gray-400 mt-1">{selectedType.hint}</p>}
          {newContentType === 'story' && (
            <div className="mt-2 flex items-start gap-2 px-3 py-2 bg-amber-50 border border-amber-200 rounded-lg">
              <AlertTriangle size={13} className="text-amber-600 shrink-0 mt-0.5" />
              <p className="text-xs text-amber-800">
                <strong>Stories expire after 24 hours.</strong> They won&apos;t appear in your feed or analytics after that. An image URL is required.
              </p>
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {/* Image */}
          <div>
            <label className="text-xs font-medium text-gray-600 block mb-1.5 flex items-center gap-1">
              <ImageIcon size={12} /> Image <span className="text-gray-400 font-normal">(optional)</span>
            </label>
            <div className="flex gap-2">
              <input
                type="url"
                value={newImageUrl}
                onChange={(e) => setNewImageUrl(e.target.value)}
                placeholder="Paste URL or pick from library"
                className="flex-1 min-w-0 px-3 py-1.5 rounded-lg border border-gray-200 text-xs outline-none focus:border-brand"
              />
              <button
                type="button"
                onClick={() => { setMediaPickerTarget('image'); setShowMediaPicker(true); }}
                className="shrink-0 flex items-center gap-1 px-2.5 py-1.5 bg-gray-100 text-gray-600 text-xs font-medium rounded-lg hover:bg-gray-200 border border-gray-200"
              >
                <Layers size={12} /> Library
              </button>
            </div>
            {newImageUrl && (
              <img src={newImageUrl} alt="" className="mt-2 rounded-lg max-h-24 object-cover border border-gray-100" onError={(e) => (e.currentTarget.style.display = 'none')} />
            )}
            {/* Carousel / additional images */}
            {['instagram', 'linkedin'].includes(newPlatform) && !newVideoUrl && (
              <div className="mt-2">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[11px] text-gray-500 font-medium">
                    {newPlatform === 'instagram' ? 'Carousel images' : 'Additional images'}
                    <span className="text-gray-400 font-normal ml-1">
                      ({newAdditionalImageUrls.length}/{newPlatform === 'instagram' ? 9 : 8} extra)
                    </span>
                  </span>
                  {newAdditionalImageUrls.length < (newPlatform === 'instagram' ? 9 : 8) && (
                    <button
                      type="button"
                      onClick={() => { setMediaPickerTarget('carousel'); setShowMediaPicker(true); }}
                      className="flex items-center gap-1 px-2 py-0.5 text-[11px] text-sky-600 hover:text-sky-800 border border-sky-200 rounded-md bg-sky-50 hover:bg-sky-100"
                    >
                      <Plus size={10} /> Add image
                    </button>
                  )}
                </div>
                {newAdditionalImageUrls.length > 0 ? (
                  <div className="flex flex-wrap gap-1.5">
                    {newAdditionalImageUrls.map((url, i) => (
                      <div key={url} className="relative group">
                        <img src={url} alt={`Extra ${i + 1}`}
                          className="rounded-lg h-14 w-14 object-cover border border-gray-200"
                          onError={(e) => (e.currentTarget.style.display = 'none')} />
                        <button type="button"
                          onClick={() => setNewAdditionalImageUrls(newAdditionalImageUrls.filter((_, idx) => idx !== i))}
                          className="absolute top-0.5 right-0.5 w-4 h-4 bg-black/50 hover:bg-red-600 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                          <X size={8} />
                        </button>
                        <span className="absolute bottom-0.5 left-0.5 text-[9px] bg-black/50 text-white rounded px-0.5">{i + 2}</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-[11px] text-gray-400 italic">
                    {newImageUrl ? `Add up to ${newPlatform === 'instagram' ? 9 : 8} more images to make a carousel` : 'Set a primary image above first'}
                  </p>
                )}
              </div>
            )}
          </div>

          {/* Video */}
          <div>
            <label className="text-xs font-medium text-gray-600 block mb-1.5 flex items-center gap-1">
              <Film size={12} /> Video <span className="text-gray-400 font-normal">(optional — overrides image)</span>
            </label>
            <div className="flex gap-2">
              <input
                type="url"
                value={newVideoUrl}
                onChange={(e) => setNewVideoUrl(e.target.value)}
                placeholder="Paste URL or pick from library"
                className="flex-1 min-w-0 px-3 py-1.5 rounded-lg border border-gray-200 text-xs outline-none focus:border-brand"
              />
              <button
                type="button"
                onClick={() => { setMediaPickerTarget('video'); setShowMediaPicker(true); }}
                className="shrink-0 flex items-center gap-1 px-2.5 py-1.5 bg-gray-100 text-gray-600 text-xs font-medium rounded-lg hover:bg-gray-200 border border-gray-200"
              >
                <Layers size={12} /> Library
              </button>
            </div>
            {newVideoUrl && (
              <p className="mt-1 text-xs text-indigo-600 flex items-center gap-1"><Film size={11} /> Video URL set</p>
            )}
          </div>
        </div>

        {/* Reel thumbnail offset */}
        {newPlatform === 'instagram' && newContentType === 'reel' && newVideoUrl && (
          <div>
            <label className="text-xs font-medium text-gray-600 block mb-1.5 flex items-center gap-1">
              🎬 Reel Thumbnail Offset
              <span className="text-gray-400 font-normal">(ms from start of video — optional)</span>
            </label>
            <div className="flex items-center gap-2">
              <input
                type="number"
                min="0"
                step="500"
                value={newThumbOffset}
                onChange={(e) => setNewThumbOffset(e.target.value)}
                placeholder="e.g. 3000 = 3 seconds in"
                className="w-64 px-3 py-1.5 rounded-lg border border-gray-200 text-xs outline-none focus:border-brand"
              />
              {newThumbOffset && (
                <span className="text-xs text-gray-500">
                  = {(Number.parseInt(newThumbOffset, 10) / 1000).toFixed(1)}s
                </span>
              )}
            </div>
            <p className="mt-1 text-xs text-gray-400">Instagram uses this frame as the Reel cover image. Leave blank to let Instagram auto-select.</p>
          </div>
        )}
      </div>

      {/* Content Strategy */}
      <div className="flex items-center gap-3">
        <label className="text-xs font-medium text-gray-600 whitespace-nowrap">Content Strategy</label>
        <select
          value={newStrategyContentType}
          onChange={(e) => setNewStrategyContentType(e.target.value)}
          className="flex-1 px-2.5 py-1.5 rounded-lg border border-gray-200 text-xs outline-none focus:border-brand bg-white"
        >
          <option value="">Auto-assign (recommended)</option>
          <option value="educational">📚 Educational</option>
          <option value="entertaining">😄 Entertaining</option>
          <option value="behind_scenes">🎬 Behind the Scenes</option>
          <option value="promotional">🛍️ Promotional</option>
          <option value="community">🤝 Community</option>
          <option value="professional">💼 Professional</option>
          <option value="ugc">⭐ UGC / Social Proof</option>
          <option value="company_news">📣 Company News</option>
        </select>
        <span className="text-[11px] text-gray-400 whitespace-nowrap">Auto uses content mix targets</span>
      </div>

      {/* Hashtags */}
      {cfg?.hashtag_mode !== 'none' && (
        <div className="bg-gray-50 rounded-lg p-3 space-y-2">
          <div className="flex items-center gap-2">
            <Hash size={14} className="text-gray-500" />
            <span className="text-xs font-medium text-gray-600">Hashtags</span>
            <span className="text-xs text-gray-400">
              {newHashtags.length}/{cfg?.max_hashtags ?? 5} max
            </span>
            <button
              onClick={onSuggestHashtags}
              disabled={suggesting || !newContent.trim()}
              className="ml-auto flex items-center gap-1 px-2 py-1 bg-purple-50 text-purple-700 text-xs font-medium rounded-md hover:bg-purple-100 disabled:opacity-50"
            >
              <Sparkles size={12} /> {suggesting ? 'Suggesting...' : 'AI Suggest'}
            </button>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {newHashtags.map((tag) => (
              <span key={tag} className="inline-flex items-center gap-1 px-2 py-0.5 bg-brand/10 text-brand text-xs font-medium rounded-full">
                {tag}
                <button onClick={() => setNewHashtags(newHashtags.filter((t) => t !== tag))} className="hover:text-red-500"><X size={10} /></button>
              </span>
            ))}
          </div>
          <div className="flex gap-2">
            <input
              type="text"
              value={newHashtagInput}
              onChange={(e) => setNewHashtagInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addNewHashtag(); } }}
              placeholder="Add hashtag..."
              className="flex-1 px-2.5 py-1.5 rounded-md border border-gray-200 text-xs outline-none focus:border-brand font-mono"
            />
            <button
              onClick={addNewHashtag}
              className="px-3 py-1.5 bg-gray-200 text-gray-600 text-xs font-medium rounded-md hover:bg-gray-300"
            >
              Add
            </button>
          </div>
        </div>
      )}

      {/* Submit */}
      <div className="flex gap-2 pt-2 border-t border-gray-100">
        <button
          onClick={onCreate}
          disabled={creating || !newContent.trim()}
          className="px-5 py-2 bg-brand text-white text-sm font-medium rounded-lg hover:bg-brand/90 disabled:opacity-50"
        >
          {creating ? 'Creating...' : 'Create Draft'}
        </button>
        <button
          onClick={onClose}
          className="px-4 py-2 bg-gray-100 text-gray-600 text-sm font-medium rounded-lg hover:bg-gray-200"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
