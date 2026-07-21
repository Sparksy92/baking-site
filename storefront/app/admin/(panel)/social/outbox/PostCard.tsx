'use client';

import {
  CheckCircle, XCircle, Send, Trash2, Pencil, X, ExternalLink,
  Hash, Sparkles, AlertTriangle, Plus, Clock, CalendarClock,
  ChevronDown, ChevronUp, CheckSquare, Square,
  ImageIcon, Film, Layers, Star, TrendingUp, Tag,
  ShieldCheck, Wand2, MoreHorizontal, RefreshCw,
} from 'lucide-react';
import type { SocialPost, PlatformConfig, Prediction, PostPreview } from './useOutboxState';
import { parseHashtags } from './useOutboxState';

function fmtDate(iso: string | null, fallback = ''): string {
  if (!iso) return fallback;
  return new Date(iso).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' });
}

const STATUS_STYLES: Record<string, string> = {
  draft:     'bg-amber-100 text-amber-800 border border-amber-200',
  approved:  'bg-blue-100 text-blue-800 border border-blue-200',
  published: 'bg-green-100 text-green-800 border border-green-200',
  scheduled: 'bg-purple-100 text-purple-800 border border-purple-200',
  failed:    'bg-red-100 text-red-800 border border-red-200',
  rejected:  'bg-gray-100 text-gray-600 border border-gray-200',
};

const STATUS_LABELS: Record<string, string> = {
  draft: '✏️ Draft', approved: '✅ Approved', published: '📤 Published',
  scheduled: '🕐 Scheduled', failed: '❌ Failed', rejected: '🚫 Rejected',
};

const COMPLIANCE_STYLES: Record<string, string> = {
  compliant: 'bg-green-50 text-green-700 border-green-200',
  warning:   'bg-amber-50 text-amber-700 border-amber-200',
  violation: 'bg-red-50 text-red-700 border-red-200',
};

const COMPLIANCE_LABELS: Record<string, string> = {
  compliant: '✅ Compliant', warning: '⚠️ Warning', violation: '🚫 Violation',
};

const PLATFORM_ICON: Record<string, string> = {
  facebook: '𝕗', instagram: '◉', x: '𝕏', linkedin: 'in',
  tiktok: '♪', youtube: '▶', pinterest: '𝕻', threads: '@',
};

const CONTENT_PREVIEW_CHARS = 280;

const CONTENT_TYPE_STYLES: Record<string, string> = {
  educational:   'bg-blue-50 text-blue-700 border-blue-200',
  entertaining:  'bg-yellow-50 text-yellow-700 border-yellow-200',
  behind_scenes: 'bg-orange-50 text-orange-700 border-orange-200',
  promotional:   'bg-red-50 text-red-700 border-red-200',
  community:     'bg-green-50 text-green-700 border-green-200',
  professional:  'bg-indigo-50 text-indigo-700 border-indigo-200',
  ugc:           'bg-pink-50 text-pink-700 border-pink-200',
  company_news:  'bg-teal-50 text-teal-700 border-teal-200',
};

const CONTENT_TYPE_LABELS: Record<string, string> = {
  educational:   '📚 Educational',
  entertaining:  '😄 Entertaining',
  behind_scenes: '🎬 Behind the Scenes',
  promotional:   '🛍️ Promotional',
  community:     '🤝 Community',
  professional:  '💼 Professional',
  ugc:           '⭐ UGC / Social Proof',
  company_news:  '📣 Company News',
};

const CONTENT_TYPES: Record<string, { value: string; label: string; icon: string; hint: string }[]> = {
  facebook:  [
    { value: 'feed',  label: 'Feed Post', icon: '📄', hint: 'Standard post — text, image, or link' },
    { value: 'reel',  label: 'Reel',      icon: '🎬', hint: 'Short video with algorithmic reach boost' },
    { value: 'story', label: 'Story',     icon: '⏱️', hint: 'Ephemeral image — expires after 24 hours.' },
  ],
  instagram: [
    { value: 'feed',  label: 'Feed Post', icon: '📷', hint: 'Image post on your Instagram grid' },
    { value: 'reel',  label: 'Reel',      icon: '🎬', hint: 'Short video — highest organic reach on Instagram' },
    { value: 'story', label: 'Story',     icon: '⏱️', hint: 'Ephemeral image — expires after 24 hours.' },
  ],
  linkedin: [
    { value: 'feed',  label: 'Text Post',  icon: '📝', hint: 'Text post — up to 3,000 characters' },
    { value: 'image', label: 'Image Post', icon: '🖼️', hint: 'Image with commentary — highest engagement on LinkedIn' },
    { value: 'video', label: 'Video Post', icon: '🎬', hint: 'Native video — auto-plays in feed' },
  ],
  tiktok: [
    { value: 'feed',  label: 'Video',        icon: '🎵', hint: 'Standard TikTok video' },
    { value: 'short', label: 'TikTok Short', icon: '⚡', hint: 'Short-form video (≤60s)' },
  ],
  youtube: [
    { value: 'feed',  label: 'Video',         icon: '▶️', hint: 'Standard YouTube video upload' },
    { value: 'short', label: 'YouTube Short', icon: '⚡', hint: 'YouTube Short (≤60s)' },
  ],
  pinterest: [
    { value: 'feed',  label: 'Image Pin', icon: '📌', hint: 'Standard image Pin' },
    { value: 'video', label: 'Video Pin', icon: '🎬', hint: 'Video Pin' },
  ],
  threads: [
    { value: 'feed',  label: 'Thread', icon: '@',  hint: 'Text post up to 500 characters' },
    { value: 'video', label: 'Video',  icon: '🎬', hint: 'Video post — up to 5 minutes' },
  ],
};

type Props = {
  post: SocialPost;
  isSelected: boolean;
  isExpanded: boolean;
  editId: number | null;
  editContent: string; setEditContent: (v: string) => void;
  editHashtags: string[];
  editImageUrl: string; setEditImageUrl: (v: string) => void;
  editVideoUrl: string; setEditVideoUrl: (v: string) => void;
  editShortVideoUrl: string; setEditShortVideoUrl: (v: string) => void;
  editAdditionalImageUrls: string[]; setEditAdditionalImageUrls: (v: string[] | ((p: string[]) => string[])) => void;
  editContentType: string; setEditContentType: (v: string) => void;
  editStatus: string; setEditStatus: (v: string) => void;
  hashtagInput: string; setHashtagInput: (v: string) => void;
  suggesting: boolean;
  editMediaPickerTarget: string; setEditMediaPickerTarget: (v: 'image' | 'video' | 'carousel') => void;
  setShowEditMediaPicker: (v: boolean) => void;
  rescheduleId: number | null; setRescheduleId: (v: number | null) => void;
  rescheduleValue: string; setRescheduleValue: (v: string) => void;
  expandedBlogImages: Set<number>; setExpandedBlogImages: (v: (p: Set<number>) => Set<number>) => void;
  overflowOpen: Record<number, boolean>; setOverflowOpen: (v: (p: Record<number, boolean>) => Record<number, boolean>) => void;
  predictions: Record<number, Prediction | 'loading'>;
  previews: Record<number, PostPreview | 'loading'>;
  improving: Record<number, boolean>;
  analysisTab: Record<number, 'score' | 'preview'>; setAnalysisTab: (v: (p: Record<number, 'score' | 'preview'>) => Record<number, 'score' | 'preview'>) => void;
  productTagPostId: number | null; setProductTagPostId: (v: number | null) => void;
  productSearch: string; setProductSearch: (v: string) => void;
  productResults: { id: number; name: string }[];
  productTagsMap: Record<number, { id: number; name: string }[]>;
  productSearching: boolean;
  boostPostId: number | null; setBoostPostId: (v: number | null) => void;
  boostBudget: string; setBoostBudget: (v: string) => void;
  boostDays: string; setBoostDays: (v: string) => void;
  boostObjective: string; setBoostObjective: (v: string) => void;
  boosting: boolean;
  busy: Record<number, boolean>;
  platformConfigs: Record<string, PlatformConfig>;
  onToggleSelect: (id: number) => void;
  onToggleExpand: (id: number) => void;
  onApprove: (id: number) => void;
  onReject: (id: number) => void;
  onPublish: (id: number) => void;
  onPublishNow: (id: number) => void;
  onAutoSchedule: (id: number) => void;
  onReschedule: (id: number) => void;
  onCheckCompliance: (id: number) => void;
  onFixCompliance: (id: number) => void;
  onSaveEdit: (id: number) => void;
  onRemove: (id: number) => void;
  onSuggestHashtags: (post: SocialPost) => void;
  onAddHashtag: () => void;
  onRemoveHashtag: (tag: string) => void;
  onPredictScore: (id: number) => void;
  onPreviewPost: (post: SocialPost) => void;
  onImprovePost: (id: number) => Promise<void>;
  onSearchProducts: (q: string) => void;
  onToggleProductTag: (postId: number, product: { id: number; name: string }) => void;
  onSaveProductTags: (postId: number) => void;
  onBoostPost: (postId: number) => void;
  onClearAnalysis: (id: number) => void;
  onSetEditId: (id: number | null) => void;
};

export function PostCard({
  post, isSelected, isExpanded, editId,
  editContent, setEditContent,
  editHashtags,
  editImageUrl, setEditImageUrl,
  editVideoUrl, setEditVideoUrl,
  editShortVideoUrl, setEditShortVideoUrl,
  editAdditionalImageUrls, setEditAdditionalImageUrls,
  editContentType, setEditContentType,
  editStatus, setEditStatus,
  hashtagInput, setHashtagInput,
  suggesting,
  setEditMediaPickerTarget, setShowEditMediaPicker,
  rescheduleId, setRescheduleId,
  rescheduleValue, setRescheduleValue,
  expandedBlogImages, setExpandedBlogImages,
  overflowOpen, setOverflowOpen,
  predictions, previews, improving,
  analysisTab, setAnalysisTab,
  productTagPostId, setProductTagPostId,
  productSearch, setProductSearch,
  productResults, productTagsMap, productSearching,
  boostPostId, setBoostPostId,
  boostBudget, setBoostBudget,
  boostDays, setBoostDays,
  boostObjective, setBoostObjective,
  boosting, busy, platformConfigs,
  onToggleSelect, onToggleExpand,
  onApprove, onReject, onPublish, onPublishNow, onAutoSchedule, onReschedule,
  onCheckCompliance, onFixCompliance, onSaveEdit, onRemove,
  onSuggestHashtags, onAddHashtag, onRemoveHashtag,
  onPredictScore, onPreviewPost, onImprovePost,
  onSearchProducts, onToggleProductTag, onSaveProductTags,
  onBoostPost, onClearAnalysis, onSetEditId,
}: Props) {
  const isSelectable = ['draft', 'approved', 'failed'].includes(post.status);
  const contentLong = post.content.length > CONTENT_PREVIEW_CHARS;
  const displayContent = (contentLong && !isExpanded && editId !== post.id)
    ? post.content.slice(0, CONTENT_PREVIEW_CHARS) + '…'
    : post.content;

  const cfg = platformConfigs[post.platform];
  const editCfg = platformConfigs[post.platform];
  const editMaxChars = editCfg?.max_caption_chars ?? 2200;
  const editCharCount = editContent.length + editHashtags.join(' ').length + (editHashtags.length > 0 ? 2 : 0);
  const editOverLimit = editCharCount > editMaxChars;
  const editCharPct = Math.min(100, Math.round((editCharCount / editMaxChars) * 100));

  const tab = analysisTab[post.id] ?? 'score';
  const hasPrediction = predictions[post.id] && predictions[post.id] !== 'loading';
  const hasPreview = previews[post.id] && previews[post.id] !== 'loading';
  const pred = hasPrediction ? predictions[post.id] as Prediction : null;
  const prev = hasPreview ? previews[post.id] as PostPreview : null;

  return (
    <div className={`bg-white rounded-xl border p-5 transition-colors ${isSelected ? 'border-indigo-300 bg-indigo-50/30' : 'border-gray-200'}`}>
      <div className="flex items-start gap-3">
        {/* Checkbox */}
        {isSelectable && (
          <button onClick={() => onToggleSelect(post.id)} className="mt-0.5 shrink-0" title="Select for bulk action">
            {isSelected ? <CheckSquare size={16} className="text-indigo-600" /> : <Square size={16} className="text-gray-300 hover:text-gray-500" />}
          </button>
        )}

        {/* Platform icon */}
        <div className="w-9 h-9 rounded-lg bg-gray-100 flex items-center justify-center font-bold text-sm text-gray-600 shrink-0">
          {PLATFORM_ICON[post.platform] ?? post.platform[0].toUpperCase()}
        </div>

        <div className="flex-1 min-w-0">
          {/* Header row */}
          <div className="flex items-center gap-2 flex-wrap mb-2">
            <span className="text-sm font-semibold text-gray-900 capitalize">{post.platform}</span>
            {post.content_type === 'reel' && <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-700 border border-indigo-200">🎬 Reel</span>}
            {post.content_type === 'story' && <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 border border-amber-200" title="Expires 24 hours after publishing">⏱️ Story · 24h</span>}
            {post.content_type === 'short' && <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-cyan-100 text-cyan-700 border border-cyan-200">⚡ Short</span>}
            <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${STATUS_STYLES[post.status] ?? 'bg-gray-100 text-gray-600'}`}>
              {STATUS_LABELS[post.status] ?? post.status}
            </span>
            {post.compliance_status && post.compliance_status !== 'unchecked' && (
              <span className={`text-xs font-medium px-2 py-0.5 rounded-full border ${COMPLIANCE_STYLES[post.compliance_status] ?? 'bg-gray-100 text-gray-600'}`}
                title={post.compliance_issues_count ? `${post.compliance_issues_count} issue(s) detected` : 'Compliant'}>
                {COMPLIANCE_LABELS[post.compliance_status]}
                {post.compliance_issues_count ? ` (${post.compliance_issues_count})` : ''}
              </span>
            )}
            {post.strategy_content_type && (
              <span className={`text-xs font-medium px-2 py-0.5 rounded-full border ${CONTENT_TYPE_STYLES[post.strategy_content_type] ?? 'bg-gray-50 text-gray-600 border-gray-200'}`} title="Content mix strategy type">
                {CONTENT_TYPE_LABELS[post.strategy_content_type] ?? post.strategy_content_type}
              </span>
            )}
            {post.page_title && (
              <span className="text-xs text-gray-400">
                from: <a href={`/blog/${post.page_slug}`} target="_blank" rel="noopener noreferrer" className="underline hover:text-brand inline-flex items-center gap-0.5">
                  {post.page_title} <ExternalLink size={10} />
                </a>
              </span>
            )}
            <span className="ml-auto text-xs flex items-center gap-1">
              {post.status === 'scheduled' && post.scheduled_at && (
                <><Clock size={11} className="text-purple-400" />
                <span className="text-purple-600 font-medium">
                  {new Date(post.scheduled_at) <= new Date() ? 'Publishing soon…' : fmtDate(post.scheduled_at)}
                </span></>
              )}
              {post.status === 'published' && <span className="text-green-600 font-medium">Published {fmtDate(post.published_at)}</span>}
              {post.status === 'failed' && <span className="text-red-500 font-medium">Failed</span>}
              {['draft', 'approved', 'rejected'].includes(post.status) && <span className="text-gray-400">{fmtDate(post.created_at)}</span>}
            </span>
          </div>

          {/* Content — edit mode or read mode */}
          {editId === post.id ? (
            <div className="space-y-3">
              <div className="relative">
                <textarea
                  value={editContent}
                  onChange={(e) => setEditContent(e.target.value)}
                  rows={5}
                  className={`w-full px-3 py-2 rounded-lg border text-sm resize-y outline-none ${editOverLimit ? 'border-red-400' : 'border-brand'}`}
                />
                <span className={`absolute bottom-2 right-3 text-xs ${editOverLimit ? 'text-red-500 font-semibold' : 'text-gray-400'}`}>
                  {editCharCount}/{editMaxChars}
                </span>
              </div>
              <div className="h-1 rounded-full bg-gray-100 overflow-hidden">
                <div className={`h-full rounded-full transition-all ${editOverLimit ? 'bg-red-400' : editCharPct > 80 ? 'bg-amber-400' : 'bg-brand'}`} style={{ width: `${editCharPct}%` }} />
              </div>
              {editOverLimit && (
                <div className="flex items-center gap-1 text-xs text-red-500">
                  <AlertTriangle size={12} /> Over character limit for {post.platform}
                </div>
              )}

              {cfg?.hashtag_mode !== 'none' && (
                <div className="bg-gray-50 rounded-lg p-3 space-y-2">
                  <div className="flex items-center gap-2">
                    <Hash size={14} className="text-gray-500" />
                    <span className="text-xs font-medium text-gray-600">Hashtags</span>
                    <span className="text-xs text-gray-400">{editHashtags.length}/{cfg?.max_hashtags ?? 5} max</span>
                    <button onClick={() => onSuggestHashtags(post)} disabled={suggesting}
                      className="ml-auto flex items-center gap-1 px-2 py-1 bg-purple-50 text-purple-700 text-xs font-medium rounded-md hover:bg-purple-100 disabled:opacity-50">
                      <Sparkles size={12} /> {suggesting ? 'Suggesting…' : 'AI Suggest'}
                    </button>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {editHashtags.map((tag) => (
                      <span key={tag} className="inline-flex items-center gap-1 px-2 py-0.5 bg-brand/10 text-brand text-xs font-medium rounded-full">
                        {tag}<button onClick={() => onRemoveHashtag(tag)} className="hover:text-red-500"><X size={10} /></button>
                      </span>
                    ))}
                  </div>
                  <div className="flex gap-2">
                    <input type="text" value={hashtagInput} onChange={(e) => setHashtagInput(e.target.value)}
                      onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); onAddHashtag(); } }}
                      placeholder="Add hashtag…"
                      className="flex-1 px-2.5 py-1.5 rounded-md border border-gray-200 text-xs outline-none focus:border-brand font-mono" />
                    <button onClick={onAddHashtag} className="px-3 py-1.5 bg-gray-200 text-gray-600 text-xs font-medium rounded-md hover:bg-gray-300">Add</button>
                  </div>
                </div>
              )}

              {CONTENT_TYPES[post.platform] && (
                <div>
                  <label className="text-xs font-medium text-gray-600 block mb-1">Post Type</label>
                  <div className="flex gap-2 flex-wrap">
                    {CONTENT_TYPES[post.platform].map((ct) => (
                      <button key={ct.value} type="button" onClick={() => setEditContentType(ct.value)}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                          editContentType === ct.value ? 'bg-brand text-white border-brand' : 'bg-gray-50 text-gray-600 border-gray-200 hover:bg-gray-100'
                        }`}>
                        <span>{ct.icon}</span> {ct.label}
                      </button>
                    ))}
                  </div>
                  <p className="text-xs text-gray-400 mt-1">{CONTENT_TYPES[post.platform].find((c) => c.value === editContentType)?.hint}</p>
                </div>
              )}

              {/* Image */}
              <div>
                <label className="text-xs font-medium text-gray-600 block mb-1"><ImageIcon size={12} className="inline mr-1" />Image (optional)</label>
                <div className="flex gap-2">
                  <input type="text" value={editImageUrl} onChange={(e) => setEditImageUrl(e.target.value)}
                    placeholder="Paste URL or pick from library"
                    className="flex-1 px-2.5 py-1.5 rounded-lg border border-gray-200 text-xs outline-none focus:border-brand" />
                  {editImageUrl && (
                    <button type="button" onClick={() => setEditImageUrl('')}
                      className="flex items-center px-2 py-1.5 bg-red-50 text-red-500 text-xs rounded-lg hover:bg-red-100 border border-red-100"><X size={13} /></button>
                  )}
                  <button type="button" onClick={() => { setEditMediaPickerTarget('image'); setShowEditMediaPicker(true); }}
                    className="flex items-center gap-1 px-3 py-1.5 bg-gray-100 text-gray-600 text-xs font-medium rounded-lg hover:bg-gray-200 border border-gray-200">
                    <Layers size={12} /> Library
                  </button>
                </div>
                {editImageUrl && (
                  <div className="relative mt-2 w-fit">
                    <img src={editImageUrl} alt="Preview" className="rounded-lg max-h-32 object-contain border border-gray-100" onError={(e) => (e.currentTarget.style.display = 'none')} />
                    <button type="button" onClick={() => setEditImageUrl('')}
                      className="absolute top-1 right-1 w-5 h-5 bg-black/50 hover:bg-red-600 text-white rounded-full flex items-center justify-center"><X size={10} /></button>
                  </div>
                )}
              </div>

              {/* Video */}
              <div>
                <label className="text-xs font-medium text-gray-600 block mb-1"><Film size={12} className="inline mr-1" />Video (optional — overrides image)</label>
                <div className="flex gap-2">
                  <input type="text" value={editVideoUrl} onChange={(e) => setEditVideoUrl(e.target.value)}
                    placeholder="Paste URL or pick from library"
                    className="flex-1 px-2.5 py-1.5 rounded-lg border border-gray-200 text-xs outline-none focus:border-brand" />
                  {editVideoUrl && (
                    <button type="button" onClick={() => setEditVideoUrl('')}
                      className="flex items-center px-2 py-1.5 bg-red-50 text-red-500 text-xs rounded-lg hover:bg-red-100 border border-red-100"><X size={13} /></button>
                  )}
                  <button type="button" onClick={() => { setEditMediaPickerTarget('video'); setShowEditMediaPicker(true); }}
                    className="flex items-center gap-1 px-3 py-1.5 bg-gray-100 text-gray-600 text-xs font-medium rounded-lg hover:bg-gray-200 border border-gray-200">
                    <Layers size={12} /> Library
                  </button>
                </div>
              </div>

              {post.platform === 'youtube' && editContentType === 'short' && (
                <div className="rounded-lg border border-red-100 bg-red-50/50 p-3">
                  <label className="text-xs font-medium text-red-700 block mb-1"><Film size={12} className="inline mr-1" />Short Video URL <span className="font-normal text-red-500">(vertical 9:16, ≤60 s)</span></label>
                  <div className="flex gap-2">
                    <input type="text" value={editShortVideoUrl} onChange={(e) => setEditShortVideoUrl(e.target.value)}
                      placeholder="Paste URL to your Shorts-format video"
                      className="flex-1 px-2.5 py-1.5 rounded-lg border border-red-200 text-xs outline-none focus:border-red-400 bg-white" />
                    {editShortVideoUrl && (
                      <button type="button" onClick={() => setEditShortVideoUrl('')}
                        className="flex items-center px-2 py-1.5 bg-red-100 text-red-500 text-xs rounded-lg hover:bg-red-200 border border-red-200"><X size={13} /></button>
                    )}
                  </div>
                  <p className="text-[10px] text-red-400 mt-1">Takes precedence over Video URL above. #Shorts tag is added automatically.</p>
                </div>
              )}

              {['instagram', 'linkedin'].includes(post.platform) && !editVideoUrl && (
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-xs font-medium text-gray-600 flex items-center gap-1">
                      <ImageIcon size={12} />
                      {post.platform === 'instagram' ? 'Carousel images' : 'Additional images'}
                      <span className="font-normal text-gray-400">({editAdditionalImageUrls.length}/{post.platform === 'instagram' ? 9 : 8} extra)</span>
                    </label>
                    {editAdditionalImageUrls.length < (post.platform === 'instagram' ? 9 : 8) && (
                      <button type="button" onClick={() => { setEditMediaPickerTarget('carousel'); setShowEditMediaPicker(true); }}
                        className="flex items-center gap-1 px-2 py-0.5 text-[11px] text-sky-600 hover:text-sky-800 border border-sky-200 rounded-md bg-sky-50 hover:bg-sky-100">
                        <Plus size={10} /> Add image
                      </button>
                    )}
                  </div>
                  {editAdditionalImageUrls.length > 0 ? (
                    <div className="flex flex-wrap gap-1.5">
                      {editAdditionalImageUrls.map((url, i) => (
                        <div key={url} className="relative group">
                          <img src={url} alt={`Image ${i + 2}`} className="rounded-lg h-14 w-14 object-cover border border-gray-200" onError={(e) => (e.currentTarget.style.display = 'none')} />
                          <button type="button" onClick={() => setEditAdditionalImageUrls((prev) => prev.filter((_, idx) => idx !== i))}
                            className="absolute top-0.5 right-0.5 w-5 h-5 bg-black/50 hover:bg-red-600 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"><X size={9} /></button>
                          <span className="absolute bottom-0.5 left-0.5 text-[9px] bg-black/50 text-white rounded px-0.5">{i + 2}</span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-[11px] text-gray-400 italic">
                      {editImageUrl ? `Add up to ${post.platform === 'instagram' ? 9 : 8} more images to make a carousel` : 'Set a primary image above first'}
                    </p>
                  )}
                </div>
              )}

              {!['instagram', 'linkedin'].includes(post.platform) && editAdditionalImageUrls.length > 0 && (
                <div>
                  <label className="text-xs font-medium text-gray-600 block mb-1"><ImageIcon size={12} className="inline mr-1" />Blog post images <span className="font-normal text-gray-400">(click ✕ to remove)</span></label>
                  <div className="flex flex-wrap gap-2">
                    {editAdditionalImageUrls.map((url, i) => (
                      <div key={url} className="relative group">
                        <img src={url} alt={`Blog image ${i + 1}`} className="rounded-lg h-14 w-14 object-cover border border-gray-200" onError={(e) => (e.currentTarget.style.display = 'none')} />
                        <button type="button" onClick={() => setEditAdditionalImageUrls((prev) => prev.filter((_, idx) => idx !== i))}
                          className="absolute top-0.5 right-0.5 w-5 h-5 bg-black/50 hover:bg-red-600 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"><X size={9} /></button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div>
                <label className="text-xs font-medium text-gray-600 block mb-1">Status</label>
                <select value={editStatus} onChange={(e) => setEditStatus(e.target.value)}
                  className="px-2.5 py-1.5 rounded-lg border border-gray-200 text-xs outline-none focus:border-brand bg-white">
                  <option value="draft">✏️ Draft</option>
                  <option value="approved">✅ Approved</option>
                  <option value="scheduled">🕐 Scheduled</option>
                  <option value="rejected">🚫 Rejected</option>
                </select>
              </div>

              <div className="flex gap-2 pt-1">
                <button onClick={() => onSaveEdit(post.id)} disabled={busy[post.id]}
                  className="px-4 py-1.5 bg-brand text-white text-xs font-medium rounded-lg hover:bg-brand/90 disabled:opacity-50">Save</button>
                <button onClick={() => onSetEditId(null)}
                  className="px-4 py-1.5 bg-gray-100 text-gray-600 text-xs font-medium rounded-lg hover:bg-gray-200">
                  <X size={12} className="inline mr-1" />Cancel
                </button>
              </div>
            </div>
          ) : (
            <div>
              <p className="text-sm text-gray-700 whitespace-pre-wrap leading-relaxed">{displayContent}</p>
              {contentLong && (
                <button onClick={() => onToggleExpand(post.id)} className="mt-1 flex items-center gap-1 text-xs text-brand hover:underline">
                  {isExpanded ? <><ChevronUp size={12} /> Show less</> : <><ChevronDown size={12} /> Show more</>}
                </button>
              )}
              {post.video_url && (
                <div className="mt-2 flex items-center gap-1.5 px-2.5 py-1.5 bg-indigo-50 rounded-lg border border-indigo-100 w-fit">
                  <Film size={13} className="text-indigo-600" />
                  <span className="text-xs font-medium text-indigo-700">{post.content_type === 'reel' ? 'Reel' : 'Video'} attached</span>
                  <a href={post.video_url} target="_blank" rel="noopener noreferrer" className="text-xs text-indigo-500 hover:underline ml-1"><ExternalLink size={11} /></a>
                </div>
              )}
              {post.image_url && !post.video_url && (
                <img src={post.image_url} alt="Post image" className="mt-2 rounded-lg max-h-40 object-cover border border-gray-100" onError={(e) => (e.currentTarget.style.display = 'none')} />
              )}
              {post.additional_image_urls && (() => {
                try {
                  const extras: string[] = JSON.parse(post.additional_image_urls);
                  if (extras.length === 0) return null;
                  const blogExpanded = expandedBlogImages.has(post.id);
                  return (
                    <div className="mt-2">
                      <button onClick={() => setExpandedBlogImages((prev) => { const n = new Set(prev); blogExpanded ? n.delete(post.id) : n.add(post.id); return n; })}
                        className="flex items-center gap-1.5 text-[11px] text-gray-400 hover:text-gray-600 transition-colors">
                        {blogExpanded ? <ChevronUp size={11} /> : <ChevronDown size={11} />}
                        <ImageIcon size={11} />
                        <span className="font-medium">{extras.length} blog image{extras.length > 1 ? 's' : ''}</span>
                      </button>
                      {blogExpanded && (
                        <div className="mt-1.5 flex flex-wrap gap-1.5">
                          {extras.map((url, i) => (
                            <img key={url} src={url} alt={`Blog image ${i + 1}`} className="rounded-lg h-14 w-14 object-cover border border-gray-200" onError={(e) => (e.currentTarget.style.display = 'none')} />
                          ))}
                        </div>
                      )}
                    </div>
                  );
                } catch { return null; }
              })()}
              {parseHashtags(post.hashtags).length > 0 && (
                <div className="flex flex-wrap gap-1 mt-2">
                  {parseHashtags(post.hashtags).map((tag) => (
                    <span key={tag} className="text-xs text-brand font-medium">{tag}</span>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Engagement metrics */}
          {post.status === 'published' && (
            <div className="mt-3 flex items-center gap-4 px-3 py-2 bg-gray-50 rounded-lg border border-gray-100 flex-wrap">
              <span className="text-xs text-gray-500 font-medium">Engagement:</span>
              <span className="text-xs text-gray-700 flex items-center gap-1" title="Likes">❤️ {post.likes ?? '—'}</span>
              <span className="text-xs text-gray-700 flex items-center gap-1" title="Comments">💬 {post.comments_count ?? '—'}</span>
              <span className="text-xs text-gray-700 flex items-center gap-1" title="Shares">↗️ {post.shares ?? '—'}</span>
              <span className="text-xs text-gray-700 flex items-center gap-1" title="Unique reach">👁 {post.reach ?? '—'}</span>
              {post.metrics_updated_at
                ? <span className="text-xs text-gray-400 ml-auto">updated {fmtDate(post.metrics_updated_at)}</span>
                : <span className="text-xs text-gray-400 ml-auto italic">metrics not yet synced</span>
              }
            </div>
          )}

          {post.error_message && (
            <div className="mt-2 flex items-start gap-1.5 p-2 bg-red-50 rounded-lg border border-red-100">
              <AlertTriangle size={13} className="text-red-500 shrink-0 mt-0.5" />
              <p className="text-xs text-red-600">{post.error_message}</p>
            </div>
          )}

          {/* Published actions: Boost + Product Tags */}
          {post.status === 'published' && (
            <div className="mt-3 flex flex-wrap gap-2">
              {['facebook', 'instagram'].includes(post.platform) && (
                <button onClick={() => setBoostPostId(boostPostId === post.id ? null : post.id)}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-orange-50 text-orange-700 text-xs font-medium rounded-lg hover:bg-orange-100 border border-orange-100">
                  <TrendingUp size={12} /> Boost Post
                </button>
              )}
              {['facebook', 'instagram'].includes(post.platform) && (
                <button onClick={() => { setProductTagPostId(productTagPostId === post.id ? null : post.id); if (productTagPostId !== post.id) { setProductSearch(''); onSearchProducts(''); } }}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-teal-50 text-teal-700 text-xs font-medium rounded-lg hover:bg-teal-100 border border-teal-100">
                  <Tag size={12} /> Product Tags {(productTagsMap[post.id]?.length ?? 0) > 0 && <span className="ml-1 bg-teal-200 text-teal-800 rounded-full px-1.5 py-0.5 text-[10px] font-bold">{productTagsMap[post.id].length}</span>}
                </button>
              )}
            </div>
          )}

          {/* Product tag panel */}
          {productTagPostId === post.id && (
            <div className="mt-3 p-3 bg-teal-50 rounded-xl border border-teal-100 space-y-2">
              <p className="text-xs font-semibold text-teal-800">Tag Products (IG/FB Shopping)</p>
              <div className="flex gap-2">
                <input value={productSearch} onChange={(e) => { setProductSearch(e.target.value); onSearchProducts(e.target.value); }}
                  placeholder="Search products…"
                  className="flex-1 px-2.5 py-1.5 rounded-lg border border-teal-200 text-xs outline-none focus:border-teal-400 bg-white" />
                {productSearching && <span className="text-xs text-teal-600 self-center">…</span>}
              </div>
              <div className="max-h-40 overflow-y-auto space-y-1">
                {productResults.map((p) => {
                  const selected = (productTagsMap[post.id] ?? []).some((t) => t.id === p.id);
                  return (
                    <button key={p.id} onClick={() => onToggleProductTag(post.id, p)}
                      className={`flex items-center gap-2 w-full px-2.5 py-1.5 rounded-lg text-xs text-left transition-colors ${
                        selected ? 'bg-teal-200 text-teal-900 font-medium' : 'bg-white hover:bg-teal-100 text-gray-700'
                      } border border-transparent`}>
                      <span className="flex-1">{p.name}</span>
                      {selected && <span className="text-teal-700">✓</span>}
                    </button>
                  );
                })}
                {productResults.length === 0 && !productSearching && (
                  <p className="text-xs text-gray-400 py-2 text-center">No products found</p>
                )}
              </div>
              <div className="flex gap-2 justify-end">
                <button onClick={() => setProductTagPostId(null)} className="px-3 py-1 text-xs text-gray-500 hover:text-gray-700">Cancel</button>
                <button onClick={() => onSaveProductTags(post.id)} className="px-4 py-1 bg-teal-600 text-white text-xs font-medium rounded-lg hover:bg-teal-700">
                  Save Tags ({productTagsMap[post.id]?.length ?? 0})
                </button>
              </div>
            </div>
          )}

          {/* Boost panel */}
          {boostPostId === post.id && (
            <div className="mt-3 p-3 bg-orange-50 rounded-xl border border-orange-100 space-y-3">
              <p className="text-xs font-semibold text-orange-800 flex items-center gap-1.5"><TrendingUp size={13} /> Boost to Meta Ads</p>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                <div>
                  <label className="text-[10px] text-gray-500 font-medium block mb-0.5">Daily budget (¢)</label>
                  <input type="number" min="100" step="100" value={boostBudget} onChange={(e) => setBoostBudget(e.target.value)}
                    className="w-full px-2 py-1.5 rounded-lg border border-orange-200 text-xs outline-none focus:border-orange-400 bg-white" />
                  <p className="text-[10px] text-gray-400 mt-0.5">${(Number.parseInt(boostBudget || '0', 10) / 100).toFixed(2)}/day</p>
                </div>
                <div>
                  <label className="text-[10px] text-gray-500 font-medium block mb-0.5">Duration (days)</label>
                  <input type="number" min="1" max="30" value={boostDays} onChange={(e) => setBoostDays(e.target.value)}
                    className="w-full px-2 py-1.5 rounded-lg border border-orange-200 text-xs outline-none focus:border-orange-400 bg-white" />
                </div>
                <div>
                  <label className="text-[10px] text-gray-500 font-medium block mb-0.5">Objective</label>
                  <select value={boostObjective} onChange={(e) => setBoostObjective(e.target.value)}
                    className="w-full px-2 py-1.5 rounded-lg border border-orange-200 text-xs outline-none focus:border-orange-400 bg-white">
                    <option value="POST_ENGAGEMENT">Engagement</option>
                    <option value="REACH">Reach</option>
                    <option value="LINK_CLICKS">Link Clicks</option>
                  </select>
                </div>
              </div>
              <div className="flex gap-2 justify-end">
                <button onClick={() => setBoostPostId(null)} className="px-3 py-1 text-xs text-gray-500 hover:text-gray-700">Cancel</button>
                <button onClick={() => onBoostPost(post.id)} disabled={boosting}
                  className="flex items-center gap-1.5 px-4 py-1.5 bg-orange-600 text-white text-xs font-medium rounded-lg hover:bg-orange-700 disabled:opacity-50">
                  <TrendingUp size={12} /> {boosting ? 'Boosting…' : `Boost for $${((Number.parseInt(boostBudget || '0', 10) / 100) * Number.parseInt(boostDays || '1', 10)).toFixed(0)}`}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Action bar */}
      {post.status !== 'published' && post.status !== 'rejected' && editId !== post.id && (
        <div className="mt-4 pt-3 border-t border-gray-100 space-y-2">
          <div className="flex items-center gap-2 flex-wrap">
            {post.status === 'draft' && (
              <button onClick={() => onApprove(post.id)} disabled={busy[post.id]}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 text-white text-xs font-semibold rounded-lg hover:bg-blue-700 disabled:opacity-50 shadow-sm">
                <CheckCircle size={13} /> Approve
              </button>
            )}
            {['draft', 'approved', 'failed'].includes(post.status) && (
              <button onClick={() => onPublish(post.id)} disabled={busy[post.id]}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-green-600 text-white text-xs font-semibold rounded-lg hover:bg-green-700 disabled:opacity-50 shadow-sm">
                <CalendarClock size={13} /> {busy[post.id] ? 'Scheduling…' : 'Auto-Schedule'}
              </button>
            )}
            {['draft', 'approved', 'failed'].includes(post.status) && (
              <button onClick={() => { setRescheduleId(rescheduleId === post.id ? null : post.id); setRescheduleValue(''); }}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-50 text-indigo-700 text-xs font-medium rounded-lg hover:bg-indigo-100 border border-indigo-100">
                <Clock size={13} /> Schedule
              </button>
            )}

            {/* Analysis button */}
            <button
              onClick={() => {
                const isOpen = hasPrediction || hasPreview;
                if (isOpen) {
                  onClearAnalysis(post.id);
                } else {
                  setAnalysisTab((prev) => ({ ...prev, [post.id]: 'score' }));
                  onPredictScore(post.id);
                }
              }}
              disabled={predictions[post.id] === 'loading' || previews[post.id] === 'loading'}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg disabled:opacity-50 border transition-colors ${
                hasPrediction || hasPreview
                  ? 'bg-purple-600 text-white border-purple-600 hover:bg-purple-700'
                  : 'bg-purple-50 text-purple-700 border-purple-100 hover:bg-purple-100'
              }`}>
              <Star size={13} />
              {predictions[post.id] === 'loading' || previews[post.id] === 'loading' ? 'Loading…' :
                (hasPrediction || hasPreview) ? 'Analysis ✓' : 'Analyse'}
            </button>

            {/* Tools overflow menu */}
            <div className="relative">
              <button onClick={() => setOverflowOpen((prev) => ({ ...prev, [post.id]: !prev[post.id] }))}
                className="flex items-center gap-1 px-2.5 py-1.5 bg-gray-50 text-gray-500 text-xs font-medium rounded-lg hover:bg-gray-100 border border-gray-200">
                <MoreHorizontal size={14} />
              </button>
              {overflowOpen[post.id] && (
                <div className="absolute left-0 top-full mt-1 z-20 w-48 bg-white rounded-xl border border-gray-200 shadow-lg py-1 text-xs">
                  <button onClick={() => {
                    onSetEditId(post.id);
                    setOverflowOpen((prev) => ({ ...prev, [post.id]: false }));
                  }} className="flex items-center gap-2 w-full px-3 py-2 hover:bg-gray-50 text-gray-700">
                    <Pencil size={12} /> Edit post
                  </button>
                  {['approved', 'scheduled', 'failed'].includes(post.status) && (
                    <button onClick={() => { setRescheduleId(rescheduleId === post.id ? null : post.id); setRescheduleValue(''); setOverflowOpen((prev) => ({ ...prev, [post.id]: false })); }}
                      className="flex items-center gap-2 w-full px-3 py-2 hover:bg-gray-50 text-gray-700">
                      <Clock size={12} /> Pick schedule time
                    </button>
                  )}
                  <button onClick={() => { onCheckCompliance(post.id); setOverflowOpen((prev) => ({ ...prev, [post.id]: false })); }} disabled={busy[post.id]}
                    className="flex items-center gap-2 w-full px-3 py-2 hover:bg-gray-50 text-gray-700 disabled:opacity-50">
                    <ShieldCheck size={12} /> Check Compliance
                  </button>
                  {post.compliance_status && ['warning', 'violation'].includes(post.compliance_status) && (
                    <button onClick={() => { onFixCompliance(post.id); setOverflowOpen((prev) => ({ ...prev, [post.id]: false })); }} disabled={busy[post.id]}
                      className="flex items-center gap-2 w-full px-3 py-2 hover:bg-amber-50 text-amber-700 disabled:opacity-50">
                      <Wand2 size={12} /> Auto-Fix Compliance
                    </button>
                  )}
                  {['draft', 'approved', 'failed'].includes(post.status) && (
                    <button onClick={() => { onPublishNow(post.id); setOverflowOpen((prev) => ({ ...prev, [post.id]: false })); }} disabled={busy[post.id]}
                      className="flex items-center gap-2 w-full px-3 py-2 hover:bg-green-50 text-green-700 disabled:opacity-50">
                      <Send size={12} /> Publish Now
                    </button>
                  )}
                  <div className="border-t border-gray-100 my-1" />
                  <button onClick={() => { onReject(post.id); setOverflowOpen((prev) => ({ ...prev, [post.id]: false })); }} disabled={busy[post.id]}
                    className="flex items-center gap-2 w-full px-3 py-2 hover:bg-red-50 text-red-600 disabled:opacity-50">
                    <XCircle size={12} /> Reject
                  </button>
                  <button onClick={() => { onRemove(post.id); setOverflowOpen((prev) => ({ ...prev, [post.id]: false })); }} disabled={busy[post.id]}
                    className="flex items-center gap-2 w-full px-3 py-2 hover:bg-red-50 text-red-500 disabled:opacity-50">
                    <Trash2 size={12} /> Delete permanently
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Unified Analysis panel */}
          {(hasPrediction || hasPreview) && (
            <div className="mt-2 rounded-xl border border-gray-200 overflow-hidden">
              <div className="flex items-center border-b border-gray-200 bg-gray-50">
                <button
                  onClick={() => { setAnalysisTab((prev) => ({ ...prev, [post.id]: 'score' })); if (!hasPrediction) onPredictScore(post.id); }}
                  disabled={predictions[post.id] === 'loading'}
                  className={`flex items-center gap-1.5 px-4 py-2 text-xs font-medium border-b-2 transition-colors ${
                    tab === 'score' ? 'border-purple-500 text-purple-700 bg-white' : 'border-transparent text-gray-500 hover:text-gray-700'
                  }`}>
                  <Star size={12} />
                  Quality Score
                  {pred && <span className={`ml-1 font-bold ${pred.quality_score >= 8 ? 'text-green-600' : pred.quality_score >= 5 ? 'text-amber-600' : 'text-red-600'}`}>{pred.quality_score}/10</span>}
                  {predictions[post.id] === 'loading' && <span className="ml-1 text-gray-400">Scoring…</span>}
                </button>
                <button
                  onClick={() => { setAnalysisTab((prev) => ({ ...prev, [post.id]: 'preview' })); if (!hasPreview) onPreviewPost(post); }}
                  disabled={previews[post.id] === 'loading'}
                  className={`flex items-center gap-1.5 px-4 py-2 text-xs font-medium border-b-2 transition-colors ${
                    tab === 'preview' ? 'border-sky-500 text-sky-700 bg-white' : 'border-transparent text-gray-500 hover:text-gray-700'
                  }`}>
                  <ImageIcon size={12} />
                  Platform Preview
                  {prev && prev.warnings.filter((w) => w.level === 'error').length > 0 && <span className="ml-1 w-4 h-4 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center">{prev.warnings.filter((w) => w.level === 'error').length}</span>}
                  {prev && prev.warnings.filter((w) => w.level === 'error').length === 0 && prev.warnings.filter((w) => w.level === 'warning').length > 0 && <span className="ml-1 w-4 h-4 bg-amber-400 text-white text-[10px] font-bold rounded-full flex items-center justify-center">{prev.warnings.filter((w) => w.level === 'warning').length}</span>}
                  {prev && prev.warnings.length === 0 && <CheckCircle size={11} className="ml-1 text-green-500" />}
                  {previews[post.id] === 'loading' && <span className="ml-1 text-gray-400">Loading…</span>}
                </button>
                <button onClick={() => onClearAnalysis(post.id)} title="Close analysis"
                  className="ml-auto mr-2 p-1 text-gray-400 hover:text-gray-600 rounded">
                  <XCircle size={13} />
                </button>
              </div>

              {tab === 'score' && pred && (
                <div className="p-3 bg-white space-y-2.5">
                  <div className="flex items-center gap-3 flex-wrap">
                    <div className="flex items-center gap-1.5 text-xs text-gray-500">
                      <TrendingUp size={12} className="text-indigo-400" />
                      ~{pred.predicted_reach.toLocaleString()} reach · ~{pred.predicted_engagement} engagements
                    </div>
                    <span className="ml-auto text-[11px] text-gray-400 italic">{Math.round(pred.confidence * 100)}% confidence</span>
                  </div>
                  {pred.suggestions.length > 0 && (
                    <div className="space-y-1">
                      {pred.suggestions.map((s, i) => (
                        <div key={i} className="flex gap-2 items-start text-xs text-purple-700 bg-purple-50 rounded-lg px-2.5 py-1.5 border border-purple-100">
                          <Sparkles size={11} className="mt-0.5 shrink-0 text-purple-400" />{s}
                        </div>
                      ))}
                    </div>
                  )}
                  <div className="flex items-center gap-2 pt-0.5 border-t border-gray-100">
                    <button onClick={async () => { await onImprovePost(post.id); onPredictScore(post.id); setAnalysisTab((prev) => ({ ...prev, [post.id]: 'score' })); }}
                      disabled={improving[post.id]}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-purple-600 text-white text-xs font-semibold rounded-lg hover:bg-purple-700 disabled:opacity-50 shadow-sm">
                      <Wand2 size={12} /> {improving[post.id] ? 'Improving…' : 'Improve with AI'}
                    </button>
                    <button onClick={() => onPredictScore(post.id)} disabled={predictions[post.id] === 'loading'}
                      className="flex items-center gap-1 px-2 py-1.5 text-xs text-gray-500 hover:text-purple-600 border border-gray-200 hover:border-purple-300 rounded-lg transition-colors disabled:opacity-40">
                      <RefreshCw size={11} /> Refresh score
                    </button>
                  </div>
                </div>
              )}

              {tab === 'preview' && prev && (() => {
                const errors = prev.warnings.filter((w) => w.level === 'error');
                const warns = prev.warnings.filter((w) => w.level === 'warning');
                const charPct = Math.min(100, Math.round((prev.character_count / prev.character_limit) * 100));
                const charOver = prev.character_count > prev.character_limit;
                return (
                  <div className="bg-white space-y-0">
                    {prev.warnings.length > 0 && (
                      <div className="px-3 pt-3 space-y-1.5">
                        {[...errors, ...warns].map((w, i) => (
                          <div key={i} className={`flex items-start gap-2 px-2.5 py-2 rounded-lg text-xs font-medium ${w.level === 'error' ? 'bg-red-50 text-red-700 border border-red-200' : 'bg-amber-50 text-amber-700 border border-amber-200'}`}>
                            <AlertTriangle size={12} className="mt-0.5 shrink-0" />{w.message}
                          </div>
                        ))}
                      </div>
                    )}
                    <div className="flex items-center gap-3 px-3 py-2 border-b border-gray-100 text-xs">
                      <span className={`flex items-center gap-1 font-medium ${charOver ? 'text-red-600' : charPct > 80 ? 'text-amber-600' : 'text-gray-400'}`}>
                        {charOver ? '⚠️' : '✓'} {prev.character_count}/{prev.character_limit >= 10000 ? '63k' : prev.character_limit} chars
                      </span>
                      {prev.hashtag_limit > 0 && (prev.hashtag_count > prev.hashtag_limit || prev.hashtag_count === 0) && (
                        <span className="text-amber-600 font-medium">{prev.hashtag_count} hashtags (ideal: {prev.hashtag_recommend})</span>
                      )}
                      {!charOver && charPct <= 80 && !(prev.hashtag_limit > 0 && (prev.hashtag_count > prev.hashtag_limit || prev.hashtag_count === 0)) && prev.warnings.length === 0 && (
                        <span className="text-green-600 font-medium">✓ Looks good for {prev.platform}</span>
                      )}
                    </div>
                    <div className="mx-3 mb-3 rounded-xl border border-gray-200 overflow-hidden">
                      <div className="flex items-center gap-2.5 px-3 pt-2.5 pb-2 bg-white">
                        <div className="w-7 h-7 rounded-full bg-brand/20 flex items-center justify-center text-xs font-bold text-brand capitalize shrink-0">{post.platform[0]}</div>
                        <div><p className="text-xs font-semibold text-gray-800">Your Page</p><p className="text-[10px] text-gray-400">Just now · 🌍</p></div>
                      </div>
                      <p className="text-xs text-gray-700 whitespace-pre-wrap leading-relaxed px-3 pb-2.5">{prev.formatted_preview}</p>
                      {post.image_url && !post.video_url && (
                        <img src={post.image_url} alt="" className="w-full max-h-40 object-cover border-t border-gray-100" onError={(e) => (e.currentTarget.style.display = 'none')} />
                      )}
                      {post.video_url && (
                        <div className="mx-3 mb-2 flex items-center gap-2 bg-gray-100 rounded-lg px-3 py-2">
                          <Film size={13} className="text-gray-500" />
                          <span className="text-xs text-gray-600">{post.content_type === 'reel' ? 'Reel' : 'Video'} attached</span>
                        </div>
                      )}
                      <div className="flex items-center gap-4 px-3 py-2 border-t border-gray-100 bg-gray-50">
                        <span className="text-[11px] text-gray-400">👍 Like</span>
                        <span className="text-[11px] text-gray-400">💬 Comment</span>
                        <span className="text-[11px] text-gray-400">➡️ Share</span>
                      </div>
                    </div>
                    {prev.tips.length > 0 && (
                      <div className="px-3 space-y-1">
                        {prev.tips.map((t, i) => (
                          <div key={i} className="flex items-start gap-1.5 text-xs text-sky-700 bg-sky-50 rounded-lg px-2.5 py-1.5 border border-sky-100">
                            <span className="shrink-0">💡</span>{t}
                          </div>
                        ))}
                      </div>
                    )}
                    <div className="flex items-center gap-2 px-3 py-3 border-t border-gray-100 mt-3">
                      <button onClick={async () => { await onImprovePost(post.id); onPredictScore(post.id); setAnalysisTab((prev2) => ({ ...prev2, [post.id]: 'score' })); }}
                        disabled={improving[post.id]}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-purple-600 text-white text-xs font-semibold rounded-lg hover:bg-purple-700 disabled:opacity-50 shadow-sm">
                        <Wand2 size={12} /> {improving[post.id] ? 'Improving…' : 'Improve with AI'}
                      </button>
                      {prev.warnings.length > 0 && <span className="text-[11px] text-gray-400 italic">AI will fix the issues above</span>}
                    </div>
                  </div>
                );
              })()}
            </div>
          )}

          {/* Schedule picker */}
          {rescheduleId === post.id && (
            <div className="flex flex-wrap items-center gap-2 p-3 bg-purple-50 rounded-lg border border-purple-100">
              <Clock size={14} className="text-purple-500 shrink-0" />
              <span className="text-xs text-purple-700 font-medium">Pick a date & time:</span>
              <input type="datetime-local" value={rescheduleValue} onChange={(e) => setRescheduleValue(e.target.value)}
                className="text-xs border border-purple-200 rounded-md px-2 py-1 bg-white outline-none focus:ring-1 focus:ring-purple-400" />
              <button onClick={() => onReschedule(post.id)} disabled={busy[post.id] || !rescheduleValue}
                className="px-3 py-1 bg-purple-600 text-white text-xs font-medium rounded-md hover:bg-purple-700 disabled:opacity-50">Confirm</button>
              <button onClick={() => { setRescheduleId(null); setRescheduleValue(''); }}
                className="px-2 py-1 text-xs text-gray-500 hover:text-gray-700">Cancel</button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
