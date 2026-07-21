'use client';

import { useEffect, useState, useMemo } from 'react';
import { useSearchParams } from 'next/navigation';
import { api } from '@/lib/api';
import { addToast } from '@/lib/toast';

export type SocialPost = {
  id: number;
  platform: string;
  content: string;
  hashtags: string | null;
  image_url: string | null;
  video_url: string | null;
  short_video_url: string | null;
  content_type: string | null;
  link_url: string | null;
  status: string;
  page_title: string | null;
  page_slug: string | null;
  created_at: string;
  published_at: string | null;
  scheduled_at: string | null;
  error_message: string | null;
  impressions: number | null;
  likes: number | null;
  comments_count: number | null;
  shares: number | null;
  reach: number | null;
  metrics_updated_at: string | null;
  additional_image_urls: string | null;
  compliance_status: 'clean' | 'warning' | 'violation' | 'unchecked' | null;
  compliance_checked_at: string | null;
  compliance_issues_count: number | null;
  strategy_content_type: string | null;
};

export type PlatformConfig = {
  platform: string;
  enabled: boolean;
  max_hashtags: number;
  max_caption_chars: number;
  hashtag_mode: string;
};

export type Prediction = {
  quality_score: number;
  predicted_reach: number;
  predicted_engagement: number;
  confidence: number;
  strengths: string[];
  weaknesses: string[];
  suggestions: string[];
};

export type McD = {
  platform: string;
  content: string;
  strategy_content_type: string;
  image_url: string | null;
  additional_image_urls?: string[];
  status: 'ok' | 'error';
  error?: string;
  discarded?: boolean;
};

export type PostPreview = {
  platform: string;
  formatted_preview: string;
  character_count: number;
  character_limit: number;
  within_limit: boolean;
  hashtag_count: number;
  hashtag_limit: number;
  hashtag_recommend: string;
  image_count: number;
  has_video: boolean;
  warnings: { level: 'error' | 'warning'; message: string }[];
  tips: string[];
};

export function parseHashtags(raw: string | null): string[] {
  if (!raw) return [];
  try { return JSON.parse(raw); } catch { return []; }
}

export function formatHashtags(tags: string[]): string {
  return JSON.stringify(tags);
}

const PAGE_SIZE = 50;

export function useOutboxState() {
  const searchParams = useSearchParams();

  // ── Posts & pagination ──────────────────────────────────────────────────────
  const [posts, setPosts] = useState<SocialPost[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [filterPlatform, setFilterPlatform] = useState('');
  const [filterStatus, setFilterStatus] = useState(
    () => searchParams.get('status') ?? 'draft'
  );

  // ── Platform config ─────────────────────────────────────────────────────────
  const [platformConfigs, setPlatformConfigs] = useState<Record<string, PlatformConfig>>({});

  // ── Per-post busy state ─────────────────────────────────────────────────────
  const [busy, setBusy] = useState<Record<number, boolean>>({});

  // ── Edit modal ──────────────────────────────────────────────────────────────
  const [editId, setEditId] = useState<number | null>(null);
  const [editContent, setEditContent] = useState('');
  const [editHashtags, setEditHashtags] = useState<string[]>([]);
  const [editImageUrl, setEditImageUrl] = useState('');
  const [editVideoUrl, setEditVideoUrl] = useState('');
  const [editShortVideoUrl, setEditShortVideoUrl] = useState('');
  const [editAdditionalImageUrls, setEditAdditionalImageUrls] = useState<string[]>([]);
  const [editContentType, setEditContentType] = useState('feed');
  const [editStatus, setEditStatus] = useState('draft');
  const [hashtagInput, setHashtagInput] = useState('');
  const [suggesting, setSuggesting] = useState(false);
  const [editMediaPickerTarget, setEditMediaPickerTarget] = useState<'image' | 'video' | 'carousel'>('image');
  const [showEditMediaPicker, setShowEditMediaPicker] = useState(false);

  // ── Reschedule ──────────────────────────────────────────────────────────────
  const [rescheduleId, setRescheduleId] = useState<number | null>(null);
  const [rescheduleValue, setRescheduleValue] = useState('');

  // ── Create post ─────────────────────────────────────────────────────────────
  const [showCreate, setShowCreate] = useState(false);
  const [newPlatform, setNewPlatform] = useState('facebook');
  const [newContent, setNewContent] = useState('');
  const [newImageUrl, setNewImageUrl] = useState('');
  const [newAdditionalImageUrls, setNewAdditionalImageUrls] = useState<string[]>([]);
  const [newVideoUrl, setNewVideoUrl] = useState('');
  const [newContentType, setNewContentType] = useState('feed');
  const [newThumbOffset, setNewThumbOffset] = useState('');
  const [newStrategyContentType, setNewStrategyContentType] = useState('');
  const [newHashtags, setNewHashtags] = useState<string[]>([]);
  const [newHashtagInput, setNewHashtagInput] = useState('');
  const [creating, setCreating] = useState(false);
  const [showMediaPicker, setShowMediaPicker] = useState(false);
  const [mediaPickerTarget, setMediaPickerTarget] = useState<'image' | 'video' | 'carousel'>('image');

  // ── Bulk & selection ────────────────────────────────────────────────────────
  const [expandedIds, setExpandedIds] = useState<Set<number>>(new Set());
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [bulkBusy, setBulkBusy] = useState(false);

  // ── UI state ────────────────────────────────────────────────────────────────
  const [showHelp, setShowHelp] = useState(true);
  const [viewMode, setViewMode] = useState<'list' | 'calendar'>('list');
  const [calendarDate, setCalendarDate] = useState(() => {
    const d = new Date(); d.setDate(d.getDate() - d.getDay()); return d;
  });
  const [expandedBlogImages, setExpandedBlogImages] = useState<Set<number>>(new Set());
  const [overflowOpen, setOverflowOpen] = useState<Record<number, boolean>>({});

  // ── AI analysis ─────────────────────────────────────────────────────────────
  const [predictions, setPredictions] = useState<Record<number, Prediction | 'loading'>>({});
  const [improving, setImproving] = useState<Record<number, boolean>>({});
  const [previews, setPreviews] = useState<Record<number, PostPreview | 'loading'>>({});
  const [analysisTab, setAnalysisTab] = useState<Record<number, 'score' | 'preview'>>({});

  // ── Product tag picker ──────────────────────────────────────────────────────
  const [productTagPostId, setProductTagPostId] = useState<number | null>(null);
  const [productSearch, setProductSearch] = useState('');
  const [productResults, setProductResults] = useState<{ id: number; name: string; slug: string; image_path: string | null }[]>([]);
  const [productTagsMap, setProductTagsMap] = useState<Record<number, { id: number; name: string }[]>>({});
  const [productSearching, setProductSearching] = useState(false);

  // ── Boost modal ─────────────────────────────────────────────────────────────
  const [boostPostId, setBoostPostId] = useState<number | null>(null);
  const [boostBudget, setBoostBudget] = useState('1000');
  const [boostDays, setBoostDays] = useState('3');
  const [boostObjective, setBoostObjective] = useState('POST_ENGAGEMENT');
  const [boosting, setBoosting] = useState(false);

  // ── AI Generate panel ───────────────────────────────────────────────────────
  const [showAiGenerate, setShowAiGenerate] = useState(false);
  const [aiTopic, setAiTopic] = useState('');
  const [aiExtraContext, setAiExtraContext] = useState('');
  const [aiGenerating, setAiGenerating] = useState(false);
  const [aiGeneratedTopic, setAiGeneratedTopic] = useState('');

  // ── Moment Capture panel ────────────────────────────────────────────────────
  const [showMomentCapture, setShowMomentCapture] = useState(false);
  const [mcMoment, setMcMoment] = useState('');
  const [mcExtraContext, setMcExtraContext] = useState('');
  const [mcImageUrls, setMcImageUrls] = useState<string[]>([]);
  const [mcUploading, setMcUploading] = useState(false);
  const [mcGenerating, setMcGenerating] = useState(false);
  const [mcDrafts, setMcDrafts] = useState<McD[]>([]);
  const [mcSaving, setMcSaving] = useState(false);
  const [showMcMediaPicker, setShowMcMediaPicker] = useState(false);

  // ── Load platform configs once ──────────────────────────────────────────────
  useEffect(() => {
    api.get<PlatformConfig[]>('/api/admin/social/platforms')
      .then((cfgs) => {
        const map: Record<string, PlatformConfig> = {};
        cfgs.forEach((c) => { map[c.platform] = c; });
        setPlatformConfigs(map);
      })
      .catch(console.error);
  }, []);

  // ── Data fetching ───────────────────────────────────────────────────────────
  async function load(p = 1) {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (filterPlatform) params.set('platform', filterPlatform);
      if (filterStatus)   params.set('post_status', filterStatus);
      params.set('limit', String(PAGE_SIZE));
      params.set('page', String(p));
      const data = await api.get<{ posts: SocialPost[]; total: number }>(
        `/api/admin/social/outbox?${params}`
      );
      setPosts((prev) => p === 1 ? data.posts : [...prev, ...data.posts]);
      setTotal(data.total);
      setPage(p);
    } catch {
      addToast('Failed to load outbox', 'error');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { setPage(1); load(1); }, [filterPlatform, filterStatus]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Post actions ────────────────────────────────────────────────────────────
  async function approve(id: number) {
    setBusy((b) => ({ ...b, [id]: true }));
    try {
      await api.patch(`/api/admin/social/outbox/${id}`, { status: 'approved' });
      addToast('Approved', 'success');
      load();
    } catch { addToast('Failed', 'error'); }
    finally { setBusy((b) => ({ ...b, [id]: false })); }
  }

  async function reject(id: number) {
    setBusy((b) => ({ ...b, [id]: true }));
    try {
      await api.patch(`/api/admin/social/outbox/${id}`, { status: 'rejected' });
      addToast('Rejected', 'success');
      load();
    } catch { addToast('Failed', 'error'); }
    finally { setBusy((b) => ({ ...b, [id]: false })); }
  }

  async function publish(id: number) {
    setBusy((b) => ({ ...b, [id]: true }));
    try {
      const data = await api.post<{ queued: boolean; scheduled_at: string; strategy_slot: boolean }>(
        `/api/admin/social/outbox/${id}/publish?immediate=false`, {}
      );
      const when = new Date(data.scheduled_at).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' });
      addToast(
        data.strategy_slot
          ? `Scheduled for ${when} (strategy best time)`
          : `Queued — will publish within 60 seconds`,
        'success'
      );
      load();
    } catch (e: unknown) {
      const raw = (e as { detail?: unknown })?.detail;
      let msg: string;
      if (typeof raw === 'string') { msg = raw; }
      else if (raw) { msg = JSON.stringify(raw); }
      else { msg = 'Failed to queue post'; }
      addToast(msg, 'error');
    } finally { setBusy((b) => ({ ...b, [id]: false })); }
  }

  async function publishNow(id: number) {
    setBusy((b) => ({ ...b, [id]: true }));
    try {
      await api.post(`/api/admin/social/outbox/${id}/publish?immediate=true`, {});
      addToast('Queued — will publish within 60 seconds', 'success');
      load();
    } catch (e: unknown) {
      const raw = (e as { detail?: unknown })?.detail;
      let msg: string;
      if (typeof raw === 'string') { msg = raw; }
      else if (raw) { msg = JSON.stringify(raw); }
      else { msg = 'Failed to queue post'; }
      addToast(msg, 'error');
    } finally { setBusy((b) => ({ ...b, [id]: false })); }
  }

  async function autoSchedule(id: number) {
    setBusy((b) => ({ ...b, [id]: true }));
    try {
      const data = await api.post<{ scheduled: boolean; scheduled_at: string }>(
        `/api/admin/social/outbox/${id}/auto-schedule`, {}
      );
      const when = new Date(data.scheduled_at).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' });
      addToast(`Scheduled for ${when}`, 'success');
      load();
    } catch (e: unknown) {
      const raw = (e as { detail?: unknown })?.detail;
      let msg: string;
      if (typeof raw === 'string') { msg = raw; }
      else if (raw) { msg = JSON.stringify(raw); }
      else { msg = 'Failed to auto-schedule'; }
      addToast(msg, 'error');
    } finally { setBusy((b) => ({ ...b, [id]: false })); }
  }

  async function reschedule(id: number) {
    if (!rescheduleValue) { addToast('Pick a date and time', 'error'); return; }
    setBusy((b) => ({ ...b, [id]: true }));
    try {
      const iso = new Date(rescheduleValue).toISOString();
      await api.patch(`/api/admin/social/outbox/${id}`, { status: 'scheduled', scheduled_at: iso });
      addToast('Rescheduled', 'success');
      setRescheduleId(null);
      setRescheduleValue('');
      load();
    } catch (e: unknown) {
      const msg = (e as { detail?: string })?.detail ?? 'Failed to reschedule';
      addToast(msg, 'error');
    } finally { setBusy((b) => ({ ...b, [id]: false })); }
  }

  async function checkCompliance(id: number) {
    setBusy((b) => ({ ...b, [id]: true }));
    try {
      const data = await api.post<{ status: string; severity: string; issues: Array<{ severity: string; category: string; description: string }>; can_auto_fix: boolean }>(
        `/api/admin/social/outbox/${id}/check-compliance`, {}
      );
      if (data.status === 'clean') {
        addToast('✓ Content is compliant', 'success');
      } else if (data.issues.length === 0) {
        addToast(`Compliance: ${data.status}`, 'info');
      } else {
        addToast(`${data.issues.length} compliance issue(s) found — ${data.can_auto_fix ? 'can auto-fix' : 'manual review required'}`, 'error');
      }
      load();
    } catch (e: unknown) {
      const msg = (e as { detail?: string })?.detail ?? 'Failed to check compliance';
      addToast(msg, 'error');
    } finally { setBusy((b) => ({ ...b, [id]: false })); }
  }

  async function fixCompliance(id: number) {
    setBusy((b) => ({ ...b, [id]: true }));
    try {
      const data = await api.post<{ fixed: boolean; new_status: string; remaining_issues: number; can_publish: boolean; reason?: string }>(
        `/api/admin/social/outbox/${id}/fix-compliance`, {}
      );
      if (data.fixed) {
        const fixDetail = data.can_publish ? 'ready to publish' : `${data.remaining_issues} issue(s) remaining`;
        const fixSeverity = data.can_publish ? 'success' : 'info';
        addToast(`Content auto-fixed — ${fixDetail}`, fixSeverity);
      } else {
        addToast(`Could not auto-fix: ${data.reason}`, 'error');
      }
      load();
    } catch (e: unknown) {
      const msg = (e as { detail?: string })?.detail ?? 'Failed to fix compliance';
      addToast(msg, 'error');
    } finally { setBusy((b) => ({ ...b, [id]: false })); }
  }

  async function remove(id: number) {
    if (!confirm('Delete this draft?')) return;
    setBusy((b) => ({ ...b, [id]: true }));
    try {
      await api.delete(`/api/admin/social/outbox/${id}`);
      addToast('Deleted', 'success');
      load();
    } catch { addToast('Failed', 'error'); }
    finally { setBusy((b) => ({ ...b, [id]: false })); }
  }

  async function saveEdit(id: number) {
    setBusy((b) => ({ ...b, [id]: true }));
    try {
      await api.patch(`/api/admin/social/outbox/${id}`, {
        content: editContent,
        hashtags: formatHashtags(editHashtags),
        image_url: editImageUrl.trim() || null,
        video_url: editVideoUrl.trim() || null,
        short_video_url: editShortVideoUrl.trim() || null,
        additional_image_urls: editAdditionalImageUrls.length > 0 ? JSON.stringify(editAdditionalImageUrls) : null,
        content_type: editContentType,
        status: editStatus,
      });
      addToast('Saved', 'success');
      setEditId(null);
      load();
    } catch { addToast('Failed', 'error'); }
    finally { setBusy((b) => ({ ...b, [id]: false })); }
  }

  // ── Hashtag helpers ─────────────────────────────────────────────────────────
  async function suggestHashtags(post: SocialPost) {
    setSuggesting(true);
    try {
      const data = await api.post<{ hashtags: string[]; note: string }>(
        '/api/admin/social/hashtags/suggest',
        { content: editContent || post.content, platform: post.platform }
      );
      setEditHashtags(data.hashtags);
      if (data.note) addToast(data.note, 'info');
    } catch { addToast('Failed to suggest hashtags', 'error'); }
    finally { setSuggesting(false); }
  }

  async function suggestNewHashtags() {
    setSuggesting(true);
    try {
      const data = await api.post<{ hashtags: string[]; note: string }>(
        '/api/admin/social/hashtags/suggest',
        { content: newContent, platform: newPlatform }
      );
      setNewHashtags(data.hashtags);
    } catch { addToast('Failed to suggest', 'error'); }
    finally { setSuggesting(false); }
  }

  function addHashtag() {
    const tag = hashtagInput.trim();
    if (!tag) return;
    const formatted = tag.startsWith('#') ? tag : `#${tag}`;
    if (!editHashtags.includes(formatted)) {
      setEditHashtags([...editHashtags, formatted]);
    }
    setHashtagInput('');
  }

  function removeHashtag(tag: string) {
    setEditHashtags(editHashtags.filter((t) => t !== tag));
  }

  // ── Bulk actions ────────────────────────────────────────────────────────────
  async function bulkAutoSchedule() {
    if (selectedIds.size === 0) { addToast('Select posts first', 'error'); return; }
    setBulkBusy(true);
    let ok = 0; let fail = 0;
    for (const id of Array.from(selectedIds)) {
      try {
        await api.post(`/api/admin/social/outbox/${id}/auto-schedule`, {});
        ok++;
      } catch { fail++; }
    }
    setBulkBusy(false);
    setSelectedIds(new Set());
    if (ok > 0) addToast(`${ok} post${ok > 1 ? 's' : ''} auto-scheduled`, 'success');
    if (fail > 0) addToast(`${fail} post${fail > 1 ? 's' : ''} failed`, 'error');
    load();
  }

  function toggleSelect(id: number) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  function toggleSelectAll() {
    const selectable = posts.filter((p) => ['draft', 'approved', 'failed'].includes(p.status)).map((p) => p.id);
    if (selectable.every((id) => selectedIds.has(id))) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(selectable));
    }
  }

  function toggleExpand(id: number) {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  // ── Create post ─────────────────────────────────────────────────────────────
  async function createPost() {
    if (!newContent.trim()) { addToast('Content is required', 'error'); return; }
    setCreating(true);
    try {
      await api.post('/api/admin/social/outbox', {
        platform: newPlatform,
        content: newContent,
        content_type: newContentType,
        image_url: newImageUrl.trim() || null,
        video_url: newVideoUrl.trim() || null,
        hashtags: newHashtags.length > 0 ? formatHashtags(newHashtags) : null,
        thumb_offset_ms: newThumbOffset ? Number.parseInt(newThumbOffset, 10) : null,
        additional_image_urls: newAdditionalImageUrls.length > 0 ? JSON.stringify(newAdditionalImageUrls) : null,
        strategy_content_type: newStrategyContentType || null,
      });
      addToast('Draft created', 'success');
      setShowCreate(false);
      setNewContent(''); setNewImageUrl(''); setNewAdditionalImageUrls([]);
      setNewVideoUrl(''); setNewContentType('feed'); setNewThumbOffset('');
      setNewStrategyContentType(''); setNewHashtags([]);
      setShowAiGenerate(false); setAiTopic(''); setAiExtraContext('');
      setFilterStatus('draft');
      load();
    } catch { addToast('Failed to create post', 'error'); }
    finally { setCreating(false); }
  }

  // ── AI actions ──────────────────────────────────────────────────────────────
  async function generateDraft() {
    if (!aiTopic.trim()) { addToast('Enter a topic first', 'error'); return; }
    setAiGenerating(true);
    try {
      const data = await api.post<{ content: string }>(
        '/api/admin/social/generate-draft',
        { topic: aiTopic.trim(), platform: newPlatform, extra_context: aiExtraContext.trim() }
      );
      setNewContent(data.content);
      setAiGeneratedTopic(aiTopic.trim());
      setShowAiGenerate(false);
      setAiTopic(''); setAiExtraContext('');
      addToast('Draft generated — review and edit before posting', 'success');
    } catch (e: any) {
      addToast(e?.detail ?? 'AI generation failed', 'error');
    } finally { setAiGenerating(false); }
  }

  async function predictScore(postId: number) {
    setPredictions(prev => ({ ...prev, [postId]: 'loading' }));
    try {
      const data = await api.post<Prediction>(`/api/admin/social/outbox/${postId}/predict`, {});
      setPredictions(prev => ({ ...prev, [postId]: data }));
    } catch {
      addToast('Prediction failed', 'error');
      setPredictions(prev => { const n = { ...prev }; delete n[postId]; return n; });
    }
  }

  async function previewPost(post: SocialPost) {
    setPreviews(prev => ({ ...prev, [post.id]: 'loading' }));
    try {
      let additionalUrls: string[] = [];
      if (post.additional_image_urls) {
        try { additionalUrls = JSON.parse(post.additional_image_urls); } catch {}
      }
      const data = await api.post<PostPreview>('/api/admin/social/preview', {
        content: post.content,
        platform: post.platform,
        hashtags: parseHashtags(post.hashtags),
        image_url: post.image_url,
        video_url: post.video_url,
        additional_image_urls: additionalUrls,
        content_type: post.content_type ?? 'feed',
      });
      setPreviews(prev => ({ ...prev, [post.id]: data }));
    } catch (e: any) {
      addToast(e?.detail ?? 'Preview failed', 'error');
      setPreviews(prev => { const n = { ...prev }; delete n[post.id]; return n; });
    }
  }

  async function improvePost(postId: number) {
    setImproving(prev => ({ ...prev, [postId]: true }));
    try {
      const data = await api.post<{ content: string; post_id: number }>(
        `/api/admin/social/outbox/${postId}/improve`, {}
      );
      setPosts(prev => prev.map(p => p.id === postId ? { ...p, content: data.content } : p));
      setPredictions(prev => { const n = { ...prev }; delete n[postId]; return n; });
      setPreviews(prev => { const n = { ...prev }; delete n[postId]; return n; });
      addToast('Post improved — check the Platform Preview tab to confirm it\'s within limits', 'success');
    } catch (e: any) {
      addToast(e?.detail ?? 'AI improvement failed', 'error');
    } finally {
      setImproving(prev => ({ ...prev, [postId]: false }));
    }
  }

  // ── Product tags ────────────────────────────────────────────────────────────
  async function searchProducts(q: string) {
    setProductSearching(true);
    try {
      const data = await api.get<{ products: { id: number; name: string; slug: string; image_path: string | null }[] }>(
        `/api/admin/social/products/search?q=${encodeURIComponent(q)}&limit=20`
      );
      setProductResults(data.products);
    } catch { /* silent */ }
    finally { setProductSearching(false); }
  }

  function toggleProductTag(postId: number, product: { id: number; name: string }) {
    setProductTagsMap((prev) => {
      const current = prev[postId] ?? [];
      const exists = current.some((p) => p.id === product.id);
      const next = exists ? current.filter((p) => p.id !== product.id) : [...current, product];
      return { ...prev, [postId]: next };
    });
  }

  async function saveProductTags(postId: number) {
    const tags = (productTagsMap[postId] ?? []).map((p) => ({ product_id: p.id, name: p.name }));
    try {
      await api.patch(`/api/admin/social/outbox/${postId}`, { product_tags: tags });
      addToast('Product tags saved', 'success');
      setProductTagPostId(null);
    } catch { addToast('Failed to save product tags', 'error'); }
  }

  // ── Boost ───────────────────────────────────────────────────────────────────
  async function boostPost(postId: number) {
    setBoosting(true);
    try {
      const res = await api.post<{ boosted: boolean; campaign_id: string; ad_id: string; ends_at: string }>(
        `/api/admin/social/outbox/${postId}/boost`,
        {
          budget_cents: Number.parseInt(boostBudget, 10) || 1000,
          duration_days: Number.parseInt(boostDays, 10) || 3,
          objective: boostObjective,
        }
      );
      addToast(`Boost live — campaign ${res.campaign_id}`, 'success');
      setBoostPostId(null);
    } catch (e: any) {
      addToast(e?.message ?? 'Boost failed', 'error');
    } finally { setBoosting(false); }
  }

  // ── Moment Capture ──────────────────────────────────────────────────────────
  async function mcUploadImage(file: File) {
    if (mcImageUrls.length >= 3) { addToast('Maximum 3 images', 'error'); return; }
    setMcUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      const data = await api.upload<{ url: string }>('/api/admin/media/upload', formData);
      setMcImageUrls((prev) => [...prev, data.url].slice(0, 3));
    } catch (e: unknown) {
      addToast((e as { detail?: string })?.detail ?? 'Upload failed', 'error');
    } finally { setMcUploading(false); }
  }

  async function runMomentCapture() {
    const hasText = mcMoment.trim().length > 0;
    const hasImages = mcImageUrls.length > 0;
    if (!hasText && !hasImages) { addToast('Add a description or upload at least one image', 'error'); return; }
    setMcGenerating(true);
    setMcDrafts([]);
    try {
      const data = await api.post<{
        drafts: { platform: string; content: string; strategy_content_type: string; image_url: string | null; additional_image_urls?: string[]; status: string; error?: string }[];
        platforms_succeeded: number;
      }>('/api/admin/social/moment-capture', {
        moment: mcMoment,
        extra_context: mcExtraContext,
        image_urls: mcImageUrls,
      });
      setMcDrafts(data.drafts.map((d) => ({ ...d, status: d.status as McD['status'], discarded: d.status !== 'ok' })));
      if (data.platforms_succeeded === 0) addToast('All platforms failed to generate — check AI config', 'error');
      else addToast(`${data.platforms_succeeded} drafts generated`, 'success');
    } catch (e: unknown) {
      addToast((e as { detail?: string })?.detail ?? 'Generation failed', 'error');
    } finally { setMcGenerating(false); }
  }

  async function saveMomentDrafts() {
    const toSave = mcDrafts.filter((d) => !d.discarded && d.content.trim());
    if (toSave.length === 0) { addToast('No drafts selected to save', 'error'); return; }
    setMcSaving(true);
    try {
      const result = await api.post<{
        results: { platform: string; saved: boolean; post_id?: number; error?: string; compliance?: { status: string; issues_count: number } }[];
        saved_count: number;
        failed_count: number;
      }>('/api/admin/social/moment-capture/save', {
        drafts: toSave.map((d) => ({
          platform: d.platform,
          content: d.content,
          image_url: d.image_url || null,
          additional_image_urls: d.additional_image_urls || [],
          strategy_content_type: d.strategy_content_type || null,
          content_type: 'feed',
        })),
      });

      const { saved_count, failed_count, results } = result;
      if (saved_count > 0) addToast(`${saved_count} draft${saved_count > 1 ? 's' : ''} saved to outbox`, 'success');
      if (failed_count > 0) addToast(`${failed_count} draft${failed_count > 1 ? 's' : ''} failed to save`, 'error');

      results.forEach((r) => {
        if (r.saved && r.compliance && r.compliance.status !== 'clean' && r.compliance.issues_count > 0) {
          addToast(`${r.platform}: saved with ${r.compliance.issues_count} compliance issue${r.compliance.issues_count > 1 ? 's' : ''} — review in outbox`, 'info');
        }
      });

      if (saved_count > 0) {
        setShowMomentCapture(false);
        setMcMoment(''); setMcExtraContext(''); setMcImageUrls([]); setMcDrafts([]);
        setFilterStatus('draft');
        load();
      }
    } catch (e: unknown) {
      addToast((e as { detail?: string })?.detail ?? 'Save failed', 'error');
    } finally { setMcSaving(false); }
  }

  function openMediaPicker(target: 'image' | 'video') {
    setMediaPickerTarget(target);
    setShowMediaPicker(true);
  }

  function clearAnalysis(postId: number) {
    setPredictions(prev => { const n = { ...prev }; delete n[postId]; return n; });
    setPreviews(prev => { const n = { ...prev }; delete n[postId]; return n; });
  }

  function clearSelection() {
    setSelectedIds(new Set());
  }

  // ── Derived values ──────────────────────────────────────────────────────────
  const selectableIds = posts.filter((p) => ['draft', 'approved', 'failed'].includes(p.status)).map((p) => p.id);
  const allSelected = selectableIds.length > 0 && selectableIds.every((id) => selectedIds.has(id));
  const enabledPlatformsList = ['facebook', 'instagram', 'x', 'linkedin', 'tiktok', 'youtube', 'pinterest', 'threads']
    .filter((p) => platformConfigs[p]?.enabled);
  const noEnabledPlatforms = Object.keys(platformConfigs).length > 0 && enabledPlatformsList.length === 0;

  const calendarWeek = useMemo(() => {
    const days: Date[] = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date(calendarDate);
      d.setDate(calendarDate.getDate() + i);
      days.push(d);
    }
    return days;
  }, [calendarDate]);

  const scheduledByDay = useMemo(() => {
    const map: Record<string, SocialPost[]> = {};
    posts.forEach((p) => {
      const t = p.scheduled_at || p.published_at;
      if (!t) return;
      const key = new Date(t).toISOString().slice(0, 10);
      if (!map[key]) map[key] = [];
      map[key].push(p);
    });
    return map;
  }, [posts]);

  return {
    // Data
    posts, total, loading, page, PAGE_SIZE,
    // Filters
    filterPlatform, setFilterPlatform, filterStatus, setFilterStatus,
    // Platform configs
    platformConfigs, enabledPlatformsList, noEnabledPlatforms,
    // Busy
    busy,
    // Edit modal
    editId, setEditId,
    editContent, setEditContent,
    editHashtags, setEditHashtags,
    editImageUrl, setEditImageUrl,
    editVideoUrl, setEditVideoUrl,
    editShortVideoUrl, setEditShortVideoUrl,
    editAdditionalImageUrls, setEditAdditionalImageUrls,
    editContentType, setEditContentType,
    editStatus, setEditStatus,
    hashtagInput, setHashtagInput,
    suggesting,
    editMediaPickerTarget, setEditMediaPickerTarget,
    showEditMediaPicker, setShowEditMediaPicker,
    // Reschedule
    rescheduleId, setRescheduleId,
    rescheduleValue, setRescheduleValue,
    // Create
    showCreate, setShowCreate,
    newPlatform, setNewPlatform,
    newContent, setNewContent,
    newImageUrl, setNewImageUrl,
    newAdditionalImageUrls, setNewAdditionalImageUrls,
    newVideoUrl, setNewVideoUrl,
    newContentType, setNewContentType,
    newThumbOffset, setNewThumbOffset,
    newStrategyContentType, setNewStrategyContentType,
    newHashtags, setNewHashtags,
    newHashtagInput, setNewHashtagInput,
    creating,
    showMediaPicker, setShowMediaPicker,
    mediaPickerTarget, setMediaPickerTarget,
    // Bulk & selection
    expandedIds, selectedIds, bulkBusy,
    selectableIds, allSelected,
    // UI
    showHelp, setShowHelp,
    viewMode, setViewMode,
    calendarDate, setCalendarDate,
    calendarWeek, scheduledByDay,
    expandedBlogImages, setExpandedBlogImages,
    overflowOpen, setOverflowOpen,
    // Analysis
    predictions, improving, previews, analysisTab, setAnalysisTab,
    // Product tags
    productTagPostId, setProductTagPostId,
    productSearch, setProductSearch,
    productResults, productTagsMap,
    productSearching,
    // Boost
    boostPostId, setBoostPostId,
    boostBudget, setBoostBudget,
    boostDays, setBoostDays,
    boostObjective, setBoostObjective,
    boosting,
    // AI Generate
    showAiGenerate, setShowAiGenerate,
    aiTopic, setAiTopic,
    aiExtraContext, setAiExtraContext,
    aiGenerating,
    aiGeneratedTopic,
    // Moment Capture
    showMomentCapture, setShowMomentCapture,
    mcMoment, setMcMoment,
    mcExtraContext, setMcExtraContext,
    mcImageUrls, setMcImageUrls,
    mcUploading, mcGenerating,
    mcDrafts, setMcDrafts,
    mcSaving,
    showMcMediaPicker, setShowMcMediaPicker,
    // Actions
    load,
    approve, reject, publish, publishNow, autoSchedule, reschedule,
    checkCompliance, fixCompliance, remove, saveEdit,
    suggestHashtags, suggestNewHashtags, addHashtag, removeHashtag,
    bulkAutoSchedule, toggleSelect, toggleSelectAll, toggleExpand,
    createPost, generateDraft,
    predictScore, previewPost, improvePost,
    searchProducts, toggleProductTag, saveProductTags,
    boostPost,
    mcUploadImage, runMomentCapture, saveMomentDrafts,
    openMediaPicker,
    clearAnalysis, clearSelection,
  };
}
