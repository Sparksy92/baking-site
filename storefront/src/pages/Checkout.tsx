import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useCart } from '../lib/cart';
import { api, type CheckoutResponse, type PublicSettings } from '../lib/api';
import { formatCents } from '../lib/format';

export default function Checkout() {
  const { items, subtotal, clear } = useCart();
  const navigate = useNavigate();
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

  useEffect(() => {
    api.get<PublicSettings>('/api/settings/public').then(setSettings).catch(() => {});
  }, []);

  useEffect(() => {
    if (items.length === 0 && !loading) navigate('/');
  }, [items.length, navigate, loading]);

  if (!settings) return null;

  const freeThreshold = settings.shipping_free_threshold_cents;
  const shippingCost = subtotal >= freeThreshold ? 0 : settings.shipping_flat_rate_cents;
  const tax = Math.round(subtotal * settings.tax_rate);
  const total = subtotal + shippingCost + tax;

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
        {/* Contact */}
        <section>
          <h2 className="text-sm font-semibold text-gray-900 mb-3">Contact</h2>
          <div className="space-y-3">
            <input type="text" placeholder="Full name" value={name} onChange={(e) => setName(e.target.value)} required className={inputClass} />
            <input type="email" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} required className={inputClass} />
            <input type="tel" placeholder="Phone (optional)" value={phone} onChange={(e) => setPhone(e.target.value)} className={inputClass} />
          </div>
        </section>

        {/* Shipping */}
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

        {/* Notes */}
        <section>
          <h2 className="text-sm font-semibold text-gray-900 mb-3">Order Notes (optional)</h2>
          <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} maxLength={500} className={`${inputClass} resize-none`} />
        </section>

        {/* Summary */}
        <section className="bg-gray-50 rounded-xl p-5 space-y-2">
          <div className="flex justify-between text-sm"><span>Subtotal</span><span>{formatCents(subtotal)}</span></div>
          <div className="flex justify-between text-sm"><span>Shipping</span><span>{shippingCost === 0 ? 'Free' : formatCents(shippingCost)}</span></div>
          <div className="flex justify-between text-sm"><span>Tax (HST)</span><span>{formatCents(tax)}</span></div>
          <div className="flex justify-between font-bold text-base pt-2 border-t border-gray-200"><span>Total</span><span>{formatCents(total)}</span></div>
        </section>

        {error && (
          <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg p-3">{error}</div>
        )}

        <button
          type="submit"
          disabled={loading}
          className="w-full py-4 bg-brand text-white font-bold rounded-xl hover:bg-brand/90 active:scale-[0.98] transition-all disabled:opacity-50"
        >
          {loading ? 'Processing...' : `Pay ${formatCents(total)}`}
        </button>
      </form>
    </div>
  );
}
