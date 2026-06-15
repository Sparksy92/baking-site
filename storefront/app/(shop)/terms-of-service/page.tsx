import type { Metadata } from 'next';
import { brandName, siteUrl } from '@/lib/format';
import { getPublicSettings } from '@/lib/db-service';

export function generateMetadata(): Metadata {
  return {
    title: 'Terms of Service',
    description: `Terms of service for ${brandName()}.`,
    alternates: { canonical: `${siteUrl()}/terms-of-service` },
  };
}

export default async function TermsOfServicePage() {
  const settings = await getPublicSettings().catch(() => null);
  const name = settings?.brand_name || brandName();

  return (
    <div className="max-w-3xl mx-auto px-4 py-12">
      <h1 className="text-3xl font-bold text-gray-900 mb-2">Terms of Service</h1>
      <p className="text-sm text-gray-400 mb-8">Last updated: June 2026</p>

      <div className="prose prose-gray max-w-none space-y-6 text-gray-600 text-sm leading-relaxed">
        <section>
          <h2 className="text-lg font-semibold text-gray-900">Agreement</h2>
          <p>By accessing or requesting bakes from {name}, you agree to these terms. If you do not agree, please do not use our website.</p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-gray-900">Products &amp; Pricing</h2>
          <p>All prices are listed in Canadian dollars (CAD). We reserve the right to modify prices or adjust quotes at any time. Product images are for illustration — handcrafted items may vary slightly in final appearance.</p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-gray-900">Orders</h2>
          <p>By submitting an order request, you are making an inquiry. We reserve the right to refuse or cancel requests based on capacity, stock availability, or scheduling conflicts. You will be notified if your request is accepted or declined.</p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-gray-900">Payment</h2>
          <p>We operate on a pre-payment request model. Once your order request is reviewed and confirmed, payments are made manually via Interac E-transfer or cash/cheque. Payment is required in full to secure your scheduled baking slot.</p>
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
