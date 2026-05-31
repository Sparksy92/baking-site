'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import { ShoppingBag, Search, Menu, X, User } from 'lucide-react';
import { useCart } from '@/lib/cart';
import { useCustomer } from '@/lib/customer';
import { api, type PublicSettings } from '@/lib/api';
import { brandName, brandLogo, formatCents } from '@/lib/format';

export function Header() {
  const { count, subtotal } = useCart();
  const { customer } = useCustomer();
  const pathname = usePathname();
  const isCheckout = ['/cart', '/checkout'].includes(pathname);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [announcement, setAnnouncement] = useState('');
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    api.get<PublicSettings>('/api/settings/public')
      .then((s) => { if (s.store_announcement) setAnnouncement(s.store_announcement); })
      .catch(() => {});
  }, []);

  useEffect(() => { setMobileOpen(false); }, [pathname]);

  const navLinks = [
    { label: 'Shop', href: '/' },
    { label: 'New Arrivals', href: '/collections/new-arrivals' },
    { label: 'Categories', href: '/categories' },
    { label: 'About', href: '/about' },
    { label: 'Track Order', href: '/order-lookup' },
  ];

  return (
    <>
      {/* Announcement bar */}
      {announcement && (
        <div className="bg-brand text-white text-center text-xs font-medium py-2 px-4">
          {announcement}
        </div>
      )}

      <header className="sticky top-0 z-50 bg-white border-b border-gray-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          {/* Mobile menu toggle */}
          <button
            onClick={() => setMobileOpen(!mobileOpen)}
            className="md:hidden w-10 h-10 flex items-center justify-center text-gray-600"
            aria-label="Menu"
          >
            {mobileOpen ? <X size={22} /> : <Menu size={22} />}
          </button>

          {/* Logo */}
          <Link href="/" className="flex items-center gap-2">
            {brandLogo() && (
              <Image src={brandLogo()!} alt={brandName()} width={32} height={32} className="h-8 w-auto" />
            )}
            <span className="text-2xl font-black tracking-tight text-brand">{brandName()}</span>
          </Link>

          {/* Nav — desktop */}
          <nav className="hidden md:flex items-center gap-8">
            {navLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className={`text-sm font-medium transition-colors ${
                  pathname === link.href ? 'text-brand' : 'text-gray-700 hover:text-brand'
                }`}
              >
                {link.label}
              </Link>
            ))}
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
              href={customer ? '/account' : '/account/login'}
              className="w-10 h-10 flex items-center justify-center rounded-full text-gray-600 hover:bg-gray-100 transition-colors"
              aria-label={customer ? 'Account' : 'Sign in'}
            >
              <User size={20} />
            </Link>
            <Link
              href="/cart"
              className="relative w-10 h-10 flex items-center justify-center rounded-full text-gray-600 hover:bg-gray-100 transition-colors"
              aria-label="Cart"
            >
              <ShoppingBag size={20} />
              {mounted && count > 0 && (
                <span className="absolute -top-0.5 -right-0.5 bg-accent text-white text-[10px] font-bold rounded-full min-w-[18px] h-[18px] flex items-center justify-center px-1">
                  {count}
                </span>
              )}
            </Link>
          </div>
        </div>

        {/* Mobile nav drawer */}
        {mobileOpen && (
          <nav className="md:hidden border-t border-gray-100 bg-white px-4 py-4 space-y-1">
            {navLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className={`block py-2.5 text-sm font-medium rounded-lg px-3 ${
                  pathname === link.href ? 'bg-gray-100 text-brand' : 'text-gray-700 hover:bg-gray-50'
                }`}
              >
                {link.label}
              </Link>
            ))}
          </nav>
        )}
      </header>

      {/* Floating cart bar — mobile only */}
      {mounted && count > 0 && !isCheckout && (
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
