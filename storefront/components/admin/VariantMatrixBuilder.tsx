'use client';

import { useState } from 'react';
import { X, Zap } from 'lucide-react';
import { api, type Variant } from '@/lib/api';

interface Props {
  productId: string;
  existingVariants: Variant[];
  onVariantsCreated: (variants: Variant[]) => void;
}

export default function VariantMatrixBuilder({ productId, existingVariants, onVariantsCreated }: Props) {
  const [sizes, setSizes] = useState<string[]>([]);
  const [colors, setColors] = useState<string[]>([]);
  const [sizeInput, setSizeInput] = useState('');
  const [colorInput, setColorInput] = useState('');
  const [bulkPrice, setBulkPrice] = useState('');
  const [bulkStock, setBulkStock] = useState('');
  const [generating, setGenerating] = useState(false);
  const [open, setOpen] = useState(existingVariants.length === 0);

  function addSize() {
    const values = sizeInput.split(',').map((s) => s.trim()).filter((s) => s && !sizes.includes(s));
    if (values.length > 0) {
      setSizes([...sizes, ...values]);
    }
    setSizeInput('');
  }

  function addColor() {
    const values = colorInput.split(',').map((s) => s.trim()).filter((s) => s && !colors.includes(s));
    if (values.length > 0) {
      setColors([...colors, ...values]);
    }
    setColorInput('');
  }

  function handleKeyDown(e: React.KeyboardEvent, action: () => void) {
    if (e.key === 'Enter') {
      e.preventDefault();
      action();
    }
  }

  // Generate the combos that don't already exist
  function getNewCombinations() {
    const combos: { size: string; color: string }[] = [];
    for (const size of sizes) {
      for (const color of colors) {
        const exists = existingVariants.some(
          (v) => v.size.toLowerCase() === size.toLowerCase() && v.color.toLowerCase() === color.toLowerCase()
        );
        if (!exists) {
          combos.push({ size, color });
        }
      }
    }
    return combos;
  }

  async function generate() {
    const combos = getNewCombinations();
    if (combos.length === 0) return;

    setGenerating(true);
    const priceCents = bulkPrice ? Math.round(Number(bulkPrice) * 100) : 0;
    const stock = bulkStock ? Number(bulkStock) : 0;

    const created: Variant[] = [];
    for (const combo of combos) {
      try {
        const v = await api.post<Variant>(`/api/admin/products/${productId}/variants`, {
          size: combo.size,
          color: combo.color,
          price_cents: priceCents,
          stock_quantity: stock,
        });
        console.log('[VariantMatrix] API returned:', JSON.stringify(v));
        created.push(v);
      } catch (err) {
        console.error('Failed to create variant:', combo, err);
      }
    }

    console.log('[VariantMatrix] All created variants:', JSON.stringify(created));
    if (created.length > 0) {
      onVariantsCreated(created);
    }
    setGenerating(false);
    setOpen(false);
    setSizes([]);
    setColors([]);
    setBulkPrice('');
    setBulkStock('');
  }

  const newCombos = getNewCombinations();

  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} className="inline-flex items-center gap-1.5 text-sm text-brand hover:text-brand/80 font-medium">
        <Zap size={14} /> Generate Variants (Size × Color)
      </button>
    );
  }

  return (
    <div className="bg-brand/5 border border-brand/20 rounded-lg p-4 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-gray-900 flex items-center gap-1.5"><Zap size={14} className="text-brand" /> Variant Matrix Builder</h3>
        <button type="button" onClick={() => setOpen(false)} className="text-gray-400 hover:text-gray-600"><X size={16} /></button>
      </div>

      <p className="text-xs text-gray-500">Define sizes and colors, then generate all combinations at once.</p>

      {/* Sizes */}
      <div>
        <label className="text-xs font-medium text-gray-700 block mb-1">Sizes</label>
        <div className="flex flex-wrap gap-1.5 mb-2">
          {sizes.map((s) => (
            <span key={s} className="inline-flex items-center gap-1 px-2 py-0.5 bg-white border border-gray-200 rounded text-xs">
              {s}
              <button type="button" onClick={() => setSizes(sizes.filter((x) => x !== s))} className="text-gray-400 hover:text-red-500"><X size={10} /></button>
            </span>
          ))}
        </div>
        <div className="flex gap-2">
          <input
            value={sizeInput}
            onChange={(e) => setSizeInput(e.target.value)}
            onKeyDown={(e) => handleKeyDown(e, addSize)}
            placeholder="e.g. S, M, L, XL"
            className="flex-1 px-3 py-1.5 border border-gray-200 rounded-lg text-sm"
          />
          <button type="button" onClick={addSize} className="px-3 py-1.5 bg-gray-100 hover:bg-gray-200 rounded-lg text-sm text-gray-700">Add</button>
        </div>
      </div>

      {/* Colors */}
      <div>
        <label className="text-xs font-medium text-gray-700 block mb-1">Colors</label>
        <div className="flex flex-wrap gap-1.5 mb-2">
          {colors.map((c) => (
            <span key={c} className="inline-flex items-center gap-1 px-2 py-0.5 bg-white border border-gray-200 rounded text-xs">
              {c}
              <button type="button" onClick={() => setColors(colors.filter((x) => x !== c))} className="text-gray-400 hover:text-red-500"><X size={10} /></button>
            </span>
          ))}
        </div>
        <div className="flex gap-2">
          <input
            value={colorInput}
            onChange={(e) => setColorInput(e.target.value)}
            onKeyDown={(e) => handleKeyDown(e, addColor)}
            placeholder="e.g. Black, White, Red"
            className="flex-1 px-3 py-1.5 border border-gray-200 rounded-lg text-sm"
          />
          <button type="button" onClick={addColor} className="px-3 py-1.5 bg-gray-100 hover:bg-gray-200 rounded-lg text-sm text-gray-700">Add</button>
        </div>
      </div>

      {/* Bulk defaults */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-xs font-medium text-gray-700 block mb-1">Default Price ($)</label>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">$</span>
            <input type="number" step="0.01" value={bulkPrice} onChange={(e) => setBulkPrice(e.target.value)} placeholder="0.00" className="w-full pl-7 pr-3 py-1.5 border border-gray-200 rounded-lg text-sm" />
          </div>
        </div>
        <div>
          <label className="text-xs font-medium text-gray-700 block mb-1">Default Stock</label>
          <input type="number" value={bulkStock} onChange={(e) => setBulkStock(e.target.value)} placeholder="0" className="w-full px-3 py-1.5 border border-gray-200 rounded-lg text-sm" />
        </div>
      </div>

      {/* Preview + Generate */}
      {sizes.length > 0 && colors.length > 0 && (
        <div className="bg-white rounded-lg border border-gray-200 p-3">
          <p className="text-xs text-gray-500 mb-2">
            Will create <strong>{newCombos.length}</strong> new variant{newCombos.length !== 1 ? 's' : ''} ({sizes.length} sizes × {colors.length} colors{existingVariants.length > 0 ? `, minus ${sizes.length * colors.length - newCombos.length} existing` : ''})
          </p>
          <div className="flex flex-wrap gap-1">
            {newCombos.slice(0, 12).map((c) => (
              <span key={`${c.size}-${c.color}`} className="text-xs px-1.5 py-0.5 bg-gray-50 rounded border border-gray-100">
                {c.size}/{c.color}
              </span>
            ))}
            {newCombos.length > 12 && <span className="text-xs text-gray-400">+{newCombos.length - 12} more</span>}
          </div>
        </div>
      )}

      <button
        type="button"
        onClick={generate}
        disabled={generating || newCombos.length === 0}
        className="w-full py-2 bg-brand text-white rounded-lg text-sm font-medium hover:bg-brand/90 disabled:opacity-50"
      >
        {generating ? 'Generating...' : `Generate ${newCombos.length} Variant${newCombos.length !== 1 ? 's' : ''}`}
      </button>
    </div>
  );
}
