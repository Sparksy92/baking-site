'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Search } from 'lucide-react';

export function SearchForm({ initialQuery = '' }: { initialQuery?: string }) {
  const [query, setQuery] = useState(initialQuery);
  const router = useRouter();

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!query.trim()) return;
    router.push(`/search?q=${encodeURIComponent(query.trim())}`);
  }

  return (
    <form onSubmit={handleSubmit} className="max-w-2xl mx-auto flex gap-3">
      <div className="relative flex-1">
        <input
          type="text"
          placeholder="Search products..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="w-full pl-12 pr-4 py-4 rounded-2xl border border-[var(--brand-border)] bg-white text-[var(--brand-text)] focus:border-[var(--brand-primary)] focus:outline-none transition-all shadow-sm"
        />
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-[var(--brand-text-muted)]" size={20} />
      </div>
      <button
        type="submit"
        disabled={!query.trim()}
        className="px-8 py-4 bg-[var(--brand-primary)] text-white font-bold rounded-2xl hover:bg-[var(--brand-primary)]/90 transition-all shadow-xl shadow-[var(--brand-primary)]/10 disabled:opacity-50 disabled:cursor-not-allowed active:scale-[0.98]"
      >
        Search
      </button>
    </form>
  );
}
