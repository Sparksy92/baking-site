import type { Metadata } from 'next';
import Link from 'next/link';
import { brandName, siteUrl } from '@/lib/format';
import { JsonLd } from '@/components/JsonLd';
import ContactForm from './ContactForm';
import { Mail, Clock, FileText, ExternalLink } from 'lucide-react';

export function generateMetadata(): Metadata {
  return {
    title: 'Contact Us',
    description: `Get in touch with ${brandName()}.`,
    alternates: { canonical: `${siteUrl()}/contact` },
  };
}

export default function ContactPage() {
  const name = brandName();
  const url = `${siteUrl()}/contact`;

  return (
    <div className="bg-gray-50/50 min-h-screen py-16 md:py-24">
      <JsonLd data={{
        '@context': 'https://schema.org',
        '@type': 'ContactPage',
        name: `Contact ${name}`,
        description: `Get in touch with ${name}.`,
        url,
        isPartOf: { '@type': 'WebSite', url: siteUrl(), name },
        breadcrumb: {
          '@type': 'BreadcrumbList',
          itemListElement: [
            { '@type': 'ListItem', position: 1, name: 'Home', item: siteUrl() },
            { '@type': 'ListItem', position: 2, name: 'Contact', item: url },
          ],
        },
      }} />
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        
        <div className="text-center max-w-2xl mx-auto mb-16">
          <h1 className="text-4xl md:text-5xl font-extrabold text-gray-900 mb-4 tracking-tight">Contact Us</h1>
          <p className="text-lg text-gray-600">
            Have a question about an order, a product, or just want to say hey? We&apos;d love to hear from you.
          </p>
        </div>

        <div className="flex flex-col lg:flex-row gap-12 lg:gap-20">
          
          {/* Contact Form */}
          <div className="flex-1">
            <div className="bg-white p-8 sm:p-10 rounded-3xl shadow-xl shadow-gray-200/40 border border-gray-100">
              <ContactForm />
            </div>
          </div>

          {/* Sidebar */}
          <div className="w-full lg:w-[380px] space-y-8">
            <div className="bg-white p-8 rounded-3xl shadow-sm border border-gray-100 space-y-8">
              
              <div className="flex items-start gap-4">
                <div className="w-10 h-10 rounded-full bg-brand/10 flex items-center justify-center flex-shrink-0 mt-1">
                  <Mail className="text-brand w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-base font-bold text-gray-900 mb-1">Email</h2>
                  <a href={`mailto:hello@${name.toLowerCase().replace(/\s+/g, '')}.com`} className="text-gray-600 hover:text-brand transition-colors font-medium">
                    hello@{name.toLowerCase().replace(/\s+/g, '')}.com
                  </a>
                </div>
              </div>

              <div className="flex items-start gap-4">
                <div className="w-10 h-10 rounded-full bg-blue-50 flex items-center justify-center flex-shrink-0 mt-1">
                  <Clock className="text-blue-600 w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-base font-bold text-gray-900 mb-1">Response Time</h2>
                  <p className="text-gray-600 text-sm leading-relaxed">We typically respond within 24 hours during business days.</p>
                </div>
              </div>

              <div className="flex items-start gap-4">
                <div className="w-10 h-10 rounded-full bg-purple-50 flex items-center justify-center flex-shrink-0 mt-1">
                  <FileText className="text-purple-600 w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-base font-bold text-gray-900 mb-1">Order Issues</h2>
                  <p className="text-gray-600 text-sm leading-relaxed">
                    For order-related questions, please include your order number. You can also track your order directly on our site.
                  </p>
                </div>
              </div>

            </div>

            <div className="bg-gray-900 rounded-3xl p-8 text-white">
              <h2 className="text-lg font-bold mb-4">Quick Links</h2>
              <ul className="space-y-3">
                <li><Link href="/order-lookup" className="flex items-center gap-2 text-gray-400 hover:text-white transition-colors group"><ExternalLink size={16} className="group-hover:-translate-y-0.5 group-hover:translate-x-0.5 transition-transform" /> Track Your Order</Link></li>
                <li><Link href="/shipping-policy" className="flex items-center gap-2 text-gray-400 hover:text-white transition-colors group"><ExternalLink size={16} className="group-hover:-translate-y-0.5 group-hover:translate-x-0.5 transition-transform" /> Shipping Policy</Link></li>
                <li><Link href="/return-policy" className="flex items-center gap-2 text-gray-400 hover:text-white transition-colors group"><ExternalLink size={16} className="group-hover:-translate-y-0.5 group-hover:translate-x-0.5 transition-transform" /> Return &amp; Exchange Policy</Link></li>
                <li><Link href="/faq" className="flex items-center gap-2 text-gray-400 hover:text-white transition-colors group"><ExternalLink size={16} className="group-hover:-translate-y-0.5 group-hover:translate-x-0.5 transition-transform" /> Frequently Asked Questions</Link></li>
              </ul>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
