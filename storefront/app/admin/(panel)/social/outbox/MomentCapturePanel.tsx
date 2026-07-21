'use client';

import { Dispatch, SetStateAction } from 'react';
import { X, Zap, Upload, RefreshCw, Sparkles, ImageIcon } from 'lucide-react';
import { AIImagePicker } from '@/components/admin/AIImagePicker';
import type { McD } from './useOutboxState';

const PLATFORM_ICON: Record<string, string> = {
  facebook: '𝕗', instagram: '◉', x: '𝕏', linkedin: 'in',
  tiktok: '♪', youtube: '▶', pinterest: '𝕻', threads: '@',
};

type Props = {
  mcMoment: string; setMcMoment: (v: string) => void;
  mcExtraContext: string; setMcExtraContext: (v: string) => void;
  mcImageUrls: string[]; setMcImageUrls: Dispatch<SetStateAction<string[]>>;
  mcUploading: boolean;
  mcGenerating: boolean;
  mcDrafts: McD[]; setMcDrafts: Dispatch<SetStateAction<McD[]>>;
  mcSaving: boolean;
  onClose: () => void;
  onRun: () => void;
  onSave: () => void;
  onUploadImage: (file: File) => void;
};

export function MomentCapturePanel({
  mcMoment, setMcMoment,
  mcExtraContext, setMcExtraContext,
  mcImageUrls, setMcImageUrls,
  mcUploading, mcGenerating,
  mcDrafts, setMcDrafts,
  mcSaving,
  onClose, onRun, onSave, onUploadImage,
}: Props) {
  function getGenerateLabel() {
    if (mcImageUrls.length > 0) {
      return mcMoment.trim() ? 'Generate from Photos + Text' : 'Generate from Photos';
    }
    return 'Generate All Platform Drafts';
  }

  return (
    <div className="bg-white rounded-xl border border-amber-300 p-5 space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Zap size={16} className="text-amber-600" />
          <h2 className="text-sm font-semibold text-gray-900">Moment Capture</h2>
          <span className="text-xs text-amber-600 font-normal">— describe it once, AI drafts it for every platform</span>
        </div>
        <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
          <X size={16} />
        </button>
      </div>

      {/* Input form — hidden once drafts are shown */}
      {mcDrafts.length === 0 && (
        <div className="space-y-4">

          {/* Images */}
          <div>
            <p className="text-xs font-medium text-gray-700 block mb-1.5">
              Photos / Images{' '}
              <span className="text-gray-400 font-normal">(up to 3 — AI reads them to write captions)</span>
            </p>

            {mcImageUrls.length > 0 && (
              <div className="flex gap-2 mb-2">
                {mcImageUrls.map((url, i) => (
                  <div key={url} className="relative group">
                    <img src={url} alt="" role="presentation" className="w-20 h-20 rounded-lg object-cover border border-amber-200" />
                    {i === 0 && (
                      <span className="absolute top-1 left-1 bg-amber-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded">BEST</span>
                    )}
                    <button
                      onClick={() => setMcImageUrls((prev) => prev.filter((_, idx) => idx !== i))}
                      className="absolute top-1 right-1 bg-black/60 hover:bg-red-600 text-white rounded-full w-5 h-5 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <X size={10} />
                    </button>
                  </div>
                ))}
                {mcImageUrls.length < 3 && (
                  <label
                    htmlFor="mc-add-image"
                    className="w-20 h-20 flex flex-col items-center justify-center rounded-lg border-2 border-dashed border-gray-200 hover:border-amber-400 text-gray-400 hover:text-amber-600 cursor-pointer transition-colors text-xs gap-1"
                  >
                    <Upload size={14} />
                    <span>Add</span>
                    <input id="mc-add-image" type="file" accept="image/*" className="hidden" onChange={(e) => {
                      if (e.target.files?.[0]) { onUploadImage(e.target.files[0]); }
                      e.target.value = '';
                    }} />
                  </label>
                )}
              </div>
            )}

            {mcImageUrls.length === 0 && (
              <label className="w-full flex flex-col items-center justify-center gap-1.5 px-4 py-5 rounded-lg border-2 border-dashed border-gray-200 hover:border-amber-400 text-sm text-gray-500 hover:text-amber-600 transition-colors cursor-pointer">
                {mcUploading ? (
                  <><RefreshCw size={16} className="animate-spin" /> Uploading…</>
                ) : (
                  <>
                    <Upload size={16} />
                    <span>Click or drag up to 3 photos here</span>
                    <span className="text-xs text-gray-400">AI will read the images and write captions based on what it sees</span>
                  </>
                )}
                <input type="file" accept="image/*" multiple className="hidden" onChange={(e) => {
                  Array.from(e.target.files || []).slice(0, 3 - mcImageUrls.length).forEach(onUploadImage);
                  e.target.value = '';
                }} />
              </label>
            )}

            {mcUploading && mcImageUrls.length > 0 && (
              <p className="text-xs text-amber-600 flex items-center gap-1 mt-1"><RefreshCw size={11} className="animate-spin" /> Uploading…</p>
            )}
          </div>

          {/* Moment text */}
          <div>
            <label htmlFor="mc-moment" className="text-xs font-medium text-gray-700 block mb-1">
              {mcImageUrls.length > 0
                ? <>What&apos;s the story? <span className="text-gray-400 font-normal">(optional — add context beyond what the photos show)</span></>
                : <>What happened? <span className="text-gray-400 font-normal">(be raw and specific)</span></>}
            </label>
            <textarea
              id="mc-moment"
              value={mcMoment}
              onChange={(e) => setMcMoment(e.target.value)}
              rows={mcImageUrls.length > 0 ? 2 : 4}
              placeholder={
                mcImageUrls.length > 0
                  ? 'e.g. Community market at Six Nations — first time selling online'
                  : 'e.g. Had a customer email us saying our gear reminded him of his grandfather. He cried.'
              }
              className="w-full px-3 py-2.5 rounded-lg border border-gray-200 focus:border-amber-400 outline-none text-sm resize-none"
            />
            <p className="text-xs text-gray-400 mt-1">{mcMoment.length}/1000</p>
          </div>

          {/* Extra context */}
          <div>
            <label htmlFor="mc-extra-context" className="text-xs font-medium text-gray-700 block mb-1">
              Extra context <span className="text-gray-400 font-normal">(optional)</span>
            </label>
            <input
              id="mc-extra-context"
              value={mcExtraContext}
              onChange={(e) => setMcExtraContext(e.target.value)}
              placeholder="e.g. mention our summer sale, focus on the product launch"
              className="w-full px-3 py-2 rounded-lg border border-gray-200 focus:border-amber-400 outline-none text-sm"
            />
          </div>

          {/* Generate button */}
          <button
            onClick={onRun}
            disabled={mcGenerating || mcUploading || (!mcMoment.trim() && mcImageUrls.length === 0)}
            className="w-full flex items-center justify-center gap-2 py-2.5 bg-amber-500 hover:bg-amber-600 disabled:opacity-50 text-white font-semibold rounded-lg text-sm"
          >
            {mcGenerating ? (
              <>
                <RefreshCw size={15} className="animate-spin" />
                {mcImageUrls.length > 0 ? 'Reading photos + generating drafts…' : 'Generating drafts for all platforms…'}
              </>
            ) : (
              <><Zap size={15} />{getGenerateLabel()}</>
            )}
          </button>
          {mcGenerating && (
            <p className="text-xs text-center text-gray-400">
              {mcImageUrls.length > 0
                ? 'Vision reading photos, then generating per-platform captions — usually 15–25s'
                : 'Running in parallel — usually 10–20s for all platforms'}
            </p>
          )}
        </div>
      )}

      {/* Draft review cards */}
      {mcDrafts.length > 0 && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold text-gray-700">
              {mcDrafts.filter((d) => !d.discarded).length} of {mcDrafts.length} drafts selected
            </p>
            <button
              onClick={() => setMcDrafts(() => [])}
              className="text-xs text-gray-500 hover:text-gray-800 underline"
            >
              ← Start over
            </button>
          </div>

          {mcDrafts.some((d) => !d.discarded && d.content) && (
            <AIImagePicker
              content={mcDrafts.find((d) => !d.discarded && d.content)?.content ?? ''}
              topic={mcMoment}
            />
          )}

          {mcDrafts.map((draft, idx) => (
            <div
              key={draft.platform}
              className={`rounded-xl border p-4 space-y-3 transition-opacity ${draft.discarded ? 'opacity-40 border-gray-200 bg-gray-50' : 'border-amber-200 bg-white'}`}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-lg font-bold">{PLATFORM_ICON[draft.platform] ?? draft.platform[0].toUpperCase()}</span>
                  <span className="text-sm font-semibold text-gray-800 capitalize">{draft.platform}</span>
                  {draft.strategy_content_type && (
                    <span className="text-xs px-2 py-0.5 bg-blue-100 text-blue-700 rounded-full">{draft.strategy_content_type}</span>
                  )}
                  {draft.status === 'error' && (
                    <span className="text-xs px-2 py-0.5 bg-red-100 text-red-600 rounded-full">⚠ generation failed</span>
                  )}
                </div>
                <button
                  onClick={() => setMcDrafts((prev) => prev.map((d, i) => i === idx ? { ...d, discarded: !d.discarded } : d))}
                  className={`text-xs px-3 py-1 rounded-lg font-medium border transition-colors ${draft.discarded ? 'border-gray-300 text-gray-500 hover:border-green-400 hover:text-green-700' : 'border-red-200 text-red-600 hover:bg-red-50'}`}
                >
                  {draft.discarded ? '+ Include' : '✕ Discard'}
                </button>
              </div>

              {!draft.discarded && draft.status === 'ok' && (
                <textarea
                  value={draft.content}
                  onChange={(e) => setMcDrafts((prev) => prev.map((d, i) => i === idx ? { ...d, content: e.target.value } : d))}
                  rows={5}
                  className="w-full px-3 py-2.5 rounded-lg border border-gray-200 focus:border-amber-400 outline-none text-sm resize-y"
                />
              )}

              {!draft.discarded && draft.image_url && (
                <div className="flex items-center gap-2 text-xs text-gray-500">
                  <ImageIcon size={12} />
                  <span className="truncate font-mono">{draft.image_url}</span>
                </div>
              )}
            </div>
          ))}

          <div className="flex items-center justify-between gap-3 pt-2 border-t border-gray-100">
            <p className="text-xs text-gray-500">
              {mcDrafts.filter((d) => !d.discarded && d.content.trim()).length} draft{mcDrafts.filter((d) => !d.discarded).length !== 1 ? 's' : ''} will be saved to outbox as <strong>Draft</strong>
            </p>
            <button
              onClick={onSave}
              disabled={mcSaving || mcDrafts.filter((d) => !d.discarded && d.content.trim()).length === 0}
              className="flex items-center gap-2 px-5 py-2.5 bg-amber-500 hover:bg-amber-600 disabled:opacity-50 text-white font-semibold rounded-xl text-sm"
            >
              {mcSaving ? <><RefreshCw size={14} className="animate-spin" /> Saving…</> : <><Sparkles size={14} /> Save Selected Drafts</>}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
