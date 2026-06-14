import type { Metadata } from 'next';
import { brandName, siteUrl } from '@/lib/format';

export function generateMetadata(): Metadata {
  return {
    title: 'Pickup & Delivery Policy',
    description: `Pickup and delivery information for ${brandName()}.`,
    alternates: { canonical: `${siteUrl()}/shipping-policy` },
  };
}

export default function ShippingPolicyPage() {
  const name = brandName();

  return (
    <div className="max-w-3xl mx-auto px-4 py-12">
      <h1 className="text-3xl font-black text-earth tracking-tight mb-2">Pickup &amp; Delivery Policy</h1>
      <p className="text-sm text-muted-earth mb-8">Last updated: June 2026</p>

      <div className="prose prose-gray max-w-none space-y-6 text-muted-earth text-sm leading-relaxed">
        <section className="space-y-2">
          <h2 className="text-lg font-bold text-earth">Local Pickup (Homestead)</h2>
          <p>
            Because we bake everything fresh in small batches, all items are prepared to order. Pickups are available at our homestead (pickup address and instructions are provided upon request review and payment confirmation).
          </p>
          <p>
            Please specify your desired pickup day and time window when submitting your order request. Fresh items are placed in our sanitized homestead pickup cabinet at your scheduled window.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-lg font-bold text-earth">Local Delivery</h2>
          <p>
            We offer local delivery within our community boundaries. When submitting your order request, you can select the delivery option and provide your address. 
          </p>
          <p>
            A flat-rate delivery fee (e.g. $5.00 for orders over $30.00) will be added to your total, subject to confirmation by Kirstin during the order review process.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-lg font-bold text-earth">Order Confirmation &amp; Scheduling</h2>
          <p>
            After submitting a request, Kirstin will review the availability of ingredients and scheduling. We will send you an email confirmation with your total, E-transfer instructions, and pickup/delivery logistics within 24 hours. Prepayment via E-transfer is required to secure your baking slot.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-lg font-bold text-earth">Lead Times</h2>
          <p>
            Different items require different lead times (for example, wild-fermented sourdough takes up to 3 days to feed, cold-ferment, and bake). Sourdough preorders typically close Wednesday at 5:00 PM for weekend pickup. Please refer to individual menu items for required lead times.
          </p>
        </section>
      </div>
    </div>
  );
}
