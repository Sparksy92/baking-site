'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ShoppingBag, Search } from 'lucide-react';
import { useCart } from '@/lib/cart';
import { brandName, brandLogo, formatCents } from '@/lib/format';

export function Header() {
  const { count, subtotal } = useCart();
  const pathname = usePathname();
  const isCheckout = ['/cart', '/checkout'].includes(pathname);

  return (
    <>
      <header className="sticky top-0 z-50 bg-white border-b border-gray-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-2">
            {brandLogo() && (
              <img src={brandLogo()!} alt={brandName()} className="h-8 w-auto" />
            )}
            <span className="text-2xl font-black tracking-tight text-brand">{brandName()}</span>
          </Link>

          {/* Nav — desktop */}
          <nav className="hidden md:flex items-center gap-8">
            <Link href="/" className="text-sm font-medium text-gray-700 hover:text-brand transition-colors">
              Shop
            </Link>
            <Link href="/collections/new-arrivals" className="text-sm font-medium text-gray-700 hover:text-brand transition-colors">
              New Arrivals
            </Link>
            <Link href="/order-lookup" className="text-sm font-medium text-gray-700 hover:text-brand transition-colors">
              Track Order
            </Link>
          </nav>

          {/* Actions */}
          <div className="flex items-center gap-2">
            <Link
              href="/search"
              className="w-10 h-10 flex items-center justify-center rounded-full text-gray-600 hover:bg-gray-100 transition-colors"
              aria-label="Search"
            >
              <Search size={20} />
            </Link>
            <Link
              href="/cart"
              className="relative w-10 h-10 flex items-center justify-center rounded-full text-gray-600 hover:bg-gray-100 transition-colors"
              aria-label="Cart"
            >
              <ShoppingBag size={20} />
              {count > 0 && (
                <span className="absolute -top-0.5 -right-0.5 bg-accent text-white text-[10px] font-bold rounded-full min-w-[18px] h-[18px] flex items-center justify-center px-1">
                  {count}
                </span>
              )}
            </Link>
          </div>
        </div>
      </header>

      {/* Floating cart bar — mobile only */}
      {count > 0 && !isCheckout && (
        <div className="fixed bottom-0 left-0 right-0 z-50 p-3 bg-white/90 backdrop-blur border-t border-gray-200 md:hidden">
          <Link
            href="/cart"
            className="flex items-center justify-between bg-brand text-white rounded-xl px-5 py-3.5 shadow-lg"
          >
            <div className="flex items-center gap-3">
              <span className="bg-white/20 rounded-full w-7 h-7 flex items-center justify-center text-xs font-bold">
                {count}
              </span>
              <span className="font-semibold text-sm">View Cart</span>
            </div>
            <span className="font-bold text-sm">{formatCents(subtotal)}</span>
          </Link>
        </div>
      )}
    </>
  );
}
