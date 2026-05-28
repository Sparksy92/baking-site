import Script from 'next/script';
import { apiFetch, type PublicSettings } from '@/lib/api';

export async function Analytics() {
  let analyticsId = '';
  try {
    const settings = await apiFetch<PublicSettings>('/api/settings/public');
    analyticsId = settings.analytics_id;
  } catch {
    // API unavailable — skip analytics
  }

  if (!analyticsId) return null;

  return (
    <>
      <Script
        src={`https://www.googletagmanager.com/gtag/js?id=${analyticsId}`}
        strategy="afterInteractive"
      />
      <Script id="ga4-init" strategy="afterInteractive">
        {`
          window.dataLayer = window.dataLayer || [];
          function gtag(){dataLayer.push(arguments);}
          gtag('js', new Date());
          gtag('config', '${analyticsId}');
        `}
      </Script>
    </>
  );
}
