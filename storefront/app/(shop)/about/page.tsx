'use client';

import { useState, useEffect } from 'react';
import { api, type PublicSettings } from '@/lib/api';
import { brandName, brandTagline } from '@/lib/format';
import { Flame } from 'lucide-react';

export default function AboutPage() {
  const [settings, setSettings] = useState<PublicSettings | null>(null);

  useEffect(() => {
    api.get<PublicSettings>('/api/settings/public')
      .then(setSettings)
      .catch(() => {});
  }, []);

  const name = settings?.brand_name || brandName() || 'Sage & Sweetgrass Homestead';
  const tagline = settings?.brand_tagline || brandTagline() || 'Fresh baking, pantry goods & handmade homestead care';
  const aboutText = settings?.about_content || 'Sage & Sweetgrass Homestead is a small-batch homestead kitchen offering fresh baking, pantry goods, and handmade home and body products. Every request is handled with care, and many items are prepared by preorder so they can be made fresh.';

  return (
    <div className="bg-cream min-h-screen">
      {/* Hero */}
      <div className="relative bg-earth text-white py-20 sm:py-28 overflow-hidden border-b border-sand/30">
        <div className="absolute inset-0 bg-brand/10 mix-blend-multiply"></div>
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,rgba(200,162,168,0.12),transparent_50%)]" aria-hidden="true" />
        <div className="relative max-w-4xl mx-auto px-4 text-center z-10">
          <h1 className="text-4xl md:text-5xl font-black tracking-tight mb-4">{name}</h1>
          <p className="text-lg text-white/80 font-light max-w-xl mx-auto">{tagline}</p>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 py-16 sm:py-24 space-y-16">
        
        {/* Story Section */}
        <section className="flex flex-col md:flex-row gap-12 items-center">
          <div className="flex-1 space-y-6">
            <h2 className="text-3xl font-black text-earth tracking-tight">Our Story</h2>
            <div className="w-12 h-1 bg-brand rounded-full"></div>
            <p className="text-base text-muted-earth leading-relaxed whitespace-pre-line">
              {aboutText}
            </p>
          </div>
          <div className="flex-1 w-full aspect-square bg-white border border-sand/60 rounded-[2.5rem] overflow-hidden relative shadow-sm">
             <div className="absolute inset-0 flex flex-col items-center justify-center text-muted-earth font-medium p-8 text-center bg-warm">
               <span className="text-5xl mb-4">🌻</span>
               <h3 className="font-bold text-earth text-lg mb-2">Homestead Kitchen</h3>
               <p className="text-xs text-muted-earth">Baking fresh in small batches with wholesome ingredients.</p>
             </div>
          </div>
        </section>

        {/* Quality & Craft */}
        <section className="bg-white rounded-3xl p-8 sm:p-12 text-center border border-sand/50 shadow-sm">
          <div className="w-12 h-12 rounded-full bg-brand/10 text-brand flex items-center justify-center mx-auto mb-4">
            <Flame size={24} />
          </div>
          <h2 className="text-2xl font-black text-earth tracking-tight mb-4">Small Batch &amp; Freshly Prepared</h2>
          <p className="text-base text-muted-earth leading-relaxed max-w-2xl mx-auto">
            Because everything is prepared in our home kitchen, orders are made by request. This guarantees that your bread is baked fresh on the day of pickup, and your pantry goods are crafted in peak seasonal batches.
          </p>
        </section>

      </div>
    </div>
  );
}

