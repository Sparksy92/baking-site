'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { Trash2, Plus, Minus, ShoppingBag, ArrowRight, PackageCheck } from 'lucide-react';
import { useCart } from '@/lib/cart';
import { formatCents } from '@/lib/format';
import { api, type PublicSettings } from '@/lib/api';
import { RecentlyViewed } from '@/components/RecentlyViewed';
import { addToast } from '@/lib/toast';

export default function CartPage() {
  const { items, subtotal, updateQuantity, removeItem } = useCart();
  const [settings, setSettings] = useState<PublicSettings | null>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    api.get<PublicSettings>('/api/settings/public')
      .then(setSettings)
      .catch((err) => console.error('Failed to load settings:', err));
  }, []);

  if (!mounted) {
    return (
      <div className="min-h-[65vh] bg-cream flex items-center justify-center">
        <div className="animate-pulse flex flex-col items-center">
          <div className="w-12 h-12 bg-sand rounded-full mb-4"></div>
          <div className="h-6 bg-sand rounded-2xl w-48 mb-2"></div>
        </div>
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="min-h-[65vh] bg-cream flex items-center justify-center">
        <div className="max-w-2xl mx-auto px-6 py-16 text-center">
          <div className="inline-flex items-center justify-center w-20 h-20 bg-warm border border-sand/60 rounded-full mb-6">
            <ShoppingBag className="w-10 h-10 text-muted-earth/65" />
          </div>
          <h1 className="text-3xl font-black text-earth mb-4 tracking-tight">Your cart is empty</h1>
          <p className="text-muted-earth mb-8 max-w-sm mx-auto text-base leading-relaxed">
            Discover our fresh weekly artisan sourdoughs, buns, and organic pantry items.
          </p>
          <Link href="/shop" className="btn-primary inline-flex items-center gap-2 px-8 py-4 rounded-xl font-bold">
            Browse the Menu <ArrowRight size={18} />
          </Link>
        </div>
      </div>
    );
  }

  // Delivery configuration from settings or fallbacks
  const freeThreshold = settings?.shipping_free_threshold_cents ?? 3000; // default $30
  const deliveryFee = settings?.shipping_flat_rate_cents ?? 500; // default $5
  
  const progressToFree = Math.min((subtotal / freeThreshold) * 100, 100);
  const remainingForFree = Math.max(freeThreshold - subtotal, 0);
  const taxRate = settings?.tax_rate ?? 0.13;
  const tax = Math.round(subtotal * taxRate);

  return (
    <div className="min-h-screen bg-cream">
      <div className="max-w-5xl mx-auto px-4 py-12 sm:py-16">
        <div className="flex items-center justify-between mb-8 border-b border-sand/50 pb-4">
          <h1 className="text-3xl sm:text-4xl font-black text-earth tracking-tight">Your Cart</h1>
          <span className="bg-warm border border-sand/80 text-muted-earth py-1 px-3 rounded-full text-sm font-bold">
            {items.length} {items.length === 1 ? 'item' : 'items'}
          </span>
        </div>

        <div className="flex flex-col lg:flex-row gap-10">
          {/* Cart Items List */}
          <div className="flex-1 space-y-4 sm:space-y-6">
            {items.map((item) => (
              <div 
                key={item.variantId} 
                className="group flex flex-col sm:flex-row gap-4 sm:gap-6 p-4 sm:p-5 bg-white border border-sand/50 rounded-2xl hover:shadow-earth-sm transition-all duration-300"
              >
                {item.imageUrl ? (
                  <div className="relative w-full sm:w-28 h-28 sm:h-28 rounded-xl overflow-hidden bg-warm flex-shrink-0 border border-sand/30">
                    <Image src={item.imageUrl} alt={item.productName} fill className="object-cover group-hover:scale-102 transition-transform duration-500" />
                  </div>
                ) : (
                  <div className="w-full sm:w-28 h-28 sm:h-28 rounded-xl bg-warm border border-sand/30 flex items-center justify-center text-muted-earth/30 flex-shrink-0 text-3xl">
                    🍞
                  </div>
                )}
                <div className="flex-1 flex flex-col justify-between min-w-0">
                  <div className="flex justify-between items-start gap-4">
                    <div>
                      <span className="font-bold text-earth text-base sm:text-lg line-clamp-1">{item.productName}</span>
                      <p className="text-sm text-muted-earth mt-1 capitalize">
                        {item.variantSize !== 'Standard' || item.variantColor !== 'Default' 
                          ? `${item.variantSize} / ${item.variantColor}`
                          : 'Standard Option'
                        }
                      </p>
                    </div>
                    <p className="font-bold text-earth whitespace-nowrap">{formatCents(item.unitPriceCents)}</p>
                  </div>
                  
                  <div className="flex items-center justify-between mt-4 sm:mt-0">
                    <div className="flex items-center gap-1 bg-cream border border-sand/80 rounded-lg p-1">
                      <button 
                        onClick={() => {
                          updateQuantity(item.variantId, item.quantity - 1);
                          addToast('Updated item quantity', 'info');
                        }} 
                        disabled={item.quantity <= 1} 
                        className="w-8 h-8 flex items-center justify-center text-muted-earth/60 hover:text-earth hover:bg-warm rounded-md transition-all disabled:opacity-40"
                      >
                        <Minus size={14} strokeWidth={2.5} />
                      </button>
                      <span className="w-8 text-center text-sm font-bold text-earth">{item.quantity}</span>
                      <button 
                        onClick={() => {
                          updateQuantity(item.variantId, item.quantity + 1);
                          addToast('Updated item quantity', 'info');
                        }} 
                        className="w-8 h-8 flex items-center justify-center text-muted-earth/60 hover:text-earth hover:bg-warm rounded-md transition-all"
                      >
                        <Plus size={14} strokeWidth={2.5} />
                      </button>
                    </div>
                    
                    <button 
                      onClick={() => {
                        removeItem(item.variantId);
                        addToast(`Removed ${item.productName} from cart.`, 'info');
                      }} 
                      className="flex items-center justify-center p-2 text-muted-earth/40 hover:text-terracotta hover:bg-terracotta/10 rounded-lg transition-colors" 
                      aria-label="Remove item"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Order Summary */}
          <div className="lg:w-96 flex-shrink-0">
            <div className="bg-white border border-sand/50 shadow-earth-sm rounded-3xl p-6 sm:p-8 sticky top-24">
              <h2 className="text-xl font-bold text-earth mb-6">Order Request Summary</h2>

              {/* Delivery Progress Bar */}
              <div className="mb-8">
                {subtotal >= freeThreshold ? (
                  <div className="flex items-center justify-center gap-2 p-3 bg-brand/10 border border-brand/20 text-brand font-semibold rounded-xl text-xs">
                    <PackageCheck className="text-brand shrink-0" size={16} />
                    Free delivery unlocked!
                  </div>
                ) : (
                  <>
                    <div className="flex justify-between text-xs font-semibold text-muted-earth mb-2">
                      <span>{formatCents(remainingForFree)} more for free delivery</span>
                      <span>{Math.round(progressToFree)}%</span>
                    </div>
                    <div className="h-2 bg-sand/35 rounded-full overflow-hidden">
                      <div 
                        className="h-full bg-brand rounded-full transition-all duration-1000 ease-out" 
                        style={{ width: `${progressToFree}%` }}
                      />
                    </div>
                  </>
                )}
              </div>

              <div className="space-y-4 mb-6 text-sm">
                <div className="flex justify-between text-muted-earth"><span className="font-semibold">Subtotal</span><span className="text-earth font-bold">{formatCents(subtotal)}</span></div>
                <div className="flex justify-between text-muted-earth">
                  <span className="font-semibold">Local Delivery</span>
                  <span className="text-earth font-bold">
                    {subtotal >= freeThreshold ? 'Free' : `${formatCents(deliveryFee)} (or Free Pickup)`}
                  </span>
                </div>
                {tax > 0 && <div className="flex justify-between text-muted-earth"><span className="font-semibold">Estimated Tax ({Math.round(taxRate * 100)}%)</span><span className="text-earth font-bold">{formatCents(tax)}</span></div>}
              </div>

              <div className="pt-6 border-t border-sand/50 mb-8">
                <div className="flex justify-between items-end">
                  <span className="text-earth font-bold text-base">Estimated Total</span>
                  <span className="text-2xl font-black tracking-tight text-earth">{formatCents(subtotal + tax)}</span>
                </div>
                <p className="text-[10px] text-muted-earth/65 mt-1">
                  Delivery options and pricing are finalized in your checkout request.
                </p>
              </div>

              <Link 
                href="/checkout" 
                className="btn-primary w-full py-4 rounded-xl font-bold text-base flex items-center justify-center gap-2 group relative overflow-hidden transition-all shadow-md active:scale-[0.98]"
              >
                Checkout Now <ArrowRight size={16} />
              </Link>
              
              <div className="text-center mt-4">
                <Link href="/shop" className="text-xs text-brand hover:text-earth font-bold transition-colors">
                  Continue Shopping
                </Link>
              </div>
            </div>
          </div>
        </div>
        
        <RecentlyViewed title="Recently Viewed" maxItems={4} />
      </div>
    </div>
  );
}
