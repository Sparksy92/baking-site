'use client';

import { useState } from 'react';
import { Search as SearchIcon } from 'lucide-react';
import { api, type ProductListItem } from '@/lib/api';
import { ProductCard } from '@/components/ProductCard';

export default function SearchPage() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<ProductListItem[]>([]);
  const [total, setTotal] = useState(0);
  const [searched, setSearched] = useState(false);
  const [sort, setSort] = useState('');

  async function doSearch(q: string, sortBy: string) {
    if (!q.trim()) return;
    const sortParam = sortBy ? `&sort=${sortBy}` : '';
    const data = await api.get<{ products: ProductListItem[]; total: number }>(
      `/api/products?search=${encodeURIComponent(q.trim())}&limit=48${sortParam}`
    );
    setResults(data.products);
    setTotal(data.total);
    setSearched(true);
  }

  async function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    doSearch(query, sort);
  }

  function handleSortChange(newSort: string) {
    setSort(newSort);
    if (searched) doSearch(query, newSort);
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <form onSubmit={handleSearch} className="max-w-2xl mx-auto flex gap-2">
        <div className="flex-1 relative">
          <SearchIcon size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Search products..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-3 rounded-lg border border-gray-200 focus:border-brand outline-none text-sm"
            autoFocus
          />
        </div>
        <button type="submit" className="px-6 py-3 bg-brand text-white rounded-lg font-medium text-sm hover:bg-brand/90">
          Search
        </button>
      </form>

      {searched && (
        <div className="mt-6 flex items-center justify-between">
          <p className="text-sm text-gray-500">
            {total === 0 ? `No products found for "${query}"` : `${total} result${total !== 1 ? 's' : ''} for "${query}"`}
          </p>
          {total > 0 && (
            <select
              value={sort}
              onChange={(e) => handleSortChange(e.target.value)}
              className="text-sm border border-gray-200 rounded-lg px-3 py-2 bg-white text-gray-700 focus:border-brand outline-none"
            >
              <option value="">Default</option>
              <option value="newest">Newest</option>
              <option value="price_asc">Price: Low to High</option>
              <option value="price_desc">Price: High to Low</option>
              <option value="name_asc">Name: A-Z</option>
              <option value="name_desc">Name: Z-A</option>
            </select>
          )}
        </div>
      )}

      {results.length > 0 && (
        <div className="mt-6 grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 md:gap-6">
          {results.map((product) => (
            <ProductCard key={product.id} product={product} />
          ))}
        </div>
      )}
    </div>
  );
}
