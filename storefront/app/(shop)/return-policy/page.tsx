import type { Metadata } from 'next';
import { brandName, siteUrl } from '@/lib/format';

export function generateMetadata(): Metadata {
  return {
    title: 'Return Policy',
    description: `Return and exchange policy for ${brandName()}.`,
    alternates: { canonical: `${siteUrl()}/return-policy` },
  };
}

export default function ReturnPolicyPage() {
  const name = brandName();

  return (
    <div className="max-w-3xl mx-auto px-4 py-12">
      <h1 className="text-3xl font-bold text-gray-900 mb-2">Return &amp; Exchange Policy</h1>
      <p className="text-sm text-gray-400 mb-8">Last updated: January 2025</p>

      <div className="prose prose-gray max-w-none space-y-6 text-gray-600 text-sm leading-relaxed">
        <section>
          <h2 className="text-lg font-semibold text-gray-900">Returns</h2>
          <p>We accept returns within 30 days of delivery for unworn, unwashed items in original condition with tags attached. To initiate a return, contact us with your order number and reason for return.</p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-gray-900">Exchanges</h2>
          <p>Need a different size or color? Contact us within 30 days of delivery. We will arrange an exchange subject to availability. If the item is out of stock, we will offer a full refund.</p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-gray-900">Refunds</h2>
          <p>Refunds are processed to the original payment method within 5–10 business days of receiving the returned item. Shipping costs are non-refundable. Return shipping is the responsibility of the customer unless the item arrived defective or incorrect.</p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-gray-900">Non-Returnable Items</h2>
          <p>Sale items marked as final sale, gift cards, and items that have been worn, washed, or altered are not eligible for return or exchange.</p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-gray-900">Defective Items</h2>
          <p>If you receive a defective or incorrect item, contact us immediately. We will arrange a free return and replacement or full refund at our expense.</p>
        </section>
      </div>
    </div>
  );
}
