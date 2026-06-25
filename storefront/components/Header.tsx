'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';
import { Menu, X, ArrowRight, ShoppingBag } from 'lucide-react';
import { api, type PublicSettings } from '@/lib/api';
import { brandName } from '@/lib/format';
import { brandConfig } from '@/config/brand.config';
import { useCart } from '@/lib/cart';

function hexToRgba(hex: string, alpha: number): string {
  const cleanHex = hex.replace('#', '');
  const r = parseInt(cleanHex.substring(0, 2), 16);
  const g = parseInt(cleanHex.substring(2, 4), 16);
  const b = parseInt(cleanHex.substring(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

export function Header() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const fullPath = searchParams.toString() ? `${pathname}?${searchParams.toString()}` : pathname;
  const [mobileOpen, setMobileOpen] = useState(false);
  const [announcement, setAnnouncement] = useState('');
  const [scrolled, setScrolled] = useState(false);
  const { count } = useCart();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    api.get<PublicSettings>('/api/settings/public')
      .then((s) => { if (s.store_announcement) setAnnouncement(s.store_announcement); })
      .catch(() => {});
  }, []);

  useEffect(() => {
    const handler = () => setScrolled(window.scrollY > 8);
    window.addEventListener('scroll', handler, { passive: true });
    return () => window.removeEventListener('scroll', handler);
  }, []);

  useEffect(() => { setMobileOpen(false); }, [pathname, searchParams]);

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

      <header
        className={`sticky top-0 z-50 transition-all duration-300 backdrop-blur-xl ${
          scrolled ? 'shadow-earth-sm border-b border-sand/80' : 'border-b border-sand/60'
        }`}
        style={{
          backgroundColor: hexToRgba(brandConfig.colors.background, scrolled ? 0.98 : 0.95),
        }}
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-20 flex items-center justify-between gap-6">

          <Link href="/" className="flex items-center gap-3 flex-shrink-0 group relative z-10">
            <img
              src="/logo.png"
              alt="Logo"
              className="w-12 h-12 md:w-14 md:h-14 rounded-full object-cover group-hover:scale-105 transition-transform duration-300 border-2 border-sand shadow-md bg-cream transform translate-y-0.5"
            />
            <span className="text-lg sm:text-xl md:text-2xl font-semibold font-serif tracking-tight text-earth group-hover:text-brand-secondary transition-colors duration-300 ml-1">
              <span className="inline md:hidden">Sage &amp; Sweetgrass</span>
              <span className="hidden md:inline">{brandName()}</span>
            </span>
          </Link>

          {/* Nav — desktop */}
          <nav className="hidden md:flex items-center gap-1 flex-1 justify-center">
            {navLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className={`relative px-4 py-2 text-sm font-semibold rounded-full transition-all duration-200 ${
                  fullPath === link.href
                    ? 'text-terracotta bg-terracotta/8'
                    : 'text-earth/65 hover:text-earth hover:bg-sand/60'
                }`}
              >
                {link.label}
                {fullPath === link.href && (
                  <span className="absolute bottom-1 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-terracotta" />
                )}
              </Link>
            ))}
          </nav>

          {/* Actions */}
          <div className="flex items-center gap-2">
            {/* Shopping Cart Link */}
            <Link
              href="/cart"
              className="relative p-2 text-earth/60 hover:text-terracotta hover:bg-sand/70 rounded-full transition-all duration-200"
              aria-label="View Cart"
            >
              <ShoppingBag size={20} />
              {mounted && count > 0 && (
                <span className="absolute -top-1 -right-1 bg-terracotta text-white text-[9px] font-black w-4.5 h-4.5 flex items-center justify-center rounded-full border border-cream leading-none">
                  {count}
                </span>
              )}
            </Link>

            {/* Mobile hamburger */}
            <button
              onClick={() => setMobileOpen(!mobileOpen)}
              className="md:hidden ml-1 w-9 h-9 flex items-center justify-center rounded-full text-earth/60 hover:bg-sand/70 hover:text-terracotta transition-all duration-200"
              aria-label="Menu"
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
        <div
          className={`md:hidden overflow-hidden transition-all duration-300 ease-in-out ${
            mobileOpen ? 'max-h-[480px] opacity-100' : 'max-h-0 opacity-0'
          }`}
          style={{
            visibility: mobileOpen ? 'visible' : 'hidden',
          }}
        >
          <nav
            className="md:hidden border-t border-sand/60 backdrop-blur-xl px-4 py-5 space-y-1"
            style={{
              backgroundColor: hexToRgba(brandConfig.colors.surface, 0.98),
            }}
          >
            {navLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className={`flex items-center justify-between py-3 px-4 text-sm font-semibold rounded-2xl transition-all duration-200 ${
                  fullPath === link.href
                    ? 'bg-sand text-terracotta'
                    : 'text-earth/75 hover:bg-sand/60 hover:text-earth'
                }`}
              >
                {link.label}
                {fullPath === link.href && <span className="w-1.5 h-1.5 rounded-full bg-terracotta" />}
              </Link>
            ))}
            <div className="pt-3 border-t border-sand/60 mt-3">
              <Link
                href="/shop"
                className="flex items-center gap-2 py-3 px-4 text-sm font-bold text-terracotta rounded-2xl hover:bg-terracotta/8 transition-colors duration-200"
              >
                Browse All Products <ArrowRight size={14} />
              </Link>
            </div>
          </nav>
        </div>
      </header>
    </>
  );
}
