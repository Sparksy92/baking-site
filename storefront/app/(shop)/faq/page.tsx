'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { api, type PublicSettings } from '@/lib/api';
import { ChevronDown, HelpCircle } from 'lucide-react';
import { JsonLd } from '@/components/JsonLd';

interface FaqItem {
  q: string;
  a: string;
}

export default function FaqPage() {
  const [settings, setSettings] = useState<PublicSettings | null>(null);
  const [activeIndex, setActiveIndex] = useState<number | null>(null);

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

  const toggleFaq = (index: number) => {
    setActiveIndex(activeIndex === index ? null : index);
  };

  return (
    <div className="bg-cream min-h-screen py-16 sm:py-24">
      <JsonLd data={{
        '@context': 'https://schema.org',
        '@type': 'FAQPage',
        mainEntity: faqs.map(faq => ({
          '@type': 'Question',
          name: faq.q,
          acceptedAnswer: {
            '@type': 'Answer',
            text: faq.a
          }
        }))
      }} />
      <div className="max-w-3xl mx-auto px-4">
        <div className="text-center max-w-xl mx-auto mb-12">
          <span className="inline-block mb-3 text-[10px] font-black uppercase tracking-[0.28em] text-terracotta">
            Got Questions?
          </span>
          <h1 className="text-4xl font-black text-earth tracking-tight mb-2 font-serif">Frequently Asked Questions</h1>
          <p className="text-muted-earth text-sm">Quick answers to common questions about our bakes and ordering process.</p>
        </div>

        <div className="bg-white border border-sand/50 rounded-[2.5rem] p-6 sm:p-10 shadow-earth-sm space-y-4">
          {faqs.map((faq, i) => {
            const isOpen = activeIndex === i;
            return (
              <div key={i} className="border-b border-sand/30 last:border-0 pb-4 last:pb-0">
                <button
                  onClick={() => toggleFaq(i)}
                  className="w-full flex items-center justify-between py-4 text-left group cursor-pointer"
                  aria-expanded={isOpen}
                >
                  <h3 className="font-bold text-earth group-hover:text-terracotta transition-colors text-sm sm:text-base leading-snug text-left inline">
                    {faq.q}
                  </h3>
                  <span className={`w-8 h-8 rounded-full bg-warm/50 flex items-center justify-center text-muted-earth shrink-0 ml-4 transition-transform duration-300 ${isOpen ? 'rotate-180 text-terracotta bg-terracotta/10' : 'group-hover:bg-sand/40'}`}>
                    <ChevronDown size={16} />
                  </span>
                </button>
                <div
                  className={`overflow-hidden transition-all duration-300 ease-in-out ${
                    isOpen ? 'max-h-[300px] opacity-100 pb-4' : 'max-h-0 opacity-0'
                  }`}
                >
                  <p className="text-sm text-muted-earth leading-relaxed pl-1">
                    {faq.a}
                  </p>
                </div>
              </div>
            );
          })}
        </div>

        <div className="mt-12 bg-warm border border-sand rounded-3xl p-8 text-center shadow-sm max-w-xl mx-auto">
          <div className="w-12 h-12 rounded-full bg-brand/10 text-brand flex items-center justify-center mx-auto mb-4">
            <HelpCircle size={22} />
          </div>
          <h2 className="font-bold text-earth mb-2 text-lg font-serif">Still have questions?</h2>
          <p className="text-sm text-muted-earth mb-6 max-w-sm mx-auto">We&apos;re here to help clarify details about custom orders, pickup times, or ingredients.</p>
          <Link href="/contact" className="btn-primary inline-block px-8 py-3 rounded-xl text-sm font-bold active:scale-[0.98] transition-all">
            Contact Us
          </Link>
        </div>
      </div>
    </div>
  );
}
