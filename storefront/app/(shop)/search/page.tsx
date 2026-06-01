'use client';

import { useState } from 'react';
import { Search as SearchIcon, Loader2, SearchX } from 'lucide-react';
import { api, type ProductListItem } from '@/lib/api';
import { ProductCard } from '@/components/ProductCard';

  import { useEffect } from 'react';

  export default function SearchPage() {
    const [query, setQuery] = useState('');
    const [results, setResults] = useState<ProductListItem[]>([]);
    const [total, setTotal] = useState(0);
    const [searched, setSearched] = useState(true);
    const [sort, setSort] = useState('');
    const [loading, setLoading] = useState(true);

    async function doSearch(q: string, sortBy: string) {
      setLoading(true);
    setSearched(true);
    try {
      const qParam = q.trim() ? `search=${encodeURIComponent(q.trim())}&` : '';
      const sortParam = sortBy ? `sort=${sortBy}&` : '';
      const data = await api.get<{ products: ProductListItem[]; total: number }>(
        `/api/products?${qParam}${sortParam}limit=48`
      );
      setResults(data.products);
      setTotal(data.total);
    } catch (err) {
      console.error(err);
      setResults([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    doSearch('', sort);
  }, []);

  async function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    doSearch(query, sort);
  }

  function handleSortChange(newSort: string) {
    setSort(newSort);
    doSearch(query, newSort);
  }

  return (
    <div className="min-h-screen bg-gray-50/30">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 md:py-20">
        
        <div className="max-w-3xl mx-auto text-center mb-10">
          <h1 className="text-3xl md:text-5xl font-bold text-gray-900 mb-6 tracking-tight">Shop All Products</h1>
          
          <form onSubmit={handleSearch} className="flex flex-col sm:flex-row gap-3">
            <div className="flex-1 relative group">
              <SearchIcon size={20} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-brand transition-colors" />
              <input
                type="text"
                placeholder="Search products..."
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                className="w-full pl-12 pr-4 py-4 rounded-2xl border border-gray-200 focus:border-brand focus:ring-4 focus:ring-brand/10 outline-none text-base md:text-lg transition-all shadow-sm"
                autoFocus
              />
            </div>
            <button 
              type="submit" 
              disabled={loading}
              className="px-8 py-4 bg-brand text-white rounded-2xl font-bold text-base md:text-lg hover:bg-brand/90 active:scale-[0.98] transition-all disabled:opacity-50 disabled:active:scale-100 flex items-center justify-center min-w-[140px] shadow-lg shadow-brand/20"
            >
              {loading ? <Loader2 size={24} className="animate-spin" /> : 'Search'}
            </button>
          </form>
        </div>

        {searched && (
          <div className="mt-8 border-t border-gray-100 pt-8">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-8">
              <p className="text-base text-gray-600">
                {loading ? (
                  <span className="flex items-center gap-2"><Loader2 size={16} className="animate-spin" /> Searching...</span>
                ) : (
                  total === 0 ? (query ? `No products found for "${query}"` : "No products found.") : <span className="font-medium text-gray-900">{total} result{total !== 1 ? 's' : ''} {query && <span className="text-gray-500 font-normal">for "{query}"</span>}</span>
                )}
              </p>
              
              {total > 0 && !loading && (
                <div className="flex items-center gap-3">
                  <span className="text-sm text-gray-500 font-medium">Sort by:</span>
                  <select
                    value={sort}
                    onChange={(e) => handleSortChange(e.target.value)}
                    className="text-sm border border-gray-200 rounded-xl px-4 py-2.5 bg-white text-gray-900 font-medium focus:border-brand outline-none shadow-sm cursor-pointer hover:border-gray-300 transition-colors"
                  >
                    <option value="">Best Match</option>
                    <option value="newest">Newest Arrivals</option>
                    <option value="price_asc">Price: Low to High</option>
                    <option value="price_desc">Price: High to Low</option>
                    <option value="name_asc">Name: A-Z</option>
                    <option value="name_desc">Name: Z-A</option>
                  </select>
                </div>
              )}
            </div>

            {loading ? (
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 md:gap-6 lg:gap-8">
                {[...Array(8)].map((_, i) => (
                  <div key={i} className="animate-pulse">
                    <div className="bg-gray-200 aspect-[3/4] rounded-2xl mb-4"></div>
                    <div className="h-4 bg-gray-200 rounded w-3/4 mb-2"></div>
                    <div className="h-4 bg-gray-200 rounded w-1/4"></div>
                  </div>
                ))}
              </div>
            ) : total > 0 ? (
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 md:gap-6 lg:gap-8">
                {results.map((product) => (
                  <ProductCard key={product.id} product={product} />
                ))}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-20 text-center">
                <div className="w-24 h-24 bg-gray-100 rounded-full flex items-center justify-center mb-6">
                  <SearchX size={40} className="text-gray-400" />
                </div>
                <h3 className="text-2xl font-bold text-gray-900 mb-2">No results found</h3>
                <p className="text-gray-500 max-w-md mx-auto">
                  {query ? `We couldn't find anything matching "${query}". Try adjusting your search terms.` : "No products available in the catalog yet."}
                </p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
