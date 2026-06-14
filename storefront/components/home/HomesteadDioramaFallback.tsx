'use client';

import Link from 'next/link';
import { ArrowRight, Flame, Cookie, Sparkles, ShoppingBag } from 'lucide-react';

export type CategoryData = {
  id: string;
  title: string;
  description: string;
  href: string;
  icon: any;
  tagline: string;
};

export const CATEGORIES: CategoryData[] = [
  {
    id: 'baked-fresh',
    title: 'Baked Fresh',
    tagline: 'Artisan Breads & Sourdough',
    description: 'Fresh breads, buns, bagels, cinnamon rolls, and weekend sourdough preorders.',
    href: '/shop?category=baked-fresh',
    icon: Cookie,
  },
  {
    id: 'pantry',
    title: 'Pantry',
    tagline: 'Preserves & Pantry Goods',
    description: 'Jams, jellies, pickled goods, dried mixes, simmer pots, and seasonal bundles.',
    href: '/shop?category=pantry',
    icon: ShoppingBag,
  },
  {
    id: 'home-body',
    title: 'Home & Body',
    tagline: 'Lotions & Herbal Salves',
    description: 'Handmade homestead care, tallow lotions, lip balms, salves, and herbal oils.',
    href: '/shop?category=home-body',
    icon: Sparkles,
  },
  {
    id: 'oven-fund',
    title: 'Oven Fund',
    tagline: 'Help Build Our Capacity',
    description: 'Support the tools and equipment that help Cedar & Sage grow. View our progress and support tiers.',
    href: '/oven-fund',
    icon: Flame,
  },
];

export default function HomesteadDioramaFallback() {
  return (
    <div className="w-full">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {CATEGORIES.map((category) => {
          const Icon = category.icon;
          return (
            <div
              key={category.id}
              className="bg-warm border border-sand hover:border-brand rounded-3xl p-8 flex flex-col justify-between transition-all duration-300 hover:shadow-lg group"
            >
              <div>
                <div className="w-12 h-12 rounded-2xl bg-brand/10 text-brand flex items-center justify-center mb-6 group-hover:bg-brand group-hover:text-white transition-colors duration-300">
                  <Icon size={24} />
                </div>
                <h3 className="text-earth text-xs font-black uppercase tracking-[0.2em] mb-1">
                  {category.title}
                </h3>
                <h4 className="text-earth text-xl font-bold mb-3 tracking-[-0.01em]">
                  {category.tagline}
                </h4>
                <p className="text-muted-earth text-sm leading-relaxed mb-6">
                  {category.description}
                </p>
              </div>
              <Link
                href={category.href}
                className="inline-flex items-center gap-2 text-sm font-bold text-brand hover:text-brand-accent transition-colors mt-auto w-fit"
                aria-label={`Enter ${category.title}`}
              >
                <span>Enter Section</span>
                <ArrowRight size={16} className="transform group-hover:translate-x-1 transition-transform" />
              </Link>
            </div>
          );
        })}
      </div>
    </div>
  );
}
