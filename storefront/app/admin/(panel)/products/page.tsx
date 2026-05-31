'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Plus, Search } from 'lucide-react';
import { api } from '@/lib/api';

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

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <h1 className="text-2xl font-bold text-gray-900">Products</h1>
        <Link href="/admin/products/new" className="flex items-center justify-center gap-2 bg-brand text-white px-5 py-2.5 rounded-xl text-sm font-bold hover:bg-brand/90 transition-all shadow-md shadow-brand/20 active:scale-95">
          <Plus size={18} /> Add Product
        </Link>
      </div>

      {/* Controls Container */}
      <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 flex items-center">
        {/* Search */}
        <div className="relative w-full max-w-md">
          <Search size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Search products by name or category..."
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
                <th className="px-6 py-4 text-left font-semibold text-gray-600 whitespace-nowrap">Product</th>
                <th className="px-6 py-4 text-left font-semibold text-gray-600 whitespace-nowrap">Category</th>
                <th className="px-6 py-4 text-right font-semibold text-gray-600 whitespace-nowrap">Stock</th>
                <th className="px-6 py-4 text-left font-semibold text-gray-600 whitespace-nowrap">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading ? (
                [...Array(5)].map((_, i) => (
                  <tr key={i} className="animate-pulse">
                    <td className="px-6 py-4"><div className="h-4 bg-gray-200 rounded w-48"></div></td>
                    <td className="px-6 py-4"><div className="h-4 bg-gray-200 rounded w-24"></div></td>
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
                    <td className="px-6 py-4 text-right font-semibold text-gray-900 whitespace-nowrap">
                      {p.total_stock ?? 0}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`px-2.5 py-1 rounded-full text-xs font-bold ${p.is_active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                        {p.is_active ? 'Active' : 'Draft'}
                      </span>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={4} className="px-6 py-12 text-center text-gray-400">
                    {search ? 'No matching products found' : 'No products yet'}
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
