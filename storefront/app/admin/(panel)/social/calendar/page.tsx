'use client';

import { useEffect, useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import { addToast } from '@/lib/toast';
import {
  Calendar, ChevronLeft, ChevronRight, Eye, EyeOff,
  AlertTriangle, Clock, CheckCircle, Send, Pencil,
} from 'lucide-react';

// ── Types ─────────────────────────────────────────────────────────────────────

type SocialPost = {
  id: number;
  platform: string;
  content: string;
  status: string;
  scheduled_at: string | null;
  published_at: string | null;
  content_type: string | null;
  image_url: string | null;
  video_url: string | null;
};

// ── Constants ─────────────────────────────────────────────────────────────────

const PLATFORM_COLOURS: Record<string, string> = {
  facebook:  'bg-blue-100 border-blue-300 text-blue-800',
  instagram: 'bg-pink-100 border-pink-300 text-pink-800',
  tiktok:    'bg-slate-100 border-slate-300 text-slate-800',
  youtube:   'bg-red-100 border-red-300 text-red-800',
  x:         'bg-gray-100 border-gray-300 text-gray-800',
  linkedin:  'bg-sky-100 border-sky-300 text-sky-800',
  pinterest: 'bg-rose-100 border-rose-300 text-rose-800',
  threads:   'bg-neutral-100 border-neutral-300 text-neutral-800',
};

const PLATFORM_EMOJI: Record<string, string> = {
  facebook: '📘', instagram: '📸', tiktok: '🎵',
  youtube: '▶️', x: '𝕏', linkedin: '💼', pinterest: '📌', threads: '🧵',
};

const STATUS_DOT: Record<string, string> = {
  draft:     'bg-amber-400',
  approved:  'bg-blue-500',
  scheduled: 'bg-purple-500',
  published: 'bg-green-500',
  failed:    'bg-red-500',
  rejected:  'bg-gray-400',
};

const CONFIRMED_STATUSES = new Set(['approved', 'scheduled', 'published', 'failed']);
const DRAFT_STATUSES     = new Set(['draft']);

const PLATFORMS = ['facebook', 'instagram', 'tiktok', 'youtube', 'x', 'linkedin', 'pinterest', 'threads'];
const DAYS      = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

// ── Utilities ─────────────────────────────────────────────────────────────────

function startOfWeek(date: Date): Date {
  const d = new Date(date);
  d.setDate(d.getDate() - d.getDay()); // Sunday
  d.setHours(0, 0, 0, 0);
  return d;
}

function addDays(date: Date, n: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + n);
  return d;
}

function isSameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

function fmtMonthYear(date: Date): string {
  return date.toLocaleDateString([], { month: 'long', year: 'numeric' });
}

function fmtDayNum(date: Date): string {
  return String(date.getDate());
}

function fmtTime(iso: string): string {
  return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function postDateKey(post: SocialPost): string | null {
  const raw = post.scheduled_at ?? post.published_at;
  if (!raw) return null;
  const d = new Date(raw);
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
}

function dayKey(date: Date): string {
  return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
}

// ── Post card ─────────────────────────────────────────────────────────────────

function PostCard({
  post,
  isDraft,
  onClick,
}: {
  post: SocialPost;
  isDraft: boolean;
  onClick: () => void;
}) {
  const colours = PLATFORM_COLOURS[post.platform] ?? 'bg-gray-100 border-gray-300 text-gray-800';
  const dot     = STATUS_DOT[post.status] ?? 'bg-gray-300';
  const raw     = post.scheduled_at ?? post.published_at;

  return (
    <button
      onClick={onClick}
      className={`w-full text-left rounded-lg border px-2 py-1.5 text-xs transition-all hover:shadow-sm
        ${isDraft ? 'border-dashed opacity-60 hover:opacity-80' : 'border-solid'}
        ${colours}
      `}
    >
      <div className="flex items-center gap-1.5 mb-0.5">
        <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${dot}`} />
        <span className="font-semibold truncate">{PLATFORM_EMOJI[post.platform] ?? ''} {post.platform}</span>
        {raw && <span className="ml-auto shrink-0 opacity-70">{fmtTime(raw)}</span>}
      </div>
      <p className="line-clamp-2 leading-snug opacity-80">{post.content}</p>
    </button>
  );
}

// ── Post detail modal ─────────────────────────────────────────────────────────

function PostModal({ post, onClose, onEdit }: { post: SocialPost; onClose: () => void; onEdit: () => void }) {
  const raw = post.scheduled_at ?? post.published_at;
  return (
    <button
      type="button"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 cursor-default"
      onClick={onClose}
      aria-label="Close modal"
    >
      <dialog
        open
        className="bg-white rounded-2xl shadow-xl w-full max-w-md p-5 space-y-4 m-0 border-0"
        aria-modal="true"
      >
        <div role="none" onClick={(e) => e.stopPropagation()} onKeyDown={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="text-2xl">{PLATFORM_EMOJI[post.platform] ?? '📄'}</span>
            <div>
              <p className="font-semibold capitalize text-gray-900">{post.platform}</p>
              <p className="text-xs text-gray-400 capitalize">{post.status}{post.content_type ? ` · ${post.content_type}` : ''}</p>
            </div>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-lg leading-none">✕</button>
        </div>

        {raw && (
          <div className="flex items-center gap-2 text-xs text-gray-500">
            <Clock size={12} />
            {new Date(raw).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })}
          </div>
        )}

        <p className="text-sm text-gray-800 leading-relaxed whitespace-pre-wrap">{post.content}</p>

        {(post.image_url || post.video_url) && (
          <div className="text-xs text-gray-400 flex items-center gap-1">
            {post.video_url ? '🎬 Video attached' : '🖼️ Image attached'}
          </div>
        )}

        <div className="flex gap-2 pt-1">
          <button
            onClick={onEdit}
            className="flex items-center gap-1.5 px-4 py-2 bg-brand text-white text-sm font-medium rounded-xl hover:bg-brand/90"
          >
            <Pencil size={13} /> Edit in Outbox
          </button>
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800 rounded-xl hover:bg-gray-100"
          >
            Close
          </button>
        </div>
        </div>
      </dialog>
    </button>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function CalendarPage() {
  const router = useRouter();
  const [posts, setPosts]           = useState<SocialPost[]>([]);
  const [loading, setLoading]       = useState(true);
  const [weekStart, setWeekStart]   = useState<Date>(() => startOfWeek(new Date()));
  const [activePlatform, setActivePlatform] = useState<string>('all');
  const [showDrafts, setShowDrafts] = useState(false);
  const [selected, setSelected]     = useState<SocialPost | null>(null);

  // Fetch a wide window: 4 weeks back → 8 weeks forward so navigation is instant
  useEffect(() => {
    setLoading(true);
    api
      .get<{ posts: SocialPost[] }>('/api/admin/social/outbox?limit=500')
      .then((d) => setPosts(d.posts ?? []))
      .catch(() => addToast('Failed to load posts', 'error'))
      .finally(() => setLoading(false));
  }, []);

  // Build the 7-day array for current week
  const weekDays = useMemo(
    () => Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)),
    [weekStart],
  );

  // Filter by platform
  const filteredPosts = useMemo(
    () =>
      posts.filter(
        (p) => activePlatform === 'all' || p.platform === activePlatform,
      ),
    [posts, activePlatform],
  );

  // Bucket confirmed posts by day key
  const confirmedByDay = useMemo(() => {
    const map: Record<string, SocialPost[]> = {};
    for (const p of filteredPosts) {
      if (!CONFIRMED_STATUSES.has(p.status)) continue;
      const k = postDateKey(p);
      if (!k) continue;
      map[k] = map[k] ? [...map[k], p] : [p];
    }
    return map;
  }, [filteredPosts]);

  // Bucket draft posts by day key
  const draftsByDay = useMemo(() => {
    const map: Record<string, SocialPost[]> = {};
    for (const p of filteredPosts) {
      if (!DRAFT_STATUSES.has(p.status)) continue;
      const k = postDateKey(p);
      if (!k) continue;
      map[k] = map[k] ? [...map[k], p] : [p];
    }
    return map;
  }, [filteredPosts]);

  // Total draft count for badge
  const totalDrafts = useMemo(
    () => filteredPosts.filter((p) => DRAFT_STATUSES.has(p.status)).length,
    [filteredPosts],
  );

  // Gap detection: confirmed days in this week
  const gapDays = useMemo(
    () => weekDays.filter((d) => (confirmedByDay[dayKey(d)] ?? []).length === 0),
    [weekDays, confirmedByDay],
  );

  const today = new Date();

  return (
    <div className="space-y-4">
      {/* ── Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-3 justify-between">
        <div className="flex items-center gap-2">
          <Calendar size={20} className="text-brand" />
          <h1 className="text-2xl font-bold text-gray-900">Content Calendar</h1>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {/* Draft toggle */}
          <button
            onClick={() => setShowDrafts((v) => !v)}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors ${
              showDrafts
                ? 'bg-amber-50 text-amber-700 border-amber-300'
                : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'
            }`}
          >
            {showDrafts ? <Eye size={13} /> : <EyeOff size={13} />}
            {showDrafts ? 'Drafts On' : 'Show Drafts'}
            {totalDrafts > 0 && (
              <span className="ml-0.5 px-1.5 py-0.5 bg-amber-200 text-amber-800 rounded-full text-[10px] font-bold">
                {totalDrafts}
              </span>
            )}
          </button>

          {/* Week navigation */}
          <div className="flex items-center gap-1">
            <button
              onClick={() => setWeekStart((w) => addDays(w, -7))}
              className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-600"
            >
              <ChevronLeft size={16} />
            </button>
            <span className="text-sm font-medium text-gray-700 min-w-[160px] text-center">
              {fmtMonthYear(weekStart)}
            </span>
            <button
              onClick={() => setWeekStart((w) => addDays(w, 7))}
              className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-600"
            >
              <ChevronRight size={16} />
            </button>
          </div>

          {/* Today */}
          <button
            onClick={() => setWeekStart(startOfWeek(new Date()))}
            className="px-3 py-1.5 text-xs font-medium text-brand border border-brand/30 rounded-lg hover:bg-brand/5"
          >
            Today
          </button>
        </div>
      </div>

      {/* ── Platform filter ── */}
      <div className="flex items-center gap-1.5 flex-wrap">
        <button
          onClick={() => setActivePlatform('all')}
          className={`px-3 py-1 rounded-lg text-xs font-medium border transition-colors ${
            activePlatform === 'all'
              ? 'bg-brand text-white border-brand'
              : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'
          }`}
        >
          All Platforms
        </button>
        {PLATFORMS.map((p) => (
          <button
            key={p}
            onClick={() => setActivePlatform(activePlatform === p ? 'all' : p)}
            className={`flex items-center gap-1 px-3 py-1 rounded-lg text-xs font-medium border transition-colors ${
              activePlatform === p
                ? `${PLATFORM_COLOURS[p]} border-current`
                : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'
            }`}
          >
            {PLATFORM_EMOJI[p]} <span className="capitalize">{p}</span>
          </button>
        ))}
      </div>

      {/* ── Gap warning ── */}
      {!loading && gapDays.length >= 3 && (
        <div className="flex items-center gap-2 px-4 py-2.5 bg-amber-50 border border-amber-200 rounded-xl text-sm text-amber-800">
          <AlertTriangle size={15} className="shrink-0 text-amber-500" />
          <span>
            <strong>{gapDays.length} days</strong> this week have no confirmed posts scheduled.
            {' '}
            <button
              onClick={() => router.push('/admin/social/outbox')}
              className="underline font-medium"
            >
              Schedule in Outbox →
            </button>
          </span>
        </div>
      )}

      {/* ── Calendar grid ── */}
      {loading ? (
        <div className="text-center py-16 text-gray-400 text-sm">Loading calendar…</div>
      ) : (
        <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
          {/* Day headers */}
          <div className="grid grid-cols-7 border-b border-gray-100">
            {weekDays.map((day, i) => {
              const isToday = isSameDay(day, today);
              return (
                <div
                  key={i}
                  className={`px-2 py-3 text-center border-r last:border-r-0 border-gray-100 ${
                    isToday ? 'bg-brand/5' : ''
                  }`}
                >
                  <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide">
                    {DAYS[day.getDay()]}
                  </p>
                  <p
                    className={`text-lg font-bold mt-0.5 ${
                      isToday
                        ? 'w-8 h-8 rounded-full bg-brand text-white flex items-center justify-center mx-auto'
                        : 'text-gray-800'
                    }`}
                  >
                    {fmtDayNum(day)}
                  </p>
                </div>
              );
            })}
          </div>

          {/* Day columns */}
          <div className="grid grid-cols-7 min-h-[420px]">
            {weekDays.map((day, i) => {
              const dk             = dayKey(day);
              const confirmed      = confirmedByDay[dk] ?? [];
              const drafts         = draftsByDay[dk] ?? [];
              const isToday        = isSameDay(day, today);
              const isPast         = day < today && !isToday;
              const isGap          = confirmed.length === 0 && !isPast;

              return (
                <div
                  key={i}
                  className={`border-r last:border-r-0 border-gray-100 p-2 space-y-1.5 overflow-y-auto max-h-[540px] ${
                    isToday ? 'bg-brand/5' : isGap && !isPast ? 'bg-amber-50/40' : ''
                  }`}
                >
                  {/* Confirmed posts */}
                  {confirmed
                    .sort((a, b) => {
                      const at = new Date(a.scheduled_at ?? a.published_at ?? 0).getTime();
                      const bt = new Date(b.scheduled_at ?? b.published_at ?? 0).getTime();
                      return at - bt;
                    })
                    .map((p) => (
                      <PostCard
                        key={p.id}
                        post={p}
                        isDraft={false}
                        onClick={() => setSelected(p)}
                      />
                    ))}

                  {/* Draft posts (shown when toggle is on) */}
                  {showDrafts &&
                    drafts
                      .sort((a, b) => {
                        const at = new Date(a.scheduled_at ?? a.published_at ?? 0).getTime();
                        const bt = new Date(b.scheduled_at ?? b.published_at ?? 0).getTime();
                        return at - bt;
                      })
                      .map((p) => (
                        <PostCard
                          key={p.id}
                          post={p}
                          isDraft={true}
                          onClick={() => setSelected(p)}
                        />
                      ))}

                  {/* Gap nudge */}
                  {isGap && !isPast && confirmed.length === 0 && (
                    <button
                      onClick={() => router.push('/admin/social/outbox')}
                      className="w-full text-center text-[10px] text-gray-300 hover:text-brand py-1 rounded-lg hover:bg-brand/5 transition-colors border border-dashed border-gray-200 hover:border-brand/30"
                    >
                      + Schedule
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── Legend ── */}
      <div className="flex items-center gap-4 flex-wrap text-xs text-gray-500">
        {[
          { dot: 'bg-purple-500', label: 'Scheduled' },
          { dot: 'bg-blue-500',   label: 'Approved' },
          { dot: 'bg-green-500',  label: 'Published' },
          { dot: 'bg-amber-400',  label: 'Draft (toggle on to show)' },
          { dot: 'bg-red-500',    label: 'Failed' },
        ].map(({ dot, label }) => (
          <span key={label} className="flex items-center gap-1.5">
            <span className={`w-2 h-2 rounded-full ${dot}`} />
            {label}
          </span>
        ))}
        <span className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded border border-dashed border-amber-300 bg-amber-50/60 inline-block" />
          Gap warning
        </span>
      </div>

      {/* ── Weekly summary strip ── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          {
            icon: <Send size={14} className="text-purple-500" />,
            label: 'Scheduled this week',
            value: weekDays.reduce(
              (n, d) => n + (confirmedByDay[dayKey(d)]?.filter((p) => p.status === 'scheduled').length ?? 0),
              0,
            ),
          },
          {
            icon: <CheckCircle size={14} className="text-green-500" />,
            label: 'Published this week',
            value: weekDays.reduce(
              (n, d) => n + (confirmedByDay[dayKey(d)]?.filter((p) => p.status === 'published').length ?? 0),
              0,
            ),
          },
          {
            icon: <Pencil size={14} className="text-amber-500" />,
            label: 'Drafts awaiting approval',
            value: totalDrafts,
          },
          {
            icon: <AlertTriangle size={14} className="text-amber-400" />,
            label: 'Posting gaps this week',
            value: gapDays.length,
          },
        ].map(({ icon, label, value }) => (
          <div key={label} className="bg-white rounded-xl border border-gray-200 px-4 py-3 flex items-center gap-3">
            {icon}
            <div>
              <p className="text-[10px] text-gray-400 font-medium uppercase tracking-wide leading-tight">{label}</p>
              <p className="text-xl font-bold text-gray-800">{value}</p>
            </div>
          </div>
        ))}
      </div>

      {/* ── Post detail modal ── */}
      {selected && (
        <PostModal
          post={selected}
          onClose={() => setSelected(null)}
          onEdit={() => {
            router.push('/admin/social/outbox');
            setSelected(null);
          }}
        />
      )}
    </div>
  );
}
