import type { Metadata } from 'next';
import { brandName, siteUrl } from '@/lib/format';

export function generateMetadata(): Metadata {
  return {
    title: 'Shipping Policy',
    description: `Shipping information and delivery policy for ${brandName()}.`,
    alternates: { canonical: `${siteUrl()}/shipping-policy` },
  };
}

export default function ShippingPolicyPage() {
  const name = brandName();

  return (
    <div className="max-w-3xl mx-auto px-4 py-12">
      <h1 className="text-3xl font-bold text-gray-900 mb-2">Shipping Policy</h1>
      <p className="text-sm text-gray-400 mb-8">Last updated: January 2025</p>

      <div className="prose prose-gray max-w-none space-y-6 text-gray-600 text-sm leading-relaxed">
        <section>
          <h2 className="text-lg font-semibold text-gray-900">Domestic Shipping (Canada)</h2>
          <p>We ship across Canada. Orders are typically processed within 1–3 business days. Standard delivery takes 5–10 business days depending on your location. Free shipping is available on orders over the qualifying threshold — see checkout for details.</p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-gray-900">Shipping Rates</h2>
          <p>A flat-rate shipping fee applies to orders below the free shipping threshold. The exact rate and threshold are displayed at checkout. Shipping costs are non-refundable.</p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-gray-900">Order Tracking</h2>
          <p>Once your order ships, you will receive an email with a tracking number. You can also track your order on our website using the order number and email address associated with your purchase.</p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-gray-900">Remote &amp; Northern Communities</h2>
          <p>We are committed to serving all communities across Canada. Delivery to remote and northern areas may take additional time. If there are any concerns about delivery to your area, please contact us before placing your order.</p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-gray-900">Lost or Damaged Packages</h2>
          <p>If your package is lost or arrives damaged, please contact us within 14 days of the expected delivery date. We will work with the carrier to resolve the issue or arrange a replacement.</p>
        </section>
      </div>
    </div>
  );
}
