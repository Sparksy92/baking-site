'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowRight, Cookie, ShoppingBag, HeartHandshake, Sparkles, Flame } from 'lucide-react';

interface HotspotConfig {
  id: string;
  label: string;
  description: string;
  href: string;
  top: string;
  left: string;
  icon: any;
}

const HOTSPOTS: HotspotConfig[] = [
  {
    id: 'baked-fresh',
    label: 'Baked Fresh',
    description: 'Breads, buns, bagels, cinnamon rolls, and weekend sourdough.',
    href: '/shop?category=baked-fresh',
    top: '62%',
    left: '20%',
    icon: Cookie,
  },
  {
    id: 'pantry',
    label: 'Pantry Goods',
    description: 'Jams, jellies, pickled goods, simmer pots, dried mixes, and bundles.',
    href: '/shop?category=pantry',
    top: '42%',
    left: '82%',
    icon: ShoppingBag,
  },
  {
    id: 'custom-orders',
    label: 'Custom Orders',
    description: 'Cakes, custom desserts, special bakes, and order requests.',
    href: '/custom-orders',
    top: '68%',
    left: '52%',
    icon: HeartHandshake,
  },
  {
    id: 'home-body',
    label: 'Home & Body',
    description: 'Lotions, lip balms, salves, and herbal oils.',
    href: '/shop?category=home-body',
    top: '32%',
    left: '36%',
    icon: Sparkles,
  },
  {
    id: 'oven-fund',
    label: 'Oven Fund',
    description: 'Support the indoor oven upgrade and outdoor wood-fired oven build.',
    href: '/oven-fund',
    top: '28%',
    left: '60%',
    icon: Flame,
  },
];

export default function InteractiveKitchenScene() {
  const [activeHotspot, setActiveHotspot] = useState<string | null>(null);
  const router = useRouter();

  const handleHotspotClick = (id: string, href: string) => {
    if (activeHotspot === id) {
      router.push(href);
    } else {
      setActiveHotspot(id);
    }
  };

  return (
    <section className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col items-center">
      
      {/* Header Content */}
      <div className="text-center mb-8 max-w-2xl">
        <h2 className="text-3xl sm:text-4xl font-black text-earth tracking-[-0.02em] leading-tight mb-3">
          Explore the Homestead Kitchen
        </h2>
        <p className="text-sm text-muted-earth leading-relaxed">
          Tap around the kitchen to explore fresh baking, pantry goods, handmade care items, custom orders, and the Oven Fund.
        </p>
      </div>

      {/* Main Interactive Image Card */}
      <div className="relative w-full aspect-[16/10] md:aspect-[16/9] rounded-[2rem] border border-sand/40 overflow-hidden shadow-2xl bg-warm">
        
        {/* TODO: Replace with optimized final image storefront/public/images/home/interactive-kitchen.jpg when available. Currently using placeholder copy. */}
        <img
          src="/images/home/interactive-kitchen.jpg"
          alt="Cedar and Sage Homestead kitchen showing oven, pantry, prep table, window, and apothecary shelves"
          className="w-full h-full object-cover select-none"
        />

        {/* Soft shadow and depth overlay */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/20 via-transparent to-black/10 pointer-events-none" />

        {/* Hotspots Overlay */}
        {HOTSPOTS.map((hotspot) => {
          const leftVal = parseInt(hotspot.left);
          const tooltipAlignClass = leftVal > 75 
            ? 'right-0' 
            : leftVal < 25 
              ? 'left-0' 
              : 'left-1/2 -translate-x-1/2';

          return (
            <div
              key={hotspot.id}
              className="absolute -translate-x-1/2 -translate-y-1/2 z-10"
              style={{ top: hotspot.top, left: hotspot.left }}
              onMouseLeave={() => setActiveHotspot(null)}
            >
              {/* Outer pulsing ring / target area */}
              <button
                type="button"
                onClick={() => handleHotspotClick(hotspot.id, hotspot.href)}
                onMouseEnter={() => setActiveHotspot(hotspot.id)}
                onFocus={() => setActiveHotspot(hotspot.id)}
                onBlur={() => {
                  // Small timeout to prevent losing focus before mouse interactions register
                  setTimeout(() => {
                    setActiveHotspot((current) => current === hotspot.id ? null : current);
                  }, 150);
                }}
                className="w-11 h-11 flex items-center justify-center rounded-full focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-500 focus-visible:ring-offset-2 transition-transform duration-300 hover:scale-110 active:scale-95 cursor-pointer"
                aria-label={`Explore ${hotspot.label}`}
                aria-expanded={activeHotspot === hotspot.id}
              >
                <span className="relative flex h-5 w-5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-5 w-5 bg-amber-500 border-2 border-white shadow-md"></span>
                </span>
              </button>

              {/* Tooltip Popup */}
              {activeHotspot === hotspot.id && (
                <div
                  className={`absolute bottom-full mb-3 w-64 p-4 rounded-2xl bg-white/95 border border-sand/40 shadow-xl backdrop-blur-md z-20 transition-all duration-300 animate-fade-in text-left ${tooltipAlignClass}`}
                  onClick={(e) => e.stopPropagation()}
                >
                  <h4 className="text-earth text-base font-bold mb-1 tracking-tight">
                    {hotspot.label}
                  </h4>
                  <p className="text-muted-earth text-xs leading-relaxed mb-3">
                    {hotspot.description}
                  </p>
                  <Link
                    href={hotspot.href}
                    className="inline-flex items-center gap-1.5 text-xs font-black text-brand hover:text-brand-accent transition-colors"
                  >
                    <span>Explore</span>
                    <ArrowRight size={12} />
                  </Link>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Fallback Cards Section below the Image */}
      <div className="w-full mt-12">
        <div className="text-center mb-6">
          <span className="text-[10px] font-black uppercase tracking-[0.25em] text-terracotta block mb-1">
            Homestead Guides
          </span>
          <h3 className="text-xl sm:text-2xl font-black text-earth tracking-[-0.01em]">
            Browse by Kitchen Category
          </h3>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-5 w-full">
          {HOTSPOTS.map((hotspot) => {
            const Icon = hotspot.icon;
            return (
              <Link
                key={hotspot.id}
                href={hotspot.href}
                className="bg-white border border-sand hover:border-brand/40 rounded-2xl p-5 flex flex-col justify-between transition-all duration-300 hover:shadow-md hover:-translate-y-0.5 group"
              >
                <div>
                  <div className="w-9 h-9 rounded-xl bg-brand/10 text-brand flex items-center justify-center mb-4 group-hover:bg-brand group-hover:text-white transition-colors duration-300">
                    <Icon size={18} />
                  </div>
                  <h4 className="text-earth text-sm font-bold tracking-tight mb-1">
                    {hotspot.label}
                  </h4>
                  <p className="text-muted-earth text-xs leading-relaxed mb-4">
                    {hotspot.description}
                  </p>
                </div>
                <div className="inline-flex items-center gap-1 text-xs font-bold text-brand hover:text-brand-accent transition-colors w-fit mt-auto">
                  <span>Enter</span>
                  <ArrowRight size={12} className="transform group-hover:translate-x-0.5 transition-transform" />
                </div>
              </Link>
            );
          })}
        </div>
      </div>

    </section>
  );
}
