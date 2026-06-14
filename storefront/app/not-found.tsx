import Link from 'next/link';
import { Home, ShoppingBag, HelpCircle } from 'lucide-react';
import { brandName } from '@/lib/format';

export default function NotFound() {
  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center px-4 py-20 text-center">
      <div className="relative">
        <h1 className="text-[120px] sm:text-[180px] font-black text-gray-200 leading-none tracking-tighter select-none">
          404
        </h1>
        <div className="absolute inset-0 flex flex-col items-center justify-center pt-8">
          <h2 className="text-3xl sm:text-4xl font-bold text-gray-900 bg-white/60 backdrop-blur-sm px-4 py-2 rounded-2xl">
            Page not found
          </h2>
        </div>
      </div>
      
      <p className="mt-8 text-lg text-gray-600 max-w-md mx-auto">
        We can&apos;t seem to find the page you&apos;re looking for. It might have been removed, renamed, or temporarily unavailable.
      </p>

      <div className="mt-10 flex flex-col sm:flex-row items-center gap-4">
        <Link 
          href="/" 
          className="flex items-center gap-2 px-8 py-4 bg-brand text-white font-bold rounded-2xl hover:bg-brand/90 transition-all shadow-xl shadow-brand/20 active:scale-[0.98] w-full sm:w-auto justify-center"
        >
          <Home size={18} />
          Back to Home
        </Link>
        <Link 
          href="/shop" 
          className="flex items-center gap-2 px-8 py-4 bg-white text-gray-900 border border-gray-200 font-bold rounded-2xl hover:bg-gray-50 hover:border-gray-300 transition-all w-full sm:w-auto justify-center shadow-sm"
        >
          <ShoppingBag size={18} />
          Browse Menu
        </Link>
      </div>

      <div className="mt-16 flex items-center justify-center gap-2 text-sm text-gray-500">
        <HelpCircle size={16} />
        <span>Need help? <Link href="/contact" className="text-brand font-medium hover:underline">Contact our support team</Link>.</span>
      </div>
    </div>
  );
}
