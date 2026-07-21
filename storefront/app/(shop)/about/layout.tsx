import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Our Story',
  description: 'Learn about the story, philosophy, and kitchen standards behind The Artisan Bakery.',
};

export default function AboutLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
