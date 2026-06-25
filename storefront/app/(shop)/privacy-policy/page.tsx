import type { Metadata } from 'next';
import { brandName, siteUrl } from '@/lib/format';
import { getPublicSettings } from '@/lib/db-service';

export function generateMetadata(): Metadata {
  return {
    title: 'Privacy Policy',
    description: `Privacy policy for ${brandName()}.`,
    alternates: { canonical: `${siteUrl()}/privacy-policy` },
  };
}

export default async function PrivacyPolicyPage() {
  const settings = await getPublicSettings().catch(() => null);
  const name = settings?.brand_name || brandName();
  const email = settings?.contact_email || 'hello@sageandsweetgrass.ca';

  return (
    <div className="max-w-3xl mx-auto px-4 py-12">
      <h1 className="text-3xl font-bold text-gray-900 mb-2">Privacy Policy</h1>
      <p className="text-sm text-gray-400 mb-8">Last updated: June 2026</p>

      <div className="prose prose-gray max-w-none space-y-6 text-gray-600 text-sm leading-relaxed">
        <section>
          <h2 className="text-lg font-semibold text-gray-900">Information We Collect</h2>
          <p>When you submit an order request with {name}, we collect your name, email address, shipping address, and phone number (if provided) to review and schedule your bake. All payments are handled manually via Interac E-transfer or cash/cheque — we do not process credit cards or store financial details on our servers.</p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-gray-900">How We Use Your Information</h2>
          <p>We use your information to process and schedule bakes, send order confirmation alerts, respond to custom inquiries, and improve our homestead store. We do not sell, trade, or rent your personal information to third parties.</p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-gray-900">Third-Party Services</h2>
          <p>We use the following third-party services to operate our store:</p>
          <ul className="list-disc pl-5 space-y-1">
            <li><strong>Resend</strong> — transactional email (order confirmations and request updates)</li>
          </ul>
          <p>Each service has its own privacy policy governing use of your data.</p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-gray-900">Cookies</h2>
          <p>We use essential session tokens to maintain your secure admin session. We do not use tracking cookies, shopping cart cookies, or third-party marketing analytics.</p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-gray-900">Data Retention</h2>
          <p>Order request records are retained for accounting and scheduling compliance. You may request deletion of your personal data by contacting us.</p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-gray-900">Contact</h2>
          <p>If you have questions about this privacy policy, please contact us directly at <a href={`mailto:${email}`} className="text-brand hover:underline">{email}</a>.</p>
        </section>
      </div>
    </div>
  );
}
