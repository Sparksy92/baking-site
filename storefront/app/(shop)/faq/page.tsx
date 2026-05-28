import type { Metadata } from 'next';
import Link from 'next/link';
import { brandName, siteUrl } from '@/lib/format';

export function generateMetadata(): Metadata {
  return {
    title: 'FAQ',
    description: `Frequently asked questions about ${brandName()}.`,
    alternates: { canonical: `${siteUrl()}/faq` },
  };
}

const faqs = [
  {
    q: 'How long does shipping take?',
    a: 'Orders are processed within 1–3 business days. Standard shipping across Canada takes 5–10 business days. You will receive a tracking number by email once your order ships.',
  },
  {
    q: 'Do you ship internationally?',
    a: 'We currently ship within Canada only. International shipping may be available in the future.',
  },
  {
    q: 'What is your return policy?',
    a: 'We accept returns within 30 days of delivery for unworn, unwashed items with tags attached. See our Return Policy page for full details.',
  },
  {
    q: 'Can I exchange an item for a different size?',
    a: 'Yes! Contact us within 30 days of delivery and we will arrange an exchange subject to availability.',
  },
  {
    q: 'How do I track my order?',
    a: 'Use the Track Order link in the navigation. Enter your order number and the email address used at checkout.',
  },
  {
    q: 'Do you offer promo codes or discounts?',
    a: 'Yes, we occasionally run promotions. Follow us on social media or sign up for our newsletter to stay in the loop. You can apply promo codes at checkout.',
  },
  {
    q: 'What payment methods do you accept?',
    a: 'We accept all major credit and debit cards through Stripe, including Visa, Mastercard, and American Express.',
  },
  {
    q: 'Are your products true to size?',
    a: 'Our products generally fit true to size. Check the product page for sizing details. If you are between sizes, we recommend sizing up for a relaxed fit.',
  },
];

export default function FaqPage() {
  return (
    <div className="max-w-3xl mx-auto px-4 py-12">
      <h1 className="text-3xl font-bold text-gray-900 mb-2">Frequently Asked Questions</h1>
      <p className="text-gray-600 mb-8">Quick answers to common questions.</p>

      <div className="divide-y divide-gray-200">
        {faqs.map((faq, i) => (
          <div key={i} className="py-6">
            <h2 className="text-base font-semibold text-gray-900 mb-2">{faq.q}</h2>
            <p className="text-sm text-gray-600 leading-relaxed">{faq.a}</p>
          </div>
        ))}
      </div>

      <div className="mt-10 bg-gray-50 rounded-xl p-6 text-center">
        <h2 className="font-semibold text-gray-900 mb-2">Still have questions?</h2>
        <p className="text-sm text-gray-600 mb-4">We&apos;re here to help.</p>
        <Link href="/contact" className="inline-block bg-brand text-white px-6 py-2.5 rounded-lg text-sm font-medium hover:bg-brand/90">
          Contact Us
        </Link>
      </div>
    </div>
  );
}
