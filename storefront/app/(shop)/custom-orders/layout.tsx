import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Custom Orders',
  description: 'Place custom order requests for celebration cakes, specialty pastries, bulk baking, or gift bundles.',
};

export default function CustomOrdersLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
