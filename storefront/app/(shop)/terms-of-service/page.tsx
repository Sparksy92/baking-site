import type { Metadata } from 'next';
import { brandName, siteUrl } from '@/lib/format';

export function generateMetadata(): Metadata {
  return {
    title: 'Terms of Service',
    description: `Terms of service for ${brandName()}.`,
    alternates: { canonical: `${siteUrl()}/terms-of-service` },
  };
}

export default function TermsOfServicePage() {
  const name = brandName();

  return (
    <div className="max-w-3xl mx-auto px-4 py-12">
      <h1 className="text-3xl font-bold text-gray-900 mb-2">Terms of Service</h1>
      <p className="text-sm text-gray-400 mb-8">Last updated: January 2025</p>

      <div className="prose prose-gray max-w-none space-y-6 text-gray-600 text-sm leading-relaxed">
        <section>
          <h2 className="text-lg font-semibold text-gray-900">Agreement</h2>
          <p>By accessing or purchasing from {name}, you agree to these terms. If you do not agree, please do not use our website.</p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-gray-900">Products &amp; Pricing</h2>
          <p>All prices are listed in Canadian dollars (CAD) and include applicable taxes at checkout. We reserve the right to modify prices at any time without prior notice. Product images are for illustration — slight color variations may occur.</p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-gray-900">Orders</h2>
          <p>By placing an order, you are making an offer to purchase. We reserve the right to refuse or cancel any order for reasons including stock availability, pricing errors, or suspected fraud. You will be notified if your order is cancelled.</p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-gray-900">Payment</h2>
          <p>All payments are processed securely through Stripe. We accept major credit and debit cards. Your payment information is handled directly by Stripe and never touches our servers.</p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-gray-900">Intellectual Property</h2>
          <p>All designs, logos, images, and content on this website are the property of {name} and may not be reproduced, distributed, or used without written permission.</p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-gray-900">Limitation of Liability</h2>
          <p>{name} is not liable for any indirect, incidental, or consequential damages arising from use of our website or products, to the fullest extent permitted by law.</p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-gray-900">Changes</h2>
          <p>We may update these terms at any time. Continued use of the website after changes constitutes acceptance of the revised terms.</p>
        </section>
      </div>
    </div>
  );
}
