import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Search as SearchIcon } from 'lucide-react';
import { api, type ProductListItem } from '../lib/api';
import { formatCents } from '../lib/format';

export default function SearchPage() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<ProductListItem[]>([]);
  const [searched, setSearched] = useState(false);

  async function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    if (!query.trim()) return;
    const data = await api.get<{ products: ProductListItem[] }>(`/api/products?search=${encodeURIComponent(query.trim())}`);
    setResults(data.products);
    setSearched(true);
  }

  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      <form onSubmit={handleSearch} className="flex gap-2">
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

      {searched && results.length === 0 && (
        <p className="mt-8 text-center text-gray-500">No products found for "{query}"</p>
      )}

      {results.length > 0 && (
        <div className="mt-8 grid grid-cols-2 md:grid-cols-3 gap-4">
          {results.map((product) => (
            <Link key={product.id} to={`/product/${product.slug}`} className="group">
              <div className="aspect-[3/4] bg-gray-100 rounded-lg overflow-hidden">
                {product.image_url ? (
                  <img src={product.image_url} alt={product.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-gray-400 text-xs">No image</div>
                )}
              </div>
              <h3 className="mt-2 text-sm font-medium text-gray-900 truncate">{product.name}</h3>
              <p className="text-sm font-bold">{formatCents(product.min_price_cents ?? 0)}</p>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
