import { Link, Outlet, useLocation } from 'react-router-dom';
import { ShoppingBag, Search } from 'lucide-react';
import { useCart } from '../lib/cart';
import { brandName, brandTagline, brandLogo, formatCents } from '../lib/format';

export default function Layout() {
  const { count, subtotal } = useCart();
  const location = useLocation();
  const isCheckout = ['/cart', '/checkout'].includes(location.pathname);

  return (
    <div className="min-h-screen flex flex-col bg-white">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-white border-b border-gray-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          {/* Logo */}
          <Link to="/" className="flex items-center gap-2">
            {brandLogo() && (
              <img src={brandLogo()!} alt={brandName()} className="h-8 w-auto" />
            )}
            <span className="text-2xl font-black tracking-tight text-brand">{brandName()}</span>
          </Link>

          {/* Nav — desktop */}
          <nav className="hidden md:flex items-center gap-8">
            <Link to="/" className="text-sm font-medium text-gray-700 hover:text-brand transition-colors">
              Shop
            </Link>
            <Link to="/collections/new-arrivals" className="text-sm font-medium text-gray-700 hover:text-brand transition-colors">
              New Arrivals
            </Link>
            <Link to="/order-lookup" className="text-sm font-medium text-gray-700 hover:text-brand transition-colors">
              Track Order
            </Link>
          </nav>

          {/* Actions */}
          <div className="flex items-center gap-2">
            <Link
              to="/search"
              className="w-10 h-10 flex items-center justify-center rounded-full text-gray-600 hover:bg-gray-100 transition-colors"
              aria-label="Search"
            >
              <Search size={20} />
            </Link>
            <Link
              to="/cart"
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

      {/* Main */}
      <main className="flex-1">
        <Outlet />
      </main>

      {/* Footer */}
      <footer className="border-t border-gray-100 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div>
              <h3 className="font-bold text-brand text-lg">{brandName()}</h3>
              {brandTagline() && <p className="mt-2 text-sm text-gray-600">{brandTagline()}</p>}
            </div>
            <div>
              <h4 className="font-semibold text-sm text-gray-900 mb-3">Shop</h4>
              <ul className="space-y-2 text-sm text-gray-600">
                <li><Link to="/" className="hover:text-brand">All Products</Link></li>
                <li><Link to="/collections/new-arrivals" className="hover:text-brand">New Arrivals</Link></li>
                <li><Link to="/order-lookup" className="hover:text-brand">Track Order</Link></li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold text-sm text-gray-900 mb-3">Info</h4>
              <ul className="space-y-2 text-sm text-gray-600">
                <li><a href="#" className="hover:text-brand">Shipping & Returns</a></li>
                <li><a href="#" className="hover:text-brand">Contact</a></li>
              </ul>
            </div>
          </div>
          <div className="mt-8 pt-8 border-t border-gray-200 text-center text-xs text-gray-400">
            &copy; {new Date().getFullYear()} {brandName()}. All rights reserved.
          </div>
        </div>
      </footer>

      {/* Floating cart bar — mobile only */}
      {count > 0 && !isCheckout && (
        <div className="fixed bottom-0 left-0 right-0 z-50 p-3 bg-white/90 backdrop-blur border-t border-gray-200 md:hidden">
          <Link
            to="/cart"
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
    </div>
  );
}
