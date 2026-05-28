import { Link } from 'react-router-dom';
import { Trash2, Plus, Minus } from 'lucide-react';
import { useCart } from '../lib/cart';
import { formatCents } from '../lib/format';
import { api, type PublicSettings } from '../lib/api';
import { useEffect, useState } from 'react';

export default function Cart() {
  const { items, subtotal, updateQuantity, removeItem } = useCart();
  const [settings, setSettings] = useState<PublicSettings | null>(null);

  useEffect(() => {
    api.get<PublicSettings>('/api/settings/public').then(setSettings).catch(() => {});
  }, []);

  if (items.length === 0) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-16 text-center">
        <h1 className="text-2xl font-bold text-gray-900 mb-4">Your cart is empty</h1>
        <p className="text-gray-600 mb-8">Browse our collection and add something you love.</p>
        <Link to="/" className="inline-block bg-brand text-white px-6 py-3 rounded-lg font-medium hover:bg-brand/90">
          Continue Shopping
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
    <div className="max-w-2xl mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Cart</h1>

      {/* Free shipping progress */}
      {shippingCost > 0 && (
        <div className="mb-6 p-4 bg-gray-50 rounded-xl">
          <p className="text-sm text-gray-600">
            {formatCents(remainingForFree)} away from free shipping
          </p>
          <div className="mt-2 h-2 bg-gray-200 rounded-full overflow-hidden">
            <div className="h-full bg-accent rounded-full transition-all" style={{ width: `${progressToFree}%` }} />
          </div>
        </div>
      )}
      {shippingCost === 0 && (
        <div className="mb-6 p-3 bg-green-50 text-green-700 text-sm font-medium rounded-lg text-center">
          You qualify for free shipping!
        </div>
      )}

      {/* Items */}
      <div className="space-y-4">
        {items.map((item) => (
          <div key={item.variantId} className="flex gap-4 p-4 bg-white border border-gray-100 rounded-xl">
            {item.imageUrl && (
              <img src={item.imageUrl} alt="" className="w-20 h-20 object-cover rounded-lg flex-shrink-0" />
            )}
            <div className="flex-1 min-w-0">
              <h3 className="font-medium text-gray-900 text-sm truncate">{item.productName}</h3>
              <p className="text-xs text-gray-500 mt-0.5">{item.variantSize} / {item.variantColor}</p>
              <p className="font-bold text-sm mt-1">{formatCents(item.unitPriceCents)}</p>
            </div>
            <div className="flex flex-col items-end justify-between">
              <button
                onClick={() => removeItem(item.variantId)}
                className="text-gray-400 hover:text-red-500 transition-colors"
                aria-label="Remove"
              >
                <Trash2 size={16} />
              </button>
              <div className="flex items-center gap-2 border border-gray-200 rounded-lg">
                <button
                  onClick={() => updateQuantity(item.variantId, item.quantity - 1)}
                  className="w-8 h-8 flex items-center justify-center text-gray-600 hover:text-brand"
                >
                  <Minus size={14} />
                </button>
                <span className="text-sm font-medium w-4 text-center">{item.quantity}</span>
                <button
                  onClick={() => updateQuantity(item.variantId, item.quantity + 1)}
                  className="w-8 h-8 flex items-center justify-center text-gray-600 hover:text-brand"
                >
                  <Plus size={14} />
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Totals */}
      <div className="mt-8 border-t border-gray-200 pt-6 space-y-3">
        <div className="flex justify-between text-sm text-gray-600">
          <span>Subtotal</span>
          <span className="font-medium">{formatCents(subtotal)}</span>
        </div>
        <div className="flex justify-between text-sm text-gray-600">
          <span>Shipping</span>
          <span className="font-medium">{shippingCost === 0 ? 'Free' : formatCents(shippingCost)}</span>
        </div>
        <div className="flex justify-between text-sm text-gray-600">
          <span>Tax (HST)</span>
          <span className="font-medium">{formatCents(tax)}</span>
        </div>
        <div className="flex justify-between text-lg font-bold text-gray-900 pt-3 border-t border-gray-200">
          <span>Total</span>
          <span>{formatCents(total)}</span>
        </div>
      </div>

      <Link
        to="/checkout"
        className="mt-6 block w-full text-center bg-brand text-white py-4 rounded-xl font-bold hover:bg-brand/90 active:scale-[0.98] transition-all"
      >
        Checkout — {formatCents(total)}
      </Link>
    </div>
  );
}
