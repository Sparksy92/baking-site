'use client';

import { useEffect, useState } from 'react';
import { Search as SearchIcon, Loader2, SearchX } from 'lucide-react';
import { api, type ProductListItem } from '@/lib/api';
import { ProductCard } from '@/components/ProductCard';

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
    <div className="min-h-screen bg-cream">
      <div className="relative overflow-hidden bg-warm border-b border-sand">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_left,rgba(184,92,56,0.06),transparent_55%)]" aria-hidden="true" />
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-14 md:py-20">
          <div className="max-w-3xl mx-auto text-center mb-8">
            <span className="inline-block mb-3 text-[10px] font-black uppercase tracking-[0.28em] text-terracotta">Shop The Collection</span>
            <h1 className="text-4xl md:text-6xl font-black text-earth mb-8 tracking-[-0.02em] leading-[0.92]">Find your next piece.</h1>
          
          <form onSubmit={handleSearch} className="flex flex-col sm:flex-row gap-3 max-w-2xl mx-auto">
            <div className="flex-1 relative group">
              <SearchIcon size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-earth/70 group-focus-within:text-terracotta transition-colors duration-200" />
              <input
                type="text"
                placeholder="Search products..."
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                className="w-full pl-11 pr-4 py-4 rounded-2xl border border-sand bg-cream focus:border-terracotta focus:ring-4 focus:ring-terracotta/10 outline-none text-base text-earth placeholder:text-muted-earth/50 transition-all duration-200 shadow-earth-sm"
                autoFocus
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="px-8 py-4 bg-terracotta text-white rounded-2xl font-bold text-sm hover:bg-terracotta/90 hover:scale-[1.02] active:scale-[0.98] transition-all duration-200 disabled:opacity-50 disabled:active:scale-100 disabled:hover:scale-100 flex items-center justify-center min-w-[130px] shadow-earth-sm"
            >
              {loading ? <Loader2 size={20} className="animate-spin" /> : 'Search'}
            </button>
          </form>
          </div>
        </div>
      </div>

      {searched && (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
          <div className="border-t border-sand pt-8">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-8">
              <p className="text-base text-muted-earth">
                {loading ? (
                  <span className="flex items-center gap-2"><Loader2 size={16} className="animate-spin" /> Searching...</span>
                ) : (
                  total === 0 ? (query ? `No products found for "${query}"` : "No products found.") : <span className="font-semibold text-earth">{total} result{total !== 1 ? 's' : ''} {query && <span className="text-muted-earth font-normal">for "{query}"</span>}</span>
                )}
              </p>
              
              {total > 0 && !loading && (
                <div className="flex items-center gap-3">
                  <span className="text-sm text-muted-earth font-semibold">Sort by:</span>
                  <select
                    value={sort}
                    onChange={(e) => handleSortChange(e.target.value)}
                    className="text-sm border border-sand rounded-xl px-4 py-2.5 bg-warm text-earth font-semibold focus:border-terracotta focus:ring-4 focus:ring-terracotta/10 outline-none shadow-earth-sm cursor-pointer hover:border-terracotta/60 transition-colors"
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
                    <div className="bg-sand aspect-[3/4] rounded-2xl mb-4"></div>
                    <div className="h-4 bg-sand rounded w-3/4 mb-2"></div>
                    <div className="h-4 bg-sand rounded w-1/4"></div>
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
                <div className="w-24 h-24 bg-warm border border-sand rounded-full flex items-center justify-center mb-6">
                  <SearchX size={40} className="text-muted-earth" />
                </div>
                <h3 className="text-2xl font-bold text-earth mb-2">No results found</h3>
                <p className="text-muted-earth max-w-md mx-auto">
                  {query ? `We couldn't find anything matching "${query}". Try adjusting your search terms.` : "No products available in the catalog yet."}
                </p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
