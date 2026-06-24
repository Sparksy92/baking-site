import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Our Story',
  description: 'Learn about the story, philosophy, and kitchen standards behind Sage & Sweetgrass Homestead.',
};

export default function AboutLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
