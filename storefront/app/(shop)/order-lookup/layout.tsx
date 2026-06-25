import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Order Lookup',
  robots: { index: false, follow: false },
};

export default function OrderLookupLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
