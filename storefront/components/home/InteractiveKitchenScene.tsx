'use client';

import { useState, useRef } from 'react';
import Link from 'next/link';
import { ArrowRight, Cookie, ShoppingBag, HeartHandshake, Sparkles, Flame, X } from 'lucide-react';

interface KitchenZoneConfig {
  id: string;
  title: string;
  shortLabel: string;
  description: string;
  href: string;
  top: string;
  left: string;
  thumbnail: string;
  previewItems: string[];
  icon: any;
  ctaText: string;
}

const KITCHEN_ZONES: KitchenZoneConfig[] = [
  {
    id: 'baked-fresh',
    title: 'Baked Fresh',
    shortLabel: 'Baked Fresh',
    description: 'Fresh breads, buns, bagels, cinnamon rolls, and weekend sourdough.',
    href: '/shop?category=baked-fresh',
    top: '62%',
    left: '84%',
    thumbnail: '/images/products/sourdough.jpg',
    previewItems: ['Artisan Bread', 'Sandwich Loaf', 'Bagels', 'Buns', 'Sourdough', 'Cinnamon Rolls'],
    icon: Cookie,
    ctaText: 'View Baked Fresh Menu',
  },
  {
    id: 'pantry',
    title: 'Pantry Goods',
    shortLabel: 'Pantry Goods',
    description: 'Jams, jellies, pickled goods, simmer pots, dried mixes, and seasonal bundles.',
    href: '/shop?category=pantry',
    top: '27%',
    left: '76%',
    thumbnail: '/images/products/jams.jpg',
    previewItems: ['Jams/Jellies', 'Pickled Goods', 'Simmer Pots', 'Dried Mix Jars', 'Bundles'],
    icon: ShoppingBag,
    ctaText: 'View Pantry Goods',
  },
  {
    id: 'special-bakes',
    title: 'Special Bakes',
    shortLabel: 'Special Bakes',
    description: 'Cheesecakes, custom desserts, celebration bakes, and approval-based preorder items.',
    href: '/custom-orders',
    top: '52%',
    left: '68%',
    thumbnail: '/images/products/cheesecakes.jpg',
    previewItems: ['Cheesecakes', 'Custom Desserts', 'Occasion Cakes', 'Cupcakes'],
    icon: Sparkles,
    ctaText: 'Request a Custom Order',
  },
  {
    id: 'custom-orders',
    title: 'Custom Orders',
    shortLabel: 'Custom Orders',
    description: 'Explain special bakes, large batches, occasion desserts, and preorder requests.',
    href: '/custom-orders',
    top: '67%',
    left: '50%',
    thumbnail: '/images/products/custom-desserts.jpg',
    previewItems: ['Celebration Platters', 'Large Batch Bakes', 'Special Preorders'],
    icon: HeartHandshake,
    ctaText: 'Start an Order Request',
  },
  {
    id: 'home-body',
    title: 'Home & Body',
    shortLabel: 'Home & Body',
    description: 'Handmade lotions, lip balms, salves, herbal oils, and home & body care.',
    href: '/shop?category=home-body',
    top: '32%',
    left: '36%',
    thumbnail: '/images/products/lotions.jpg',
    previewItems: ['Lotions', 'Lip Balms', 'Salves', 'Herbal Oils'],
    icon: Sparkles,
    ctaText: 'View Home & Body',
  },
  {
    id: 'oven-fund',
    title: 'Oven Fund',
    shortLabel: 'Oven Fund',
    description: 'Support the indoor oven upgrade and outdoor wood-fired oven build.',
    href: '/oven-fund',
    top: '34%',
    left: '18%',
    thumbnail: '/images/products/oven-fund.jpg',
    previewItems: ['Primary Oven Upgrade', 'Outdoor Brick Oven', 'Supporter Wall Perk'],
    icon: Flame,
    ctaText: 'Support the Oven Fund',
  },
];

export default function InteractiveKitchenScene() {
  const [activeZone, setActiveZone] = useState<string | null>(null);
  const [hoveredHotspot, setHoveredHotspot] = useState<string | null>(null);
  const drawerRef = useRef<HTMLDivElement>(null);

  const handleHotspotClick = (id: string, e: React.MouseEvent | React.KeyboardEvent) => {
    e.stopPropagation();
    setActiveZone(activeZone === id ? null : id);
  };

  const activeZoneConfig = KITCHEN_ZONES.find(z => z.id === activeZone);
  const isLeftHotspot = activeZoneConfig && parseInt(activeZoneConfig.left) < 50;
  const drawerAlignClass = isLeftHotspot ? 'md:right-4 md:left-auto' : 'md:left-4 md:right-auto';

  return (
    <section className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col items-center">
      
      {/* Header Content */}
      <div className="text-center mb-8 max-w-2xl flex flex-col items-center">
        <span className="text-[10px] font-black uppercase tracking-[0.25em] text-terracotta block mb-2">
          Interactive Kitchen Map
        </span>
        <h2 className="text-3xl sm:text-4xl font-black text-earth tracking-[-0.02em] leading-tight mb-3">
          Explore the Homestead Kitchen
        </h2>
        <p className="text-sm text-muted-earth leading-relaxed">
          Tap around the kitchen to explore fresh baking, pantry goods, handmade care items, custom orders, and the Oven Fund.
        </p>
      </div>

      {/* Main Container Card */}
      <div 
        className="relative w-full aspect-[16/10] md:aspect-[16/9] bg-warm rounded-[2rem] cursor-default"
        onClick={() => setActiveZone(null)}
      >
        <div className="absolute inset-0 rounded-[2rem] border border-[#EBE3D5] overflow-hidden shadow-2xl w-full h-full">
          <div className="w-full h-full relative">
            {/* Main Background Image */}
            <img
              src="/images/home/interactive-kitchen.jpg"
              alt="The Artisan Bakery kitchen showing oven, pantry, prep table, window, and apothecary shelves"
              className="w-full h-full object-cover select-none"
            />

            {/* Subtle Vignette Overlay for Realism */}
            <div className="absolute inset-0 pointer-events-none shadow-[inset_0_0_80px_rgba(0,0,0,0.25)] z-2" />
            <div className="absolute inset-0 bg-gradient-to-t from-black/15 via-transparent to-black/10 pointer-events-none z-2" />

            {/* Dimming overlay when any zone is selected to spotlight the active zone */}
            <div 
              className={`absolute inset-0 bg-black/40 transition-opacity duration-500 pointer-events-none z-4 ${
                activeZone ? 'opacity-100' : 'opacity-0'
              }`}
            />

            {/* Hotspots Render Overlay */}
            {KITCHEN_ZONES.map((hotspot) => {
              const isSelected = activeZone === hotspot.id;
              const isHovered = hoveredHotspot === hotspot.id;
              const Icon = hotspot.icon;

              return (
                <div
                  key={hotspot.id}
                  className={`absolute -translate-x-1/2 -translate-y-1/2 transition-all duration-300 ${
                    isSelected || isHovered ? 'z-10' : 'z-3'
                  }`}
                  style={{ top: hotspot.top, left: hotspot.left }}
                  onMouseLeave={() => setHoveredHotspot(null)}
                >
                  
                  {/* Modern glassmorphic tooltip (displays only on hover/select) */}
                  <div 
                    className={`absolute bottom-full mb-3 left-1/2 -translate-x-1/2 px-3 py-1.5 rounded-xl border border-white/20 bg-white/25 backdrop-blur-md text-white text-[10px] font-bold uppercase tracking-widest pointer-events-none select-none transition-all duration-300 shadow-xl whitespace-nowrap flex items-center gap-2 ${
                      isSelected || isHovered ? 'opacity-100 translate-y-0 scale-100' : 'opacity-0 translate-y-1 scale-95'
                    }`}
                  >
                    <Icon size={11} className="text-amber-300 shrink-0" />
                    <span>{hotspot.shortLabel}</span>
                  </div>

                  {/* Minimalist target focus ring button */}
                  <button
                    type="button"
                    onClick={(e) => handleHotspotClick(hotspot.id, e)}
                    onMouseEnter={() => setHoveredHotspot(hotspot.id)}
                    onFocus={() => setHoveredHotspot(hotspot.id)}
                    onBlur={() => setHoveredHotspot(null)}
                    className="w-10 h-10 md:w-16 md:h-16 flex items-center justify-center rounded-full focus:outline-none focus-visible:ring-2 focus-visible:ring-white z-10 bg-transparent transition-transform active:scale-95 cursor-pointer group"
                    aria-label={`Open details for ${hotspot.title}`}
                    aria-expanded={isSelected}
                  >
                    <span className="relative flex h-8 w-8 items-center justify-center">
                      {/* Pulsing outer ring */}
                      <span className={`absolute inset-0 rounded-full border border-white/40 transition-all duration-300 scale-75 group-hover:scale-100 ${
                        isSelected || isHovered ? 'scale-100 border-white bg-white/10' : 'animate-pulse'
                      }`} />
                      
                      {/* Core dot */}
                      <span className={`h-2 w-2 rounded-full bg-white transition-all duration-300 ${
                        isSelected || isHovered ? 'bg-amber-400 scale-125 shadow-lg' : ''
                      }`} />
                    </span>
                  </button>
                </div>
              );
            })}
          </div>
        </div>

        {/* Mobile Backdrop Overlay */}
        {activeZoneConfig && (
          <div 
            className="fixed inset-0 bg-black/40 z-40 md:hidden transition-opacity"
            onClick={(e) => {
              e.stopPropagation();
              setActiveZone(null);
            }}
            aria-hidden="true"
          />
        )}

        {/* Stable Side Drawer / Details Panel */}
        {activeZoneConfig && (
          <div
            ref={drawerRef}
            tabIndex={-1}
            className="fixed bottom-0 left-0 right-0 z-50 rounded-t-[2rem] max-h-[80vh] md:absolute md:top-4 md:bottom-4 md:w-96 md:rounded-2xl md:z-20 p-6 bg-[#FDFBF7]/95 border-t border-x md:border border-[#EBE3D5] shadow-2xl backdrop-blur-md text-left transition-all duration-300 ease-out drawerAlignClass overflow-y-auto flex flex-col justify-between"
            style={{
              left: isLeftHotspot ? 'auto' : '1rem',
              right: isLeftHotspot ? '1rem' : 'auto'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Drag Handle (Mobile only) */}
            <div className="w-12 h-1 bg-[#EBE3D5] rounded-full mx-auto mb-4 md:hidden shrink-0" />
            
            {/* Drawer Header & Content */}
            <div className="space-y-4">
              <div className="flex justify-between items-start">
                <div className="flex gap-3 items-center">
                  <div className="w-10 h-10 rounded-xl bg-brand/10 text-brand flex items-center justify-center">
                    <activeZoneConfig.icon size={20} />
                  </div>
                  <div>
                    <h3 className="text-earth text-base font-bold tracking-tight">
                      {activeZoneConfig.title}
                    </h3>
                    <span className="text-[9px] font-bold text-terracotta uppercase tracking-wider block">
                      Homestead Room Detail
                    </span>
                  </div>
                </div>
                
                {/* Manual Close Button */}
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setActiveZone(null);
                  }}
                  className="w-7 h-7 rounded-lg border border-[#EBE3D5] text-muted-earth hover:text-earth flex items-center justify-center hover:bg-warm transition-colors focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 focus:outline-none"
                  aria-label="Close drawer and return to kitchen overview"
                >
                  <X size={14} />
                </button>
              </div>

              {/* Thumbnail and Description */}
              <div className="flex gap-4 items-start bg-warm/30 border border-[#EBE3D5]/40 p-3 rounded-xl">
                <img 
                  src={activeZoneConfig.thumbnail} 
                  alt={activeZoneConfig.title} 
                  className="w-16 h-16 rounded-xl object-cover border border-[#EBE3D5] shrink-0" 
                />
                <p className="text-muted-earth text-xs leading-relaxed">
                  {activeZoneConfig.description}
                </p>
              </div>

              {/* Preview featured products */}
              <div className="space-y-2.5">
                <span className="text-[10px] font-black uppercase tracking-wider text-muted-earth block">
                  Featured Selections
                </span>
                <div className="grid grid-cols-2 gap-2">
                  {activeZoneConfig.previewItems.map((item) => (
                    <div 
                      key={item} 
                      className="bg-white border border-[#EBE3D5]/80 p-2 rounded-xl text-xs text-earth font-semibold flex items-center gap-1.5 shadow-xs"
                    >
                      <div className="w-1.5 h-1.5 rounded-full bg-brand shrink-0" />
                      <span className="truncate">{item}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Footer CTAs */}
            <div className="border-t border-[#EBE3D5] pt-4 mt-6">
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 w-full">
                <Link
                  href={activeZoneConfig.href}
                  className="w-full sm:w-auto sm:flex-1 text-center bg-brand text-white px-4 py-2.5 rounded-xl font-bold text-xs hover:bg-brand-accent transition-colors shadow-xs focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 focus:outline-none"
                >
                  {activeZoneConfig.ctaText}
                </Link>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setActiveZone(null);
                  }}
                  className="w-full sm:w-auto text-center px-4 py-2.5 border border-[#EBE3D5] text-earth font-bold text-xs rounded-xl hover:bg-warm transition-colors focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 focus:outline-none"
                >
                  Back to Kitchen
                </button>
              </div>
            </div>

          </div>
        )}
      </div>

      {/* Quick Explore Cards Section below the Image */}
      <div className="w-full mt-12">
        <div className="text-center mb-6">
          <span className="text-[10px] font-black uppercase tracking-[0.25em] text-terracotta block mb-1">
            Quick Explore
          </span>
          <h3 className="text-xl sm:text-2xl font-black text-earth tracking-[-0.01em]">
            Browse by Kitchen Category
          </h3>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-5 w-full">
          {KITCHEN_ZONES.map((hotspot) => {
            const Icon = hotspot.icon;
            return (
              <Link
                key={hotspot.id}
                href={hotspot.href}
                className="bg-white border border-[#EBE3D5] hover:border-brand rounded-2xl p-4 flex flex-col justify-between transition-all duration-300 hover:shadow-md hover:-translate-y-0.5 group focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 focus:outline-none"
              >
                <div>
                  {/* Thumbnail with overlay icon */}
                  <div className="relative w-full h-28 rounded-xl overflow-hidden mb-4 border border-[#EBE3D5]">
                    <img 
                      src={hotspot.thumbnail} 
                      alt={hotspot.title} 
                      className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105" 
                    />
                    <div className="absolute top-2.5 right-2.5 w-7.5 h-7.5 rounded-lg bg-white/90 backdrop-blur-xs text-brand flex items-center justify-center shadow-sm">
                      <Icon size={14} />
                    </div>
                  </div>

                  <h4 className="text-earth text-sm font-bold tracking-tight mb-1">
                    {hotspot.title}
                  </h4>
                  <p className="text-muted-earth text-[11px] leading-relaxed mb-4 line-clamp-3">
                    {hotspot.description}
                  </p>
                </div>
                <div className="inline-flex items-center gap-1 text-[11px] font-bold text-brand hover:text-brand-accent transition-colors w-fit mt-auto">
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
