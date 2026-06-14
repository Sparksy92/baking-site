import type { Metadata } from 'next';
import { brandName, siteUrl } from '@/lib/format';

export function generateMetadata(): Metadata {
  return {
    title: 'Returns & Cancellations Policy',
    description: `Returns and cancellation policy for ${brandName()}.`,
    alternates: { canonical: `${siteUrl()}/return-policy` },
  };
}

export default function ReturnPolicyPage() {
  const name = brandName();

  return (
    <div className="max-w-3xl mx-auto px-4 py-12">
      <h1 className="text-3xl font-black text-earth tracking-tight mb-2">Returns &amp; Cancellations</h1>
      <p className="text-sm text-muted-earth mb-8">Last updated: June 2026</p>

      <div className="prose prose-gray max-w-none space-y-6 text-muted-earth text-sm leading-relaxed">
        <section className="space-y-2">
          <h2 className="text-lg font-bold text-earth">Order Changes &amp; Cancellations</h2>
          <p>
            Because we bake everything fresh to order and plan our ingredient prep around reserved baking dates, we require at least <strong>48 hours notice</strong> prior to your scheduled pickup or delivery window for any cancellations or major order modifications.
          </p>
          <p>
            Cancellations made within 48 hours of your baking window may not be eligible for a refund or credit, as dough prep, feeding, and baking schedules will have already commenced.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-lg font-bold text-earth">Perishable Goods (Fresh Baking)</h2>
          <p>
            Due to the perishable nature of fresh baking (breads, buns, bagels, cinnamon rolls, cheesecakes, and custom desserts), all sales of these items are final. 
          </p>
          <p>
            We want you to love your fresh bakes! If you are unsatisfied with the quality of your order, please contact us immediately upon pickup so we can resolve the issue or arrange a replacement bake.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-lg font-bold text-earth">Non-Perishable Goods (Pantry &amp; Homestead Care)</h2>
          <p>
            Unused, unopened pantry preserves (jams, jellies, pickles, simmer pots) and hand-crafted body care products (tallow lotions, lip balms, salves, and herbal oils) in their original packaging can be returned or exchanged within 14 days of pickup. 
          </p>
          <p>
            Please contact us to arrange return drop-offs. Refunds will be issued once the items are returned in resalable condition.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-lg font-bold text-earth">Contact Us</h2>
          <p>
            For any cancellations, changes, or questions about your order, please email us directly at <a href="mailto:hello@cedarandsagehomestead.ca" className="text-terracotta hover:underline">hello@cedarandsagehomestead.ca</a>.
          </p>
        </section>
      </div>
    </div>
  );
}
