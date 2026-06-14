'use client';

import { useEffect, useState, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { Loader2 } from 'lucide-react';
import { api, type ProductListItem } from '@/lib/api';
import { ProductCard } from '@/components/ProductCard';

function ShopContent() {
  const [products, setProducts] = useState<ProductListItem[]>([]);
  const [total, setTotal] = useState(0);
  const [sort, setSort] = useState('');
  const [loading, setLoading] = useState(true);
  const [category, setCategory] = useState<string | null>(null);
  const searchParams = useSearchParams();

  const searchParamsString = searchParams.toString();
  useEffect(() => {
    const cat = searchParams.get('category');
    setCategory(cat);
    setSort('');
    fetchProducts(cat, '');
  }, [searchParamsString]);

  async function fetchProducts(cat: string | null, sortBy: string) {
    setLoading(true);
    try {
      const catParam = cat ? `category=${encodeURIComponent(cat)}&` : '';
      const sortParam = sortBy ? `sort=${sortBy}&` : '';
      const data = await api.get<{ products: ProductListItem[]; total: number }>(
        `/api/products?${catParam}${sortParam}limit=48`
      );
      setProducts(data.products);
      setTotal(data.total);
    } catch (err) {
      console.error(err);
      setProducts([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  }

  function handleSortChange(newSort: string) {
    setSort(newSort);
    fetchProducts(category, newSort);
  }

  return (
    <div className="min-h-screen bg-cream">
      {/* Hero Header */}
      <div className="relative overflow-hidden bg-warm border-b border-sand">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_left,rgba(184,92,56,0.06),transparent_55%)]" aria-hidden="true" />
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 md:py-16">
          <div className="text-center">
            <span className="inline-block mb-3 text-[10px] font-black uppercase tracking-[0.28em] text-terracotta">
              {category ? 'Category' : 'Shop'}
            </span>
            <h1 className="text-3xl md:text-5xl font-black text-earth tracking-[-0.02em] leading-[0.95]">
              {category 
                ? category.charAt(0).toUpperCase() + category.slice(1)
                : 'All Products'}
            </h1>
            {category && (
              <p className="mt-4 text-muted-earth max-w-lg mx-auto">
                Browse our selection of {category}.
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Product Grid */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        <div className="border-t border-sand pt-8">
          {/* Homestead Ordering Notice */}
          <div className="bg-brand/5 border border-brand/20 rounded-2xl p-5 mb-8 text-sm text-muted-earth space-y-2">
            <h3 className="font-bold text-earth">🌾 Homestead Selections &amp; Ordering Notes</h3>
            <ul className="list-disc list-inside space-y-1 text-xs">
              <li>Some prices are placeholder starting rates and will be finalized after your request is reviewed.</li>
              <li>Sourdough is prepared by preorder and is typically baked on weekends.</li>
              <li>Custom cakes, cheesecakes, and custom desserts require a quote request.</li>
              <li>Order requests are not guaranteed until Kirstin confirms availability.</li>
              <li>E-transfer details and pickup/delivery logistics will be finalized upon request review.</li>
            </ul>
          </div>

          {/* Controls */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-8">
            <p className="text-base text-muted-earth">
              {loading ? (
                <span className="flex items-center gap-2">
                  <Loader2 size={16} className="animate-spin" /> Loading products...
                </span>
              ) : (
                <span className="font-semibold text-earth">
                  {total} product{total !== 1 ? 's' : ''}
                </span>
              )}
            </p>
            
            {!loading && total > 0 && (
              <div className="flex items-center gap-3">
                <span className="text-sm text-muted-earth font-semibold">Sort by:</span>
                <select
                  value={sort}
                  onChange={(e) => handleSortChange(e.target.value)}
                  className="text-sm border border-sand rounded-xl px-4 py-2.5 bg-warm text-earth font-semibold focus:border-terracotta focus:ring-4 focus:ring-terracotta/10 outline-none shadow-earth-sm cursor-pointer hover:border-terracotta/60 transition-colors"
                >
                  <option value="">Featured</option>
                  <option value="newest">Newest Arrivals</option>
                  <option value="price_asc">Price: Low to High</option>
                  <option value="price_desc">Price: High to Low</option>
                  <option value="name_asc">Name: A-Z</option>
                  <option value="name_desc">Name: Z-A</option>
                </select>
              </div>
            )}
          </div>

          {/* Grid */}
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
              {products.map((product) => (
                <ProductCard key={product.id} product={product} />
              ))}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <div className="w-24 h-24 bg-warm border border-sand rounded-full flex items-center justify-center mb-6">
                <span className="text-4xl">📦</span>
              </div>
              <h3 className="text-2xl font-bold text-earth mb-2">No products found</h3>
              <p className="text-muted-earth max-w-md mx-auto">
                {category 
                  ? `No ${category} products available yet.` 
                  : "No products available in the catalog yet."}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function ShopPage() {
  return (
    <Suspense>
      <ShopContent />
    </Suspense>
  );
}
