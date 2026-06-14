import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Oven Fund',
  description: 'Help us fund deck-oven upgrades to bake more fresh bread for our local community.',
};

export default function OvenFundLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
