import Link from 'next/link';
import { brandName, brandTagline } from '@/lib/format';

export function Footer() {
  const name = brandName();
  const tagline = brandTagline();

  return (
    <footer className="border-t border-gray-100 bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
          <div className="col-span-2 md:col-span-1">
            <h3 className="font-bold text-brand text-lg">{name}</h3>
            {tagline && <p className="mt-2 text-sm text-gray-600">{tagline}</p>}
          </div>
          <div>
            <h4 className="font-semibold text-sm text-gray-900 mb-3">Shop</h4>
            <ul className="space-y-2 text-sm text-gray-600">
              <li><Link href="/" className="hover:text-brand">All Products</Link></li>
              <li><Link href="/collections/new-arrivals" className="hover:text-brand">New Arrivals</Link></li>
              <li><Link href="/categories" className="hover:text-brand">Categories</Link></li>
              <li><Link href="/search" className="hover:text-brand">Search</Link></li>
            </ul>
          </div>
          <div>
            <h4 className="font-semibold text-sm text-gray-900 mb-3">Company</h4>
            <ul className="space-y-2 text-sm text-gray-600">
              <li><Link href="/about" className="hover:text-brand">Our Story</Link></li>
              <li><Link href="/contact" className="hover:text-brand">Contact</Link></li>
              <li><Link href="/faq" className="hover:text-brand">FAQ</Link></li>
              <li><Link href="/order-lookup" className="hover:text-brand">Track Order</Link></li>
            </ul>
          </div>
          <div>
            <h4 className="font-semibold text-sm text-gray-900 mb-3">Policies</h4>
            <ul className="space-y-2 text-sm text-gray-600">
              <li><Link href="/shipping-policy" className="hover:text-brand">Shipping</Link></li>
              <li><Link href="/return-policy" className="hover:text-brand">Returns &amp; Exchanges</Link></li>
              <li><Link href="/privacy-policy" className="hover:text-brand">Privacy Policy</Link></li>
              <li><Link href="/terms-of-service" className="hover:text-brand">Terms of Service</Link></li>
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
