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
    <div className="max-w-4xl mx-auto px-4 py-12">
      <div className="text-center mb-12">
        <h1 className="text-4xl md:text-5xl font-black text-gray-900">{name}</h1>
        {tagline && <p className="mt-3 text-xl text-gray-500">{tagline}</p>}
      </div>

      <div className="space-y-8 text-gray-600 leading-relaxed">
        <section>
          <h2 className="text-2xl font-bold text-gray-900 mb-3">Our Story</h2>
          <p>
            {name} was born from a simple idea: culture should be lived, not archived. We create streetwear that carries the stories, symbols, and strength of Indigenous identity — designed to be worn every day, in every space.
          </p>
        </section>

        <section>
          <h2 className="text-2xl font-bold text-gray-900 mb-3">What We Stand For</h2>
          <p>
            Every piece in our collection is a statement. We believe in visibility, in representation, and in the power of clothing to spark conversation and connection. Our designs draw from tradition while looking forward — modern fits, quality materials, and art that means something.
          </p>
        </section>

        <section>
          <h2 className="text-2xl font-bold text-gray-900 mb-3">Quality &amp; Craft</h2>
          <p>
            We source premium fabrics and work with trusted manufacturers to ensure every garment meets our standards. From the weight of the cotton to the vibrancy of the print — every detail matters. We stand behind what we make.
          </p>
        </section>

        <section>
          <h2 className="text-2xl font-bold text-gray-900 mb-3">Community First</h2>
          <p>
            This is more than a brand — it&apos;s a community. We are committed to supporting Indigenous communities and giving back. When you shop with us, you are supporting Indigenous entrepreneurship and creative expression.
          </p>
        </section>
      </div>
    </div>
  );
}
