import type { Metadata } from 'next';
import { brandName, siteUrl } from '@/lib/format';

export function generateMetadata(): Metadata {
  return {
    title: 'Privacy Policy',
    description: `Privacy policy for ${brandName()}.`,
    alternates: { canonical: `${siteUrl()}/privacy-policy` },
  };
}

export default function PrivacyPolicyPage() {
  const name = brandName();

  return (
    <div className="max-w-3xl mx-auto px-4 py-12">
      <h1 className="text-3xl font-bold text-gray-900 mb-2">Privacy Policy</h1>
      <p className="text-sm text-gray-400 mb-8">Last updated: January 2025</p>

      <div className="prose prose-gray max-w-none space-y-6 text-gray-600 text-sm leading-relaxed">
        <section>
          <h2 className="text-lg font-semibold text-gray-900">Information We Collect</h2>
          <p>When you place an order with {name}, we collect your name, email address, shipping address, and phone number (if provided). We also collect payment information through our secure payment processor, Stripe — we never store your full card details on our servers.</p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-gray-900">How We Use Your Information</h2>
          <p>We use your information to process and fulfill orders, send order confirmations and shipping updates, respond to customer service inquiries, and improve our store experience. We do not sell, trade, or rent your personal information to third parties.</p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-gray-900">Third-Party Services</h2>
          <p>We use the following third-party services to operate our store:</p>
          <ul className="list-disc pl-5 space-y-1">
            <li><strong>Stripe</strong> — payment processing</li>
            <li><strong>Resend</strong> — transactional email (order confirmations, shipping updates)</li>
          </ul>
          <p>Each service has its own privacy policy governing use of your data.</p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-gray-900">Cookies</h2>
          <p>We use essential cookies to maintain your shopping cart and admin session. We do not use tracking cookies or third-party analytics.</p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-gray-900">Data Retention</h2>
          <p>Order records are retained for accounting and legal compliance purposes. You may request deletion of your personal data by contacting us.</p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-gray-900">Contact</h2>
          <p>If you have questions about this privacy policy, please contact us through our website.</p>
        </section>
      </div>
    </div>
  );
}
