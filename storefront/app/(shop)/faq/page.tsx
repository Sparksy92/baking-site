'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { api, type PublicSettings } from '@/lib/api';

interface FaqItem {
  q: string;
  a: string;
}

export default function FaqPage() {
  const [settings, setSettings] = useState<PublicSettings | null>(null);

  useEffect(() => {
    api.get<PublicSettings>('/api/settings/public')
      .then(setSettings)
      .catch(() => {});
  }, []);

  const rawFaq = settings?.faq_content || '';
  let faqs: FaqItem[] = [];

  if (rawFaq) {
    const blocks = rawFaq.split(/\n\s*\n/);
    for (const block of blocks) {
      const lines = block.split('\n');
      let q = '';
      let a = '';
      for (const line of lines) {
        if (line.trim().startsWith('Q:')) {
          q = line.replace(/^\s*Q:\s*/, '').trim();
        } else if (line.trim().startsWith('A:')) {
          a = line.replace(/^\s*A:\s*/, '').trim();
        }
      }
      if (q && a) {
        faqs.push({ q, a });
      }
    }
  }

  // Fallback if parsing fails or database is empty
  if (faqs.length === 0) {
    faqs = [
      {
        q: 'How do I place an order?',
        a: 'Browse our menu, select your items, and submit an order request. Kirstin will review it and reach out to confirm pickup/delivery and payment details.',
      },
      {
        q: 'Are prices final?',
        a: 'For custom bakes and quote-only items, final pricing is confirmed after request review.',
      },
      {
        q: 'How does sourdough preorder work?',
        a: 'Sourdough is baked fresh on weekends. Preorder by Wednesday evening to secure your Saturday pickup.',
      },
      {
        q: 'Do you offer custom desserts?',
        a: 'Yes! Use the Custom Desserts item to describe your request, and we will get back to you with a quote.',
      },
      {
        q: 'Can I request pickup or delivery?',
        a: 'Yes. Choose pickup or local delivery, and specify your preference/address in the request.',
      },
      {
        q: 'What allergens should I know about?',
        a: 'Our kitchen handles wheat, dairy, eggs, soy, and nuts. Let us know of any allergies.',
      },
      {
        q: 'How do I support the Oven Fund?',
        a: 'Visit our Oven Fund page to view current progress and support tiers. Contributions can be sent via e-transfer or made in person.',
      },
    ];
  }

  return (
    <div className="bg-cream min-h-screen py-16">
      <div className="max-w-3xl mx-auto px-4">
        <h1 className="text-3xl font-black text-earth tracking-tight mb-2">Frequently Asked Questions</h1>
        <p className="text-muted-earth mb-8">Quick answers to common questions about our bakes and ordering process.</p>

        <div className="divide-y divide-sand/50 bg-white border border-sand/50 rounded-3xl p-6 sm:p-8 shadow-sm">
          {faqs.map((faq, i) => (
            <div key={i} className="py-6 first:pt-0 last:pb-0">
              <h2 className="text-base font-bold text-earth mb-2">{faq.q}</h2>
              <p className="text-sm text-muted-earth leading-relaxed">{faq.a}</p>
            </div>
          ))}
        </div>

        <div className="mt-10 bg-white border border-sand/50 rounded-3xl p-6 text-center shadow-sm">
          <h2 className="font-bold text-earth mb-2">Still have questions?</h2>
          <p className="text-sm text-muted-earth mb-4">We&apos;re here to help clarify details about custom orders, pickup times, or ingredients.</p>
          <Link href="/contact" className="inline-block bg-brand text-white px-6 py-2.5 rounded-lg text-sm font-medium hover:bg-brand/90 transition-colors">
            Contact Us
          </Link>
        </div>
      </div>
    </div>
  );
}

