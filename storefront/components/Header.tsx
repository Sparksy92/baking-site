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
      <style>{`
        .header-nav-link-active {
          color: ${brandConfig.colors.accent} !important;
          background-color: ${hexToRgba(brandConfig.colors.accent, 0.08)} !important;
        }
        .header-nav-link-inactive {
          color: ${hexToRgba(brandConfig.colors.text, 0.65)} !important;
        }
        .header-nav-link-inactive:hover {
          color: ${brandConfig.colors.text} !important;
          background-color: ${hexToRgba(brandConfig.colors.border, 0.6)} !important;
        }
        .header-cart-btn {
          color: ${hexToRgba(brandConfig.colors.text, 0.6)} !important;
        }
        .header-cart-btn:hover {
          color: ${brandConfig.colors.accent} !important;
          background-color: ${hexToRgba(brandConfig.colors.border, 0.7)} !important;
        }
        .header-menu-btn {
          color: ${hexToRgba(brandConfig.colors.text, 0.6)} !important;
        }
        .header-menu-btn:hover {
          color: ${brandConfig.colors.accent} !important;
          background-color: ${hexToRgba(brandConfig.colors.border, 0.7)} !important;
        }
        .header-mobile-drawer-nav {
          border-color: ${hexToRgba(brandConfig.colors.border, 0.6)} !important;
        }
        .header-mobile-link-active {
          background-color: ${brandConfig.colors.border} !important;
          color: ${brandConfig.colors.accent} !important;
        }
        .header-mobile-link-inactive {
          color: ${hexToRgba(brandConfig.colors.text, 0.75)} !important;
        }
        .header-mobile-link-inactive:hover {
          background-color: ${hexToRgba(brandConfig.colors.border, 0.6)} !important;
          color: ${brandConfig.colors.text} !important;
        }
        .header-mobile-browse-link {
          color: ${brandConfig.colors.accent} !important;
        }
        .header-mobile-browse-link:hover {
          background-color: ${hexToRgba(brandConfig.colors.accent, 0.08)} !important;
        }
      `}</style>

      {/* Announcement bar */}
      {announcement && (
        <div className="relative overflow-hidden bg-earth text-white text-center text-xs font-bold tracking-widest uppercase py-2.5 px-4">
          <span className="relative z-10">{announcement}</span>
          <span className="absolute inset-0 bg-[linear-gradient(90deg,transparent_0%,rgba(184,92,56,0.3)_50%,transparent_100%)] animate-pulse" aria-hidden="true" />
        </div>
      )}

      <header
        className={`sticky top-0 z-50 transition-all duration-300 border-b backdrop-blur-xl ${
          scrolled ? 'shadow-earth-sm' : ''
        }`}
        style={{
          backgroundColor: hexToRgba(brandConfig.colors.background, scrolled ? 0.98 : 0.95),
          borderColor: hexToRgba(brandConfig.colors.border, scrolled ? 0.8 : 0.6),
        }}
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-20 flex items-center justify-between gap-2 sm:gap-6">

          <Link href="/" className="flex items-center gap-2 sm:gap-3 flex-shrink-0 group relative z-10">
            <img
              src="/logo.png"
              alt="Logo"
              className="w-14 h-14 md:w-16 md:h-16 rounded-full object-cover group-hover:scale-105 transition-transform duration-300 border-2 border-sand shadow-md bg-cream transform translate-y-0.5"
            />
            <span className="text-sm min-[380px]:text-base sm:text-xl md:text-2xl font-semibold font-serif tracking-tight text-earth group-hover:text-brand-secondary transition-colors duration-300 ml-1">
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
                    ? 'header-nav-link-active'
                    : 'header-nav-link-inactive'
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
          <div className="flex items-center gap-1.5 sm:gap-2 flex-shrink-0">
            {/* Shopping Cart Link */}
            <Link
              href="/cart"
              className="relative p-2 rounded-full transition-all duration-200 header-cart-btn flex-shrink-0"
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
              className="md:hidden ml-1 w-9 h-9 flex-shrink-0 flex items-center justify-center rounded-full transition-all duration-200 header-menu-btn"
              aria-label="Menu"
              aria-expanded={mobileOpen}
            >
              {mobileOpen ? <X size={20} /> : <Menu size={20} />}
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
            className="md:hidden border-t backdrop-blur-xl px-4 py-5 space-y-1 header-mobile-drawer-nav"
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
                    ? 'header-mobile-link-active'
                    : 'header-mobile-link-inactive'
                }`}
              >
                {link.label}
                {fullPath === link.href && <span className="w-1.5 h-1.5 rounded-full bg-terracotta" />}
              </Link>
            ))}
            <div className="pt-3 border-t mt-3" style={{ borderColor: hexToRgba(brandConfig.colors.border, 0.6) }}>
              <Link
                href="/shop"
                className="flex items-center gap-2 py-3 px-4 text-sm font-bold rounded-2xl transition-colors duration-200 header-mobile-browse-link"
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
