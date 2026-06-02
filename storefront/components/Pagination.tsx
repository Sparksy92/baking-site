import Link from 'next/link';

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
    <nav className="flex items-center justify-center gap-1 mt-10" aria-label="Pagination">
      {currentPage > 1 && (
        <Link
          href={buildHref(currentPage - 1)}
          className="px-3 py-2 text-sm font-medium text-earth/70 hover:text-terracotta rounded-xl hover:bg-sand/60 transition-colors"
        >
          Prev
        </Link>
      )}
      {pages.map((p, i) =>
        p === '...' ? (
          <span key={`dot-${i}`} className="px-2 py-2 text-sm text-muted-earth/60">...</span>
        ) : (
          <Link
            key={p}
            href={buildHref(p)}
            className={`px-3 py-2 text-sm rounded-xl font-semibold transition-colors ${
              p === currentPage
                ? 'bg-earth text-white'
                : 'text-earth/70 hover:text-terracotta hover:bg-sand/60'
            }`}
          >
            {p}
          </Link>
        )
      )}
      {currentPage < totalPages && (
        <Link
          href={buildHref(currentPage + 1)}
          className="px-3 py-2 text-sm font-medium text-earth/70 hover:text-terracotta rounded-xl hover:bg-sand/60 transition-colors"
        >
          Next
        </Link>
      )}
    </nav>
  );
}
