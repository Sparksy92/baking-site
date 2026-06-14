'use client';

import { useState, useEffect } from 'react';
import { api, type PublicSettings } from '@/lib/api';
import { MapPin, Wallet, Calendar, AlertTriangle } from 'lucide-react';

export default function OrderInfoPage() {
  const [settings, setSettings] = useState<PublicSettings | null>(null);

  useEffect(() => {
    api.get<PublicSettings>('/api/settings/public')
      .then(setSettings)
      .catch(() => {});
  }, []);

  const pickup = settings?.pickup_instructions || 'Orders are prepared by request. Pickup or local delivery details will be confirmed after Kirstin reviews your order request.';
  const payment = settings?.payment_instructions || 'Payment details will be confirmed after your request is reviewed. E-transfer or pay-on-confirmation is preferred while the menu and availability are being finalized.';
  const preorder = settings?.preorder_instructions || 'Sourdough is available by preorder and is usually prepared on weekends. Please include your desired date and any special notes when submitting your request.';
  const allergy = settings?.allergy_disclaimer || 'Items are prepared in a home kitchen and may come into contact with common allergens including wheat, dairy, eggs, nuts, peanuts, soy, and other ingredients. If you have an allergy or dietary concern, include it in your order request before confirming your order.';

  return (
    <div className="bg-cream min-h-screen py-16">
      <div className="max-w-4xl mx-auto px-4">
        
        {/* Header */}
        <div className="text-center max-w-xl mx-auto mb-16">
          <h1 className="text-4xl font-black text-earth tracking-tight mb-2">Order Information</h1>
          <p className="text-muted-earth text-sm">
            Everything you need to know about placing order requests, sourdough preorders, payments, and pickup logistics.
          </p>
        </div>

        {/* Content grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-12">
          
          {/* Card 1: Preorder Info */}
          <div className="bg-white border border-sand/50 rounded-[2.5rem] p-8 shadow-sm flex flex-col gap-6">
            <div className="flex items-center gap-3.5">
              <div className="w-12 h-12 rounded-2xl bg-brand/10 text-brand flex items-center justify-center flex-shrink-0">
                <Calendar size={22} />
              </div>
              <h2 className="text-lg font-black text-earth tracking-tight">Preorder Cycles &amp; Scheduling</h2>
            </div>
            <p className="text-sm text-muted-earth leading-relaxed whitespace-pre-line flex-grow">
              {preorder}
            </p>
          </div>

          {/* Card 2: Pickup Logistics */}
          <div className="bg-white border border-sand/50 rounded-[2.5rem] p-8 shadow-sm flex flex-col gap-6">
            <div className="flex items-center gap-3.5">
              <div className="w-12 h-12 rounded-2xl bg-brand/10 text-brand flex items-center justify-center flex-shrink-0">
                <MapPin size={22} />
              </div>
              <h2 className="text-lg font-black text-earth tracking-tight">Pickup &amp; Delivery</h2>
            </div>
            <p className="text-sm text-muted-earth leading-relaxed whitespace-pre-line flex-grow">
              {pickup}
            </p>
          </div>

          {/* Card 3: Prepayments & Pricing */}
          <div className="bg-white border border-sand/50 rounded-[2.5rem] p-8 shadow-sm flex flex-col gap-6">
            <div className="flex items-center gap-3.5">
              <div className="w-12 h-12 rounded-2xl bg-brand/10 text-brand flex items-center justify-center flex-shrink-0">
                <Wallet size={22} />
              </div>
              <h2 className="text-lg font-black text-earth tracking-tight">Payment Instructions</h2>
            </div>
            <p className="text-sm text-muted-earth leading-relaxed whitespace-pre-line flex-grow">
              {payment}
            </p>
          </div>

          {/* Card 4: Allergy Notes */}
          <div className="bg-white border border-sand/50 rounded-[2.5rem] p-8 shadow-sm flex flex-col gap-6 border-l-brand border-l-4">
            <div className="flex items-center gap-3.5">
              <div className="w-12 h-12 rounded-2xl bg-brand/10 text-brand flex items-center justify-center flex-shrink-0">
                <AlertTriangle size={22} />
              </div>
              <h2 className="text-lg font-black text-earth tracking-tight">Allergy Disclaimer</h2>
            </div>
            <p className="text-sm text-muted-earth leading-relaxed whitespace-pre-line flex-grow">
              {allergy}
            </p>
          </div>

        </div>

        {/* Note on Pricing */}
        <div className="bg-brand/5 border border-brand/20 rounded-[2.5rem] p-8 md:p-10 text-center">
          <h3 className="text-lg font-black text-earth mb-2">A Quick Note on Pricing &amp; Checkout</h3>
          <p className="text-sm text-muted-earth leading-relaxed max-w-2xl mx-auto">
            Our checkout acts as an <strong>order request system</strong>. Many of our items have prices that may be confirmed after request depending on size, batch requirements, or seasonal ingredients. Submitting a request is not a guaranteed booking until confirmed by Kirstin.
          </p>
        </div>

      </div>
    </div>
  );
}
