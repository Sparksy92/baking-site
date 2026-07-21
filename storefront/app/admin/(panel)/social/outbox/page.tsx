'use client';

import { Suspense } from 'react';
import {
  Inbox, Plus, HelpCircle,
  ChevronDown, ChevronUp, Calendar, List, CheckSquare, Square, Zap,
  Link, Upload,
} from 'lucide-react';
import { MediaPickerModal } from '@/components/admin/MediaPickerModal';
import { AIImagePicker } from '@/components/admin/AIImagePicker';
import { useOutboxState } from './useOutboxState';
import { CreatePostForm } from './CreatePostForm';
import { MomentCapturePanel } from './MomentCapturePanel';
import { PostCard } from './PostCard';

function fmtDate(iso: string | null, fallback = ''): string {
  if (!iso) return fallback;
  return new Date(iso).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' });
}

const PLATFORM_ICON: Record<string, string> = {
  facebook: '𝕗', instagram: '◉', x: '𝕏', linkedin: 'in', tiktok: '♪', youtube: '▶', pinterest: '𝕻', threads: '@',
};

const PLATFORMS = ['', 'facebook', 'instagram', 'x', 'linkedin', 'tiktok', 'youtube', 'pinterest', 'threads'];
const STATUSES  = ['', 'draft', 'approved', 'scheduled', 'published', 'rejected', 'failed'];

function OutboxPageInner() {
  const {
    posts, total, loading, page, PAGE_SIZE,
    filterPlatform, setFilterPlatform, filterStatus, setFilterStatus,
    platformConfigs, noEnabledPlatforms,
    busy,
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
    rescheduleId, setRescheduleId,
    rescheduleValue, setRescheduleValue,
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
    expandedIds, selectedIds, bulkBusy,
    selectableIds, allSelected,
    showHelp, setShowHelp,
    viewMode, setViewMode,
    calendarDate, setCalendarDate,
    calendarWeek, scheduledByDay,
    expandedBlogImages, setExpandedBlogImages,
    overflowOpen, setOverflowOpen,
    predictions, improving, previews, analysisTab, setAnalysisTab,
    productTagPostId, setProductTagPostId,
    productSearch, setProductSearch,
    productResults, productTagsMap,
    productSearching,
    boostPostId, setBoostPostId,
    boostBudget, setBoostBudget,
    boostDays, setBoostDays,
    boostObjective, setBoostObjective,
    boosting,
    showAiGenerate, setShowAiGenerate,
    aiTopic, setAiTopic,
    aiExtraContext, setAiExtraContext,
    aiGenerating,
    aiGeneratedTopic,
    showMomentCapture, setShowMomentCapture,
    mcMoment, setMcMoment,
    mcExtraContext, setMcExtraContext,
    mcImageUrls, setMcImageUrls,
    mcUploading, mcGenerating,
    mcDrafts, setMcDrafts,
    mcSaving,
    showMcMediaPicker, setShowMcMediaPicker,
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
  } = useOutboxState();

  return (
    <>
    <div className="max-w-4xl space-y-5">

      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Inbox size={20} className="text-brand" />
            <h1 className="text-2xl font-bold text-gray-900">Social Outbox</h1>
          </div>
          <p className="text-sm text-gray-500">
            Review, schedule and publish social posts across platforms.
          </p>
        </div>
        <button
          onClick={() => setShowHelp((v) => !v)}
          title={showHelp ? 'Hide workflow guide' : 'Show workflow guide'}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-gray-500 bg-gray-100 rounded-lg hover:bg-gray-200 shrink-0 mt-1"
        >
          <HelpCircle size={13} /> {showHelp ? 'Hide help' : 'How it works'}
        </button>
      </div>

      {/* Workflow help banner */}
      {showHelp && (
        <div className="bg-blue-50 border border-blue-100 rounded-xl p-4 text-sm space-y-3">
          <p className="font-semibold text-blue-900">📋 Three ways to create posts</p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs text-blue-800">
            <div className="bg-white/70 rounded-lg p-3 border border-blue-100">
              <p className="font-semibold mb-1">✍️ Blog-driven (automatic)</p>
              <p>When you publish a blog post, the AI <em>automatically</em> writes social drafts for every connected platform and drops them here. Just review and approve.</p>
            </div>
            <div className="bg-purple-50 rounded-lg p-3 border border-purple-100">
              <p className="font-semibold mb-1 text-purple-900">✨ Topic-driven (on demand)</p>
              <p className="text-purple-800">Click <strong>New Post</strong>, open <strong>Generate with AI</strong>, type any topic — the AI writes a platform-native post in your brand voice.</p>
            </div>
            <div className="bg-amber-50 rounded-lg p-3 border border-amber-100">
              <p className="font-semibold mb-1 text-amber-900">⚡ Moment Capture (new)</p>
              <p className="text-amber-800">Something happened worth sharing? Click <strong>Moment Capture</strong>, describe it in plain words — the AI atomises it into a native draft for <em>every</em> enabled platform at once. Review, edit, save what you like.</p>
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs text-blue-800">
            <div className="bg-white/70 rounded-lg p-3 border border-blue-100">
              <p className="font-semibold mb-1">1. Review &amp; edit</p>
              <p>Read the AI draft, tweak anything, add an image. Then click <strong>Approve</strong>.</p>
            </div>
            <div className="bg-white/70 rounded-lg p-3 border border-blue-100">
              <p className="font-semibold mb-1">2. Schedule or publish</p>
              <p><strong>Publish Now</strong> — goes live in ~60 s.<br />
              <strong>Auto Schedule</strong> — fills 09:00/15:00 queue.<br />
              <strong>Schedule</strong> — pick any exact time.</p>
            </div>
            <div className="bg-white/70 rounded-lg p-3 border border-blue-100">
              <p className="font-semibold mb-1">3. It posts automatically</p>
              <p>Scheduled posts fire when their time arrives. Use the <strong>Calendar</strong> tab to see your week at a glance.</p>
            </div>
          </div>
        </div>
      )}

      {/* Toolbar: New Post + Filters + View toggle */}
      <div className="flex gap-3 flex-wrap items-center">
        <button
          onClick={() => { setShowCreate((v) => !v); setShowMomentCapture(false); }}
          title={noEnabledPlatforms ? 'Enable at least one platform in Social → Platforms first' : 'Create a new social post draft'}
          disabled={noEnabledPlatforms}
          className={`flex items-center gap-1.5 px-4 py-2 text-sm font-medium rounded-lg disabled:opacity-40 disabled:cursor-not-allowed transition-colors ${
            showCreate ? 'bg-brand/90 text-white ring-2 ring-brand/40' : 'bg-brand text-white hover:bg-brand/90'
          }`}
        >
          <Plus size={16} /> New Post
        </button>
        <button
          onClick={() => { setShowMomentCapture((v) => !v); setShowCreate(false); setMcDrafts([]); }}
          title={noEnabledPlatforms ? 'Enable at least one platform first' : 'Describe a moment — AI drafts it for every enabled platform at once'}
          disabled={noEnabledPlatforms}
          className={`flex items-center gap-1.5 px-4 py-2 text-sm font-medium rounded-lg disabled:opacity-40 disabled:cursor-not-allowed transition-colors ${
            showMomentCapture ? 'bg-amber-600 text-white ring-2 ring-amber-400/40' : 'bg-amber-500 text-white hover:bg-amber-600'
          }`}
        >
          <Zap size={16} /> Moment Capture
        </button>
        {noEnabledPlatforms && (
          <span className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
            No platforms enabled —{' '}
            <a href="/admin/social/platforms" className="font-semibold underline hover:text-amber-900">Social → Platforms</a>
          </span>
        )}
        <select
          value={filterPlatform}
          onChange={(e) => setFilterPlatform(e.target.value)}
          className="px-3 py-2 rounded-lg border border-gray-200 text-sm outline-none focus:border-brand"
        >
          <option value="">All Platforms</option>
          {PLATFORMS.filter(Boolean).map((p) => (
            <option key={p} value={p}>{p.charAt(0).toUpperCase() + p.slice(1)}</option>
          ))}
        </select>
        <select
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value)}
          className="px-3 py-2 rounded-lg border border-gray-200 text-sm outline-none focus:border-brand"
        >
          <option value="">All Statuses</option>
          {STATUSES.filter(Boolean).map((s) => (
            <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>
          ))}
        </select>
        <span className="text-sm text-gray-400">{total} post{total !== 1 ? 's' : ''}</span>

        {/* View toggle */}
        <div className="ml-auto flex rounded-lg border border-gray-200 overflow-hidden">
          <button
            onClick={() => setViewMode('list')}
            title="List view"
            className={`flex items-center gap-1 px-3 py-1.5 text-xs font-medium ${viewMode === 'list' ? 'bg-brand text-white' : 'bg-white text-gray-500 hover:bg-gray-50'}`}
          >
            <List size={13} /> List
          </button>
          <button
            onClick={() => { setViewMode('calendar'); setFilterStatus(''); }}
            title="Calendar view — see your week's queue"
            className={`flex items-center gap-1 px-3 py-1.5 text-xs font-medium border-l border-gray-200 ${viewMode === 'calendar' ? 'bg-brand text-white' : 'bg-white text-gray-500 hover:bg-gray-50'}`}
          >
            <Calendar size={13} /> Calendar
          </button>
        </div>
      </div>

      {/* Bulk action bar — appears when posts are selected */}
      {selectedIds.size > 0 && (
        <div className="flex items-center gap-3 px-4 py-3 bg-indigo-50 border border-indigo-200 rounded-xl">
          <span className="text-xs font-medium text-indigo-800">{selectedIds.size} post{selectedIds.size > 1 ? 's' : ''} selected</span>
          <button
            onClick={bulkAutoSchedule}
            disabled={bulkBusy}
            title="Auto-schedule all selected posts into your next available time slots"
            className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 text-white text-xs font-medium rounded-lg hover:bg-indigo-700 disabled:opacity-50"
          >
            <Zap size={12} /> {bulkBusy ? 'Scheduling…' : 'Auto Schedule All'}
          </button>
          <button
            onClick={() => clearSelection()}
            className="text-xs text-indigo-600 hover:text-indigo-800 ml-auto"
          >
            Clear selection
          </button>
        </div>
      )}

      {/* Create Post Form */}
      {showCreate && (
        <CreatePostForm
          platformConfigs={platformConfigs}
          newPlatform={newPlatform} setNewPlatform={setNewPlatform}
          newContent={newContent} setNewContent={setNewContent}
          newContentType={newContentType} setNewContentType={setNewContentType}
          newImageUrl={newImageUrl} setNewImageUrl={setNewImageUrl}
          newAdditionalImageUrls={newAdditionalImageUrls} setNewAdditionalImageUrls={setNewAdditionalImageUrls}
          newVideoUrl={newVideoUrl} setNewVideoUrl={setNewVideoUrl}
          newThumbOffset={newThumbOffset} setNewThumbOffset={setNewThumbOffset}
          newStrategyContentType={newStrategyContentType} setNewStrategyContentType={setNewStrategyContentType}
          newHashtags={newHashtags} setNewHashtags={setNewHashtags}
          newHashtagInput={newHashtagInput} setNewHashtagInput={setNewHashtagInput}
          showAiGenerate={showAiGenerate} setShowAiGenerate={setShowAiGenerate}
          aiTopic={aiTopic} setAiTopic={setAiTopic}
          aiExtraContext={aiExtraContext} setAiExtraContext={setAiExtraContext}
          aiGenerating={aiGenerating}
          aiGeneratedTopic={aiGeneratedTopic}
          creating={creating}
          suggesting={suggesting}
          mediaPickerTarget={mediaPickerTarget as 'image' | 'video' | 'carousel'}
          setMediaPickerTarget={setMediaPickerTarget as (v: 'image' | 'video' | 'carousel') => void}
          setShowMediaPicker={setShowMediaPicker}
          onClose={() => setShowCreate(false)}
          onGenerate={generateDraft}
          onSuggestHashtags={suggestNewHashtags}
          onCreate={createPost}
        />
      )}

      {/* ── CALENDAR VIEW ─────────────────────────────────────────── */}
      {viewMode === 'calendar' && (() => {
        const CAL_PLATFORM_COLOURS: Record<string, string> = {
          facebook:  'bg-blue-100 border-blue-300 text-blue-800',
          instagram: 'bg-pink-100 border-pink-300 text-pink-800',
          tiktok:    'bg-slate-100 border-slate-300 text-slate-800',
          youtube:   'bg-red-100 border-red-300 text-red-800',
          x:         'bg-gray-100 border-gray-300 text-gray-800',
          linkedin:  'bg-sky-100 border-sky-300 text-sky-800',
          pinterest: 'bg-rose-100 border-rose-300 text-rose-800',
          threads:   'bg-neutral-100 border-neutral-300 text-neutral-800',
        };
        const CAL_PLATFORM_EMOJI: Record<string, string> = {
          facebook: '📘', instagram: '📸', tiktok: '🎵',
          youtube: '▶️', x: '𝕏', linkedin: '💼', pinterest: '📌', threads: '🧵',
        };
        const CAL_STATUS_DOT: Record<string, string> = {
          draft: 'bg-amber-400', approved: 'bg-blue-500', scheduled: 'bg-purple-500',
          published: 'bg-green-500', failed: 'bg-red-500', rejected: 'bg-gray-400',
        };
        const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
        const todayKey = new Date().toISOString().slice(0, 10);

        return (
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            {/* Week nav */}
            <div className="flex items-center justify-between px-5 py-3 border-b border-gray-100 bg-gray-50">
              <button
                onClick={() => setCalendarDate((d) => { const n = new Date(d); n.setDate(d.getDate() - 7); return n; })}
                className="px-3 py-1.5 text-xs font-medium text-gray-600 bg-white border border-gray-200 rounded-lg hover:bg-gray-50"
              >← Prev week</button>
              <span className="text-sm font-semibold text-gray-800">
                {calendarWeek[0].toLocaleDateString([], { month: 'short', day: 'numeric' })} — {calendarWeek[6].toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' })}
              </span>
              <button
                onClick={() => setCalendarDate((d) => { const n = new Date(d); n.setDate(d.getDate() + 7); return n; })}
                className="px-3 py-1.5 text-xs font-medium text-gray-600 bg-white border border-gray-200 rounded-lg hover:bg-gray-50"
              >Next week →</button>
            </div>

            {/* DOW + date header */}
            <div className="grid grid-cols-7 border-b border-gray-100">
              {calendarWeek.map((day, i) => {
                const key = day.toISOString().slice(0, 10);
                const isToday = key === todayKey;
                return (
                  <div key={i} className={`px-2 py-2.5 text-center border-r last:border-r-0 border-gray-100 ${isToday ? 'bg-brand/5' : ''}`}>
                    <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide">{DAYS[day.getDay()]}</p>
                    <p className={`text-base font-bold mt-0.5 ${isToday ? 'w-7 h-7 rounded-full bg-brand text-white flex items-center justify-center mx-auto text-sm' : 'text-gray-800'}`}>
                      {day.getDate()}
                    </p>
                  </div>
                );
              })}
            </div>

            {/* Day columns */}
            <div className="grid grid-cols-7 min-h-[320px]">
              {calendarWeek.map((day) => {
                const key = day.toISOString().slice(0, 10);
                const isToday = key === todayKey;
                const isPast = day < new Date() && !isToday;
                const dayPosts = [...(scheduledByDay[key] ?? [])].sort((a, b) => {
                  const at = new Date(a.scheduled_at ?? a.published_at ?? 0).getTime();
                  const bt = new Date(b.scheduled_at ?? b.published_at ?? 0).getTime();
                  return at - bt;
                });
                return (
                  <div key={key} className={`border-r last:border-r-0 border-gray-100 p-1.5 space-y-1 overflow-y-auto max-h-[480px] ${isToday ? 'bg-brand/5' : isPast ? '' : dayPosts.length === 0 ? 'bg-amber-50/30' : ''}`}>
                    {dayPosts.length === 0 && !isPast && (
                      <p className="text-[10px] text-gray-300 text-center pt-3 italic">no posts</p>
                    )}
                    {dayPosts.map((p) => {
                      const raw = p.scheduled_at ?? p.published_at;
                      const timeStr = raw ? new Date(raw).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '';
                      const colours = CAL_PLATFORM_COLOURS[p.platform] ?? 'bg-gray-100 border-gray-300 text-gray-800';
                      const dot = CAL_STATUS_DOT[p.status] ?? 'bg-gray-300';
                      return (
                        <div key={p.id} className={`rounded-lg border px-2 py-1.5 text-xs cursor-default ${colours}`}>
                          <div className="flex items-center gap-1 mb-0.5">
                            <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${dot}`} />
                            <span className="font-semibold truncate">{CAL_PLATFORM_EMOJI[p.platform] ?? ''} {p.platform}</span>
                            {timeStr && <span className="ml-auto shrink-0 opacity-70">{timeStr}</span>}
                          </div>
                          <p className="line-clamp-2 leading-snug opacity-80">{p.content}</p>
                        </div>
                      );
                    })}
                  </div>
                );
              })}
            </div>
          </div>
        );
      })()}

      {/* ── LIST VIEW ─────────────────────────────────────────────── */}
      {viewMode === 'list' && !showMomentCapture && (
        <>
          {/* Select-all bar */}
          {selectableIds.length > 0 && (
            <div className="flex items-center gap-2 px-1">
              <button onClick={toggleSelectAll} className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-gray-800">
                {allSelected ? <CheckSquare size={14} className="text-indigo-600" /> : <Square size={14} />}
                {allSelected ? 'Deselect all' : `Select all ${selectableIds.length} actionable`}
              </button>
            </div>
          )}

          {loading && page === 1 ? (
            <div className="text-gray-400 text-sm py-8 text-center">Loading…</div>
          ) : posts.length === 0 ? (
            <div className="bg-white rounded-xl border border-dashed border-gray-200 p-16 text-center">
              <Inbox size={32} className="mx-auto text-gray-300 mb-3" />
              <p className="text-sm font-medium text-gray-500">No posts found</p>
              <p className="text-xs text-gray-400 mt-1">Publish a blog post to auto-generate social drafts, or adjust your filters.</p>
            </div>
          ) : (
            <>
            <div className="space-y-3">
              {posts.map((post) => (
                <PostCard
                  key={post.id}
                  post={post}
                  isSelected={selectedIds.has(post.id)}
                  isExpanded={expandedIds.has(post.id)}
                  editId={editId}
                  editContent={editContent} setEditContent={setEditContent}
                  editHashtags={editHashtags}
                  editImageUrl={editImageUrl} setEditImageUrl={setEditImageUrl}
                  editVideoUrl={editVideoUrl} setEditVideoUrl={setEditVideoUrl}
                  editShortVideoUrl={editShortVideoUrl} setEditShortVideoUrl={setEditShortVideoUrl}
                  editAdditionalImageUrls={editAdditionalImageUrls} setEditAdditionalImageUrls={setEditAdditionalImageUrls}
                  editContentType={editContentType} setEditContentType={setEditContentType}
                  editStatus={editStatus} setEditStatus={setEditStatus}
                  hashtagInput={hashtagInput} setHashtagInput={setHashtagInput}
                  suggesting={suggesting}
                  editMediaPickerTarget={editMediaPickerTarget} setEditMediaPickerTarget={setEditMediaPickerTarget}
                  setShowEditMediaPicker={setShowEditMediaPicker}
                  rescheduleId={rescheduleId} setRescheduleId={setRescheduleId}
                  rescheduleValue={rescheduleValue} setRescheduleValue={setRescheduleValue}
                  expandedBlogImages={expandedBlogImages} setExpandedBlogImages={setExpandedBlogImages}
                  overflowOpen={overflowOpen} setOverflowOpen={setOverflowOpen}
                  predictions={predictions} previews={previews} improving={improving}
                  analysisTab={analysisTab} setAnalysisTab={setAnalysisTab}
                  productTagPostId={productTagPostId} setProductTagPostId={setProductTagPostId}
                  productSearch={productSearch} setProductSearch={setProductSearch}
                  productResults={productResults} productTagsMap={productTagsMap} productSearching={productSearching}
                  boostPostId={boostPostId} setBoostPostId={setBoostPostId}
                  boostBudget={boostBudget} setBoostBudget={setBoostBudget}
                  boostDays={boostDays} setBoostDays={setBoostDays}
                  boostObjective={boostObjective} setBoostObjective={setBoostObjective}
                  boosting={boosting}
                  busy={busy}
                  platformConfigs={platformConfigs}
                  onToggleSelect={toggleSelect}
                  onToggleExpand={toggleExpand}
                  onApprove={approve}
                  onReject={reject}
                  onPublish={publish}
                  onPublishNow={publishNow}
                  onAutoSchedule={autoSchedule}
                  onReschedule={reschedule}
                  onCheckCompliance={checkCompliance}
                  onFixCompliance={fixCompliance}
                  onSaveEdit={saveEdit}
                  onRemove={remove}
                  onSuggestHashtags={suggestHashtags}
                  onAddHashtag={addHashtag}
                  onRemoveHashtag={removeHashtag}
                  onPredictScore={predictScore}
                  onPreviewPost={previewPost}
                  onImprovePost={improvePost}
                  onSearchProducts={searchProducts}
                  onToggleProductTag={toggleProductTag}
                  onSaveProductTags={saveProductTags}
                  onBoostPost={boostPost}
                  onClearAnalysis={clearAnalysis}
                  onSetEditId={setEditId}
                />
              ))}
            </div>
            {/* Load more */}
            {posts.length < total && (
              <div className="flex items-center justify-between py-2 px-1">
                <p className="text-xs text-gray-400">Showing {posts.length} of {total} posts</p>
                <button
                  onClick={() => load(page + 1)}
                  disabled={loading}
                  className="px-4 py-2 text-xs font-medium text-indigo-600 bg-indigo-50 border border-indigo-100 rounded-lg hover:bg-indigo-100 disabled:opacity-50"
                >
                  {loading ? 'Loading…' : `Load more (${total - posts.length} remaining)`}
                </button>
              </div>
            )}
            {posts.length >= total && total > PAGE_SIZE && (
              <p className="text-xs text-gray-400 text-center py-2">All {total} posts loaded</p>
            )}
            </>
          )}
        </>
      )}
    </div>

      {/* ── Media Library Picker Modal ─────────────────────────────────────── */}
      {showMediaPicker && (
        <MediaPickerModal
          onSelect={(url) => {
            if (mediaPickerTarget === 'carousel') {
              setNewAdditionalImageUrls(prev => [...prev, url]);
            } else if (mediaPickerTarget === 'image') {
              setNewImageUrl(url);
            } else {
              setNewVideoUrl(url);
            }
            setShowMediaPicker(false);
          }}
          onClose={() => setShowMediaPicker(false)}
        />
      )}

      {/* ── Edit-mode Media Library Picker Modal ───────────────────────────── */}
      {showEditMediaPicker && (
        <MediaPickerModal
          onSelect={(url) => {
            if (editMediaPickerTarget === 'carousel') {
              setEditAdditionalImageUrls(prev => [...prev, url]);
            } else if (editMediaPickerTarget === 'image') {
              setEditImageUrl(url);
            } else {
              setEditVideoUrl(url);
            }
            setShowEditMediaPicker(false);
          }}
          onClose={() => setShowEditMediaPicker(false)}
        />
      )}

      {/* ── Moment Capture media picker ─────────────────────────────────────── */}
      {showMcMediaPicker && (
        <MediaPickerModal
          onSelect={(url) => { setMcImageUrls((prev) => [...prev, url].slice(0, 3)); setShowMcMediaPicker(false); }}
          onClose={() => setShowMcMediaPicker(false)}
        />
      )}

      {/* ── Moment Capture inline section ───────────────────────────────────── */}
      {/* Moment Capture Panel */}
      {showMomentCapture && (
        <MomentCapturePanel
          mcMoment={mcMoment} setMcMoment={setMcMoment}
          mcExtraContext={mcExtraContext} setMcExtraContext={setMcExtraContext}
          mcImageUrls={mcImageUrls} setMcImageUrls={setMcImageUrls}
          mcUploading={mcUploading}
          mcGenerating={mcGenerating}
          mcDrafts={mcDrafts} setMcDrafts={setMcDrafts}
          mcSaving={mcSaving}
          onClose={() => { setShowMomentCapture(false); setMcDrafts(() => []); setMcMoment(''); setMcExtraContext(''); setMcImageUrls(() => []); }}
          onRun={runMomentCapture}
          onSave={saveMomentDrafts}
          onUploadImage={mcUploadImage}
        />
      )}
    </>
  );
}

export default function OutboxPage() {
  return (
    <Suspense fallback={
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
      </div>
    }>
      <OutboxPageInner />
    </Suspense>
  );
}
