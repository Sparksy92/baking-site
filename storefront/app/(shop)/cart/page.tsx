'use client';

import Link from 'next/link';
import Image from 'next/image';
import { Trash2, Plus, Minus, ShoppingBag, ArrowRight, PackageCheck } from 'lucide-react';
import { useCart } from '@/lib/cart';
import { formatCents } from '@/lib/format';
import { api, type PublicSettings } from '@/lib/api';
import { useEffect, useState } from 'react';

export default function CartPage() {
  const { items, subtotal, updateQuantity, removeItem } = useCart();
  const [settings, setSettings] = useState<PublicSettings | null>(null);

  useEffect(() => {
    api.get<PublicSettings>('/api/settings/public').then(setSettings).catch(() => {});
  }, []);

  if (items.length === 0) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-24 text-center">
        <div className="inline-flex items-center justify-center w-24 h-24 bg-gray-50 rounded-full mb-6">
          <ShoppingBag className="w-12 h-12 text-gray-300" />
        </div>
        <h1 className="text-3xl font-bold text-gray-900 mb-4 tracking-tight">Your cart is empty</h1>
        <p className="text-gray-500 mb-8 max-w-sm mx-auto text-lg">Looks like you haven't added anything yet. Discover our latest collection.</p>
        <Link href="/" className="inline-flex items-center gap-2 bg-brand text-white px-8 py-4 rounded-xl font-bold hover:bg-brand/90 transition-all hover:-translate-y-1 hover:shadow-xl hover:shadow-brand/20 active:scale-[0.98]">
          Start Shopping <ArrowRight size={18} />
        </Link>
      </div>
    );
  }

  const freeShippingThreshold = settings?.shipping_free_threshold_cents ?? 15000;
  const shippingCost = subtotal >= freeShippingThreshold ? 0 : (settings?.shipping_flat_rate_cents ?? 1200);
  const progressToFree = Math.min((subtotal / freeShippingThreshold) * 100, 100);
  const remainingForFree = Math.max(freeShippingThreshold - subtotal, 0);
  const taxRate = settings?.tax_rate ?? 0.13;
  const tax = Math.round(subtotal * taxRate);
  const total = subtotal + shippingCost + tax;

  return (
    <div className="max-w-4xl mx-auto px-4 py-12 sm:py-16">
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-3xl sm:text-4xl font-bold text-gray-900 tracking-tight">Your Cart</h1>
        <span className="bg-gray-100 text-gray-600 py-1 px-3 rounded-full text-sm font-semibold">{items.length} {items.length === 1 ? 'item' : 'items'}</span>
      </div>

      <div className="flex flex-col lg:flex-row gap-12">
        {/* Cart Items List */}
        <div className="flex-1 space-y-4 sm:space-y-6">
          {items.map((item) => (
            <div key={item.variantId} className="group flex flex-col sm:flex-row gap-4 sm:gap-6 p-4 sm:p-5 bg-white border border-gray-100 rounded-2xl shadow-sm hover:shadow-md transition-all duration-300">
              {item.imageUrl && (
                <div className="relative w-full sm:w-28 h-28 sm:h-28 rounded-xl overflow-hidden bg-gray-50 flex-shrink-0">
                  <Image src={item.imageUrl} alt={item.productName} fill className="object-cover group-hover:scale-105 transition-transform duration-500" />
                </div>
              )}
              <div className="flex-1 flex flex-col justify-between min-w-0">
                <div className="flex justify-between items-start gap-4">
                  <div>
                    <span className="font-bold text-gray-900 text-base sm:text-lg transition-colors line-clamp-1">{item.productName}</span>
                    <p className="text-sm text-gray-500 mt-1 capitalize">{item.variantSize} / {item.variantColor}</p>
                  </div>
                  <p className="font-bold text-gray-900 whitespace-nowrap">{formatCents(item.unitPriceCents)}</p>
                </div>
                
                <div className="flex items-center justify-between mt-4 sm:mt-0">
                  <div className="flex items-center gap-1 bg-gray-50 border border-gray-200 rounded-lg p-1">
                    <button onClick={() => updateQuantity(item.variantId, item.quantity - 1)} disabled={item.quantity <= 1} className="w-8 h-8 flex items-center justify-center text-gray-500 hover:text-gray-900 hover:bg-white rounded-md transition-all disabled:opacity-50 disabled:hover:bg-transparent">
                      <Minus size={16} strokeWidth={2.5} />
                    </button>
                    <span className="w-8 text-center text-sm font-bold text-gray-900">{item.quantity}</span>
                    <button onClick={() => updateQuantity(item.variantId, item.quantity + 1)} className="w-8 h-8 flex items-center justify-center text-gray-500 hover:text-gray-900 hover:bg-white rounded-md transition-all">
                      <Plus size={16} strokeWidth={2.5} />
                    </button>
                  </div>
                  
                  <button onClick={() => removeItem(item.variantId)} className="flex items-center justify-center p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors" aria-label="Remove item">
                    <Trash2 size={18} />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Order Summary */}
        <div className="lg:w-96 flex-shrink-0">
          <div className="bg-white border border-gray-100 shadow-xl shadow-gray-200/50 rounded-3xl p-6 sm:p-8 sticky top-24">
            <h2 className="text-xl font-bold text-gray-900 mb-6">Order Summary</h2>

            {/* Free Shipping Progress */}
            <div className="mb-8">
              {shippingCost > 0 ? (
                <>
                  <div className="flex justify-between text-sm font-medium text-gray-600 mb-3">
                    <span>{formatCents(remainingForFree)} away from free shipping</span>
                  </div>
                  <div className="h-2.5 bg-gray-100 rounded-full overflow-hidden">
                    <div className="h-full bg-brand rounded-full transition-all duration-1000 ease-out relative" style={{ width: `${progressToFree}%` }}>
                      <div className="absolute inset-0 bg-white/20 animate-pulse"></div>
                    </div>
                  </div>
                </>
              ) : (
                <div className="flex items-center justify-center gap-2 p-4 bg-green-50/80 border border-green-100 text-green-700 font-semibold rounded-2xl">
                  <PackageCheck className="text-green-500" size={20} />
                  You qualify for free shipping!
                </div>
              )}
            </div>

            <div className="space-y-4 mb-6 text-sm">
              <div className="flex justify-between text-gray-500"><span className="font-medium">Subtotal</span><span className="text-gray-900 font-semibold">{formatCents(subtotal)}</span></div>
              <div className="flex justify-between text-gray-500"><span className="font-medium">Shipping</span><span className="text-gray-900 font-semibold">{shippingCost === 0 ? 'Free' : formatCents(shippingCost)}</span></div>
              {tax > 0 && <div className="flex justify-between text-gray-500"><span className="font-medium">Estimated Tax</span><span className="text-gray-900 font-semibold">{formatCents(tax)}</span></div>}
            </div>

            <div className="pt-6 border-t border-gray-100 mb-8">
              <div className="flex justify-between items-end">
                <span className="text-gray-900 font-bold">Total</span>
                <span className="text-3xl font-black tracking-tight text-gray-900">{formatCents(total)}</span>
              </div>
            </div>

            <Link href="/checkout" className="group relative flex items-center justify-center w-full bg-brand text-white py-4 rounded-xl font-bold text-lg hover:bg-brand/90 active:scale-[0.98] transition-all overflow-hidden shadow-lg shadow-brand/25">
              <div className="absolute inset-0 bg-white/20 group-hover:translate-x-full transition-transform duration-500 -translate-x-full"></div>
              Checkout Now
            </Link>
            
            <p className="text-center text-xs text-gray-400 mt-4 flex items-center justify-center gap-1">
               Secure encrypted checkout
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
