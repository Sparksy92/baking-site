'use client';

/**
 * ExpressCheckout — Apple Pay / Google Pay via Stripe Payment Request Button.
 *
 * Usage on PDP (single item):
 *   <ExpressCheckout
 *     mode="buy-now"
 *     variantId={selectedVariant.id}
 *     productName={product.name}
 *     variantSize={selectedVariant.size}
 *     variantColor={selectedVariant.color}
 *     unitPriceCents={effectivePrice}
 *     imageUrl={product.images[0]?.url ?? null}
 *   />
 *
 * Usage on checkout page (cart contents):
 *   <ExpressCheckout mode="cart" totalCents={total} />
 *
 * The button is only rendered when the browser supports Apple Pay or Google Pay.
 * On unsupported browsers it renders nothing, so it never breaks the page.
 */

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { loadStripe, type Stripe, type PaymentRequest } from '@stripe/stripe-js';
import { useCart } from '@/lib/cart';
import { useCustomer } from '@/lib/customer';
import { api } from '@/lib/api';
import { formatCents } from '@/lib/format';

const PUBLISHABLE_KEY = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY ?? '';

type BuyNowProps = {
  mode: 'buy-now';
  variantId: number;
  productName: string;
  variantSize: string;
  variantColor: string;
  unitPriceCents: number;
  imageUrl: string | null;
};

type CartProps = {
  mode: 'cart';
  totalCents: number;
};

type Props = BuyNowProps | CartProps;

type PaymentIntentResponse = {
  order_number: string;
  client_secret: string;
  total_cents: number;
};

export function ExpressCheckout(props: Props) {
  const router = useRouter();
  const { items, subtotal, clear: clearCart } = useCart();
  const { customer } = useCustomer();

  const containerRef = useRef<HTMLDivElement>(null);
  const [supported, setSupported] = useState(false);
  const stripeRef = useRef<Stripe | null>(null);
  const prRef = useRef<PaymentRequest | null>(null);

  const totalCents = props.mode === 'cart' ? props.totalCents : props.unitPriceCents;
  const label = props.mode === 'buy-now' ? props.productName : 'Order total';

  useEffect(() => {
    if (!PUBLISHABLE_KEY) return;

    let cancelled = false;

    async function init() {
      const stripe = await loadStripe(PUBLISHABLE_KEY);
      if (!stripe || cancelled) return;
      stripeRef.current = stripe;

      const pr = stripe.paymentRequest({
        country: 'CA',
        currency: 'cad',
        total: { label, amount: totalCents },
        requestPayerName: true,
        requestPayerEmail: true,
        requestShipping: true,
        shippingOptions: [
          {
            id: 'standard',
            label: 'Standard shipping',
            detail: 'Delivered in 5–10 business days',
            amount: 0,
          },
        ],
      });

      const result = await pr.canMakePayment();
      if (!result || cancelled) return;

      prRef.current = pr;
      setSupported(true);

      pr.on('paymentmethod', async (event) => {
        try {
          const shippingDetails = event.shippingAddress;

          const checkoutBody = {
            customer_name: event.payerName ?? 'Express Checkout',
            customer_email: event.payerEmail ?? customer?.email ?? '',
            shipping_address: {
              line1: shippingDetails?.addressLine?.[0] ?? '',
              line2: shippingDetails?.addressLine?.[1] ?? null,
              city: shippingDetails?.city ?? '',
              province: shippingDetails?.region ?? '',
              postal_code: shippingDetails?.postalCode ?? '',
              country: shippingDetails?.country ?? 'CA',
            },
            items:
              props.mode === 'buy-now'
                ? [{ variant_id: props.variantId, quantity: 1 }]
                : items.map((i) => ({ variant_id: i.variantId, quantity: i.quantity })),
            payment_method: 'stripe' as const,
          };

          const resp = await api.post<PaymentIntentResponse>(
            '/api/checkout/payment-intent',
            checkoutBody,
          );

          const confirmResult = await stripe.confirmCardPayment(
            resp.client_secret,
            { payment_method: event.paymentMethod.id },
            { handleActions: false },
          );

          if (confirmResult.error) {
            event.complete('fail');
            return;
          }

          event.complete('success');

          if (props.mode === 'cart') clearCart();

          sessionStorage.setItem(
            'pending_order',
            JSON.stringify({ order_number: resp.order_number, email: checkoutBody.customer_email }),
          );
          router.push(`/confirmation/${resp.order_number}`);
        } catch {
          event.complete('fail');
        }
      });
    }

    init();
    return () => { cancelled = true; };
  }, [totalCents]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!supported || !prRef.current || !containerRef.current || !stripeRef.current) return;
    const elements = stripeRef.current.elements();
    const prButton = elements.create('paymentRequestButton', {
      paymentRequest: prRef.current,
      style: { paymentRequestButton: { type: 'buy', theme: 'dark', height: '52px' } },
    });
    prButton.mount(containerRef.current);
    return () => prButton.destroy();
  }, [supported]);

  if (!supported) return null;

  return (
    <div className="w-full space-y-3">
      <div ref={containerRef} className="w-full rounded-2xl overflow-hidden" />
      <div className="flex items-center gap-3 text-xs text-gray-400">
        <div className="flex-1 h-px bg-gray-200" />
        <span>or pay with card below</span>
        <div className="flex-1 h-px bg-gray-200" />
      </div>
    </div>
  );
}
