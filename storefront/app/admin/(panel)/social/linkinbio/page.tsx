'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { addToast } from '@/lib/toast';
import {
  Link2, Plus, X, ExternalLink, BarChart2, ChevronDown,
  ChevronUp, Star, Trash2, MousePointerClick, Eye,
} from 'lucide-react';

type LibPage = {
  id: number;
  slug: string;
  title: string;
  subtitle: string | null;
  is_active: boolean;
  view_count: number;
  click_count: number;
  created_at: string;
};

type LibLink = {
  id: number;
  title: string;
  url: string;
  description: string | null;
  button_text: string;
  is_highlighted: boolean;
  click_count: number;
};

type PageDetail = LibPage & { links: LibLink[] };

export default function LinkInBioPage() {
  const [pages, setPages] = useState<LibPage[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [pageDetails, setPageDetails] = useState<Record<number, PageDetail>>({});

  // Create page form
  const [showCreate, setShowCreate] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newSubtitle, setNewSubtitle] = useState('');
  const [newSlug, setNewSlug] = useState('');
  const [creating, setCreating] = useState(false);

  // Add link form
  const [addLinkPageId, setAddLinkPageId] = useState<number | null>(null);
  const [linkTitle, setLinkTitle] = useState('');
  const [linkUrl, setLinkUrl] = useState('');
  const [linkDesc, setLinkDesc] = useState('');
  const [linkBtn, setLinkBtn] = useState('Shop Now');
  const [linkHighlighted, setLinkHighlighted] = useState(false);
  const [addingLink, setAddingLink] = useState(false);

  function load() {
    setLoading(true);
    api.get<{ pages: LibPage[] }>('/api/admin/linkinbio/pages')
      .then((d) => setPages(d.pages))
      .catch(() => addToast('Failed to load pages', 'error'))
      .finally(() => setLoading(false));
  }

  useEffect(() => { load(); }, []);

  async function expand(pageId: number) {
    if (expandedId === pageId) { setExpandedId(null); return; }
    setExpandedId(pageId);
    if (!pageDetails[pageId]) {
      try {
        const data = await api.get<PageDetail>(`/api/admin/linkinbio/pages/${pageId}`);
        setPageDetails((prev) => ({ ...prev, [pageId]: data }));
      } catch { addToast('Failed to load page details', 'error'); }
    }
  }

  async function createPage() {
    if (!newTitle.trim()) { addToast('Title required', 'error'); return; }
    setCreating(true);
    try {
      await api.post('/api/admin/linkinbio/pages', {
        title: newTitle,
        subtitle: newSubtitle || null,
        custom_slug: newSlug || null,
      });
      addToast('Page created', 'success');
      setShowCreate(false);
      setNewTitle(''); setNewSubtitle(''); setNewSlug('');
      load();
    } catch { addToast('Failed to create page', 'error'); }
    finally { setCreating(false); }
  }

  async function addLink(pageId: number) {
    if (!linkTitle.trim() || !linkUrl.trim()) { addToast('Title and URL required', 'error'); return; }
    setAddingLink(true);
    try {
      await api.post(`/api/admin/linkinbio/pages/${pageId}/links`, {
        title: linkTitle,
        url: linkUrl,
        description: linkDesc || null,
        button_text: linkBtn,
        is_highlighted: linkHighlighted,
      });
      addToast('Link added', 'success');
      setAddLinkPageId(null);
      setLinkTitle(''); setLinkUrl(''); setLinkDesc(''); setLinkBtn('Shop Now'); setLinkHighlighted(false);
      // Refresh page detail
      const data = await api.get<PageDetail>(`/api/admin/linkinbio/pages/${pageId}`);
      setPageDetails((prev) => ({ ...prev, [pageId]: data }));
    } catch { addToast('Failed to add link', 'error'); }
    finally { setAddingLink(false); }
  }

  const storeDomain = typeof window !== 'undefined' ? window.location.origin : '';

  return (
    <div className="max-w-3xl space-y-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Link2 size={20} className="text-brand" />
            <h1 className="text-2xl font-bold text-gray-900">Link in Bio</h1>
          </div>
          <p className="text-sm text-gray-500">
            Micro landing pages for your social profiles. Share one link, show everything.
          </p>
        </div>
        <button
          onClick={() => setShowCreate((v) => !v)}
          className="flex items-center gap-2 px-4 py-2 bg-brand text-white text-sm font-medium rounded-xl hover:bg-brand/90"
        >
          <Plus size={15} /> New Page
        </button>
      </div>

      {/* Create form */}
      {showCreate && (
        <div className="bg-white rounded-xl border border-brand/30 p-5 space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-gray-900">New Link in Bio Page</h2>
            <button onClick={() => setShowCreate(false)} className="text-gray-400 hover:text-gray-600"><X size={16} /></button>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-gray-600 block mb-1">Title *</label>
              <input value={newTitle} onChange={(e) => setNewTitle(e.target.value)} placeholder="My Brand" className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm outline-none focus:border-brand" />
            </div>
            <div>
              <label className="text-xs font-medium text-gray-600 block mb-1">Subtitle</label>
              <input value={newSubtitle} onChange={(e) => setNewSubtitle(e.target.value)} placeholder="Shop our latest drops" className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm outline-none focus:border-brand" />
            </div>
            <div>
              <label className="text-xs font-medium text-gray-600 block mb-1">Custom Slug <span className="text-gray-400 font-normal">(optional)</span></label>
              <div className="flex items-center rounded-lg border border-gray-200 overflow-hidden focus-within:border-brand">
                <span className="px-2 py-2 bg-gray-50 text-xs text-gray-400 border-r border-gray-200">/l/</span>
                <input value={newSlug} onChange={(e) => setNewSlug(e.target.value)} placeholder="my-brand" className="flex-1 px-2 py-2 text-sm outline-none bg-white" />
              </div>
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <button onClick={() => setShowCreate(false)} className="px-4 py-1.5 text-sm text-gray-600 hover:text-gray-800">Cancel</button>
            <button onClick={createPage} disabled={creating} className="px-5 py-1.5 bg-brand text-white text-sm font-medium rounded-lg hover:bg-brand/90 disabled:opacity-50">
              {creating ? 'Creating…' : 'Create Page'}
            </button>
          </div>
        </div>
      )}

      {loading ? (
        <div className="text-gray-400 text-sm py-8 text-center">Loading…</div>
      ) : pages.length === 0 ? (
        <div className="bg-white rounded-xl border border-dashed border-gray-200 p-16 text-center">
          <Link2 size={32} className="mx-auto text-gray-300 mb-3" />
          <p className="text-sm font-medium text-gray-500">No pages yet</p>
          <p className="text-xs text-gray-400 mt-1">Create your first Link in Bio page to start driving traffic from social profiles.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {pages.map((page) => {
            const isExpanded = expandedId === page.id;
            const detail = pageDetails[page.id];
            const publicUrl = `${storeDomain}/l/${page.slug}`;

            return (
              <div key={page.id} className="bg-white rounded-xl border border-gray-200">
                {/* Header */}
                <div className="p-4 flex items-center gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className="text-sm font-semibold text-gray-900">{page.title}</span>
                      {page.is_active && <span className="text-[10px] px-1.5 py-0.5 bg-green-100 text-green-700 rounded-full font-medium">Active</span>}
                    </div>
                    {page.subtitle && <p className="text-xs text-gray-400">{page.subtitle}</p>}
                    <div className="flex items-center gap-3 mt-1">
                      <a href={publicUrl} target="_blank" rel="noopener noreferrer" className="text-xs text-brand hover:underline flex items-center gap-0.5">
                        /l/{page.slug} <ExternalLink size={10} />
                      </a>
                      <span className="flex items-center gap-1 text-xs text-gray-400"><Eye size={11} /> {page.view_count}</span>
                      <span className="flex items-center gap-1 text-xs text-gray-400"><MousePointerClick size={11} /> {page.click_count}</span>
                    </div>
                  </div>
                  <button
                    onClick={() => expand(page.id)}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-50 text-gray-600 text-xs font-medium rounded-lg hover:bg-gray-100 border border-gray-200"
                  >
                    {isExpanded ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
                    {isExpanded ? 'Collapse' : 'Manage Links'}
                  </button>
                </div>

                {/* Expanded: links + add form */}
                {isExpanded && detail && (
                  <div className="border-t border-gray-100 p-4 space-y-3">
                    {detail.links.length === 0 ? (
                      <p className="text-xs text-gray-400 text-center py-4">No links yet — add one below.</p>
                    ) : (
                      <div className="space-y-2">
                        {detail.links.map((link) => (
                          <div key={link.id} className="flex items-center gap-3 px-3 py-2 bg-gray-50 rounded-lg">
                            {link.is_highlighted && <Star size={13} className="text-amber-500 shrink-0" />}
                            <div className="flex-1 min-w-0">
                              <p className="text-xs font-medium text-gray-800 truncate">{link.title}</p>
                              <a href={link.url} target="_blank" rel="noopener noreferrer" className="text-xs text-gray-400 hover:text-brand truncate block">{link.url}</a>
                            </div>
                            <span className="text-xs text-gray-400 flex items-center gap-1 shrink-0"><MousePointerClick size={10} /> {link.click_count}</span>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Add link form */}
                    {addLinkPageId === page.id ? (
                      <div className="bg-gray-50 rounded-lg p-3 space-y-2.5 border border-gray-200">
                        <p className="text-xs font-semibold text-gray-700">Add Link</p>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                          <input value={linkTitle} onChange={(e) => setLinkTitle(e.target.value)} placeholder="Link title *" className="px-2.5 py-1.5 rounded-lg border border-gray-200 text-xs outline-none focus:border-brand" />
                          <input value={linkUrl} onChange={(e) => setLinkUrl(e.target.value)} placeholder="https://… *" className="px-2.5 py-1.5 rounded-lg border border-gray-200 text-xs outline-none focus:border-brand" />
                          <input value={linkDesc} onChange={(e) => setLinkDesc(e.target.value)} placeholder="Description (optional)" className="px-2.5 py-1.5 rounded-lg border border-gray-200 text-xs outline-none focus:border-brand" />
                          <input value={linkBtn} onChange={(e) => setLinkBtn(e.target.value)} placeholder="Button text" className="px-2.5 py-1.5 rounded-lg border border-gray-200 text-xs outline-none focus:border-brand" />
                        </div>
                        <label className="flex items-center gap-2 text-xs text-gray-600 cursor-pointer">
                          <input type="checkbox" checked={linkHighlighted} onChange={(e) => setLinkHighlighted(e.target.checked)} className="rounded" />
                          Highlight this link <Star size={11} className="text-amber-500" />
                        </label>
                        <div className="flex gap-2 justify-end">
                          <button onClick={() => setAddLinkPageId(null)} className="px-3 py-1 text-xs text-gray-500 hover:text-gray-700">Cancel</button>
                          <button onClick={() => addLink(page.id)} disabled={addingLink} className="px-4 py-1 bg-brand text-white text-xs font-medium rounded-lg hover:bg-brand/90 disabled:opacity-50">
                            {addingLink ? 'Adding…' : 'Add Link'}
                          </button>
                        </div>
                      </div>
                    ) : (
                      <button
                        onClick={() => setAddLinkPageId(page.id)}
                        className="flex items-center gap-1.5 text-xs text-brand hover:underline"
                      >
                        <Plus size={12} /> Add link
                      </button>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
