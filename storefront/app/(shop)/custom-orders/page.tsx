'use client';

import { Suspense, useState, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import { api } from '@/lib/api';
import { ArrowRight, Sparkles, CheckCircle, Loader2 } from 'lucide-react';
import Link from 'next/link';

function CustomOrdersForm() {
  const searchParams = useSearchParams();
  const itemSlug = searchParams.get('item');

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [contactMethod, setContactMethod] = useState('email');
  const [date, setDate] = useState('');
  const [pickupOrDelivery, setPickupOrDelivery] = useState('pickup');
  const [customDescription, setCustomDescription] = useState('');
  const [allergyNotes, setAllergyNotes] = useState('');
  const [specialInstructions, setSpecialInstructions] = useState('');
  
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');

  // Prefill the item description if the item query parameter is present
  useEffect(() => {
    if (itemSlug) {
      setCustomDescription(`I would like to request: ${itemSlug}`);
      api.get<any>(`/api/products/${itemSlug}`)
        .then((product) => {
          if (product && product.name) {
            setCustomDescription(`I would like to request: ${product.name}`);
          }
        })
        .catch(() => {
          // Fallback to original slug if fetch fails
        });
    }
  }, [itemSlug]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError('');

    try {
      const payload = {
        customer_name: name,
        customer_email: email,
        customer_phone: phone || null,
        preferred_contact_method: contactMethod,
        requested_items: [
          {
            product_name: 'Custom Celebration/Event Bakes',
            option: 'Custom Request',
            quantity: 1,
            notes: customDescription,
          }
        ],
        desired_date: date || null,
        pickup_or_delivery: pickupOrDelivery,
        allergy_notes: allergyNotes || null,
        special_instructions: specialInstructions || null,
      };

      await api.post('/api/order-requests', payload);
      setSuccess(true);
    } catch (err: any) {
      console.error(err);
      setError(err?.message || 'Failed to submit custom request. Please check your information and try again.');
    } finally {
      setSubmitting(false);
    }
  }

  if (success) {
    return (
      <div className="bg-cream min-h-screen py-20 flex items-center justify-center">
        <div className="max-w-md w-full mx-auto px-4 text-center">
          <div className="bg-white border border-sand/50 rounded-[2.5rem] p-8 md:p-12 shadow-sm space-y-6">
            <div className="w-16 h-16 rounded-full bg-brand/10 text-brand flex items-center justify-center mx-auto mb-2 animate-bounce">
              <CheckCircle size={36} />
            </div>
            <h1 className="text-3xl font-black text-earth tracking-tight">Request Received!</h1>
            <p className="text-muted-earth text-sm leading-relaxed">
              Thank you for submitting your custom order request. Kirstin will review the details and reach out to you within 24 hours to confirm availability, options, and final pricing.
            </p>
            <div className="border-t border-sand/40 pt-6 mt-6">
              <Link href="/shop" className="inline-flex items-center gap-2 bg-brand text-white px-6 py-3 rounded-xl text-sm font-bold hover:bg-brand/90 transition-all hover:scale-[1.02]">
                Back to Shop <ArrowRight size={16} />
              </Link>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-cream min-h-screen py-16">
      <div className="max-w-3xl mx-auto px-4">
        
        {/* Header */}
        <div className="text-center max-w-xl mx-auto mb-12">
          <div className="inline-flex items-center gap-1.5 bg-brand/10 text-brand text-xs font-black px-3 py-1.5 rounded-full uppercase tracking-wider mb-3">
            <Sparkles size={12} /> Special Occasions &amp; Custom Requests
          </div>
          <h1 className="text-4xl font-black text-earth tracking-tight mb-2">Custom Orders</h1>
          <p className="text-muted-earth text-sm">
            Celebrate with custom cakes, personalized cookies, special loaves, or custom pantry bundles. Let us know what you need and Kirstin will make it happen!
          </p>
        </div>

        {/* Form Container */}
        <form onSubmit={handleSubmit} className="bg-white border border-sand/50 rounded-[2.5rem] p-6 sm:p-10 md:p-12 shadow-sm space-y-8">
          
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-5 py-4 rounded-2xl">
              {error}
            </div>
          )}

          {/* Section 1: Custom Details */}
          <div className="space-y-4">
            <h2 className="text-lg font-black text-earth border-b border-sand/30 pb-2">Custom Request Details</h2>
            <div>
              <label htmlFor="customDescription" className="block text-xs font-black uppercase tracking-wider text-earth mb-2">
                What would you like us to bake? *
              </label>
              <textarea
                id="customDescription"
                required
                rows={5}
                value={customDescription}
                onChange={(e) => setCustomDescription(e.target.value)}
                placeholder="Please describe flavor, design ideas, size, serving count, or any specific theme you have in mind..."
                className="w-full px-4 py-3 rounded-2xl border border-sand focus:border-brand focus:ring-1 focus:ring-brand outline-none text-sm resize-none placeholder-gray-400 text-earth"
              />
            </div>
          </div>

          {/* Section 2: Contact Info */}
          <div className="space-y-6">
            <h2 className="text-lg font-black text-earth border-b border-sand/30 pb-2">Your Contact Information</h2>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label htmlFor="name" className="block text-xs font-black uppercase tracking-wider text-earth mb-2">
                  Full Name *
                </label>
                <input
                  id="name"
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Your Name"
                  className="w-full px-4 py-3 rounded-xl border border-sand focus:border-brand focus:ring-1 focus:ring-brand outline-none text-sm placeholder-gray-400 text-earth"
                />
              </div>

              <div>
                <label htmlFor="email" className="block text-xs font-black uppercase tracking-wider text-earth mb-2">
                  Email Address *
                </label>
                <input
                  id="email"
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  className="w-full px-4 py-3 rounded-xl border border-sand focus:border-brand focus:ring-1 focus:ring-brand outline-none text-sm placeholder-gray-400 text-earth"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label htmlFor="phone" className="block text-xs font-black uppercase tracking-wider text-earth mb-2">
                  Phone Number
                </label>
                <input
                  id="phone"
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="(555) 000-0000"
                  className="w-full px-4 py-3 rounded-xl border border-sand focus:border-brand focus:ring-1 focus:ring-brand outline-none text-sm placeholder-gray-400 text-earth"
                />
              </div>

              <div>
                <label htmlFor="contactMethod" className="block text-xs font-black uppercase tracking-wider text-earth mb-2">
                  Preferred Contact *
                </label>
                <select
                  id="contactMethod"
                  value={contactMethod}
                  onChange={(e) => setContactMethod(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl border border-sand focus:border-brand focus:ring-1 focus:ring-brand outline-none text-sm text-earth"
                >
                  <option value="email">Email</option>
                  <option value="phone">Phone Call</option>
                  <option value="text">SMS / Text Message</option>
                </select>
              </div>
            </div>
          </div>

          {/* Section 3: Timing & Logistics */}
          <div className="space-y-6">
            <h2 className="text-lg font-black text-earth border-b border-sand/30 pb-2">Timing &amp; Logistics</h2>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label htmlFor="date" className="block text-xs font-black uppercase tracking-wider text-earth mb-2">
                  Desired Date Needed
                </label>
                <input
                  id="date"
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl border border-sand focus:border-brand focus:ring-1 focus:ring-brand outline-none text-sm text-earth"
                />
                <span className="text-[10px] text-muted-earth block mt-1">
                  Please note our recommended baking lead times (e.g. sourdough on weekends).
                </span>
              </div>

              <div>
                <label htmlFor="pickupOrDelivery" className="block text-xs font-black uppercase tracking-wider text-earth mb-2">
                  Pickup or Local Delivery? *
                </label>
                <select
                  id="pickupOrDelivery"
                  value={pickupOrDelivery}
                  onChange={(e) => setPickupOrDelivery(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl border border-sand focus:border-brand focus:ring-1 focus:ring-brand outline-none text-sm text-earth"
                >
                  <option value="pickup">Pickup from Homestead</option>
                  <option value="delivery">Local Delivery (Confirmed by request)</option>
                </select>
              </div>
            </div>
          </div>

          {/* Section 4: Allergies & Notes */}
          <div className="space-y-4">
            <h2 className="text-lg font-black text-earth border-b border-sand/30 pb-2">Allergies &amp; Special Instructions</h2>
            
            <div>
              <label htmlFor="allergyNotes" className="block text-xs font-black uppercase tracking-wider text-earth mb-2">
                Allergy Disclaimers / Dietary Concerns
              </label>
              <textarea
                id="allergyNotes"
                rows={2}
                value={allergyNotes}
                onChange={(e) => setAllergyNotes(e.target.value)}
                placeholder="Include any food allergies or ingredient restrictions here..."
                className="w-full px-4 py-3 rounded-2xl border border-sand focus:border-brand focus:ring-1 focus:ring-brand outline-none text-sm resize-none placeholder-gray-400 text-earth"
              />
            </div>

            <div>
              <label htmlFor="specialInstructions" className="block text-xs font-black uppercase tracking-wider text-earth mb-2">
                Special Instructions or Order Notes
              </label>
              <textarea
                id="specialInstructions"
                rows={2}
                value={specialInstructions}
                onChange={(e) => setSpecialInstructions(e.target.value)}
                placeholder="Any extra details we should know about?"
                className="w-full px-4 py-3 rounded-2xl border border-sand focus:border-brand focus:ring-1 focus:ring-brand outline-none text-sm resize-none placeholder-gray-400 text-earth"
              />
            </div>
          </div>

          {/* Submit */}
          <div className="border-t border-sand/30 pt-8 flex items-center justify-end">
            <button
              type="submit"
              disabled={submitting}
              className="inline-flex items-center gap-2 bg-brand text-white px-8 py-3.5 rounded-2xl text-sm font-bold hover:bg-brand/90 transition-all active:scale-[0.98] disabled:bg-brand/60"
            >
              {submitting ? 'Submitting Request...' : 'Submit Custom Request'}
              {!submitting && <ArrowRight size={16} />}
            </button>
          </div>

        </form>
      </div>
    </div>
  );
}

export default function CustomOrdersPage() {
  return (
    <Suspense fallback={
      <div className="bg-cream min-h-screen py-20 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-brand" />
      </div>
    }>
      <CustomOrdersForm />
    </Suspense>
  );
}
