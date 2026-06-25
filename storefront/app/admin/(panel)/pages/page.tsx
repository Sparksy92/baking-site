'use client';

import { useEffect, useRef, useState } from 'react';
import { api } from '@/lib/api';
import { Eye, Pencil, Trash2, Globe, FileText, RefreshCw, ChevronDown, ChevronUp, Images, X, AlertTriangle, CheckCircle, Monitor, Smartphone, Search } from 'lucide-react';
import { AIImagePicker } from '@/components/admin/AIImagePicker';
import { MediaPickerModal } from '@/components/admin/MediaPickerModal';

interface Page {
  id: number;
  title: string;
  slug: string;
  page_type: string;
  status: string;
  content_html: string;
  meta_title: string | null;
  meta_description: string | null;
  featured_image_url: string | null;
  author: string | null;
  published_at: string | null;
  updated_at: string;
}

const EMPTY_FORM = {
  title: '', slug: '', content_html: '', page_type: 'blog_post', status: 'draft',
  meta_title: '', meta_description: '', featured_image_url: '', author: '',
  ai_generated: false, ai_disclosure: false,
};

interface WCAGIssue {
  type: string;
  severity: 'error' | 'warning';
  message: string;
}

const AI_DISCLOSURE_TEXT_DEFAULT = 'This content was created with AI assistance and reviewed by our team.';

function wordCount(html: string | null | undefined) {
  return (html ?? '').replace(/<[^>]+>/g, ' ').trim().split(/\s+/).filter(Boolean).length;
}

function toSlug(s: string) {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)+/g, '');
}

export default function PagesPage() {
  const [pages, setPages] = useState<Page[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<'draft' | 'approved' | 'published'>('draft');
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  const [form, setForm] = useState({ ...EMPTY_FORM });
  const [seoOpen, setSeoOpen] = useState(true);
  const [showPicker, setShowPicker] = useState(false);
  const [showContentPicker, setShowContentPicker] = useState(false);
  const contentRef = useRef<HTMLTextAreaElement>(null);
  const [aiPrompt, setAiPrompt] = useState('');
  const [lastPrompt, setLastPrompt] = useState('');
  const [aiLoading, setAiLoading] = useState(false);
  const [aiGeneratedForImages, setAiGeneratedForImages] = useState<{ content: string; topic: string } | null>(null);
  const [saving, setSaving] = useState(false);
  const [syncLoading, setSyncLoading] = useState(false);
  const [togglingId, setTogglingId] = useState<number | null>(null);
  const [showPreview, setShowPreview] = useState(false);
  const [previewMode, setPreviewMode] = useState<'desktop' | 'mobile'>('desktop');
  const [wcagIssues, setWcagIssues] = useState<WCAGIssue[]>([]);
  const [wcagChecked, setWcagChecked] = useState(false);
  const [featuredImageError, setFeaturedImageError] = useState(false);
  const [aiDisclosureText, setAiDisclosureText] = useState(AI_DISCLOSURE_TEXT_DEFAULT);

  function insertImageAtCursor(url: string, altText: string) {
    const el = contentRef.current;
    if (!el) return;
    const tag = `<img src="${url}" alt="${altText}" class="w-full rounded-2xl my-6" />`;
    const start = el.selectionStart ?? el.value.length;
    const end = el.selectionEnd ?? el.value.length;
    const newVal = el.value.slice(0, start) + tag + el.value.slice(end);
    setForm((f) => ({ ...f, content_html: newVal }));
    // restore cursor after the inserted tag
    requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(start + tag.length, start + tag.length);
    });
  }

  useEffect(() => {
    load();
    api.get<{ key: string; value: string }[]>('/api/admin/settings')
      .then((rows) => {
        const val = rows.find((r) => r.key === 'ai_disclosure_text')?.value;
        if (val?.trim()) setAiDisclosureText(val.trim());
      })
      .catch(() => {});
  }, []);

  async function load() {
    try {
      const data = await api.get<{ pages: Page[] }>('/api/admin/pages');
      setPages(data.pages ?? []);
    } catch {} finally { setLoading(false); }
  }

  function openCreate() {
    setEditId(null);
    setForm({ ...EMPTY_FORM });
    setAiPrompt('');
    setLastPrompt('');
    setSeoOpen(false);
    setShowForm(true);
  }

  function openEdit(p: Page) {
    setEditId(p.id);
    setForm({
      title: p.title,
      slug: p.slug,
      content_html: p.content_html ?? '',
      page_type: p.page_type,
      status: p.status,
      meta_title: p.meta_title ?? '',
      meta_description: p.meta_description ?? '',
      featured_image_url: p.featured_image_url ?? '',
      author: p.author ?? '',
      ai_generated: (p as any).ai_generated ?? false,
      ai_disclosure: (p as any).ai_disclosure ?? false,
    });
    setAiPrompt('');
    setLastPrompt('');
    setSeoOpen(false);
    setShowForm(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function cancelForm() {
    setShowForm(false);
    setEditId(null);
    setForm({ ...EMPTY_FORM });
  }

  async function save() {
    const payload = { ...form } as typeof form & { slug: string };
    if (!payload.slug && payload.title) payload.slug = toSlug(payload.title);
    if (!payload.title || !payload.slug) { alert('Title and slug are required.'); return; }

    if (payload.status === 'published' && payload.page_type === 'blog_post' && !payload.featured_image_url) {
      setFeaturedImageError(true);
      setSeoOpen(true);
      return;
    }
    setFeaturedImageError(false);

    const issues = wcagChecked ? wcagIssues : await runWCAGCheck();
    const errors = issues.filter((i) => i.severity === 'error');
    if (errors.length > 0) {
      const proceed = confirm(
        `${errors.length} accessibility error(s) found:\n\n` +
        errors.map((e) => `• ${e.message}`).join('\n') +
        '\n\nSave anyway?'
      );
      if (!proceed) return;
    }

    let finalHtml = payload.content_html;
    if (payload.ai_disclosure && !finalHtml.includes(aiDisclosureText)) {
      finalHtml += `\n<p class="text-sm text-gray-500 mt-8 border-t border-gray-100 pt-4"><em>${aiDisclosureText}</em></p>`;
    }

    setSaving(true);
    try {
      if (editId) {
        await api.patch(`/api/admin/pages/${editId}`, { ...payload, content_html: finalHtml });
      } else {
        await api.post('/api/admin/pages', { ...payload, content_html: finalHtml });
      }
      cancelForm();
      load();
    } catch (e: any) {
      const msg = e?.detail || e?.message || '';
      if (msg.includes('featured image')) {
        setFeaturedImageError(true);
        setSeoOpen(true);
        setSaving(false);
        return;
      }
      alert(msg || 'Failed to save. Ensure the slug is unique.');
    } finally { setSaving(false); }
  }

  async function toggleStatus(p: Page) {
    setTogglingId(p.id);
    try {
      await api.patch(`/api/admin/pages/${p.id}`, {
        status: p.status === 'published' ? 'draft' : 'published',
      });
      load();
    } catch (e: any) {
      alert(e?.detail || 'Failed to update status.');
    } finally { setTogglingId(null); }
  }

  async function remove(id: number) {
    if (!confirm('Delete this page? This cannot be undone.')) return;
    await api.delete(`/api/admin/pages/${id}`);
    load();
  }

  async function generateAI() {
    if (!aiPrompt) return;
    setAiLoading(true);
    setLastPrompt(aiPrompt);
    try {
      const data = await api.post<{
        title: string; slug: string; meta_description: string;
        keywords: string[]; content_html: string;
      }>('/api/admin/pages/generate-ai', { prompt: aiPrompt });
      setForm((f) => ({
        ...f,
        title: data.title || f.title,
        slug: data.slug || f.slug,
        content_html: data.content_html || '',
        meta_description: data.meta_description || f.meta_description,
        page_type: 'blog_post',
        ai_generated: true,
        ai_disclosure: true,
      }));
      setAiGeneratedForImages({ content: data.content_html || '', topic: aiPrompt });
      if (data.meta_description) setSeoOpen(true);
      setAiPrompt('');
      setWcagChecked(false);
      setWcagIssues([]);
    } catch {
      alert('Failed to generate. Make sure AI API keys are configured.');
    } finally { setAiLoading(false); }
  }

  async function runWCAGCheck(): Promise<WCAGIssue[]> {
    try {
      const result = await api.post<{ issues: WCAGIssue[] }>('/api/admin/pages/wcag-check', {
        content_html: form.content_html,
      });
      setWcagIssues(result.issues);
      setWcagChecked(true);
      return result.issues;
    } catch {
      return [];
    }
  }

  async function syncSocials() {
    setSyncLoading(true);
    try {
      await api.post('/api/admin/pages/sync-social', {});
      load();
      alert('Social media sync complete!');
    } catch { alert('Sync failed. Make sure Meta tokens are configured.'); }
    finally { setSyncLoading(false); }
  }

  const filtered = pages.filter((p) => p.status === (tab as string));

  if (loading) return <div className="text-gray-400">Loading...</div>;

  const wc = wordCount(form.content_html);

  return (
    <div>
      {/* ── Header ── */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Pages & Blog</h1>
          <p className="text-xs text-gray-400 mt-0.5">
            Blog posts live at <code className="bg-gray-100 px-1 rounded">/blog/[slug]</code> · Pages at <code className="bg-gray-100 px-1 rounded">/pages/[slug]</code>
          </p>
        </div>
        <div className="flex gap-2">
          <button onClick={syncSocials} disabled={syncLoading} className="px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition-colors disabled:opacity-50">
            {syncLoading ? 'Syncing…' : 'Sync Socials'}
          </button>
          <button onClick={openCreate} className="px-4 py-2 bg-brand text-white rounded-lg text-sm font-medium">+ New</button>
        </div>
      </div>

      {/* ── Create / Edit form ── */}
      {showForm && (
        <div className="bg-white rounded-xl border border-gray-200 p-5 mb-6 space-y-4">
          <h2 className="font-semibold text-gray-800">{editId ? 'Edit post / page' : 'New post / page'}</h2>

          {/* AI assistant */}
          <div className="flex gap-2 p-3 bg-purple-50 rounded-lg border border-purple-100 items-start">
            <span className="text-lg mt-0.5">✨</span>
            <div className="flex-1 space-y-1.5">
              {lastPrompt && (
                <p className="text-xs text-purple-500">Last prompt: <em>{lastPrompt}</em></p>
              )}
              <div className="flex gap-2">
                <input
                  placeholder="AI: describe what to write (e.g. Amazing sweat with my people at Miitig…)"
                  value={aiPrompt}
                  onChange={(e) => setAiPrompt(e.target.value)}
                  className="flex-1 bg-white border border-purple-200 rounded px-3 py-1.5 text-sm outline-none focus:border-purple-400"
                  onKeyDown={(e) => e.key === 'Enter' && generateAI()}
                />
                <button
                  onClick={generateAI}
                  disabled={aiLoading || !aiPrompt}
                  className="px-3 py-1.5 bg-purple-600 hover:bg-purple-700 text-white rounded text-sm font-medium disabled:opacity-50 transition-colors flex items-center gap-1.5"
                >
                  {aiLoading ? <><RefreshCw size={13} className="animate-spin" /> Generating…</> : 'Generate'}
                </button>
              </div>
            </div>
          </div>

          {/* Core fields */}
          <div className="grid grid-cols-2 gap-3">
            <input
              placeholder="Title *"
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value, slug: form.slug || toSlug(e.target.value) })}
              className="border border-gray-200 rounded px-3 py-1.5 text-sm col-span-2"
            />
            <input
              placeholder="slug (auto-generated from title)"
              value={form.slug}
              onChange={(e) => setForm({ ...form, slug: e.target.value })}
              className="border border-gray-200 rounded px-3 py-1.5 text-sm font-mono text-xs"
            />
            <input
              placeholder="Author (optional)"
              value={form.author}
              onChange={(e) => setForm({ ...form, author: e.target.value })}
              className="border border-gray-200 rounded px-3 py-1.5 text-sm"
            />
            <select
              value={form.page_type}
              onChange={(e) => setForm({ ...form, page_type: e.target.value })}
              className="border border-gray-200 rounded px-3 py-1.5 text-sm"
            >
              <option value="blog_post">Blog Post</option>
              <option value="page">Static Page</option>
            </select>
            <select
              value={form.status}
              onChange={(e) => setForm({ ...form, status: e.target.value })}
              className="border border-gray-200 rounded px-3 py-1.5 text-sm"
            >
              <option value="draft">Draft — not public</option>
              <option value="approved">Approved — ready to publish</option>
              <option value="published">Published — live on site</option>
            </select>
          </div>

          {/* AI disclosure checkbox — shown when ai_generated */}
          {form.ai_generated && (
            <label className="flex items-start gap-2.5 p-3 bg-amber-50 border border-amber-200 rounded-lg cursor-pointer">
              <input
                type="checkbox"
                checked={form.ai_disclosure}
                onChange={(e) => setForm({ ...form, ai_disclosure: e.target.checked })}
                className="mt-0.5 w-4 h-4 rounded border-gray-300 text-brand"
              />
              <div>
                <span className="text-sm font-medium text-amber-800">Include AI disclosure footer</span>
                <p className="text-xs text-amber-600 mt-0.5">Appends: &ldquo;{aiDisclosureText}&rdquo;</p>
              </div>
            </label>
          )}

          {/* WCAG issues banner */}
          {wcagChecked && wcagIssues.length > 0 && (
            <div className="p-3 rounded-lg border border-amber-200 bg-amber-50 space-y-1">
              <div className="flex items-center gap-1.5 text-amber-700 font-medium text-sm">
                <AlertTriangle size={14} /> {wcagIssues.filter(i => i.severity === 'error').length} error(s), {wcagIssues.filter(i => i.severity === 'warning').length} warning(s)
              </div>
              {wcagIssues.map((issue, i) => (
                <p key={i} className={`text-xs pl-5 ${issue.severity === 'error' ? 'text-red-600' : 'text-amber-600'}`}>
                  {issue.severity === 'error' ? '✕' : '!'} {issue.message}
                </p>
              ))}
            </div>
          )}
          {wcagChecked && wcagIssues.length === 0 && (
            <div className="flex items-center gap-1.5 p-2.5 rounded-lg bg-green-50 border border-green-200 text-green-700 text-xs">
              <CheckCircle size={13} /> No accessibility issues found
            </div>
          )}

          {/* Content */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-xs text-gray-400 font-medium uppercase tracking-wide">Content</span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={runWCAGCheck}
                  disabled={!form.content_html}
                  className="flex items-center gap-1.5 px-2.5 py-1 text-xs border border-gray-200 rounded-lg text-gray-500 hover:bg-gray-50 disabled:opacity-40"
                >
                  <CheckCircle size={12} /> Check accessibility
                </button>
                <button
                  type="button"
                  onClick={() => setShowPreview(true)}
                  disabled={!form.content_html}
                  className="flex items-center gap-1.5 px-2.5 py-1 text-xs border border-gray-200 rounded-lg text-gray-500 hover:bg-gray-50 disabled:opacity-40"
                >
                  <Eye size={12} /> Preview
                </button>
                <button
                  type="button"
                  onClick={() => setShowContentPicker(true)}
                  className="flex items-center gap-1.5 px-2.5 py-1 text-xs border border-gray-200 rounded-lg text-gray-500 hover:bg-gray-50"
                  title="Insert image from Media Library at cursor position"
                >
                  <Images size={12} /> Insert image
                </button>
              </div>
            </div>
            <textarea
              ref={contentRef}
              placeholder="Write your content here… Plain text is formatted into paragraphs. HTML is also accepted."
              value={form.content_html}
              onChange={(e) => setForm({ ...form, content_html: e.target.value })}
              rows={10}
              className="w-full border border-gray-200 rounded px-3 py-2 text-sm font-mono"
            />
            <p className="text-xs text-gray-400 mt-1">{wc} words · ~{Math.ceil(wc / 200)} min read</p>
          </div>

          {/* ✨ AI Image Picker — shown after AI content generation */}
          {aiGeneratedForImages && (
            <AIImagePicker
              content={aiGeneratedForImages.content}
              topic={aiGeneratedForImages.topic}
              context="blog"
              onSelect={(dataUrl) => {
                setForm((f) => ({ ...f, featured_image_url: dataUrl }));
                setFeaturedImageError(false);
              }}
            />
          )}

          {/* SEO accordion */}
          <div className="border border-gray-200 rounded-lg overflow-hidden">
            <div className="w-full flex items-center justify-between px-4 py-2.5 text-sm font-medium text-gray-600 bg-gray-50">
              <span>SEO & Meta</span>
            </div>
            <div className="p-4 space-y-3">
                <input
                  placeholder="Meta title (defaults to post title)"
                  value={form.meta_title}
                  onChange={(e) => setForm({ ...form, meta_title: e.target.value })}
                  className="w-full border border-gray-200 rounded px-3 py-1.5 text-sm"
                />
                <div>
                  <textarea
                    placeholder="Meta description (~155 chars) — shown in Google search results"
                    value={form.meta_description}
                    onChange={(e) => setForm({ ...form, meta_description: e.target.value })}
                    rows={2}
                    maxLength={300}
                    className="w-full border border-gray-200 rounded px-3 py-1.5 text-sm"
                  />
                  <p className={`text-xs mt-0.5 ${(form.meta_description?.length ?? 0) > 160 ? 'text-amber-500' : 'text-gray-400'}`}>
                    {form.meta_description?.length ?? 0}/155
                  </p>
                </div>
                {featuredImageError && !form.featured_image_url && (
                  <div className="flex items-start gap-2 px-3 py-2.5 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
                    <AlertTriangle size={15} className="mt-0.5 shrink-0" />
                    <span>A featured image is required before publishing a blog post.</span>
                    <button
                      type="button"
                      onClick={() => setShowPicker(true)}
                      className="ml-auto shrink-0 underline font-medium hover:text-red-900 whitespace-nowrap"
                    >
                      Pick from Library
                    </button>
                  </div>
                )}
                <div className="flex gap-2">
                  <input
                    placeholder="Featured image URL (used in OG / blog card)"
                    value={form.featured_image_url}
                    onChange={(e) => { setForm({ ...form, featured_image_url: e.target.value }); if (e.target.value) setFeaturedImageError(false); }}
                    className={`flex-1 border rounded px-3 py-1.5 text-sm ${featuredImageError && !form.featured_image_url ? 'border-red-400 bg-red-50' : 'border-gray-200'}`}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPicker(true)}
                    className="flex items-center gap-1.5 px-3 py-1.5 border border-gray-200 rounded text-sm text-gray-600 hover:bg-gray-50 whitespace-nowrap"
                  >
                    <Images size={14} /> Browse Library
                  </button>
                </div>
                {form.featured_image_url && (
                  <img src={form.featured_image_url} alt="Featured" className="mt-2 h-24 rounded-lg object-cover border border-gray-200" />
                )}

                {/* Google snippet preview */}
                <div className="pt-1">
                  <div className="mt-2 p-3 bg-white border border-gray-200 rounded-lg font-sans">
                    <p className="text-xs text-gray-400 mb-2 uppercase tracking-wide flex items-center gap-1.5"><Search size={11} /> Search result preview</p>
                    <div className="space-y-0.5">
                      <p className="text-xs text-green-700 truncate">
                        badasselder.com › {form.page_type === 'blog_post' ? 'blog' : 'pages'} › {form.slug || 'your-slug'}
                      </p>
                      <p className="text-base text-blue-700 hover:underline cursor-pointer truncate font-medium leading-snug">
                        {form.meta_title || form.title || 'Page Title'}
                      </p>
                      <p className={`text-sm leading-snug ${form.meta_description ? 'text-gray-600' : 'text-gray-400 italic'}`}>
                        {form.meta_description
                          ? (form.meta_description.length > 160
                              ? form.meta_description.slice(0, 157) + '…'
                              : form.meta_description)
                          : 'No meta description — Google will auto-generate one from your content.'}
                      </p>
                    </div>
                    {!form.meta_description && (
                      <p className="mt-2 text-xs text-amber-600">⚠ Add a meta description for better click-through rates</p>
                    )}
                    {form.meta_title && form.meta_title.length > 60 && (
                      <p className="mt-1 text-xs text-amber-600">⚠ Meta title is {form.meta_title.length} chars — Google truncates at ~60</p>
                    )}
                  </div>
                </div>
              </div>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-3">
            <button
              onClick={save}
              disabled={saving}
              className="px-5 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg text-sm font-medium disabled:opacity-50 transition-colors"
            >
              {saving ? 'Saving…' : form.status === 'published' ? 'Save & Publish' : form.status === 'approved' ? 'Save as Approved' : 'Save Draft'}
            </button>
            <button onClick={cancelForm} className="px-4 py-2 border border-gray-200 rounded-lg text-sm text-gray-500 hover:bg-gray-50 transition-colors">
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* ── Tabs ── */}
      <div className="flex border-b border-gray-200 mb-4">
        {(['draft', 'approved', 'published'] as const).map((t) => {
          const count = pages.filter((p) => p.status === t).length;
          return (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-5 py-2.5 text-sm font-medium border-b-2 transition-colors ${
                tab === t ? 'border-brand text-brand' : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              {t === 'draft' ? 'Drafts' : t === 'approved' ? 'Approved' : 'Published'} {count > 0 && <span className="ml-1.5 px-1.5 py-0.5 bg-gray-100 rounded-full text-xs">{count}</span>}
            </button>
          );
        })}
      </div>

      {/* ── Table ── */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        {filtered.length === 0 ? (
          <div className="py-12 text-center text-gray-400">
            <FileText size={32} className="mx-auto mb-3 opacity-30" />
            <p className="text-sm">No {tab} {tab === 'draft' ? 'drafts' : 'posts'} yet.</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Title</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Type</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Updated</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filtered.map((p) => (
                <tr key={p.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-4 py-3">
                    <span className="font-medium text-gray-900">{p.title}</span>
                    <span className="ml-2 text-xs text-gray-400 font-mono">{p.slug}</span>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-0.5 rounded text-xs font-medium ${p.page_type === 'blog_post' ? 'bg-purple-100 text-purple-700' : 'bg-blue-100 text-blue-700'}`}>
                      {p.page_type === 'blog_post' ? 'Blog' : 'Page'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-xs text-gray-400">
                    {new Date(p.updated_at).toLocaleDateString('en-CA', { month: 'short', day: 'numeric', year: 'numeric' })}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <button role="link" aria-label="Edit" onClick={() => openEdit(p)} className="text-gray-500 hover:text-gray-800 transition-colors" title="Edit">
                        <Pencil size={14} />
                      </button>
                      <button
                        onClick={() => toggleStatus(p)}
                        disabled={togglingId === p.id}
                        className={`text-xs font-medium px-2 py-0.5 rounded transition-colors ${
                          p.status === 'published'
                            ? 'bg-green-100 text-green-700 hover:bg-amber-100 hover:text-amber-700'
                            : 'bg-yellow-100 text-yellow-700 hover:bg-green-100 hover:text-green-700'
                        }`}
                        title={p.status === 'published' ? 'Click to unpublish' : 'Click to publish'}
                      >
                        {togglingId === p.id ? '…' : p.status === 'published' ? 'Published ↓' : 'Draft → Publish'}
                      </button>
                      {p.status === 'published' && (
                        <a
                          href={`/${p.page_type === 'blog_post' ? 'blog' : 'pages'}/${p.slug}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-gray-400 hover:text-blue-600 transition-colors"
                          title="View on site"
                        >
                          <Eye size={14} />
                        </a>
                      )}
                      <button onClick={() => remove(p.id)} className="text-gray-400 hover:text-red-600 transition-colors" title="Delete">
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {showPicker && (
        <MediaPickerModal
          onSelect={(url, altText) => {
            setForm((f) => ({ ...f, featured_image_url: url }));
            setFeaturedImageError(false);
            setShowPicker(false);
          }}
          onClose={() => setShowPicker(false)}
        />
      )}

      {showContentPicker && (
        <MediaPickerModal
          onSelect={(url, altText) => {
            insertImageAtCursor(url, altText);
            setShowContentPicker(false);
          }}
          onClose={() => setShowContentPicker(false)}
        />
      )}

      {/* Preview modal */}
      {showPreview && (
        <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/60 overflow-y-auto py-8 px-4">
          <div className={`bg-white rounded-2xl shadow-2xl transition-all ${previewMode === 'mobile' ? 'w-full max-w-sm' : 'w-full max-w-3xl'}`}>
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
              <div>
                <h2 className="font-bold text-gray-900 text-lg">{form.title || 'Preview'}</h2>
                {form.author && <p className="text-xs text-gray-400 mt-0.5">By {form.author}</p>}
              </div>
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-1">
                  <button
                    onClick={() => setPreviewMode('desktop')}
                    title="Desktop view"
                    className={`p-1.5 rounded-md transition-colors ${previewMode === 'desktop' ? 'bg-white shadow text-gray-800' : 'text-gray-400 hover:text-gray-600'}`}
                  >
                    <Monitor size={15} />
                  </button>
                  <button
                    onClick={() => setPreviewMode('mobile')}
                    title="Mobile view"
                    className={`p-1.5 rounded-md transition-colors ${previewMode === 'mobile' ? 'bg-white shadow text-gray-800' : 'text-gray-400 hover:text-gray-600'}`}
                  >
                    <Smartphone size={15} />
                  </button>
                </div>
                <button onClick={() => setShowPreview(false)} className="text-gray-400 hover:text-gray-700">
                  <X size={20} />
                </button>
              </div>
            </div>
            {form.featured_image_url && (
              <div className={`w-full bg-gray-100 overflow-hidden flex items-center justify-center ${previewMode === 'mobile' ? 'max-h-64' : 'max-h-80'}`}>
                <img src={form.featured_image_url} alt={form.title} className="w-full h-auto max-h-64 object-contain" style={{ maxHeight: previewMode === 'mobile' ? '16rem' : '20rem' }} />
              </div>
            )}
            <div
              className={`py-6 prose prose-sm max-w-none prose-headings:font-bold prose-a:text-blue-600 prose-strong:font-semibold text-gray-800 leading-relaxed ${previewMode === 'mobile' ? 'px-4 text-sm' : 'px-8'}`}
              dangerouslySetInnerHTML={{
                __html: form.ai_disclosure
                  ? form.content_html + `<p class="text-sm text-gray-400 mt-8 border-t border-gray-100 pt-4"><em>${aiDisclosureText}</em></p>`
                  : form.content_html,
              }}
            />
            <div className="px-6 py-4 border-t border-gray-100 bg-gray-50 rounded-b-2xl flex justify-between items-center">
              <span className="text-xs text-gray-400">{wordCount(form.content_html)} words · ~{Math.ceil(wordCount(form.content_html) / 200)} min read · {previewMode}</span>
              <button onClick={() => setShowPreview(false)} className="px-4 py-2 bg-gray-800 text-white rounded-lg text-sm">Close</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
