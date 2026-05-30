'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useCart } from '@/lib/cart';
import { useCustomer } from '@/lib/customer';
import { api, type CheckoutResponse, type PublicSettings, type CustomerAddress } from '@/lib/api';
import { formatCents } from '@/lib/format';

export default function CheckoutPage() {
  const { items, subtotal } = useCart();
  const { customer } = useCustomer();
  const router = useRouter();
  const [settings, setSettings] = useState<PublicSettings | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [savedAddresses, setSavedAddresses] = useState<CustomerAddress[]>([]);

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

  // Shipping rate state
  const [shippingRates, setShippingRates] = useState<{ service_code: string; service_name: string; price_cents: number; expected_transit_days: number | null }[]>([]);
  const [shippingSource, setShippingSource] = useState<'flat_rate' | 'canadapost'>('flat_rate');
  const [shippingLoading, setShippingLoading] = useState(false);
  const [selectedShipping, setSelectedShipping] = useState<string>('');

  useEffect(() => {
    api.get<PublicSettings>('/api/settings/public').then(setSettings).catch(() => {});
  }, []);

  // Pre-fill from customer account
  useEffect(() => {
    if (customer) {
      if (!name) setName(`${customer.first_name} ${customer.last_name}`);
      if (!email) setEmail(customer.email);
      if (!phone && customer.phone) setPhone(customer.phone);
      // Load saved addresses
      api.get<CustomerAddress[]>('/api/customers/me/addresses')
        .then((addrs) => {
          setSavedAddresses(addrs);
          // Auto-fill default address if shipping fields are empty
          const defaultAddr = addrs.find((a) => a.is_default) || addrs[0];
          if (defaultAddr && !line1) {
            applyAddress(defaultAddr);
          }
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

  // Fetch shipping rates when postal code changes
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
      });
      // Store order info for confirmation page — don't clear cart until payment confirmed
      sessionStorage.setItem('pending_order', JSON.stringify({
        order_number: resp.order_number,
        email: email.trim(),
      }));
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
            <div>
              <label htmlFor="checkout-name" className="sr-only">Full name</label>
              <input id="checkout-name" type="text" placeholder="Full name" value={name} onChange={(e) => setName(e.target.value)} required className={inputClass} autoComplete="name" />
            </div>
            <div>
              <label htmlFor="checkout-email" className="sr-only">Email</label>
              <input id="checkout-email" type="email" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} required className={inputClass} autoComplete="email" />
            </div>
            <div>
              <label htmlFor="checkout-phone" className="sr-only">Phone (optional)</label>
              <input id="checkout-phone" type="tel" placeholder="Phone (optional)" value={phone} onChange={(e) => setPhone(e.target.value)} className={inputClass} autoComplete="tel" />
            </div>
          </div>
        </section>
        <section>
          <h2 className="text-sm font-semibold text-gray-900 mb-3">Shipping Address</h2>
          {savedAddresses.length > 0 && (
            <div className="mb-3">
              <select
                onChange={(e) => {
                  const addr = savedAddresses.find((a) => a.id === Number(e.target.value));
                  if (addr) applyAddress(addr);
                }}
                className={`${inputClass} bg-white`}
                defaultValue=""
              >
                <option value="" disabled>Use a saved address...</option>
                {savedAddresses.map((addr) => (
                  <option key={addr.id} value={addr.id}>
                    {addr.label} — {addr.line1}, {addr.city} {addr.province}
                  </option>
                ))}
              </select>
            </div>
          )}
          <div className="space-y-3">
            <div>
              <label htmlFor="checkout-address" className="sr-only">Address</label>
              <input id="checkout-address" type="text" placeholder="Address" value={line1} onChange={(e) => setLine1(e.target.value)} required className={inputClass} autoComplete="address-line1" />
            </div>
            <div>
              <label htmlFor="checkout-address2" className="sr-only">Apt / Suite (optional)</label>
              <input id="checkout-address2" type="text" placeholder="Apt / Suite (optional)" value={line2} onChange={(e) => setLine2(e.target.value)} className={inputClass} autoComplete="address-line2" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label htmlFor="checkout-city" className="sr-only">City</label>
                <input id="checkout-city" type="text" placeholder="City" value={city} onChange={(e) => setCity(e.target.value)} required className={inputClass} autoComplete="address-level2" />
              </div>
              <div>
                <label htmlFor="checkout-province" className="sr-only">Province</label>
                <select id="checkout-province" value={province} onChange={(e) => setProvince(e.target.value)} required className={inputClass} autoComplete="address-level1">
                  <option value="" disabled>Province</option>
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
            </div>
            <div>
              <label htmlFor="checkout-postal" className="sr-only">Postal code</label>
              <input id="checkout-postal" type="text" placeholder="Postal code" value={postal} onChange={(e) => setPostal(e.target.value)} required className={inputClass} autoComplete="postal-code" />
            </div>
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
          <div className="flex justify-between text-sm">
            <span>Shipping{selectedRate && shippingSource === 'canadapost' && selectedRate.expected_transit_days ? ` (${selectedRate.expected_transit_days} days)` : ''}</span>
            <span>{shippingLoading ? '...' : shippingCost === 0 ? 'Free' : formatCents(shippingCost)}</span>
          </div>
          {shippingRates.length > 1 && subtotal < freeThreshold && (
            <div className="pt-1">
              <select
                value={selectedShipping}
                onChange={(e) => setSelectedShipping(e.target.value)}
                className="w-full text-xs px-2 py-1.5 rounded border border-gray-200 bg-white"
              >
                {shippingRates.map((r) => (
                  <option key={r.service_code} value={r.service_code}>
                    {r.service_name} — {formatCents(r.price_cents)}{r.expected_transit_days ? ` (${r.expected_transit_days} days)` : ''}
                  </option>
                ))}
              </select>
            </div>
          )}
          {tax > 0 && <div className="flex justify-between text-sm"><span>Tax</span><span>{formatCents(tax)}</span></div>}
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
