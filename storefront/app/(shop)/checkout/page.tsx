'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { useCart } from '@/lib/cart';
import { api, type PublicSettings } from '@/lib/api';
import { formatCents } from '@/lib/format';
import { AlertCircle, Loader2, Lock, ArrowLeft, ShoppingBag } from 'lucide-react';
import Link from 'next/link';
import { addToast } from '@/lib/toast';

interface OrderRequestResponse {
  order_number: string;
  id: number;
}

export default function CheckoutPage() {
  const { items, subtotal, clear } = useCart();
  const router = useRouter();
  const [settings, setSettings] = useState<PublicSettings | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [mounted, setMounted] = useState(false);

  // Form State
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [contactMethod, setContactMethod] = useState('email');
  const [date, setDate] = useState('');
  const [pickupOrDelivery, setPickupOrDelivery] = useState('pickup');
  const [allergyNotes, setAllergyNotes] = useState('');
  const [specialInstructions, setSpecialInstructions] = useState('');

  useEffect(() => {
    setMounted(true);
    api.get<PublicSettings>('/api/settings/public')
      .then(setSettings)
      .catch((err) => console.error('Failed to load settings:', err));
  }, []);

  useEffect(() => {
    if (mounted && items.length === 0 && !loading) {
      router.push('/shop');
    }
  }, [items.length, router, loading, mounted]);

  if (!mounted || !settings) {
    return (
      <div className="min-h-screen bg-cream flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-brand"></div>
      </div>
    );
  }

  const taxRate = settings.tax_rate ?? 0.13;
  const tax = Math.round(subtotal * taxRate);
  const deliveryFee = settings.shipping_flat_rate_cents ?? 500;
  const freeThreshold = settings.shipping_free_threshold_cents ?? 3000;
  
  const deliveryCost = pickupOrDelivery === 'delivery' && subtotal < freeThreshold ? deliveryFee : 0;
  const total = subtotal + deliveryCost + tax;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const payload = {
        customer_name: name.trim(),
        customer_email: email.trim(),
        customer_phone: phone.trim() || null,
        preferred_contact_method: contactMethod,
        requested_items: items.map((item) => ({
          productName: item.productName,
          variantSize: item.variantSize,
          variantColor: item.variantColor,
          quantity: item.quantity,
          unitPriceCents: item.unitPriceCents,
        })),
        desired_date: date || null,
        pickup_or_delivery: pickupOrDelivery,
        allergy_notes: allergyNotes.trim() || null,
        special_instructions: specialInstructions.trim() || null,
      };

      const resp = await api.post<OrderRequestResponse>('/api/order-requests', payload);
      
      const pendingData = JSON.stringify({
        order_number: resp.order_number,
        email: email.trim(),
      });
      sessionStorage.setItem('pending_order', pendingData);
      localStorage.setItem('pending_order', pendingData);
      
      clear();
      addToast('Order request submitted successfully!', 'success');
      router.push(`/confirmation/${resp.order_number}`);
    } catch (err: any) {
      console.error(err);
      setError(err?.message || 'Something went wrong. Please check your information and try again.');
    } finally {
      setLoading(false);
    }
  }

  const inputClass = "w-full border border-sand bg-[#FAF8F5] rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-brand focus:border-transparent transition-all text-earth";

  return (
    <div className="bg-cream min-h-screen pb-20">
      <meta name="robots" content="noindex, nofollow" />
      <div className="max-w-5xl mx-auto px-4 py-8 sm:py-12">
        <div className="mb-8">
          <Link href="/cart" className="inline-flex items-center gap-1.5 text-xs font-bold text-muted-earth hover:text-earth uppercase tracking-wider transition-colors">
            <ArrowLeft size={14} /> Back to Cart
          </Link>
          <h1 className="text-3xl sm:text-4xl font-black text-earth mt-3 tracking-tight">Request Checkout</h1>
        </div>

        <div className="flex flex-col lg:flex-row gap-10">
          
          {/* Form */}
          <div className="flex-1 space-y-8">
            <form onSubmit={handleSubmit} className="space-y-8">
              
              {/* Contact Info */}
              <section className="bg-white p-6 sm:p-8 rounded-3xl shadow-sm border border-sand/50 space-y-6">
                <h2 className="text-xl font-bold text-earth border-b border-sand/30 pb-2 font-serif">Contact Information</h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="col-span-full">
                    <label htmlFor="email" className="block text-xs font-bold uppercase tracking-wider text-earth mb-2">Email Address *</label>
                    <input id="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} className={inputClass} placeholder="you@example.com" />
                  </div>
                  <div>
                    <label htmlFor="name" className="block text-xs font-bold uppercase tracking-wider text-earth mb-2">Full Name *</label>
                    <input id="name" type="text" required value={name} onChange={(e) => setName(e.target.value)} className={inputClass} placeholder="Jane Doe" />
                  </div>
                  <div>
                    <label htmlFor="phone" className="block text-xs font-bold uppercase tracking-wider text-earth mb-2">Phone Number</label>
                    <input id="phone" type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} className={inputClass} placeholder="(555) 555-5555" />
                  </div>
                </div>
              </section>

              {/* Logistics */}
              <section className="bg-white p-6 sm:p-8 rounded-3xl shadow-sm border border-sand/50 space-y-6">
                <h2 className="text-xl font-bold text-earth border-b border-sand/30 pb-2 font-serif">Pickup & Delivery Preferences</h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label htmlFor="pickupOrDelivery" className="block text-xs font-bold uppercase tracking-wider text-earth mb-2">Service Style *</label>
                    <select id="pickupOrDelivery" value={pickupOrDelivery} onChange={(e) => setPickupOrDelivery(e.target.value)} className={`${inputClass} appearance-none bg-white`}>
                      <option value="pickup">Homestead Pickup (Free)</option>
                      <option value="delivery">Local Delivery</option>
                    </select>
                  </div>
                  <div>
                    <label htmlFor="contactMethod" className="block text-xs font-bold uppercase tracking-wider text-earth mb-2">Preferred Contact Method *</label>
                    <select id="contactMethod" value={contactMethod} onChange={(e) => setContactMethod(e.target.value)} className={`${inputClass} appearance-none bg-white`}>
                      <option value="email">Email</option>
                      <option value="phone">Phone Call</option>
                      <option value="text">SMS / Text Message</option>
                    </select>
                  </div>
                  <div className="col-span-full">
                    <label htmlFor="date" className="block text-xs font-bold uppercase tracking-wider text-earth mb-2">Desired Date Needed</label>
                    <input id="date" type="date" value={date} onChange={(e) => setDate(e.target.value)} className={inputClass} />
                    <span className="text-[10px] text-muted-earth block mt-1">
                      Weekend sourdough preorders close Wednesday evening.
                    </span>
                  </div>
                </div>
              </section>

              {/* Details */}
              <section className="bg-white p-6 sm:p-8 rounded-3xl shadow-sm border border-sand/50 space-y-6">
                <h2 className="text-xl font-bold text-earth border-b border-sand/30 pb-2 font-serif">Allergies & Notes</h2>
                <div>
                  <label htmlFor="allergies" className="block text-xs font-bold uppercase tracking-wider text-earth mb-2">Allergy Concerns / Dietary Restrictions</label>
                  <textarea id="allergies" rows={2} value={allergyNotes} onChange={(e) => setAllergyNotes(e.target.value)} className={`${inputClass} resize-none`} placeholder="Gluten-free preference, nut allergies, etc..." />
                </div>
                <div>
                  <label htmlFor="specialInstructions" className="block text-xs font-bold uppercase tracking-wider text-earth mb-2">Special Instructions / Request Notes</label>
                  <textarea id="specialInstructions" rows={3} value={specialInstructions} onChange={(e) => setSpecialInstructions(e.target.value)} className={`${inputClass} resize-none`} placeholder="Any specific customizations or delivery drop-off instructions..." />
                </div>
              </section>

              {error && (
                <div className="p-4 bg-rose-50 border border-rose-200 text-rose-700 rounded-2xl flex items-start gap-3">
                  <AlertCircle className="shrink-0 mt-0.5" size={18} />
                  <p className="text-sm font-medium">{error}</p>
                </div>
              )}

              <button 
                type="submit" 
                disabled={loading} 
                className="btn-primary w-full py-4 text-base font-bold rounded-2xl flex items-center justify-center gap-2 group relative overflow-hidden transition-all shadow-md active:scale-[0.98] disabled:opacity-60 cursor-pointer"
              >
                {loading ? (
                  <>
                    <Loader2 className="animate-spin" size={18} />
                    Submitting Request...
                  </>
                ) : (
                  <>
                    <Lock size={16} className="text-white" />
                    Submit Order Request ({formatCents(total)})
                  </>
                )}
              </button>

            </form>
          </div>

          {/* Sidebar */}
          <div className="w-full lg:w-[380px] flex-shrink-0">
            <div className="bg-white rounded-3xl shadow-earth-sm border border-sand/50 overflow-hidden sticky top-28">
              <div className="p-6 bg-warm border-b border-sand/50">
                <h2 className="text-lg font-bold text-earth mb-4 font-serif">Order Summary</h2>
                <div className="space-y-4 max-h-[300px] overflow-y-auto pr-2 custom-scrollbar">
                  {items.map((item) => (
                    <div key={item.variantId} className="flex gap-4 items-center">
                      <div className="relative w-12 h-12 rounded-xl overflow-hidden bg-cream flex-shrink-0 border border-sand/30">
                        {item.imageUrl ? (
                          <Image src={item.imageUrl} alt={item.productName} fill className="object-cover" />
                        ) : (
                          <div className="absolute inset-0 flex items-center justify-center text-xl bg-cream border border-sand/30">
                            🍞
                          </div>
                        )}
                        <span className="absolute -top-1.5 -right-1.5 bg-brand text-white text-[9px] font-bold w-4.5 h-4.5 flex items-center justify-center rounded-full z-10">
                          {item.quantity}
                        </span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <h3 className="text-xs font-bold text-earth truncate">{item.productName}</h3>
                        <p className="text-[10px] text-muted-earth capitalize mt-0.5">
                          {item.variantSize !== 'Standard' || item.variantColor !== 'Default'
                            ? `${item.variantSize} / ${item.variantColor}`
                            : 'Standard Option'
                          }
                        </p>
                      </div>
                      <div className="text-xs font-bold text-earth">
                        {formatCents(item.unitPriceCents * item.quantity)}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Totals */}
              <div className="p-6 space-y-3 bg-white text-xs">
                <div className="flex justify-between text-muted-earth"><span>Subtotal</span><span className="font-semibold text-earth">{formatCents(subtotal)}</span></div>
                
                {pickupOrDelivery === 'delivery' && (
                  <div className="flex justify-between text-muted-earth">
                    <span>Local Delivery Fee</span>
                    <span className="font-semibold text-earth">
                      {deliveryCost === 0 ? 'Free' : formatCents(deliveryFee)}
                    </span>
                  </div>
                )}
                
                {tax > 0 && <div className="flex justify-between text-muted-earth"><span>Estimated Tax</span><span className="font-semibold text-earth">{formatCents(tax)}</span></div>}
                
                <div className="flex justify-between items-center pt-4 mt-4 border-t border-sand/50 text-sm">
                  <span className="font-bold text-earth">Estimated Total</span>
                  <span className="text-xl font-black text-earth">{formatCents(total)}</span>
                </div>
              </div>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
