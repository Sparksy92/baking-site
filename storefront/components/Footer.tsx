import Link from 'next/link';
import { brandName, brandTagline } from '@/lib/format';

export function Footer() {
  const name = brandName();
  const tagline = brandTagline();

  return (
    <footer className="border-t border-gray-100 bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          <div>
            <h3 className="font-bold text-brand text-lg">{name}</h3>
            {tagline && <p className="mt-2 text-sm text-gray-600">{tagline}</p>}
          </div>
          <div>
            <h4 className="font-semibold text-sm text-gray-900 mb-3">Shop</h4>
            <ul className="space-y-2 text-sm text-gray-600">
              <li><Link href="/" className="hover:text-brand">All Products</Link></li>
              <li><Link href="/collections/new-arrivals" className="hover:text-brand">New Arrivals</Link></li>
              <li><Link href="/order-lookup" className="hover:text-brand">Track Order</Link></li>
            </ul>
          </div>
          <div>
            <h4 className="font-semibold text-sm text-gray-900 mb-3">Info</h4>
            <ul className="space-y-2 text-sm text-gray-600">
              <li><a href="#" className="hover:text-brand">Shipping &amp; Returns</a></li>
              <li><a href="#" className="hover:text-brand">Contact</a></li>
            </ul>
          </div>
        </div>
        <div className="mt-8 pt-8 border-t border-gray-200 text-center text-xs text-gray-400">
          &copy; {new Date().getFullYear()} {name}. All rights reserved.
        </div>
      </div>
    </footer>
  );
}
