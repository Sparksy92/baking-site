'use client';

import { useState, useEffect } from 'react';
import { api } from '@/lib/api';
import { X, Upload, Loader2, Search } from 'lucide-react';
import { addToast } from '@/lib/toast';

interface MediaAsset {
  id: number;
  url: string;
  filename: string;
  alt_text: string;
  content_type: string;
  size_bytes: number;
}

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (url: string) => void;
}

export default function MediaLibraryModal({ isOpen, onClose, onSelect }: Props) {
  const [assets, setAssets] = useState<MediaAsset[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    if (isOpen) {
      fetchAssets();
    }
  }, [isOpen]);

  async function fetchAssets() {
    setLoading(true);
    try {
      const data = await api.get<MediaAsset[]>('/api/admin/media');
      setAssets(data);
    } catch (err) {
      console.error(err);
      addToast('Failed to load media library', 'error');
    } finally {
      setLoading(false);
    }
  }

  async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 4 * 1024 * 1024) {
      addToast('File size exceeds 4 MB limit.', 'error');
      return;
    }

    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp'];
    if (!allowedTypes.includes(file.type)) {
      addToast('Only JPEG, PNG, and WebP images are allowed.', 'error');
      return;
    }

    setUploading(true);
    const formData = new FormData();
    formData.append('file', file);

    try {
      const res = await fetch('/api/admin/media/upload', {
        method: 'POST',
        body: formData,
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.detail || 'Upload failed');
      }

      const newAsset = await res.json();
      addToast('Image uploaded successfully', 'success');
      setAssets((prev) => [newAsset, ...prev]);
      onSelect(newAsset.url);
      onClose();
    } catch (err: any) {
      console.error(err);
      addToast(err.message || 'Failed to upload image', 'error');
    } finally {
      setUploading(false);
    }
  }

  if (!isOpen) return null;

  const filteredAssets = assets.filter((a) =>
    (a.filename || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
    (a.alt_text || '').toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      
      {/* Modal Card */}
      <div className="relative w-full max-w-4xl h-[80vh] bg-white rounded-2xl shadow-2xl border border-gray-100 flex flex-col overflow-hidden z-10">
        
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 bg-gray-50/50">
          <div>
            <h3 className="font-bold text-gray-900 text-base">Select Image from Media Library</h3>
            <p className="text-xs text-gray-500">Choose an existing asset or upload a new one.</p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors">
            <X size={18} />
          </button>
        </div>

        {/* Toolbar */}
        <div className="p-4 border-b border-gray-100 bg-white flex flex-col sm:flex-row items-center gap-3">
          <div className="relative flex-1 w-full">
            <Search className="absolute left-3 top-2.5 text-gray-400 w-4 h-4" />
            <input
              type="text"
              placeholder="Search images by filename or alt text..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-2 border border-gray-200 rounded-xl outline-none text-sm focus:border-brand focus:ring-4 focus:ring-brand/10 transition-all text-gray-800"
            />
          </div>

          <label className="flex items-center justify-center gap-2 px-4 py-2 bg-brand text-white font-bold text-xs rounded-xl hover:bg-brand/90 cursor-pointer shadow-sm transition-colors w-full sm:w-auto text-center disabled:opacity-50">
            {uploading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Uploading...</span>
              </>
            ) : (
              <>
                <Upload size={14} />
                <span>Upload New</span>
              </>
            )}
            <input type="file" accept="image/jpeg,image/png,image/webp" onChange={handleFileUpload} disabled={uploading} className="hidden" />
          </label>
        </div>

        {/* Content */}
        <div className="flex-1 p-6 overflow-y-auto min-h-0 bg-gray-50/30">
          {loading ? (
            <div className="flex flex-col items-center justify-center h-full text-gray-400 gap-2">
              <Loader2 className="w-8 h-8 animate-spin text-brand" />
              <span className="text-xs">Loading media assets...</span>
            </div>
          ) : filteredAssets.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-gray-400 py-12">
              <p className="text-sm font-semibold">No images found.</p>
              <p className="text-xs text-gray-400 mt-1">Upload a new image or adjust your search filter.</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
              {filteredAssets.map((asset) => (
                <button
                  key={asset.id}
                  onClick={() => {
                    onSelect(asset.url);
                    onClose();
                  }}
                  className="group relative aspect-square bg-white border border-gray-200 rounded-xl overflow-hidden hover:border-brand hover:ring-4 hover:ring-brand/10 text-left flex flex-col transition-all shadow-sm focus:outline-none"
                >
                  <div className="relative flex-1 w-full bg-gray-100 flex items-center justify-center overflow-hidden">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={asset.url}
                      alt={asset.alt_text || asset.filename}
                      className="object-cover w-full h-full group-hover:scale-105 transition-transform duration-300"
                      loading="lazy"
                    />
                  </div>
                  <div className="p-2 border-t border-gray-100 bg-white">
                    <p className="text-[11px] font-bold text-gray-700 truncate mb-0.5" title={asset.filename}>
                      {asset.filename}
                    </p>
                    <p className="text-[10px] text-gray-400 truncate">
                      {asset.alt_text || 'No alt text'}
                    </p>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
