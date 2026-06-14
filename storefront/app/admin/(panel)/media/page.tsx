'use client';

import { useState, useEffect } from 'react';
import { api } from '@/lib/api';
import { addToast } from '@/lib/toast';
import {
  Upload, Loader2, Image, Copy, Check, Trash2, X, AlertTriangle, Calendar
} from 'lucide-react';

interface MediaAsset {
  id: number;
  url: string;
  pathname: string;
  filename: string;
  alt_text: string;
  content_type: string;
  size_bytes: number;
  source: string;
  created_at: string;
}

export default function MediaPage() {
  const [assets, setAssets] = useState<MediaAsset[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [selectedAsset, setSelectedAsset] = useState<MediaAsset | null>(null);

  // Edit states for selected asset
  const [editFilename, setEditFilename] = useState('');
  const [editAltText, setEditAltText] = useState('');
  const [savingEdit, setSavingEdit] = useState(false);
  const [copiedUrl, setCopiedUrl] = useState<string | null>(null);

  // Delete states
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteWarningMsg, setDeleteWarningMsg] = useState<string | null>(null);

  useEffect(() => {
    fetchAssets();
  }, []);

  async function fetchAssets() {
    setLoading(true);
    try {
      const data = await api.get<MediaAsset[]>('/api/admin/media');
      setAssets(data);
    } catch (err: any) {
      console.error(err);
      addToast('Failed to load media assets', 'error');
    } finally {
      setLoading(false);
    }
  }

  async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 4 * 1024 * 1024) {
      addToast('File size exceeds the 4 MB limit.', 'error');
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
      setSelectedAsset(newAsset);
      setEditFilename(newAsset.filename);
      setEditAltText(newAsset.alt_text);
    } catch (err: any) {
      console.error(err);
      addToast(err.message || 'Failed to upload image', 'error');
    } finally {
      setUploading(false);
    }
  }

  function handleSelectAsset(asset: MediaAsset) {
    setSelectedAsset(asset);
    setEditFilename(asset.filename);
    setEditAltText(asset.alt_text);
    setCopiedUrl(null);
  }

  async function handleSaveEdits(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedAsset) return;

    setSavingEdit(true);
    try {
      const updated = await api.patch<MediaAsset>(`/api/admin/media/${selectedAsset.id}`, {
        filename: editFilename,
        alt_text: editAltText,
      });
      addToast('Asset details updated', 'success');
      setAssets((prev) => prev.map((a) => (a.id === selectedAsset.id ? updated : a)));
      setSelectedAsset(updated);
    } catch (err: any) {
      console.error(err);
      addToast(err.detail || 'Failed to save changes', 'error');
    } finally {
      setSavingEdit(false);
    }
  }

  async function handleCopyUrl(url: string) {
    try {
      await navigator.clipboard.writeText(url);
      setCopiedUrl(url);
      addToast('URL copied to clipboard', 'success');
      setTimeout(() => setCopiedUrl(null), 2000);
    } catch {
      addToast('Failed to copy URL', 'error');
    }
  }

  async function triggerDelete(asset: MediaAsset) {
    setDeletingId(asset.id);
    setDeleteWarningMsg(null);
    setShowDeleteConfirm(true);
  }

  async function confirmDelete(force: boolean = false) {
    if (!deletingId) return;

    try {
      const res = await fetch(`/api/admin/media/${deletingId}${force ? '?force=true' : ''}`, {
        method: 'DELETE',
      });

      const data = await res.json();

      if (!res.ok) {
        if (data.inUse) {
          setDeleteWarningMsg(data.detail);
          return;
        }
        throw new Error(data.detail || 'Delete failed');
      }

      addToast('Image deleted successfully', 'success');
      setAssets((prev) => prev.filter((a) => a.id !== deletingId));
      if (selectedAsset?.id === deletingId) {
        setSelectedAsset(null);
      }
      setShowDeleteConfirm(false);
      setDeletingId(null);
      setDeleteWarningMsg(null);
    } catch (err: any) {
      console.error(err);
      addToast(err.message || 'Failed to delete image', 'error');
    }
  }

  function formatBytes(bytes: number) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  }

  const labelClass = 'text-xs font-bold text-gray-500 uppercase tracking-wider block mb-1.5';
  const inputClass = 'w-full px-3 py-2 rounded-xl border border-gray-200 focus:border-brand focus:ring-4 focus:ring-brand/10 outline-none text-sm transition-all bg-white text-gray-800';

  return (
    <div className="flex flex-col h-full space-y-6 pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Media Library</h1>
          <p className="text-xs text-gray-500 mt-0.5">Upload, optimize, and manage images for your bakery products.</p>
        </div>

        <label className="flex items-center justify-center gap-2 px-5 py-2.5 bg-brand text-white font-bold text-xs rounded-xl hover:bg-brand/90 cursor-pointer shadow-sm transition-all disabled:opacity-50 w-full sm:w-auto text-center">
          {uploading ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              <span>Uploading...</span>
            </>
          ) : (
            <>
              <Upload size={14} />
              <span>Upload New Image</span>
            </>
          )}
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp"
            onChange={handleFileUpload}
            disabled={uploading}
            className="hidden"
          />
        </label>
      </div>

      {/* Main layout grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start flex-1">
        
        {/* Left/Middle: Image Grid */}
        <div className="lg:col-span-2 bg-white rounded-2xl border border-gray-200 p-6 min-h-[450px] flex flex-col">
          {loading ? (
            <div className="flex-1 flex flex-col items-center justify-center text-gray-400 gap-2">
              <Loader2 className="w-8 h-8 animate-spin text-brand" />
              <span className="text-xs">Loading media assets...</span>
            </div>
          ) : assets.length === 0 ? (
            <div className="flex-1 flex flex-col items-center justify-center text-gray-400 py-20 text-center">
              <Image size={48} className="text-gray-200 mb-3" />
              <p className="text-sm font-bold text-gray-700">No images uploaded yet.</p>
              <p className="text-xs text-gray-400 mt-1 max-w-sm leading-relaxed">
                Images uploaded here will be stored in Vercel Blob and can be assigned as product images. Upload your first JPEG, PNG, or WebP image above.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4 flex-1">
              {assets.map((asset) => {
                const isSelected = selectedAsset?.id === asset.id;
                return (
                  <button
                    key={asset.id}
                    onClick={() => handleSelectAsset(asset)}
                    className={`group relative aspect-square bg-white border rounded-xl overflow-hidden text-left flex flex-col transition-all shadow-sm focus:outline-none ${
                      isSelected ? 'border-brand ring-4 ring-brand/10' : 'border-gray-200 hover:border-brand'
                    }`}
                  >
                    <div className="relative flex-1 w-full bg-gray-50 flex items-center justify-center overflow-hidden">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={asset.url}
                        alt={asset.alt_text || asset.filename}
                        className="object-cover w-full h-full group-hover:scale-102 transition-transform duration-300"
                        loading="lazy"
                      />
                    </div>
                    <div className="p-2 border-t border-gray-100 bg-white">
                      <p className="text-[11px] font-bold text-gray-700 truncate" title={asset.filename}>
                        {asset.filename}
                      </p>
                      <p className="text-[10px] text-gray-400 truncate">
                        {formatBytes(asset.size_bytes)}
                      </p>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Right Sidebar: Details & Settings */}
        <div className="bg-white rounded-2xl border border-gray-200 p-6 min-h-[450px] flex flex-col">
          {selectedAsset ? (
            <div className="space-y-6 flex-1 flex flex-col">
              <div className="flex items-center justify-between">
                <h2 className="font-bold text-gray-900 text-sm uppercase tracking-wider">Asset Details</h2>
                <button
                  onClick={() => setSelectedAsset(null)}
                  className="p-1 rounded hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors"
                >
                  <X size={16} />
                </button>
              </div>

              {/* Preview */}
              <div className="relative aspect-video rounded-xl border border-gray-200 bg-gray-50 overflow-hidden flex items-center justify-center">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={selectedAsset.url}
                  alt={selectedAsset.alt_text || selectedAsset.filename}
                  className="object-contain w-full h-full max-h-40"
                />
              </div>

              {/* Form to edit metadata */}
              <form onSubmit={handleSaveEdits} className="space-y-4 flex-1">
                <div>
                  <label className={labelClass}>Filename / Label</label>
                  <input
                    value={editFilename}
                    onChange={(e) => setEditFilename(e.target.value)}
                    required
                    className={inputClass}
                  />
                </div>

                <div>
                  <label className={labelClass}>Alt Text (SEO)</label>
                  <input
                    value={editAltText}
                    onChange={(e) => setEditAltText(e.target.value)}
                    placeholder="e.g. Freshly baked artisan sourdough loaf"
                    className={inputClass}
                  />
                </div>

                <div className="bg-gray-50/50 rounded-xl p-3 border border-gray-100 text-xs text-gray-600 space-y-2">
                  <div className="flex justify-between">
                    <span className="font-semibold text-gray-400">Size:</span>
                    <span>{formatBytes(selectedAsset.size_bytes)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="font-semibold text-gray-400">Type:</span>
                    <span className="font-mono">{selectedAsset.content_type}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="font-semibold text-gray-400">Source:</span>
                    <span className="font-mono">{selectedAsset.source}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="font-semibold text-gray-400">Date:</span>
                    <span className="flex items-center gap-1">
                      <Calendar size={11} className="text-gray-400" />
                      {new Date(selectedAsset.created_at).toLocaleDateString()}
                    </span>
                  </div>
                </div>

                {/* URL block with copy button */}
                <div className="space-y-1.5">
                  <label className={labelClass}>Direct URL</label>
                  <div className="flex gap-2">
                    <input
                      readOnly
                      value={selectedAsset.url}
                      className={`${inputClass} bg-gray-50 select-all font-mono text-[10px] py-1.5`}
                    />
                    <button
                      type="button"
                      onClick={() => handleCopyUrl(selectedAsset.url)}
                      className="px-3 border border-gray-200 text-gray-500 rounded-xl hover:bg-gray-50 transition-colors flex items-center justify-center shadow-sm"
                    >
                      {copiedUrl === selectedAsset.url ? (
                        <Check size={14} className="text-emerald-500" />
                      ) : (
                        <Copy size={14} />
                      )}
                    </button>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center justify-between pt-4 border-t border-gray-100">
                  <button
                    type="button"
                    onClick={() => triggerDelete(selectedAsset)}
                    className="flex items-center gap-1 px-3 py-2 border border-rose-100 text-rose-500 hover:bg-rose-50 font-bold text-xs rounded-xl transition-colors"
                  >
                    <Trash2 size={13} />
                    <span>Delete Image</span>
                  </button>

                  <button
                    type="submit"
                    disabled={savingEdit}
                    className="px-5 py-2 bg-brand text-white font-bold text-xs rounded-xl hover:bg-brand/90 disabled:opacity-50 transition-colors shadow-sm"
                  >
                    {savingEdit ? 'Saving...' : 'Save Changes'}
                  </button>
                </div>
              </form>
            </div>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-gray-400 py-12 text-center">
              <Image size={32} className="text-gray-200 mb-2" />
              <p className="text-xs font-semibold">Select an image to view details, copy URL, or edit SEO alt text.</p>
            </div>
          )}
        </div>

      </div>

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/45 backdrop-blur-sm" onClick={() => { setShowDeleteConfirm(false); setDeleteWarningMsg(null); }} />
          <div className="relative w-full max-w-md bg-white rounded-2xl p-6 border border-gray-100 z-10 shadow-xl space-y-4">
            <div className="flex items-center gap-3 text-rose-500">
              <div className="w-10 h-10 rounded-full bg-rose-50 flex items-center justify-center">
                <AlertTriangle size={20} />
              </div>
              <h3 className="font-bold text-gray-900 text-base">Delete Image Asset?</h3>
            </div>

            <p className="text-xs text-gray-600 leading-relaxed">
              Are you sure you want to delete this media asset? This action will remove the database record and delete the image file from Vercel Blob.
            </p>

            {deleteWarningMsg && (
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 flex items-start gap-2.5 text-amber-800 text-xs">
                <AlertTriangle className="w-4 h-4 shrink-0 text-amber-600 mt-0.5" />
                <div className="space-y-2 leading-relaxed">
                  <p className="font-semibold">{deleteWarningMsg}</p>
                  <p>Deleting this image will cause products using it to display broken images. Do you want to force deletion anyway?</p>
                  <button
                    onClick={() => confirmDelete(true)}
                    className="px-3 py-1.5 bg-amber-600 text-white font-bold text-[10px] rounded-lg hover:bg-amber-700 transition-colors"
                  >
                    Yes, Force Delete
                  </button>
                </div>
              </div>
            )}

            <div className="flex justify-end gap-3 pt-2">
              <button
                onClick={() => {
                  setShowDeleteConfirm(false);
                  setDeleteWarningMsg(null);
                }}
                className="px-4 py-2 border border-gray-200 text-gray-600 rounded-xl font-bold text-xs hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              {!deleteWarningMsg && (
                <button
                  onClick={() => confirmDelete(false)}
                  className="px-4 py-2 bg-rose-500 text-white rounded-xl font-bold text-xs hover:bg-rose-600 transition-colors shadow-sm"
                >
                  Delete
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
