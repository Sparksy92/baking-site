import type { Metadata } from 'next';
import { brandName, siteUrl } from '@/lib/format';
import { brandConfig } from '@/config/brand.config';
import { JsonLd } from '@/components/JsonLd';

export function generateMetadata(): Metadata {
  const name = brandName();
  return {
    title: 'Services',
    description: `Explore what ${name} offers.`,
    alternates: { canonical: `${siteUrl()}/services` },
  };
}

/**
 * Services page — generic enough for any service-business fork.
 *
 * Content is driven by brandConfig.services (if defined) or falls back to
 * a single generic Service entry built from brand metadata.
 * JSON-LD emits one schema.org/Service block per service entry.
 *
 * To customise: add a `services` array to brandConfig (type: BrandService[]).
 */

interface ServiceEntry {
  name: string;
  description: string;
  url: string;
  serviceType?: string;
  areaServed?: string;
}

function getServices(): ServiceEntry[] {
  const name = brandName();
  const base = siteUrl();

  // If the brand config exposes a services array in the future, use it.
  // For now derive a sensible single entry from brand metadata.
  return [
    {
      name: `${name} — Products & Services`,
      description: brandConfig.metadata.description,
      url: `${base}/services`,
      serviceType: brandConfig.localBusiness?.type ?? 'OnlineBusiness',
      areaServed: brandConfig.localBusiness?.addressCountry ?? 'CA',
    },
  ];
}

export default function ServicesPage() {
  const name = brandName();
  const url = `${siteUrl()}/services`;
  const services = getServices();

  return (
    <div className="bg-white min-h-screen">
      {/* JSON-LD — one block per service */}
      {services.map((svc, i) => (
        <JsonLd
          key={i}
          data={{
            '@context': 'https://schema.org',
            '@type': 'Service',
            name: svc.name,
            description: svc.description,
            url: svc.url,
            ...(svc.serviceType ? { serviceType: svc.serviceType } : {}),
            ...(svc.areaServed ? { areaServed: svc.areaServed } : {}),
            provider: {
              '@type': 'Organization',
              name,
              url: siteUrl(),
            },
          }}
        />
      ))}

      {/* Breadcrumb JSON-LD */}
      <JsonLd data={{
        '@context': 'https://schema.org',
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'Home', item: siteUrl() },
          { '@type': 'ListItem', position: 2, name: 'Services', item: url },
        ],
      }} />

      {/* Page UI */}
      <div className="max-w-4xl mx-auto px-4 py-16 sm:py-24">
        <div className="mb-14">
          <h1 className="text-4xl md:text-5xl font-extrabold text-gray-900 tracking-tight mb-4">
            What We Offer
          </h1>
          <p className="text-lg text-gray-600 max-w-2xl">
            {brandConfig.metadata.description}
          </p>
        </div>

        <div className="grid gap-8 sm:grid-cols-2">
          {services.map((svc, i) => (
            <div
              key={i}
              className="bg-gray-50 rounded-2xl p-8 border border-gray-100"
            >
              <h2 className="text-xl font-bold text-gray-900 mb-3">{svc.name}</h2>
              <p className="text-gray-600 leading-relaxed">{svc.description}</p>
              {svc.areaServed && (
                <p className="mt-4 text-sm text-gray-400">Area served: {svc.areaServed}</p>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
