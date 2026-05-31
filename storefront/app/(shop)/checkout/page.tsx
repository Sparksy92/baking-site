'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { useCart } from '@/lib/cart';
import { useCustomer } from '@/lib/customer';
import { api, type CheckoutResponse, type PublicSettings, type CustomerAddress } from '@/lib/api';
import { formatCents } from '@/lib/format';
import { AlertCircle, CheckCircle2, Loader2, Lock, Tag } from 'lucide-react';

export default function CheckoutPage() {
  const { items, subtotal } = useCart();
  const { customer } = useCustomer();
  const router = useRouter();
  const [settings, setSettings] = useState<PublicSettings | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [savedAddresses, setSavedAddresses] = useState<CustomerAddress[]>([]);

  // Form State
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [line1, setLine1] = useState('');
  const [line2, setLine2] = useState('');
  const [city, setCity] = useState('');
  const [province, setProvince] = useState('');
  const [postal, setPostal] = useState('');
  const [notes, setNotes] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<'stripe' | 'etransfer'>('stripe');
  
  // Promo State
  const [promoCode, setPromoCode] = useState('');
  const [promoApplied, setPromoApplied] = useState<{ code: string; discount_type: string; discount_value: number } | null>(null);
  const [promoError, setPromoError] = useState('');
  const [promoLoading, setPromoLoading] = useState(false);

  // Shipping rate state
  const [shippingRates, setShippingRates] = useState<{ service_code: string; service_name: string; price_cents: number; expected_transit_days: number | null }[]>([]);
  const [shippingSource, setShippingSource] = useState<'flat_rate' | 'canadapost'>('flat_rate');
  const [shippingLoading, setShippingLoading] = useState(false);
  const [selectedShipping, setSelectedShipping] = useState<string>('');

  useEffect(() => {
    api.get<PublicSettings>('/api/settings/public').then(setSettings).catch(() => {});
  }, []);

  useEffect(() => {
    if (customer) {
      if (!name) setName(`${customer.first_name} ${customer.last_name}`);
      if (!email) setEmail(customer.email);
      if (!phone && customer.phone) setPhone(customer.phone);
      api.get<CustomerAddress[]>('/api/customers/me/addresses')
        .then((addrs) => {
          setSavedAddresses(addrs);
          const defaultAddr = addrs.find((a) => a.is_default) || addrs[0];
          if (defaultAddr && !line1) applyAddress(defaultAddr);
        })
        .catch(() => {});
    }
  }, [customer]); // eslint-disable-line react-hooks/exhaustive-deps

  function applyAddress(addr: CustomerAddress) {
    setLine1(addr.line1);
    setLine2(addr.line2 || '');
    setCity(addr.city);
    setProvince(addr.province);
    setPostal(addr.postal_code);
    if (addr.phone && !phone) setPhone(addr.phone);
  }

  useEffect(() => {
    const normalizedPostal = postal.replace(/\s/g, '');
    if (normalizedPostal.length >= 6) {
      setShippingLoading(true);
      api.get<{ rates: typeof shippingRates; source: string }>(
        `/api/shipping/rates?postal_code=${encodeURIComponent(normalizedPostal)}&subtotal_cents=${subtotal}`
      )
        .then((data) => {
          setShippingRates(data.rates);
          setShippingSource(data.source as 'flat_rate' | 'canadapost');
          if (data.rates.length > 0 && !selectedShipping) {
            setSelectedShipping(data.rates[0].service_code);
          }
        })
        .catch(() => {})
        .finally(() => setShippingLoading(false));
    }
  }, [postal, subtotal]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (items.length === 0 && !loading) router.push('/');
  }, [items.length, router, loading]);

  if (!settings) return null;

  const freeThreshold = settings.shipping_free_threshold_cents;
  const selectedRate = shippingRates.find((r) => r.service_code === selectedShipping);
  const shippingCost = subtotal >= freeThreshold ? 0 : (selectedRate?.price_cents ?? settings.shipping_flat_rate_cents);

  let discount = 0;
  if (promoApplied) {
    if (promoApplied.discount_type === 'percent') {
      discount = Math.round(subtotal * promoApplied.discount_value / 100);
    } else {
      discount = Math.min(promoApplied.discount_value, subtotal);
    }
  }
  const afterDiscount = subtotal - discount;
  const tax = Math.round(afterDiscount * settings.tax_rate);
  const total = afterDiscount + shippingCost + tax;

  async function applyPromo() {
    if (!promoCode.trim()) return;
    setPromoError('');
    setPromoLoading(true);
    try {
      const resp = await api.post<{ valid: boolean; code: string; discount_type?: string; discount_value?: number; message?: string }>(
        `/api/promos/validate?code=${encodeURIComponent(promoCode.trim())}&subtotal_cents=${subtotal}`,
        undefined
      );
      if (resp.valid && resp.discount_type && resp.discount_value !== undefined) {
        setPromoApplied({ code: resp.code, discount_type: resp.discount_type, discount_value: resp.discount_value });
      } else {
        setPromoError(resp.message || 'Invalid code');
        setPromoApplied(null);
      }
    } catch {
      setPromoError('Could not validate code');
    } finally {
      setPromoLoading(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const resp = await api.post<CheckoutResponse>('/api/checkout', {
        customer_name: name.trim(),
        customer_email: email.trim(),
        customer_phone: phone.trim() || null,
        shipping_address: {
          line1: line1.trim(),
          line2: line2.trim() || null,
          city: city.trim(),
          province: province.trim(),
          postal_code: postal.trim(),
          country: 'CA',
        },
        items: items.map((i) => ({ variant_id: i.variantId, quantity: i.quantity })),
        promo_code: promoApplied?.code || null,
        customer_notes: notes.trim() || null,
        payment_method: paymentMethod,
      });
      sessionStorage.setItem('pending_order', JSON.stringify({
        order_number: resp.order_number,
        email: email.trim(),
      }));
      if (resp.stripe_checkout_url) {
        window.location.href = resp.stripe_checkout_url;
      } else {
        router.push(`/confirmation/${resp.order_number}`);
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="bg-gray-50/50 min-h-screen pb-20">
      <div className="max-w-7xl mx-auto px-4 py-8 sm:py-12">
        <h1 className="text-3xl font-bold text-gray-900 mb-8 sm:mb-12 text-center lg:text-left">Checkout</h1>
        
        <div className="flex flex-col lg:flex-row-reverse gap-8 lg:gap-16">
          
          {/* Right Column: Order Summary (Shows first on mobile, or maybe below on mobile?) */}
          <div className="w-full lg:w-[420px] flex-shrink-0">
            <div className="bg-white rounded-2xl shadow-xl shadow-gray-200/40 border border-gray-100 overflow-hidden sticky top-8">
              
              <div className="p-6 bg-gray-50/80 border-b border-gray-100">
                <h2 className="text-lg font-bold text-gray-900 mb-4">Order Summary</h2>
                <div className="space-y-4 max-h-[300px] overflow-y-auto pr-2 custom-scrollbar">
                  {items.map((item) => (
                    <div key={item.variantId} className="flex gap-4 items-center">
                      <div className="relative w-16 h-16 rounded-xl overflow-hidden bg-white flex-shrink-0 border border-gray-200">
                        {item.imageUrl && (
                          <Image src={item.imageUrl} alt={item.productName} fill className="object-cover" />
                        )}
                        <span className="absolute -top-2 -right-2 bg-gray-500 text-white text-[10px] font-bold w-5 h-5 flex items-center justify-center rounded-full z-10">
                          {item.quantity}
                        </span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <h3 className="text-sm font-semibold text-gray-900 truncate">{item.productName}</h3>
                        <p className="text-xs text-gray-500 capitalize mt-0.5">{item.variantSize} / {item.variantColor}</p>
                      </div>
                      <div className="text-sm font-semibold text-gray-900">
                        {formatCents(item.unitPriceCents * item.quantity)}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Promo Code */}
              <div className="p-6 border-b border-gray-100">
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <Tag className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                    <input 
                      type="text" 
                      placeholder="Discount code" 
                      value={promoCode} 
                      onChange={(e) => setPromoCode(e.target.value)} 
                      disabled={!!promoApplied}
                      className="w-full pl-9 pr-4 py-2.5 rounded-lg border border-gray-200 focus:border-brand focus:ring-1 focus:ring-brand outline-none text-sm bg-gray-50 focus:bg-white transition-colors uppercase disabled:opacity-60"
                    />
                  </div>
                  {promoApplied ? (
                    <button type="button" onClick={() => { setPromoApplied(null); setPromoCode(''); }} className="px-4 py-2.5 text-sm font-medium text-red-600 bg-red-50 rounded-lg hover:bg-red-100 transition-colors">Remove</button>
                  ) : (
                    <button type="button" onClick={applyPromo} disabled={promoLoading || !promoCode.trim()} className="px-4 py-2.5 text-sm font-medium bg-gray-900 text-white rounded-lg hover:bg-gray-800 disabled:opacity-50 transition-colors">
                      {promoLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Apply'}
                    </button>
                  )}
                </div>
                {promoError && (
                  <p className="mt-2 text-sm text-red-600 flex items-center gap-1.5">
                    <AlertCircle size={14} /> {promoError}
                  </p>
                )}
                {promoApplied && (
                  <p className="mt-2 text-sm text-green-600 font-medium flex items-center gap-1.5">
                    <CheckCircle2 size={14} /> {promoApplied.code} applied
                  </p>
                )}
              </div>

              {/* Totals */}
              <div className="p-6 space-y-3 bg-white">
                <div className="flex justify-between text-sm text-gray-600"><span>Subtotal</span><span className="font-medium text-gray-900">{formatCents(subtotal)}</span></div>
                {discount > 0 && <div className="flex justify-between text-sm text-green-600 font-medium"><span>Discount</span><span>-{formatCents(discount)}</span></div>}
                
                <div className="flex justify-between text-sm text-gray-600">
                  <div className="flex flex-col">
                    <span>Shipping</span>
                    {shippingRates.length > 1 && subtotal < freeThreshold && (
                      <select
                        value={selectedShipping}
                        onChange={(e) => setSelectedShipping(e.target.value)}
                        className="mt-1 text-xs py-1 px-2 rounded-md border border-gray-200 bg-gray-50 outline-none focus:border-brand"
                      >
                        {shippingRates.map((r) => (
                          <option key={r.service_code} value={r.service_code}>
                            {r.service_name}
                          </option>
                        ))}
                      </select>
                    )}
                  </div>
                  <div className="text-right">
                    <span className="font-medium text-gray-900">
                      {shippingLoading ? <Loader2 className="w-4 h-4 animate-spin inline" /> : shippingCost === 0 ? 'Free' : formatCents(shippingCost)}
                    </span>
                    {selectedRate && shippingSource === 'canadapost' && selectedRate.expected_transit_days && (
                      <p className="text-xs text-gray-400 mt-0.5">{selectedRate.expected_transit_days} days</p>
                    )}
                  </div>
                </div>

                {tax > 0 && <div className="flex justify-between text-sm text-gray-600"><span>Estimated Tax</span><span className="font-medium text-gray-900">{formatCents(tax)}</span></div>}
                
                <div className="flex justify-between items-center pt-4 mt-4 border-t border-gray-100">
                  <span className="text-base font-bold text-gray-900">Total</span>
                  <span className="text-2xl font-black text-gray-900">{formatCents(total)}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Left Column: Form */}
          <div className="flex-1">
            <form onSubmit={handleSubmit} className="space-y-8">
              
              {/* Contact */}
              <section className="bg-white p-6 sm:p-8 rounded-2xl shadow-sm border border-gray-100">
                <h2 className="text-xl font-bold text-gray-900 mb-6">Contact Information</h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
                  <div className="col-span-full">
                    <label htmlFor="checkout-email" className="block text-sm font-semibold text-gray-700 mb-1.5">Email address</label>
                    <input id="checkout-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required 
                      className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-brand focus:ring-1 focus:ring-brand outline-none transition-all" 
                      placeholder="you@example.com" autoComplete="email" />
                  </div>
                  <div>
                    <label htmlFor="checkout-name" className="block text-sm font-semibold text-gray-700 mb-1.5">Full name</label>
                    <input id="checkout-name" type="text" value={name} onChange={(e) => setName(e.target.value)} required 
                      className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-brand focus:ring-1 focus:ring-brand outline-none transition-all" 
                      placeholder="Jane Doe" autoComplete="name" />
                  </div>
                  <div>
                    <label htmlFor="checkout-phone" className="block text-sm font-semibold text-gray-700 mb-1.5">Phone <span className="text-gray-400 font-normal">(optional)</span></label>
                    <input id="checkout-phone" type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} 
                      className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-brand focus:ring-1 focus:ring-brand outline-none transition-all" 
                      placeholder="(555) 555-5555" autoComplete="tel" />
                  </div>
                </div>
              </section>

              {/* Shipping Address */}
              <section className="bg-white p-6 sm:p-8 rounded-2xl shadow-sm border border-gray-100">
                <div className="flex justify-between items-end mb-6">
                  <h2 className="text-xl font-bold text-gray-900">Shipping Address</h2>
                  {savedAddresses.length > 0 && (
                    <select
                      onChange={(e) => {
                        const addr = savedAddresses.find((a) => a.id === Number(e.target.value));
                        if (addr) applyAddress(addr);
                      }}
                      className="text-sm border-none bg-gray-50 py-1.5 px-3 rounded-lg font-medium text-brand cursor-pointer outline-none focus:ring-2 focus:ring-brand/20"
                      defaultValue=""
                    >
                      <option value="" disabled>Use a saved address...</option>
                      {savedAddresses.map((addr) => (
                        <option key={addr.id} value={addr.id}>
                          {addr.label} — {addr.line1}
                        </option>
                      ))}
                    </select>
                  )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-6 gap-4 sm:gap-6">
                  <div className="col-span-full">
                    <label htmlFor="checkout-address" className="block text-sm font-semibold text-gray-700 mb-1.5">Address</label>
                    <input id="checkout-address" type="text" value={line1} onChange={(e) => setLine1(e.target.value)} required 
                      className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-brand focus:ring-1 focus:ring-brand outline-none transition-all" 
                      placeholder="123 Main St" autoComplete="address-line1" />
                  </div>
                  
                  <div className="col-span-full">
                    <label htmlFor="checkout-address2" className="block text-sm font-semibold text-gray-700 mb-1.5">Apartment, suite, etc. <span className="text-gray-400 font-normal">(optional)</span></label>
                    <input id="checkout-address2" type="text" value={line2} onChange={(e) => setLine2(e.target.value)} 
                      className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-brand focus:ring-1 focus:ring-brand outline-none transition-all" 
                      placeholder="Apt 4B" autoComplete="address-line2" />
                  </div>

                  <div className="col-span-full sm:col-span-2">
                    <label htmlFor="checkout-city" className="block text-sm font-semibold text-gray-700 mb-1.5">City</label>
                    <input id="checkout-city" type="text" value={city} onChange={(e) => setCity(e.target.value)} required 
                      className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-brand focus:ring-1 focus:ring-brand outline-none transition-all" 
                      placeholder="Toronto" autoComplete="address-level2" />
                  </div>
                  
                  <div className="col-span-full sm:col-span-2">
                    <label htmlFor="checkout-province" className="block text-sm font-semibold text-gray-700 mb-1.5">Province</label>
                    <select id="checkout-province" value={province} onChange={(e) => setProvince(e.target.value)} required 
                      className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-brand focus:ring-1 focus:ring-brand outline-none transition-all bg-white" 
                      autoComplete="address-level1">
                      <option value="" disabled>Select province</option>
                      <option value="AB">Alberta</option>
                      <option value="BC">British Columbia</option>
                      <option value="MB">Manitoba</option>
                      <option value="NB">New Brunswick</option>
                      <option value="NL">Newfoundland and Labrador</option>
                      <option value="NS">Nova Scotia</option>
                      <option value="NT">Northwest Territories</option>
                      <option value="NU">Nunavut</option>
                      <option value="ON">Ontario</option>
                      <option value="PE">Prince Edward Island</option>
                      <option value="QC">Quebec</option>
                      <option value="SK">Saskatchewan</option>
                      <option value="YT">Yukon</option>
                    </select>
                  </div>

                  <div className="col-span-full sm:col-span-2">
                    <label htmlFor="checkout-postal" className="block text-sm font-semibold text-gray-700 mb-1.5">Postal code</label>
                    <input id="checkout-postal" type="text" value={postal} onChange={(e) => setPostal(e.target.value)} required 
                      className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-brand focus:ring-1 focus:ring-brand outline-none transition-all uppercase" 
                      placeholder="M5V 2H1" autoComplete="postal-code" />
                  </div>
                </div>
              </section>

              {/* Order Notes */}
              <section className="bg-white p-6 sm:p-8 rounded-2xl shadow-sm border border-gray-100">
                <h2 className="text-xl font-bold text-gray-900 mb-4">Order Notes <span className="text-sm font-normal text-gray-400">(optional)</span></h2>
                <textarea 
                  value={notes} 
                  onChange={(e) => setNotes(e.target.value)} 
                  rows={3} 
                  maxLength={500} 
                  placeholder="Special instructions for delivery or order preparation..."
                  className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-brand focus:ring-1 focus:ring-brand outline-none transition-all resize-none text-sm" 
                />
              </section>

              {/* Payment Method */}
              <section className="bg-white p-6 sm:p-8 rounded-2xl shadow-sm border border-gray-100">
                <h2 className="text-xl font-bold text-gray-900 mb-6">Payment Method</h2>
                <div className="space-y-3">
                  <label className={`flex items-center gap-3 p-4 border rounded-xl cursor-pointer transition-colors ${paymentMethod === 'stripe' ? 'border-brand bg-brand/5' : 'border-gray-200 hover:border-gray-300'}`}>
                    <input 
                      type="radio" 
                      name="payment_method" 
                      value="stripe" 
                      checked={paymentMethod === 'stripe'} 
                      onChange={() => setPaymentMethod('stripe')}
                      className="text-brand focus:ring-brand w-4 h-4 cursor-pointer"
                    />
                    <span className="font-medium text-gray-900">Credit Card</span>
                  </label>
                  <label className={`flex items-center gap-3 p-4 border rounded-xl cursor-pointer transition-colors ${paymentMethod === 'etransfer' ? 'border-brand bg-brand/5' : 'border-gray-200 hover:border-gray-300'}`}>
                    <input 
                      type="radio" 
                      name="payment_method" 
                      value="etransfer" 
                      checked={paymentMethod === 'etransfer'} 
                      onChange={() => setPaymentMethod('etransfer')}
                      className="text-brand focus:ring-brand w-4 h-4 cursor-pointer"
                    />
                    <div>
                      <span className="font-medium text-gray-900 block">Interac e-Transfer</span>
                      <span className="text-sm text-gray-500">Send an e-Transfer manually through your online banking.</span>
                    </div>
                  </label>
                </div>
              </section>

              {error && (
                <div className="p-4 bg-red-50 border border-red-200 text-red-700 rounded-xl flex items-start gap-3">
                  <AlertCircle className="shrink-0 mt-0.5" size={18} />
                  <p className="text-sm font-medium">{error}</p>
                </div>
              )}

              <button 
                type="submit" 
                disabled={loading} 
                className="w-full py-5 bg-brand text-white font-bold text-lg rounded-2xl hover:bg-brand/90 active:scale-[0.98] transition-all shadow-xl shadow-brand/20 flex items-center justify-center gap-2 group relative overflow-hidden"
              >
                <div className="absolute inset-0 bg-white/20 group-hover:translate-x-full transition-transform duration-500 -translate-x-full"></div>
                {loading ? (
                  <>
                    <Loader2 className="animate-spin" size={20} />
                    Processing Securely...
                  </>
                ) : (
                  <>
                    <Lock size={18} className="text-white" />
                    {paymentMethod === 'stripe' ? `Pay ${formatCents(total)}` : `Place Order ${formatCents(total)}`}
                  </>
                )}
              </button>

            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
