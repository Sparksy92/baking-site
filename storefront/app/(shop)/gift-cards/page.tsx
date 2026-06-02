import type { Metadata } from 'next';
import { brandName } from '@/lib/format';
import { GiftCardChecker } from '@/components/gift-card/GiftCardChecker';

export const metadata: Metadata = {
  title: `Gift Cards | ${brandName()}`,
  description: 'Check your gift card balance.',
};

export default function GiftCardsPage() {
  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-16 md:py-24">
      <div className="text-center mb-12">
        <h1 className="text-4xl font-extrabold text-gray-900 mb-4">Gift Cards</h1>
        <p className="text-lg text-gray-600 max-w-2xl mx-auto">
          Have a gift card? Enter your code below to check your remaining balance.
        </p>
      </div>

      <GiftCardChecker />
    </div>
  );
}
