import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Shop Menu',
  description: 'Browse our fresh bread selections, home-baked desserts, pantry preserves, and homestead body care products.',
};

export default function ShopLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
