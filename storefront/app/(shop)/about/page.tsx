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
      <div className="relative bg-earth text-white py-24 sm:py-32 overflow-hidden border-b border-sand/30">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,rgba(200,162,168,0.18),transparent_60%)]" aria-hidden="true" />
        <div className="absolute inset-0 bg-brand/10 mix-blend-multiply" />
        <div className="relative max-w-4xl mx-auto px-4 text-center z-10">
          <h1 className="text-4xl md:text-6xl font-bold font-serif tracking-tight mb-4 text-[#F7F4EB]">{name}</h1>
          <p className="text-base sm:text-xl text-white/95 font-medium max-w-2xl mx-auto leading-relaxed">{tagline}</p>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 py-16 sm:py-24 space-y-16">
        
        {/* Story Section */}
        <section className="flex flex-col md:flex-row gap-12 items-center">
          <div className="flex-1 space-y-6">
            <span className="text-[10px] font-black uppercase tracking-[0.28em] text-terracotta block">Our Journey</span>
            <h2 className="text-3xl sm:text-4xl font-bold text-earth tracking-tight font-serif">Our Story</h2>
            <div className="w-12 h-1 bg-brand rounded-full" />
            <p className="text-base text-muted-earth leading-relaxed whitespace-pre-line font-medium">
              {aboutText}
            </p>
          </div>
          <div className="flex-1 w-full aspect-square bg-white border border-sand/60 rounded-[2.5rem] overflow-hidden relative shadow-sm hover:shadow-md hover:scale-[1.01] transition-all duration-500 group">
             <div className="absolute inset-0 flex flex-col items-center justify-center text-muted-earth font-medium p-8 text-center bg-warm transition-colors duration-300 group-hover:bg-sand/20">
               <span className="text-6xl mb-4 transform group-hover:scale-110 transition-transform duration-500">🌻</span>
               <h3 className="font-bold text-earth text-lg mb-2 font-serif">Homestead Kitchen</h3>
               <p className="text-xs text-muted-earth max-w-xs leading-relaxed">Baking fresh in small batches with traditional methods and organic homestead ingredients.</p>
             </div>
          </div>
        </section>

        {/* Quality & Craft */}
        <section className="bg-white rounded-3xl p-8 sm:p-12 text-center border border-sand/50 shadow-sm hover:shadow-md hover:scale-[1.005] transition-all duration-500 relative overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-1 bg-brand" />
          <div className="w-12 h-12 rounded-full bg-brand/10 text-brand flex items-center justify-center mx-auto mb-4">
            <Flame size={24} />
          </div>
          <h2 className="text-2xl sm:text-3xl font-bold text-earth tracking-tight mb-4 font-serif">Small Batch &amp; Freshly Prepared</h2>
          <p className="text-base text-muted-earth leading-relaxed max-w-2xl mx-auto font-medium">
            Because everything is prepared in our home kitchen, orders are made by request. This guarantees that your bread is baked fresh on the day of pickup, and your pantry goods are crafted in peak seasonal batches.
          </p>
        </section>

      </div>
    </div>
  );
}

