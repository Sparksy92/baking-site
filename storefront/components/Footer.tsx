import Link from 'next/link';
import { brandName, brandTagline } from '@/lib/format';
import { brandConfig } from '@/config/brand.config';

export function Footer() {
  const name = brandName();
  const tagline = brandTagline();

  return (
    <footer className="relative overflow-hidden bg-deep text-white">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,rgba(184,92,56,0.12),transparent_60%),radial-gradient(ellipse_at_bottom_left,rgba(107,127,94,0.08),transparent_55%)]" aria-hidden="true" />
      <div className="grain" aria-hidden="true" />

      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-16 pb-10 md:pt-20 md:pb-12">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-10 md:gap-12 pb-12 border-b border-white/10">

          {/* Brand column */}
          <div className="col-span-2 md:col-span-1 space-y-5">
            <div className="flex items-center gap-3">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/logo.png"
                alt="Logo"
                className="w-14 h-14 rounded-full object-cover border border-white/10"
              />
              <span className="text-xl font-black tracking-tight text-white">{name}</span>
            </div>
            {tagline && (
              <p className="text-sm leading-relaxed text-white/55 max-w-[220px]">{tagline}</p>
            )}
            <div className="h-px w-10 bg-terracotta/60" />
            <p className="text-xs text-white/35 leading-relaxed">
              Fresh Weekly Baking &amp;<br />Handmade Homestead Goods.
            </p>
          </div>

          {/* Nav columns */}
          {brandConfig.navigation.footerColumns.map((col, idx) => (
            <div key={idx}>
              <h4 className="text-[10px] font-black uppercase tracking-[0.22em] text-white/40 mb-5">{col.title}</h4>
              <ul className="space-y-3.5">
                {col.links.map((link) => (
                  <li key={link.href}>
                    <Link
                      href={link.href}
                      className="text-sm text-white/55 hover:text-terracotta transition-colors duration-200 leading-none"
                      target={link.external ? '_blank' : undefined}
                      rel={link.external ? 'noopener noreferrer' : undefined}
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        {/* Bottom bar */}
        <div className="pt-8 flex flex-col sm:flex-row items-center justify-between gap-4">
          <p className="text-xs text-white/30">
            <span dangerouslySetInnerHTML={{
              __html: brandConfig.content.copyright.replace('{year}', new Date().getFullYear().toString())
            }} />
          </p>
          <div className="flex items-center gap-6 text-xs text-white/25">
            <Link href="/privacy-policy" className="hover:text-white/50 transition-colors duration-200">Privacy</Link>
            <Link href="/terms-of-service" className="hover:text-white/50 transition-colors duration-200">Terms</Link>
            <Link href="/contact" className="hover:text-white/50 transition-colors duration-200">Support</Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
