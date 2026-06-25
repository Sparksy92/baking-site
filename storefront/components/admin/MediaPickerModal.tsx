'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { X, Search, Upload, RefreshCw, Image as ImageIcon, Check } from 'lucide-react';
import { api } from '@/lib/api';

interface MediaItem {
  id: number;
  filename: string;
  url: string;
  alt_text: string;
  ai_generated_alt: boolean;
  file_type: 'image' | 'video';
  size_bytes: number;
}

interface Props {
  onSelect: (url: string, altText: string) => void;
  onClose: () => void;
}

export function MediaPickerModal({ onSelect, onClose }: Props) {
  const [items, setItems] = useState<MediaItem[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [selected, setSelected] = useState<MediaItem | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async (p = 1) => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(p), per_page: '24', file_type: 'image' });
      if (search) params.set('search', search);
      const data = await api.get<{ items: MediaItem[]; total: number; pages: number; page: number }>(
        `/api/admin/media?${params}`
      );
      setItems(data.items);
      setTotal(data.total);
      setPage(data.page);
      setPages(data.pages);
    } finally {
      setLoading(false);
    }
  }, [search]);

  useEffect(() => { load(1); }, [search]);

  async function uploadAndSelect(files: FileList | null) {
    if (!files?.length) return;
    setUploading(true);
    try {
      const form = new FormData();
      form.append('file', files[0]);
      const item = await api.upload<MediaItem>('/api/admin/media/upload', form);
      onSelect(item.url, item.alt_text);
    } catch (e: any) {
      alert(`Upload failed: ${e?.message || 'Unknown error'}`);
    } finally {
      setUploading(false);
    }
  }

  function confirm() {
    if (!selected) return;
    onSelect(selected.url, selected.alt_text);
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/50">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[85vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <h2 className="font-semibold text-gray-800">Media Library</h2>
          <div className="flex items-center gap-2">
            <button
              onClick={() => fileRef.current?.click()}
              disabled={uploading}
              className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-brand text-white rounded-lg disabled:opacity-50"
            >
              {uploading ? <RefreshCw size={13} className="animate-spin" /> : <Upload size={13} />}
              Upload new
            </button>
            <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={(e) => uploadAndSelect(e.target.files)} />
            <button onClick={onClose} className="p-1.5 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100">
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Search */}
        <div className="px-5 py-3 border-b border-gray-100">
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              placeholder="Search images…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-8 pr-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-brand"
            />
          </div>
        </div>

        {/* Grid */}
        <div className="flex-1 overflow-y-auto p-5">
          {loading ? (
            <div className="flex items-center justify-center h-40 text-gray-400">
              <RefreshCw size={20} className="animate-spin" />
            </div>
          ) : items.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-40 text-gray-400">
              <ImageIcon size={32} className="mb-2 opacity-30" />
              <p className="text-sm">No images found. Upload one above.</p>
            </div>
          ) : (
            <div className="grid grid-cols-4 sm:grid-cols-5 md:grid-cols-6 gap-3">
              {items.map((item) => (
                <button
                  key={item.id}
                  onClick={() => setSelected(selected?.id === item.id ? null : item)}
                  className={`relative aspect-square rounded-lg overflow-hidden border-2 transition-all ${
                    selected?.id === item.id
                      ? 'border-brand ring-2 ring-brand/30'
                      : 'border-transparent hover:border-gray-300'
                  }`}
                >
                  <img src={item.url} alt={item.alt_text} className="w-full h-full object-cover" loading="lazy" />
                  {selected?.id === item.id && (
                    <div className="absolute inset-0 bg-brand/20 flex items-center justify-center">
                      <div className="bg-brand text-white rounded-full p-1">
                        <Check size={12} />
                      </div>
                    </div>
                  )}
                </button>
              ))}
            </div>
          )}

          {/* Pagination */}
          {pages > 1 && (
            <div className="flex items-center justify-center gap-2 mt-5">
              <button onClick={() => load(page - 1)} disabled={page === 1} className="px-3 py-1.5 text-sm border border-gray-200 rounded disabled:opacity-40">← Prev</button>
              <span className="text-sm text-gray-500">{page} / {pages}</span>
              <button onClick={() => load(page + 1)} disabled={page === pages} className="px-3 py-1.5 text-sm border border-gray-200 rounded disabled:opacity-40">Next →</button>
            </div>
          )}
        </div>

        {/* Selected preview + confirm */}
        {selected && (
          <div className="px-5 py-4 border-t border-gray-100 bg-gray-50 rounded-b-2xl flex items-center gap-4">
            <img src={selected.url} alt={selected.alt_text} className="w-14 h-14 object-cover rounded-lg border border-gray-200" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-gray-700 truncate">{selected.filename}</p>
              <p className="text-xs text-gray-500 truncate">{selected.alt_text || 'No alt text'}</p>
            </div>
            <button
              onClick={confirm}
              className="px-4 py-2 bg-brand text-white rounded-lg text-sm font-medium"
            >
              Use this image
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
