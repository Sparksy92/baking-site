'use client';

import { useState } from 'react';
import { X, Ruler } from 'lucide-react';

const sizeCharts: Record<string, { headers: string[]; rows: string[][] }> = {
  default: {
    headers: ['Size', 'Chest (in)', 'Waist (in)', 'Length (in)'],
    rows: [
      ['XS', '34', '28', '27'],
      ['S', '36', '30', '28'],
      ['M', '38', '32', '29'],
      ['L', '40', '34', '30'],
      ['XL', '42', '36', '31'],
      ['2XL', '44', '38', '32'],
      ['3XL', '46', '40', '33'],
    ],
  },
  bottoms: {
    headers: ['Size', 'Waist (in)', 'Hip (in)', 'Inseam (in)'],
    rows: [
      ['XS', '26', '36', '30'],
      ['S', '28', '38', '30'],
      ['M', '30', '40', '31'],
      ['L', '32', '42', '31'],
      ['XL', '34', '44', '32'],
      ['2XL', '36', '46', '32'],
    ],
  },
  headwear: {
    headers: ['Size', 'Circumference (in)', 'Circumference (cm)'],
    rows: [
      ['S/M', '21.5–22.5', '54.5–57'],
      ['L/XL', '22.5–23.5', '57–59.5'],
      ['One Size', '22–23', '56–58.5'],
    ],
  },
};

export function SizeGuide({ category }: { category?: string }) {
  const [open, setOpen] = useState(false);
  const chart = sizeCharts[category ?? ''] ?? sizeCharts.default;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-brand transition-colors"
      >
        <Ruler size={14} />
        Size Guide
      </button>

      {open && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40" onClick={() => setOpen(false)} />
          <div className="relative bg-white rounded-2xl shadow-2xl max-w-lg w-full max-h-[80vh] overflow-auto p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold text-gray-900">Size Guide</h2>
              <button
                onClick={() => setOpen(false)}
                className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100 text-gray-500"
                aria-label="Close"
              >
                <X size={18} />
              </button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr>
                    {chart.headers.map((h) => (
                      <th key={h} className="text-left py-2 px-3 bg-gray-50 font-semibold text-gray-700 first:rounded-tl-lg last:rounded-tr-lg">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {chart.rows.map((row, i) => (
                    <tr key={i} className="border-t border-gray-100">
                      {row.map((cell, j) => (
                        <td key={j} className={`py-2 px-3 ${j === 0 ? 'font-medium text-gray-900' : 'text-gray-600'}`}>
                          {cell}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <p className="mt-4 text-xs text-gray-400">
              Measurements are approximate. When between sizes, we recommend sizing up.
            </p>
          </div>
        </div>
      )}
    </>
  );
}
