import type { Metadata } from 'next';
import { brandName, brandTagline, siteUrl } from '@/lib/format';

export function generateMetadata(): Metadata {
  return {
    title: 'Our Story',
    description: `Learn about ${brandName()} — ${brandTagline() || 'our story and mission'}.`,
    alternates: { canonical: `${siteUrl()}/about` },
  };
}

export default function AboutPage() {
  const name = brandName();
  const tagline = brandTagline();

  return (
    <div className="bg-white min-h-screen">
      {/* Hero */}
      <div className="relative bg-gray-900 text-white py-24 sm:py-32 overflow-hidden">
        <div className="absolute inset-0 bg-brand/20 mix-blend-multiply"></div>
        <div className="absolute inset-0 bg-gradient-to-t from-gray-900 to-transparent opacity-80"></div>
        <div className="relative max-w-4xl mx-auto px-4 text-center z-10">
          <h1 className="text-5xl md:text-7xl font-black tracking-tight mb-6">{name}</h1>
          {tagline && <p className="text-xl md:text-2xl text-gray-300 font-light max-w-2xl mx-auto">{tagline}</p>}
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 py-16 sm:py-24 space-y-20">
        
        {/* Story Section */}
        <section className="flex flex-col md:flex-row gap-12 items-center">
          <div className="flex-1 space-y-6">
            <h2 className="text-3xl font-bold text-gray-900">Our Story</h2>
            <div className="w-12 h-1 bg-brand rounded-full"></div>
            <p className="text-lg text-gray-600 leading-relaxed">
              {name} was born from a simple idea: culture should be lived, not archived. We create streetwear that carries the stories, symbols, and strength of Indigenous identity — designed to be worn every day, in every space.
            </p>
          </div>
          <div className="flex-1 w-full aspect-square bg-gray-100 rounded-3xl overflow-hidden relative border border-gray-200">
             <div className="absolute inset-0 flex items-center justify-center text-gray-400 font-medium">Brand Image</div>
          </div>
        </section>

        {/* Stand For Section */}
        <section className="flex flex-col md:flex-row-reverse gap-12 items-center">
          <div className="flex-1 space-y-6">
            <h2 className="text-3xl font-bold text-gray-900">What We Stand For</h2>
            <div className="w-12 h-1 bg-brand rounded-full"></div>
            <p className="text-lg text-gray-600 leading-relaxed">
              Every piece in our collection is a statement. We believe in visibility, in representation, and in the power of clothing to spark conversation and connection. Our designs draw from tradition while looking forward — modern fits, quality materials, and art that means something.
            </p>
          </div>
          <div className="flex-1 w-full aspect-square bg-gray-100 rounded-3xl overflow-hidden relative border border-gray-200">
             <div className="absolute inset-0 flex items-center justify-center text-gray-400 font-medium">Editorial Image</div>
          </div>
        </section>

        {/* Quality & Craft */}
        <section className="bg-gray-50 rounded-3xl p-8 sm:p-12 text-center border border-gray-100">
          <h2 className="text-3xl font-bold text-gray-900 mb-6">Quality &amp; Craft</h2>
          <p className="text-lg text-gray-600 leading-relaxed max-w-2xl mx-auto">
            We source premium fabrics and work with trusted manufacturers to ensure every garment meets our standards. From the weight of the cotton to the vibrancy of the print — every detail matters. We stand behind what we make.
          </p>
        </section>

      </div>
    </div>
  );
}
