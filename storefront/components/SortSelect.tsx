'use client';

import { useRouter, useSearchParams } from 'next/navigation';

const sortOptions = [
  { value: '', label: 'Default' },
  { value: 'newest', label: 'Newest' },
  { value: 'price_asc', label: 'Price: Low to High' },
  { value: 'price_desc', label: 'Price: High to Low' },
  { value: 'name_asc', label: 'Name: A-Z' },
  { value: 'name_desc', label: 'Name: Z-A' },
];

export function SortSelect() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const currentSort = searchParams.get('sort') || '';

  function handleChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const params = new URLSearchParams(searchParams.toString());
    if (e.target.value) {
      params.set('sort', e.target.value);
    } else {
      params.delete('sort');
    }
    params.delete('page');
    router.push(`?${params.toString()}`);
  }

  return (
    <select
      value={currentSort}
      onChange={handleChange}
      aria-label="Sort products"
      className="h-11 rounded-full border border-sand bg-cream px-4 text-sm font-bold text-earth shadow-earth-sm outline-none transition-all duration-300 hover:border-terracotta/60 focus:border-terracotta focus:ring-4 focus:ring-terracotta/10"
    >
      {sortOptions.map((opt) => (
        <option key={opt.value} value={opt.value}>{opt.label}</option>
      ))}
    </select>
  );
}
