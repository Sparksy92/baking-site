'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ShoppingBag, Search, Menu, X, User, ArrowRight } from 'lucide-react';
import { useCart } from '@/lib/cart';
import { useCustomer } from '@/lib/customer';
import { api, type PublicSettings } from '@/lib/api';
import { brandName, formatCents } from '@/lib/format';
import { brandConfig } from '@/config/brand.config';

export function Header() {
  const { count, subtotal } = useCart();
  const { customer } = useCustomer();
  const pathname = usePathname();
  const isCheckout = ['/cart', '/checkout'].includes(pathname);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [announcement, setAnnouncement] = useState('');
  const [mounted, setMounted] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    setMounted(true);
    api.get<PublicSettings>('/api/settings/public')
      .then((s) => { if (s.store_announcement) setAnnouncement(s.store_announcement); })
      .catch(() => {});
  }, []);

  useEffect(() => {
    const handler = () => setScrolled(window.scrollY > 8);
    window.addEventListener('scroll', handler, { passive: true });
    return () => window.removeEventListener('scroll', handler);
  }, []);

  useEffect(() => { setMobileOpen(false); }, [pathname]);

  const navLinks = brandConfig.navigation.mainLinks;

  return (
    <>
      {/* Announcement bar */}
      {announcement && (
        <div className="relative overflow-hidden bg-earth text-white text-center text-xs font-bold tracking-widest uppercase py-2.5 px-4">
          <span className="relative z-10">{announcement}</span>
          <span className="absolute inset-0 bg-[linear-gradient(90deg,transparent_0%,rgba(184,92,56,0.3)_50%,transparent_100%)] animate-pulse" aria-hidden="true" />
        </div>
      )}

      <header className={`sticky top-0 z-50 transition-all duration-300 ${
        scrolled
          ? 'bg-cream/98 backdrop-blur-2xl shadow-earth-sm border-b border-sand/80'
          : 'bg-cream/95 backdrop-blur-xl border-b border-sand/60'
      }`}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-6">

          {/* Logo */}
          <Link href="/" className="flex items-center gap-2.5 flex-shrink-0 group">
            <span className="brand-mark group-hover:scale-105 transition-transform duration-300" aria-hidden="true">T</span>
            <span className="text-xl font-black tracking-tight text-earth group-hover:text-terracotta transition-colors duration-300">{brandName()}</span>
          </Link>

          {/* Nav — desktop */}
          <nav className="hidden md:flex items-center gap-1 flex-1 justify-center">
            {navLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className={`relative px-4 py-2 text-sm font-semibold rounded-full transition-all duration-200 ${
                  pathname === link.href
                    ? 'text-terracotta bg-terracotta/8'
                    : 'text-earth/65 hover:text-earth hover:bg-sand/60'
                }`}
              >
                {link.label}
                {pathname === link.href && (
                  <span className="absolute bottom-1 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-terracotta" />
                )}
              </Link>
            ))}
          </nav>

          {/* Actions */}
          <div className="flex items-center gap-1">
            <Link
              href="/search"
              className="w-9 h-9 flex items-center justify-center rounded-full text-earth/60 hover:bg-sand/70 hover:text-terracotta transition-all duration-200"
              aria-label="Search"
            >
              <Search size={18} />
            </Link>
            <Link
              href={mounted && customer ? '/account' : '/account/login'}
              className="w-9 h-9 flex items-center justify-center rounded-full text-earth/60 hover:bg-sand/70 hover:text-terracotta transition-all duration-200"
              aria-label="Account"
            >
              <User size={18} />
            </Link>
            <Link
              href="/cart"
              className="relative w-9 h-9 flex items-center justify-center rounded-full text-earth/60 hover:bg-sand/70 hover:text-terracotta transition-all duration-200"
              aria-label="Cart"
            >
              <ShoppingBag size={18} />
              {mounted && count > 0 && (
                <span className="absolute -top-0.5 -right-0.5 bg-terracotta text-white text-[9px] font-black rounded-full min-w-[17px] h-[17px] flex items-center justify-center px-0.5 ring-2 ring-cream">
                  {count > 9 ? '9+' : count}
                </span>
              )}
            </Link>

            {/* Mobile hamburger */}
            <button
              onClick={() => setMobileOpen(!mobileOpen)}
              className="md:hidden ml-1 w-9 h-9 flex items-center justify-center rounded-full text-earth/60 hover:bg-sand/70 hover:text-terracotta transition-all duration-200"
              aria-label={mobileOpen ? 'Close menu' : 'Open menu'}
              aria-expanded={mobileOpen}
            >
              <span className={`transition-all duration-200 ${mobileOpen ? 'opacity-0 scale-75' : 'opacity-100 scale-100'} absolute`}>
                <Menu size={20} />
              </span>
              <span className={`transition-all duration-200 ${mobileOpen ? 'opacity-100 scale-100' : 'opacity-0 scale-75'} absolute`}>
                <X size={20} />
              </span>
            </button>
          </div>
        </div>

        {/* Mobile nav drawer */}
        <div className={`md:hidden overflow-hidden transition-all duration-300 ease-in-out ${
          mobileOpen ? 'max-h-[480px] opacity-100' : 'max-h-0 opacity-0'
        }`}>
          <nav className="border-t border-sand/60 bg-warm/98 backdrop-blur-xl px-4 py-5 space-y-1">
            {navLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className={`flex items-center justify-between py-3 px-4 text-sm font-semibold rounded-2xl transition-all duration-200 ${
                  pathname === link.href
                    ? 'bg-sand text-terracotta'
                    : 'text-earth/75 hover:bg-sand/60 hover:text-earth'
                }`}
              >
                {link.label}
                {pathname === link.href && <span className="w-1.5 h-1.5 rounded-full bg-terracotta" />}
              </Link>
            ))}
            <div className="pt-3 border-t border-sand/60 mt-3">
              <Link
                href="/shop"
                className="flex items-center gap-2 py-3 px-4 text-sm font-bold text-terracotta rounded-2xl hover:bg-terracotta/8 transition-colors duration-200"
              >
                Shop All Products <ArrowRight size={14} />
              </Link>
            </div>
          </nav>
        </div>
      </header>

      {/* Floating cart bar — mobile only */}
      {mounted && count > 0 && !isCheckout && (
        <div className="fixed bottom-0 left-0 right-0 z-50 p-3 bg-cream/95 backdrop-blur-2xl border-t border-sand/70 md:hidden">
          <Link
            href="/cart"
            className="flex items-center justify-between bg-earth text-white rounded-2xl px-5 py-3.5 shadow-earth hover:bg-deep transition-colors duration-200"
          >
            <div className="flex items-center gap-3">
              <span className="bg-terracotta rounded-full w-7 h-7 flex items-center justify-center text-xs font-black">
                {count}
              </span>
              <span className="font-bold text-sm">View Cart</span>
            </div>
            <span className="font-black text-sm">{formatCents(subtotal)}</span>
          </Link>
        </div>
      )}
    </>
  );
}
