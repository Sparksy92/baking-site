import type { Metadata } from 'next';
import Link from 'next/link';
import { brandName, siteUrl } from '@/lib/format';
import ContactForm from './ContactForm';

export function generateMetadata(): Metadata {
  return {
    title: 'Contact Us',
    description: `Get in touch with ${brandName()}.`,
    alternates: { canonical: `${siteUrl()}/contact` },
  };
}

export default function ContactPage() {
  const name = brandName();

  return (
    <div className="max-w-4xl mx-auto px-4 py-12">
      <h1 className="text-3xl font-bold text-gray-900 mb-2">Contact Us</h1>
      <p className="text-gray-600 mb-8">
        Have a question about an order, a product, or just want to say hey? We&apos;d love to hear from you.
      </p>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Contact Form */}
        <div className="lg:col-span-2">
          <ContactForm />
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          <div>
            <h2 className="text-sm font-semibold text-gray-900 mb-1">Email</h2>
            <p className="text-gray-600 text-sm">
              Reach us at{' '}
              <a href={`mailto:hello@${name.toLowerCase().replace(/\s+/g, '')}.com`} className="text-brand hover:underline">
                hello@{name.toLowerCase().replace(/\s+/g, '')}.com
              </a>
            </p>
          </div>

          <div>
            <h2 className="text-sm font-semibold text-gray-900 mb-1">Response Time</h2>
            <p className="text-gray-600 text-sm">We typically respond within 24 hours during business days.</p>
          </div>

          <div>
            <h2 className="text-sm font-semibold text-gray-900 mb-1">Order Issues</h2>
            <p className="text-gray-600 text-sm">
              For order-related questions, please include your order number. You can also{' '}
              <Link href="/order-lookup" className="text-brand hover:underline">track your order</Link>{' '}
              directly on our site.
            </p>
          </div>

          <div className="bg-gray-50 rounded-xl p-6">
            <h2 className="text-sm font-semibold text-gray-900 mb-3">Quick Links</h2>
            <ul className="space-y-2 text-sm">
              <li><Link href="/order-lookup" className="text-brand hover:underline">Track Your Order</Link></li>
              <li><Link href="/shipping-policy" className="text-brand hover:underline">Shipping Policy</Link></li>
              <li><Link href="/return-policy" className="text-brand hover:underline">Return &amp; Exchange Policy</Link></li>
              <li><Link href="/faq" className="text-brand hover:underline">Frequently Asked Questions</Link></li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
