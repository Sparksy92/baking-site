'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useCart } from '@/lib/cart';
import { api, type CheckoutResponse, type PublicSettings } from '@/lib/api';
import { formatCents } from '@/lib/format';

export default function CheckoutPage() {
  const { items, subtotal, clear } = useCart();
  const router = useRouter();
  const [settings, setSettings] = useState<PublicSettings | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [line1, setLine1] = useState('');
  const [line2, setLine2] = useState('');
  const [city, setCity] = useState('');
  const [province, setProvince] = useState('');
  const [postal, setPostal] = useState('');
  const [notes, setNotes] = useState('');
  const [promoCode, setPromoCode] = useState('');
  const [promoApplied, setPromoApplied] = useState<{ code: string; discount_type: string; discount_value: number } | null>(null);
  const [promoError, setPromoError] = useState('');
  const [promoLoading, setPromoLoading] = useState(false);

  useEffect(() => {
    api.get<PublicSettings>('/api/settings/public').then(setSettings).catch(() => {});
  }, []);

  useEffect(() => {
    if (items.length === 0 && !loading) router.push('/');
  }, [items.length, router, loading]);

  if (!settings) return null;

  const freeThreshold = settings.shipping_free_threshold_cents;
  const shippingCost = subtotal >= freeThreshold ? 0 : settings.shipping_flat_rate_cents;

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
      });
      clear();
      window.location.href = resp.stripe_checkout_url;
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setLoading(false);
    }
  }

  const inputClass = "w-full px-4 py-3 rounded-lg border border-gray-200 focus:border-brand focus:ring-0 outline-none text-sm";

  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Checkout</h1>
      <form onSubmit={handleSubmit} className="space-y-6">
        <section>
          <h2 className="text-sm font-semibold text-gray-900 mb-3">Contact</h2>
          <div className="space-y-3">
            <input type="text" placeholder="Full name" value={name} onChange={(e) => setName(e.target.value)} required className={inputClass} />
            <input type="email" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} required className={inputClass} />
            <input type="tel" placeholder="Phone (optional)" value={phone} onChange={(e) => setPhone(e.target.value)} className={inputClass} />
          </div>
        </section>
        <section>
          <h2 className="text-sm font-semibold text-gray-900 mb-3">Shipping Address</h2>
          <div className="space-y-3">
            <input type="text" placeholder="Address" value={line1} onChange={(e) => setLine1(e.target.value)} required className={inputClass} />
            <input type="text" placeholder="Apt / Suite (optional)" value={line2} onChange={(e) => setLine2(e.target.value)} className={inputClass} />
            <div className="grid grid-cols-2 gap-3">
              <input type="text" placeholder="City" value={city} onChange={(e) => setCity(e.target.value)} required className={inputClass} />
              <input type="text" placeholder="Province" value={province} onChange={(e) => setProvince(e.target.value)} required className={inputClass} />
            </div>
            <input type="text" placeholder="Postal code" value={postal} onChange={(e) => setPostal(e.target.value)} required className={inputClass} />
          </div>
        </section>
        <section>
          <h2 className="text-sm font-semibold text-gray-900 mb-3">Promo Code</h2>
          <div className="flex gap-2">
            <input type="text" placeholder="Enter code" value={promoCode} onChange={(e) => setPromoCode(e.target.value)} className={`${inputClass} flex-1`} disabled={!!promoApplied} />
            {promoApplied ? (
              <button type="button" onClick={() => { setPromoApplied(null); setPromoCode(''); }} className="px-4 py-2 text-sm text-red-600 border border-red-200 rounded-lg hover:bg-red-50">Remove</button>
            ) : (
              <button type="button" onClick={applyPromo} disabled={promoLoading} className="px-4 py-2 text-sm font-medium bg-gray-100 rounded-lg hover:bg-gray-200 disabled:opacity-50">{promoLoading ? '...' : 'Apply'}</button>
            )}
          </div>
          {promoError && <p className="mt-1 text-xs text-red-600">{promoError}</p>}
          {promoApplied && <p className="mt-1 text-xs text-green-700 font-medium">Code &quot;{promoApplied.code}&quot; applied — {promoApplied.discount_type === 'percent' ? `${promoApplied.discount_value}% off` : `${formatCents(promoApplied.discount_value)} off`}</p>}
        </section>
        <section>
          <h2 className="text-sm font-semibold text-gray-900 mb-3">Order Notes (optional)</h2>
          <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} maxLength={500} className={`${inputClass} resize-none`} />
        </section>
        <section className="bg-gray-50 rounded-xl p-5 space-y-2">
          <div className="flex justify-between text-sm"><span>Subtotal</span><span>{formatCents(subtotal)}</span></div>
          {discount > 0 && <div className="flex justify-between text-sm text-green-700"><span>Discount</span><span>-{formatCents(discount)}</span></div>}
          <div className="flex justify-between text-sm"><span>Shipping</span><span>{shippingCost === 0 ? 'Free' : formatCents(shippingCost)}</span></div>
          <div className="flex justify-between text-sm"><span>Tax (HST)</span><span>{formatCents(tax)}</span></div>
          <div className="flex justify-between font-bold text-base pt-2 border-t border-gray-200"><span>Total</span><span>{formatCents(total)}</span></div>
        </section>
        {error && <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg p-3">{error}</div>}
        <button type="submit" disabled={loading} className="w-full py-4 bg-brand text-white font-bold rounded-xl hover:bg-brand/90 active:scale-[0.98] transition-all disabled:opacity-50">
          {loading ? 'Processing...' : `Pay ${formatCents(total)}`}
        </button>
      </form>
    </div>
  );
}
