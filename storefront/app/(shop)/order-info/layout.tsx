import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Order Information',
  description: 'Details on ordering timelines, sourdough preorders, e-transfer payments, and homestead pickup location.',
};

export default function OrderInfoLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
