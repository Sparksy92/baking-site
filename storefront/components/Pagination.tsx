import Link from 'next/link';
import { ArrowLeft, ArrowRight } from 'lucide-react';

interface PaginationProps {
  currentPage: number;
  totalPages: number;
  buildHref: (page: number) => string;
}

export function Pagination({ currentPage, totalPages, buildHref }: PaginationProps) {
  if (totalPages <= 1) return null;

  const pages: (number | '...')[] = [];
  for (let i = 1; i <= totalPages; i++) {
    if (i === 1 || i === totalPages || (i >= currentPage - 1 && i <= currentPage + 1)) {
      pages.push(i);
    } else if (pages[pages.length - 1] !== '...') {
      pages.push('...');
    }
  }

  return (
    <nav className="mt-12 flex items-center justify-center" aria-label="Pagination">
      <div className="inline-flex items-center gap-1 rounded-full border border-sand bg-warm p-1.5 shadow-earth-sm">
        {currentPage > 1 && (
          <Link
            href={buildHref(currentPage - 1)}
            className="inline-flex h-10 items-center gap-1.5 rounded-full px-4 text-sm font-bold text-earth/70 transition-all duration-300 hover:bg-cream hover:text-terracotta"
            aria-label="Go to previous page"
          >
            <ArrowLeft size={14} />
            <span className="hidden sm:inline">Prev</span>
          </Link>
        )}
        {pages.map((p, i) =>
          p === '...' ? (
            <span key={`dot-${i}`} className="flex h-10 min-w-10 items-center justify-center text-sm font-bold text-muted-earth/50">...</span>
          ) : (
            <Link
              key={p}
              href={buildHref(p)}
              aria-current={p === currentPage ? 'page' : undefined}
              className={`flex h-10 min-w-10 items-center justify-center rounded-full px-3 text-sm font-black transition-all duration-300 ${
                p === currentPage
                  ? 'bg-earth text-white shadow-earth-sm'
                  : 'text-earth/65 hover:bg-cream hover:text-terracotta'
              }`}
            >
              {p}
            </Link>
          )
        )}
        {currentPage < totalPages && (
          <Link
            href={buildHref(currentPage + 1)}
            className="inline-flex h-10 items-center gap-1.5 rounded-full px-4 text-sm font-bold text-earth/70 transition-all duration-300 hover:bg-cream hover:text-terracotta"
            aria-label="Go to next page"
          >
            <span className="hidden sm:inline">Next</span>
            <ArrowRight size={14} />
          </Link>
        )}
      </div>
    </nav>
  );
}
