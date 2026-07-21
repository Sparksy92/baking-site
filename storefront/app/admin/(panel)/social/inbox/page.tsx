'use client';

import { useEffect, useState, useRef } from 'react';
import { api } from '@/lib/api';
import { addToast } from '@/lib/toast';
import {
  MessageSquare, Send, RefreshCw, CheckCircle, Clock, XCircle,
  ChevronDown, Sparkles, Filter, AlertTriangle, User,
} from 'lucide-react';

type Message = {
  id: number;
  conversation_id: number;
  direction: 'inbound' | 'outbound';
  message_type: string;
  content: string;
  sent_at: string;
  sentiment_score: number | null;
  detected_intent: string | null;
  is_read: boolean;
};

type Conversation = {
  id: number;
  platform: string;
  platform_user_id: string;
  platform_user_name: string | null;
  platform_user_avatar: string | null;
  status: 'open' | 'pending' | 'resolved' | 'spam';
  unread_count: number;
  last_message_at: string | null;
  assigned_to: string | null;
  tags: string | null;
  recent_messages?: Message[];
  messages?: Message[];
};

const PLATFORM_ICON: Record<string, string> = {
  facebook: '𝕗', instagram: '◉', x: '𝕏', linkedin: 'in', tiktok: '♪',
};

const STATUS_STYLES: Record<string, string> = {
  open:     'bg-green-100 text-green-700',
  pending:  'bg-yellow-100 text-yellow-700',
  resolved: 'bg-gray-100 text-gray-500',
  spam:     'bg-red-100 text-red-500',
};

const INTENT_STYLES: Record<string, string> = {
  question:  'bg-blue-50 text-blue-600',
  complaint: 'bg-red-50 text-red-600',
  praise:    'bg-green-50 text-green-600',
  sales:     'bg-purple-50 text-purple-600',
  spam:      'bg-gray-100 text-gray-500',
  general:   'bg-gray-50 text-gray-500',
};

function fmtTime(iso: string | null) {
  if (!iso) return '';
  const d = new Date(iso);
  const now = new Date();
  const diffH = (now.getTime() - d.getTime()) / 3600000;
  if (diffH < 24) return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  if (diffH < 168) return d.toLocaleDateString([], { weekday: 'short' });
  return d.toLocaleDateString([], { month: 'short', day: 'numeric' });
}

export default function SocialInboxPage() {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [activeId, setActiveId] = useState<number | null>(null);
  const [thread, setThread] = useState<Conversation | null>(null);
  const [threadLoading, setThreadLoading] = useState(false);
  const [reply, setReply] = useState('');
  const [sending, setSending] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [filterPlatform, setFilterPlatform] = useState('');
  const [filterStatus, setFilterStatus] = useState('open');
  const bottomRef = useRef<HTMLDivElement>(null);

  async function load() {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (filterPlatform) params.set('platform', filterPlatform);
      if (filterStatus) params.set('status', filterStatus);
      const data = await api.get<{ conversations: Conversation[]; total: number }>(
        `/api/admin/social-inbox/conversations?${params}`
      );
      setConversations(data.conversations);
      setTotal(data.total);
    } catch {
      addToast('Failed to load inbox', 'error');
    } finally {
      setLoading(false);
    }
  }

  async function openThread(id: number) {
    setActiveId(id);
    setThreadLoading(true);
    try {
      const data = await api.get<Conversation>(`/api/admin/social-inbox/conversations/${id}`);
      setThread(data);
      setConversations((prev) =>
        prev.map((c) => (c.id === id ? { ...c, unread_count: 0 } : c))
      );
    } catch {
      addToast('Failed to load conversation', 'error');
    } finally {
      setThreadLoading(false);
      setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
    }
  }

  async function sendReply() {
    if (!reply.trim() || !activeId) return;
    setSending(true);
    try {
      await api.post(`/api/admin/social-inbox/conversations/${activeId}/reply`, { content: reply });
      setReply('');
      await openThread(activeId);
      addToast('Reply sent', 'success');
    } catch {
      addToast('Failed to send reply', 'error');
    } finally {
      setSending(false);
    }
  }

  async function generateReply() {
    if (!thread || !activeId) return;
    setGenerating(true);
    try {
      const lastInbound = [...(thread.messages ?? [])].reverse().find((m) => m.direction === 'inbound');
      if (!lastInbound) { addToast('No comment to reply to', 'error'); return; }
      const data = await api.post<{ reply: string }>('/api/admin/social/generate-reply', {
        comment: lastInbound.content,
        platform: thread.platform,
        commenter_name: thread.platform_user_name ?? 'a customer',
      });
      setReply(data.reply);
    } catch {
      addToast('AI reply generation failed', 'error');
    } finally {
      setGenerating(false);
    }
  }

  async function setStatus(id: number, status: string) {
    try {
      await api.post(`/api/admin/social-inbox/conversations/${id}/status`, { status });
      setConversations((prev) => prev.map((c) => c.id === id ? { ...c, status: status as Conversation['status'] } : c));
      if (thread?.id === id) setThread((t) => t ? { ...t, status: status as Conversation['status'] } : t);
    } catch { addToast('Failed to update status', 'error'); }
  }

  useEffect(() => { load(); }, [filterPlatform, filterStatus]);

  const unreadTotal = conversations.reduce((s, c) => s + (c.unread_count ?? 0), 0);

  return (
    <div className="flex h-[calc(100vh-120px)] overflow-hidden rounded-xl border border-gray-200 bg-white">
      {/* ── Left panel: conversation list ── */}
      <div className="w-80 shrink-0 border-r border-gray-200 flex flex-col">
        {/* Header */}
        <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <MessageSquare size={16} className="text-brand" />
            <span className="text-sm font-semibold text-gray-900">Inbox</span>
            {unreadTotal > 0 && (
              <span className="text-xs font-bold bg-brand text-white px-1.5 py-0.5 rounded-full">{unreadTotal}</span>
            )}
          </div>
          <button onClick={load} className="text-gray-400 hover:text-gray-600">
            <RefreshCw size={14} />
          </button>
        </div>

        {/* Filters */}
        <div className="px-3 py-2 border-b border-gray-100 flex gap-2">
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="flex-1 text-xs border border-gray-200 rounded-md px-2 py-1 outline-none focus:border-brand"
          >
            <option value="">All statuses</option>
            <option value="open">Open</option>
            <option value="pending">Pending</option>
            <option value="resolved">Resolved</option>
          </select>
          <select
            value={filterPlatform}
            onChange={(e) => setFilterPlatform(e.target.value)}
            className="flex-1 text-xs border border-gray-200 rounded-md px-2 py-1 outline-none focus:border-brand"
          >
            <option value="">All platforms</option>
            <option value="facebook">Facebook</option>
            <option value="instagram">Instagram</option>
          </select>
        </div>

        {/* Conversation list */}
        <div className="flex-1 overflow-y-auto">
          {loading && (
            <div className="flex justify-center py-8">
              <div className="w-5 h-5 rounded-full border-2 border-brand border-t-transparent animate-spin" />
            </div>
          )}
          {!loading && conversations.length === 0 && (
            <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
              <MessageSquare size={28} className="text-gray-300 mb-2" />
              <p className="text-sm text-gray-400">No conversations yet</p>
              <p className="text-xs text-gray-300 mt-1">Comments from your posts will appear here</p>
            </div>
          )}
          {conversations.map((c) => {
            const last = c.recent_messages?.[c.recent_messages.length - 1];
            const isActive = c.id === activeId;
            return (
              <button
                key={c.id}
                onClick={() => openThread(c.id)}
                className={`w-full text-left px-4 py-3 border-b border-gray-50 hover:bg-gray-50 transition-colors ${isActive ? 'bg-brand/5 border-l-2 border-l-brand' : ''}`}
              >
                <div className="flex items-start gap-2.5">
                  <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center text-xs font-bold text-gray-500 shrink-0">
                    {PLATFORM_ICON[c.platform] ?? c.platform[0].toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-1">
                      <span className="text-xs font-semibold text-gray-800 truncate">
                        {c.platform_user_name ?? 'Unknown user'}
                      </span>
                      <span className="text-xs text-gray-400 shrink-0">{fmtTime(c.last_message_at)}</span>
                    </div>
                    <p className="text-xs text-gray-500 truncate mt-0.5">
                      {last?.content ?? 'No messages'}
                    </p>
                    <div className="flex items-center gap-1.5 mt-1">
                      <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium ${STATUS_STYLES[c.status]}`}>
                        {c.status}
                      </span>
                      {c.unread_count > 0 && (
                        <span className="text-xs font-bold bg-brand text-white px-1.5 py-0.5 rounded-full">
                          {c.unread_count}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </button>
            );
          })}
        </div>

        <div className="px-4 py-2 border-t border-gray-100 text-xs text-gray-400">{total} total</div>
      </div>

      {/* ── Right panel: message thread ── */}
      <div className="flex-1 flex flex-col min-w-0">
        {!activeId && (
          <div className="flex-1 flex flex-col items-center justify-center text-center px-8">
            <MessageSquare size={36} className="text-gray-200 mb-3" />
            <p className="text-sm font-medium text-gray-400">Select a conversation</p>
            <p className="text-xs text-gray-300 mt-1">Click any conversation on the left to view the thread</p>
          </div>
        )}

        {activeId && threadLoading && (
          <div className="flex-1 flex items-center justify-center">
            <div className="w-6 h-6 rounded-full border-2 border-brand border-t-transparent animate-spin" />
          </div>
        )}

        {activeId && !threadLoading && thread && (
          <>
            {/* Thread header */}
            <div className="px-5 py-3 border-b border-gray-200 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center text-sm font-bold text-gray-500">
                  {PLATFORM_ICON[thread.platform] ?? thread.platform[0].toUpperCase()}
                </div>
                <div>
                  <p className="text-sm font-semibold text-gray-900">{thread.platform_user_name ?? 'Unknown user'}</p>
                  <p className="text-xs text-gray-400 capitalize">{thread.platform}</p>
                </div>
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_STYLES[thread.status]}`}>
                  {thread.status}
                </span>
              </div>

              {/* Status actions */}
              <div className="flex items-center gap-2">
                {thread.status !== 'resolved' && (
                  <button
                    onClick={() => setStatus(thread.id, 'resolved')}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-green-50 text-green-700 text-xs font-medium rounded-lg hover:bg-green-100 border border-green-200"
                    title="Mark resolved"
                  >
                    <CheckCircle size={13} /> Resolve
                  </button>
                )}
                {thread.status === 'resolved' && (
                  <button
                    onClick={() => setStatus(thread.id, 'open')}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-50 text-gray-600 text-xs font-medium rounded-lg hover:bg-gray-100 border border-gray-200"
                    title="Re-open"
                  >
                    <RefreshCw size={13} /> Re-open
                  </button>
                )}
                <button
                  onClick={() => setStatus(thread.id, 'spam')}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-red-50 text-red-600 text-xs font-medium rounded-lg hover:bg-red-100 border border-red-200"
                  title="Mark spam"
                >
                  <XCircle size={13} /> Spam
                </button>
              </div>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto px-5 py-4 space-y-3">
              {(thread.messages ?? []).map((msg) => {
                const isOutbound = msg.direction === 'outbound';
                return (
                  <div key={msg.id} className={`flex gap-2 ${isOutbound ? 'flex-row-reverse' : 'flex-row'}`}>
                    {!isOutbound && (
                      <div className="w-7 h-7 rounded-full bg-gray-100 flex items-center justify-center text-xs font-bold text-gray-500 shrink-0 mt-1">
                        <User size={13} />
                      </div>
                    )}
                    <div className={`max-w-[70%] space-y-1 ${isOutbound ? 'items-end' : 'items-start'} flex flex-col`}>
                      <div className={`px-3 py-2 rounded-xl text-sm leading-relaxed ${
                        isOutbound
                          ? 'bg-brand text-white rounded-tr-sm'
                          : 'bg-gray-100 text-gray-800 rounded-tl-sm'
                      }`}>
                        {msg.content}
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-gray-400">{fmtTime(msg.sent_at)}</span>
                        {msg.detected_intent && msg.direction === 'inbound' && (
                          <span className={`text-xs px-1.5 py-0.5 rounded-full ${INTENT_STYLES[msg.detected_intent] ?? INTENT_STYLES.general}`}>
                            {msg.detected_intent}
                          </span>
                        )}
                        {msg.sentiment_score !== null && msg.direction === 'inbound' && (
                          <span className={`text-xs ${msg.sentiment_score > 0.1 ? 'text-green-500' : msg.sentiment_score < -0.1 ? 'text-red-400' : 'text-gray-400'}`}>
                            {msg.sentiment_score > 0.1 ? '😊' : msg.sentiment_score < -0.1 ? '😟' : '😐'}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
              <div ref={bottomRef} />
            </div>

            {/* Reply composer */}
            {thread.status !== 'resolved' && thread.status !== 'spam' && (
              <div className="px-5 py-3 border-t border-gray-200 space-y-2">
                <div className="flex items-start gap-2">
                  <textarea
                    value={reply}
                    onChange={(e) => setReply(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) sendReply();
                    }}
                    rows={3}
                    placeholder="Write a reply… (Cmd+Enter to send)"
                    className="flex-1 px-3 py-2 rounded-xl border border-gray-200 text-sm outline-none focus:border-brand resize-none"
                  />
                </div>
                <div className="flex items-center justify-between">
                  <button
                    onClick={generateReply}
                    disabled={generating}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-purple-50 text-purple-700 text-xs font-medium rounded-lg hover:bg-purple-100 disabled:opacity-50"
                  >
                    <Sparkles size={12} /> {generating ? 'Generating...' : 'AI Draft Reply'}
                  </button>
                  <button
                    onClick={sendReply}
                    disabled={sending || !reply.trim()}
                    className="flex items-center gap-1.5 px-4 py-1.5 bg-brand text-white text-xs font-medium rounded-lg hover:bg-brand/90 disabled:opacity-50"
                  >
                    <Send size={12} /> {sending ? 'Sending...' : 'Send Reply'}
                  </button>
                </div>
              </div>
            )}

            {(thread.status === 'resolved' || thread.status === 'spam') && (
              <div className="px-5 py-3 border-t border-gray-100 text-center">
                <p className="text-xs text-gray-400">
                  This conversation is <strong>{thread.status}</strong>. Re-open it to send a reply.
                </p>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
