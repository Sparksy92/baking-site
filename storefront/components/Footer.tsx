import Link from 'next/link';
import { brandName, brandTagline } from '@/lib/format';
import { brandConfig } from '@/config/brand.config';

export function Footer() {
  const name = brandName();
  const tagline = brandTagline();

  return (
    <footer className="border-t border-sand bg-earth text-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-14">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
          <div className="col-span-2 md:col-span-1">
            <h3 className="font-bold text-white text-lg">{name}</h3>
            {tagline && <p className="mt-2 text-sm text-white/60">{tagline}</p>}
          </div>
          {brandConfig.navigation.footerColumns.map((col, idx) => (
            <div key={idx}>
              <h4 className="font-semibold text-sm text-white/90 mb-3">{col.title}</h4>
              <ul className="space-y-2 text-sm text-white/50">
                {col.links.map((link) => (
                  <li key={link.href}>
                    <Link href={link.href} className="hover:text-terracotta transition-colors" target={link.external ? '_blank' : undefined}>
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        <div className="mt-10 pt-8 border-t border-white/10 text-center text-xs text-white/30">
          <span dangerouslySetInnerHTML={{
            __html: brandConfig.content.copyright.replace('{year}', new Date().getFullYear().toString())
          }} />
        </div>
      </div>
    </footer>
  );
}
