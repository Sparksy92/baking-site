'use client';

import { useEffect, useState, useRef } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { CheckCircle2, Package, Truck, ArrowRight, Receipt, Clock, MapPin, Heart } from 'lucide-react';
import { api, type PublicSettings } from '@/lib/api';
import { formatCents } from '@/lib/format';

interface OrderRequestDetail {
  order_number: string;
  status: string;
  customer_name: string;
  customer_email: string;
  customer_phone: string | null;
  requested_items: {
    productName: string;
    variantSize: string;
    variantColor: string;
    quantity: number;
    unitPriceCents: number;
  }[];
  desired_date: string | null;
  pickup_or_delivery: string;
  preferred_contact_method: string;
  allergy_notes: string | null;
  special_instructions: string | null;
  created_at: string;
}

export default function ConfirmationPage() {
  const params = useParams<{ orderNumber: string }>();
  const searchParams = useSearchParams();
  const orderNumber = params.orderNumber;
  const [request, setRequest] = useState<OrderRequestDetail | null>(null);
  const [settings, setSettings] = useState<PublicSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [emailUsed, setEmailUsed] = useState('');

  useEffect(() => {
    if (!orderNumber) return;

    api.get<PublicSettings>('/api/settings/public')
      .then(setSettings)
      .catch((err) => console.error(err));

    let email = '';
    try {
      const pending = sessionStorage.getItem('pending_order') || localStorage.getItem('pending_order');
      if (pending) {
        const data = JSON.parse(pending);
        if (data.order_number === orderNumber && data.email) {
          email = data.email;
          setEmailUsed(email);
        }
      }
    } catch { /* ignore */ }

    if (email) {
      api.get<OrderRequestDetail>(`/api/order-requests/${orderNumber}?email=${encodeURIComponent(email)}`)
        .then((data) => {
          setRequest(data);
          sessionStorage.removeItem('pending_order');
          localStorage.removeItem('pending_order');
        })
        .catch((err) => console.error('Failed to load request details:', err))
        .finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, [orderNumber]);

  if (loading) {
    return (
      <div className="min-h-[60vh] bg-cream flex items-center justify-center">
        <div className="animate-pulse flex flex-col items-center">
          <div className="w-16 h-16 bg-sand rounded-full mb-4"></div>
          <div className="h-6 bg-sand rounded-2xl w-48 mb-2"></div>
          <div className="h-4 bg-sand rounded-2xl w-32"></div>
        </div>
      </div>
    );
  }

  // Calculate pricing from loaded request details
  const subtotal = request?.requested_items.reduce((sum, item) => sum + item.unitPriceCents * item.quantity, 0) ?? 0;
  const taxRate = settings?.tax_rate ?? 0.13;
  const tax = Math.round(subtotal * taxRate);
  
  const freeThreshold = settings?.shipping_free_threshold_cents ?? 3000;
  const deliveryFee = settings?.shipping_flat_rate_cents ?? 500;
  const deliveryCost = request?.pickup_or_delivery === 'delivery' && subtotal < freeThreshold ? deliveryFee : 0;
  const total = subtotal + deliveryCost + tax;

  const etransferEmail = settings?.etransfer_email || 'payments@sageandsweetgrass.ca';

  return (
    <div className="bg-cream min-h-screen py-12 sm:py-20">
      <div className="max-w-3xl mx-auto px-4">
        
        {/* Header Section */}
        <div className="text-center mb-10">
          <div className="inline-flex items-center justify-center w-20 h-20 bg-brand/10 border border-brand/20 rounded-full mb-6 ring-8 ring-brand/5">
            <CheckCircle2 className="text-brand w-10 h-10" />
          </div>
          <h1 className="text-3xl sm:text-4xl font-black text-earth mb-3 tracking-tight font-serif">Request Confirmed!</h1>
          <p className="text-base text-muted-earth">
            Your request <strong className="text-earth">#{orderNumber}</strong> has been submitted.
          </p>
          {emailUsed && (
            <p className="mt-2 text-sm text-muted-earth/70">
              Confirmation sent to <span className="font-semibold text-earth">{emailUsed}</span>.
            </p>
          )}
        </div>

        {/* E-Transfer Instructions Card */}
        <div className="bg-white border-2 border-brand/20 rounded-[2rem] p-6 sm:p-8 text-center shadow-sm mb-8 relative overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-1.5 bg-brand" />
          <h2 className="text-xl font-bold text-earth mb-2 font-serif">How to Pay (Interac e-Transfer)</h2>
          <p className="text-sm text-muted-earth mb-6">
            Kirstin will review ingredient availability and baking schedules within 24 hours. Once your request is approved, please send payment:
          </p>
          <div className="bg-[#FAF8F5] border border-sand rounded-2xl p-5 inline-block text-left shadow-sm max-w-md w-full">
            <div className="mb-4">
              <span className="text-[10px] font-bold uppercase tracking-wider text-muted-earth block mb-1">E-Transfer To:</span>
              <span className="font-bold text-base text-brand">{etransferEmail}</span>
            </div>
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-muted-earth block mb-1">Include Message / Memo:</span>
              <span className="font-bold text-base text-earth">#{orderNumber}</span>
            </div>
          </div>
          <p className="text-xs text-muted-earth mt-4">
            Payment is required to secure your baking slot after request confirmation.
          </p>
        </div>

        {request ? (
          <div className="space-y-8">
            <div className="bg-white rounded-[2rem] shadow-earth-sm border border-sand/50 overflow-hidden">
              
              {/* Status Bar */}
              <div className="bg-warm px-6 py-4 border-b border-sand/50 flex flex-col sm:flex-row gap-4 justify-between sm:items-center text-xs">
                <div className="flex items-center gap-2 text-muted-earth">
                  <Receipt size={16} className="text-brand shrink-0" />
                  <span>Request Status: <span className="font-bold text-earth capitalize">{request.status}</span></span>
                </div>
                <div className="flex items-center gap-2 text-muted-earth">
                  <Truck size={16} className="text-brand shrink-0" />
                  <span className="capitalize">{request.pickup_or_delivery === 'pickup' ? 'Homestead Pickup' : 'Local Delivery'}</span>
                </div>
                {request.desired_date && (
                  <div className="flex items-center gap-2 text-muted-earth">
                    <Clock size={16} className="text-brand shrink-0" />
                    <span>Desired: <span className="font-bold text-earth">{request.desired_date}</span></span>
                  </div>
                )}
              </div>

              {/* Items List */}
              <div className="p-6 sm:p-8 border-b border-sand/50">
                <h2 className="text-lg font-bold text-earth mb-6 font-serif">Items Requested</h2>
                <div className="space-y-6">
                  {request.requested_items.map((item, idx) => (
                    <div key={idx} className="flex justify-between gap-4">
                      <div className="flex gap-4 items-start">
                        <div className="w-10 h-10 rounded-xl bg-warm border border-sand/30 flex items-center justify-center flex-shrink-0 text-brand font-bold text-xs">
                          {item.quantity}x
                        </div>
                        <div>
                          <h3 className="font-bold text-earth text-sm">{item.productName}</h3>
                          <p className="text-xs text-muted-earth capitalize mt-0.5">
                            {item.variantSize !== 'Standard' || item.variantColor !== 'Default'
                              ? `${item.variantSize} / ${item.variantColor}`
                              : 'Standard Option'
                            }
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <span className="font-bold text-earth text-sm">{formatCents(item.unitPriceCents * item.quantity)}</span>
                        {item.quantity > 1 && (
                          <p className="text-[10px] text-muted-earth mt-0.5">{formatCents(item.unitPriceCents)} each</p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Details & Logistics */}
              <div className="p-6 sm:p-8 border-b border-sand/50 grid grid-cols-1 sm:grid-cols-2 gap-6 text-xs bg-warm/20">
                <div>
                  <h4 className="font-bold text-earth uppercase tracking-wider mb-2">Request Details</h4>
                  <p className="text-muted-earth leading-relaxed">
                    <strong className="text-earth">Customer:</strong> {request.customer_name}<br />
                    <strong className="text-earth">Email:</strong> {request.customer_email}<br />
                    {request.customer_phone && <><strong className="text-earth">Phone:</strong> {request.customer_phone}<br /></>}
                    <strong className="text-earth">Contact:</strong> <span className="capitalize">{request.preferred_contact_method}</span>
                  </p>
                </div>
                <div>
                  <h4 className="font-bold text-earth uppercase tracking-wider mb-2">Instructions & Dietary</h4>
                  <p className="text-muted-earth leading-relaxed">
                    <strong className="text-earth">Allergies:</strong> <span className={request.allergy_notes ? 'text-rose-600 font-bold' : ''}>{request.allergy_notes || 'None reported'}</span><br />
                    <strong className="text-earth">Special Notes:</strong> {request.special_instructions || 'None'}
                  </p>
                </div>
              </div>

              {/* Price Breakdown */}
              <div className="p-6 sm:p-8 bg-warm/30">
                <div className="max-w-xs ml-auto space-y-3 text-xs">
                  <div className="flex justify-between text-muted-earth">
                    <span>Subtotal</span>
                    <span className="font-bold text-earth">{formatCents(subtotal)}</span>
                  </div>
                  {request.pickup_or_delivery === 'delivery' && (
                    <div className="flex justify-between text-muted-earth">
                      <span>Local Delivery</span>
                      <span className="font-bold text-earth">{deliveryCost === 0 ? 'Free' : formatCents(deliveryFee)}</span>
                    </div>
                  )}
                  {tax > 0 && (
                    <div className="flex justify-between text-muted-earth">
                      <span>Estimated Tax</span>
                      <span className="font-bold text-earth">{formatCents(tax)}</span>
                    </div>
                  )}
                  <div className="flex justify-between items-center pt-4 mt-4 border-t border-sand/50 text-sm">
                    <span className="font-bold text-earth">Estimated Total</span>
                    <span className="text-lg font-black text-earth">{formatCents(total)}</span>
                  </div>
                </div>
              </div>

            </div>
          </div>
        ) : (
          <div className="bg-white border border-sand/50 rounded-[2rem] p-8 text-center shadow-sm">
            <p className="text-muted-earth mb-4">We submitted your request, but details couldn&apos;t be fetched directly.</p>
            <p className="text-xs text-muted-earth/70">Kirstin will email you soon at the address provided.</p>
          </div>
        )}

        <div className="mt-10 text-center space-y-4">
          <Link href="/shop" className="btn-primary inline-flex items-center gap-2 px-8 py-4 rounded-xl font-bold">
            Continue to Shop <ArrowRight size={16} />
          </Link>
          <div className="flex items-center justify-center gap-1.5 text-xs font-bold text-brand uppercase tracking-wider">
            <Heart size={12} className="text-terracotta animate-pulse" /> Thank you for supporting our homestead bakery!
          </div>
        </div>

      </div>
    </div>
  );
}
