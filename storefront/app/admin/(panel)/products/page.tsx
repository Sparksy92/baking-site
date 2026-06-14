'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Plus, Search, Sparkles } from 'lucide-react';
import { api } from '@/lib/api';
import { formatCents } from '@/lib/format';

export default function AdminProducts() {
  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  useEffect(() => {
    api.get<any[]>('/api/admin/products')
      .then(setProducts)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const filtered = search.trim()
    ? products.filter((p) =>
        p.name.toLowerCase().includes(search.toLowerCase()) ||
        (p.category_name && p.category_name.toLowerCase().includes(search.toLowerCase()))
      )
    : products;

  const getPriceLabel = (p: any) => {
    if (p.pricing_mode === 'quote_only') return 'Inquire';
    if (p.pricing_mode === 'seasonal') return 'Seasonal';
    const priceStr = formatCents(p.price_cents ?? 0);
    if (p.pricing_mode === 'starting_at') return `From ${priceStr}`;
    return priceStr;
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'available':
        return <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-green-50 text-green-700 border border-green-200">Available</span>;
      case 'preorder':
        return <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-amber-50 text-amber-700 border border-amber-200">Pre-order</span>;
      case 'weekend_only':
        return <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-indigo-50 text-indigo-700 border border-indigo-200">Weekends</span>;
      case 'sold_out':
        return <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-rose-50 text-rose-700 border border-rose-200">Sold Out</span>;
      case 'seasonal':
        return <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-sky-50 text-sky-700 border border-sky-200">Seasonal</span>;
      case 'hidden':
        return <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-gray-50 text-gray-500 border border-gray-200">Hidden</span>;
      default:
        return <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-gray-50 text-gray-700 border border-gray-200">{status}</span>;
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <h1 className="text-2xl font-black text-gray-900 tracking-tight flex items-center gap-2">
          <Sparkles className="text-brand w-6 h-6" />
          Menu Items
        </h1>
        <Link href="/admin/products/new" className="flex items-center justify-center gap-2 bg-brand text-white px-5 py-2.5 rounded-xl text-sm font-bold hover:bg-brand/90 transition-all shadow-md shadow-brand/20 active:scale-95">
          <Plus size={18} /> Add Menu Item
        </Link>
      </div>

      {/* Controls Container */}
      <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 flex items-center">
        {/* Search */}
        <div className="relative w-full max-w-md">
          <Search size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Search items by name or category..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 rounded-lg border border-gray-200 text-sm focus:border-brand focus:ring-1 focus:ring-brand outline-none transition-all"
          />
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto custom-scrollbar">
          <table className="w-full text-sm min-w-[700px]">
            <thead className="bg-gray-50/80 border-b border-gray-200">
              <tr>
                <th className="px-6 py-4 text-left font-semibold text-gray-600 whitespace-nowrap">Item</th>
                <th className="px-6 py-4 text-left font-semibold text-gray-600 whitespace-nowrap">Category</th>
                <th className="px-6 py-4 text-left font-semibold text-gray-600 whitespace-nowrap">Pricing Mode</th>
                <th className="px-6 py-4 text-right font-semibold text-gray-600 whitespace-nowrap">Price</th>
                <th className="px-6 py-4 text-left font-semibold text-gray-600 whitespace-nowrap">Availability</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading ? (
                [...Array(5)].map((_, i) => (
                  <tr key={i} className="animate-pulse">
                    <td className="px-6 py-4"><div className="h-4 bg-gray-200 rounded w-48"></div></td>
                    <td className="px-6 py-4"><div className="h-4 bg-gray-200 rounded w-24"></div></td>
                    <td className="px-6 py-4"><div className="h-4 bg-gray-200 rounded w-20"></div></td>
                    <td className="px-6 py-4 flex justify-end"><div className="h-4 bg-gray-200 rounded w-12"></div></td>
                    <td className="px-6 py-4"><div className="h-5 bg-gray-200 rounded-full w-16"></div></td>
                  </tr>
                ))
              ) : filtered.length > 0 ? (
                filtered.map((p) => (
                  <tr key={p.id} className="hover:bg-gray-50/80 transition-colors group">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <Link href={`/admin/products/${p.id}`} className="font-bold text-gray-900 group-hover:text-brand transition-colors">
                        {p.name}
                      </Link>
                    </td>
                    <td className="px-6 py-4 text-gray-600 font-medium whitespace-nowrap">{p.category_name || '\u2014'}</td>
                    <td className="px-6 py-4 text-gray-600 whitespace-nowrap capitalize">{p.pricing_mode?.replace('_', ' ') || '\u2014'}</td>
                    <td className="px-6 py-4 text-right font-semibold text-gray-900 whitespace-nowrap">
                      {getPriceLabel(p)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {getStatusBadge(p.availability_status)}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center text-gray-400">
                    {search ? 'No matching menu items found' : 'No menu items yet'}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
