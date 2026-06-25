'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { api, type PublicSettings } from '@/lib/api';
import { brandName, siteUrl } from '@/lib/format';
import ContactForm from './ContactForm';
import { Mail, Clock, FileText, ExternalLink } from 'lucide-react';

export default function ContactPage() {
  const [settings, setSettings] = useState<PublicSettings | null>(null);

  useEffect(() => {
    api.get<PublicSettings>('/api/settings/public')
      .then(setSettings)
      .catch(() => {});
  }, []);

  const name = settings?.brand_name || brandName() || 'Sage & Sweetgrass Homestead';
  const email = settings?.contact_email || settings?.etransfer_email || 'kirstinsparks@hotmail.com';

  return (
    <div className="bg-cream min-h-screen py-16 md:py-24">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        
        <div className="text-center max-w-2xl mx-auto mb-16">
          <h1 className="text-4xl md:text-5xl font-black text-earth mb-4 tracking-tight">Contact Us</h1>
          <p className="text-lg text-muted-earth">
            Have a question about a bake, ingredients, custom desserts, or your order request? We&apos;d love to hear from you.
          </p>
        </div>

        <div className="flex flex-col lg:flex-row gap-12 lg:gap-20">
          
          {/* Contact Form */}
          <div className="flex-1">
            <div className="bg-white p-8 sm:p-10 rounded-[2.5rem] shadow-sm border border-sand/50">
              <ContactForm />
            </div>
          </div>

          {/* Sidebar */}
          <div className="w-full lg:w-[380px] space-y-8">
            <div className="bg-white p-8 rounded-3xl shadow-sm border border-sand/50 space-y-8">
              
              <div className="flex items-start gap-4">
                <div className="w-10 h-10 rounded-full bg-brand/10 flex items-center justify-center flex-shrink-0 mt-1">
                  <Mail className="text-brand w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-base font-bold text-earth mb-1">Email</h2>
                  <a href={`mailto:${email}`} className="text-brand hover:text-brand/80 transition-colors font-semibold">
                    {email}
                  </a>
                </div>
              </div>

              <div className="flex items-start gap-4">
                <div className="w-10 h-10 rounded-full bg-brand/10 flex items-center justify-center flex-shrink-0 mt-1">
                  <Clock className="text-brand w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-base font-bold text-earth mb-1">Response Time</h2>
                  <p className="text-muted-earth text-sm leading-relaxed">Kirstin typically responds within 24 hours.</p>
                </div>
              </div>

              <div className="flex items-start gap-4">
                <div className="w-10 h-10 rounded-full bg-brand/10 flex items-center justify-center flex-shrink-0 mt-1">
                  <FileText className="text-brand w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-base font-bold text-earth mb-1">Order Requests</h2>
                  <p className="text-muted-earth text-sm leading-relaxed">
                    Order requests are reviewed in the order received. You will receive an email once Kirstin confirms availability and final pricing.
                  </p>
                </div>
              </div>

            </div>

            <div className="bg-earth rounded-3xl p-8 text-white">
              <h2 className="text-lg font-bold mb-4">Quick Links</h2>
              <ul className="space-y-3">
                <li><Link href="/order-info" className="flex items-center gap-2 text-white/80 hover:text-white transition-colors group"><ExternalLink size={16} className="group-hover:-translate-y-0.5 group-hover:translate-x-0.5 transition-transform" /> Order Information</Link></li>
                <li><Link href="/faq" className="flex items-center gap-2 text-white/80 hover:text-white transition-colors group"><ExternalLink size={16} className="group-hover:-translate-y-0.5 group-hover:translate-x-0.5 transition-transform" /> Frequently Asked Questions</Link></li>
                <li><Link href="/oven-fund" className="flex items-center gap-2 text-white/80 hover:text-white transition-colors group"><ExternalLink size={16} className="group-hover:-translate-y-0.5 group-hover:translate-x-0.5 transition-transform" /> Homestead Oven Fund</Link></li>
              </ul>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}

