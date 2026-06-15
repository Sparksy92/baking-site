'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { ArrowLeft, ArrowRight, Cookie, ShoppingBag, HeartHandshake, Sparkles, Flame, X, ChevronLeft, ChevronRight } from 'lucide-react';

interface HotspotConfig {
  id: string;
  label: string;
  description: string;
  href: string;
  top: string;
  left: string;
  icon: any;
  thumbnail: string;
}

const HOTSPOTS: HotspotConfig[] = [
  {
    id: 'baked-fresh',
    label: 'Baked Fresh',
    description: 'Fresh breads, buns, bagels, cinnamon rolls, and weekend sourdough.',
    href: '/shop?category=baked-fresh',
    top: '62%',
    left: '84%',
    icon: Cookie,
    thumbnail: '/images/products/sourdough.jpg',
  },
  {
    id: 'pantry',
    label: 'Pantry Goods',
    description: 'Jams, jellies, pickled goods, simmer pots, dried mixes, and seasonal bundles.',
    href: '/shop?category=pantry',
    top: '27%',
    left: '76%',
    icon: ShoppingBag,
    thumbnail: '/images/products/jams.jpg',
  },
  {
    id: 'custom-orders',
    label: 'Custom Orders',
    description: 'Cakes, custom desserts, large batch requests, and special occasion bakes.',
    href: '/custom-orders',
    top: '67%',
    left: '50%',
    icon: HeartHandshake,
    thumbnail: '/images/products/custom-desserts.jpg',
  },
  {
    id: 'home-body',
    label: 'Home & Body',
    description: 'Handmade lotions, lip balms, salves, herbal oils, and homestead care.',
    href: '/shop?category=home-body',
    top: '32%',
    left: '36%',
    icon: Sparkles,
    thumbnail: '/images/products/lotions.jpg',
  },
  {
    id: 'oven-fund',
    label: 'Oven Fund',
    description: 'Support the indoor oven upgrade and outdoor wood-fired oven build.',
    href: '/oven-fund',
    top: '34%',
    left: '18%',
    icon: Flame,
    thumbnail: '/images/products/oven-fund.jpg',
  },
];

export default function InteractiveKitchenScene() {
  const [activeHotspot, setActiveHotspot] = useState<string | null>(null);
  const [hoveredHotspot, setHoveredHotspot] = useState<string | null>(null);
  const [tourIndex, setTourIndex] = useState<number | null>(null);
  const [showLabels, setShowLabels] = useState(false);
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);

  // Check prefers-reduced-motion media query
  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    setPrefersReducedMotion(mediaQuery.matches);
    const handler = (e: MediaQueryListEvent) => setPrefersReducedMotion(e.matches);
    mediaQuery.addEventListener('change', handler);
    return () => mediaQuery.removeEventListener('change', handler);
  }, []);

  // Delay showing micro-labels on initial load
  useEffect(() => {
    const timer = setTimeout(() => {
      setShowLabels(true);
    }, 1500);
    return () => clearTimeout(timer);
  }, []);

  // Escape key handler to close active tooltips
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setActiveHotspot(null);
        setTourIndex(null);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const handleHotspotClick = (id: string) => {
    setActiveHotspot(activeHotspot === id ? null : id);
    setTourIndex(null); // Terminate guided tour if user interacts manually
  };

  const handleStartTour = () => {
    setTourIndex(0);
    setActiveHotspot(HOTSPOTS[0].id);
  };

  const handleNextTour = () => {
    if (tourIndex === null) return;
    if (tourIndex < HOTSPOTS.length - 1) {
      const nextIdx = tourIndex + 1;
      setTourIndex(nextIdx);
      setActiveHotspot(HOTSPOTS[nextIdx].id);
    } else {
      // Tour completed
      setTourIndex(null);
      setActiveHotspot(null);
    }
  };

  const handleBackTour = () => {
    if (tourIndex === null) return;
    if (tourIndex > 0) {
      const prevIdx = tourIndex - 1;
      setTourIndex(prevIdx);
      setActiveHotspot(HOTSPOTS[prevIdx].id);
    }
  };

  const handleCloseTour = () => {
    setTourIndex(null);
    setActiveHotspot(null);
  };

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

        {/* Guided Tour Start Button */}
        <button
          type="button"
          onClick={handleStartTour}
          className="inline-flex items-center gap-2 bg-brand/10 hover:bg-brand/20 border border-brand/20 text-brand px-5 py-2.5 rounded-full text-xs font-bold uppercase tracking-wider transition-colors mt-5 shadow-xs"
          aria-label="Start interactive guided tour of the kitchen map"
        >
          <Sparkles size={14} className={prefersReducedMotion ? '' : 'animate-pulse'} /> 
          <span>Start Kitchen Tour</span>
        </button>
      </div>

      {/* Main Container Card */}
      <div 
        className="relative w-full aspect-[16/10] md:aspect-[16/9] rounded-[2rem] border border-sand/40 overflow-hidden shadow-2xl bg-warm group"
        onMouseEnter={() => setShowLabels(true)}
      >
        
        {/* Main Background Image */}
        {/* TODO: Replace with optimized final image storefront/public/images/home/interactive-kitchen.jpg when available. Currently using placeholder copy. */}
        <img
          src="/images/home/interactive-kitchen.jpg"
          alt="Cedar and Sage Homestead kitchen showing oven, pantry, prep table, window, and apothecary shelves"
          className={`w-full h-full object-cover select-none transition-transform duration-700 ${
            activeHotspot && !prefersReducedMotion ? 'scale-[1.02]' : 'scale-100'
          }`}
        />

        {/* Subtle Vignette Overlay for Realism */}
        <div className="absolute inset-0 pointer-events-none shadow-[inset_0_0_80px_rgba(0,0,0,0.25)] z-5" />
        <div className="absolute inset-0 bg-gradient-to-t from-black/15 via-transparent to-black/10 pointer-events-none" />

        {/* Warm Light Glow near the Stove/Oven (Baked Fresh: top 62%, left 84%) */}
        <div className="absolute top-[62%] left-[84%] -translate-x-1/2 -translate-y-1/2 w-48 h-48 bg-amber-500/10 rounded-full blur-3xl pointer-events-none mix-blend-screen" />

        {/* Hotspots Render Overlay */}
        {HOTSPOTS.map((hotspot, index) => {
          const isSelected = activeHotspot === hotspot.id;
          const isHovered = hoveredHotspot === hotspot.id;
          const leftVal = parseInt(hotspot.left);
          
          // Responsive alignment logic
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
              onMouseLeave={() => setHoveredHotspot(null)}
            >
              
              {/* Subtle radial selection glow behind selected object */}
              {isSelected && (
                <div 
                  className={`absolute -translate-x-1/2 -translate-y-1/2 w-36 h-36 rounded-full pointer-events-none mix-blend-screen bg-[radial-gradient(ellipse_at_center,rgba(245,158,11,0.18),transparent_60%)] blur-xl z-0 transition-opacity ${
                    prefersReducedMotion ? '' : 'duration-500'
                  }`}
                />
              )}

              {/* Always-visible micro labels (desktop only, subtle delay/hover) */}
              <span 
                className={`absolute top-full mt-2 left-1/2 -translate-x-1/2 text-[9px] font-bold uppercase tracking-wider text-earth bg-cream/90 border border-sand/40 px-2 py-0.5 rounded shadow-xs select-none pointer-events-none transition-all duration-300 md:block hidden whitespace-nowrap ${
                  showLabels || isSelected || isHovered ? 'opacity-90 translate-y-0' : 'opacity-0 -translate-y-1'
                }`}
              >
                {hotspot.label}
              </span>

              {/* Target click wrapper button */}
              <button
                type="button"
                onClick={() => handleHotspotClick(hotspot.id)}
                onMouseEnter={() => setHoveredHotspot(hotspot.id)}
                onFocus={() => {
                  setHoveredHotspot(hotspot.id);
                  setActiveHotspot(hotspot.id);
                }}
                onBlur={() => {
                  setHoveredHotspot(null);
                  setTimeout(() => {
                    setActiveHotspot((current) => current === hotspot.id ? null : current);
                  }, 150);
                }}
                className="w-14 h-14 md:w-20 md:h-20 flex items-center justify-center rounded-full focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-500 focus-visible:ring-offset-2 z-10 bg-transparent transition-transform active:scale-95"
                aria-label={`Show details for ${hotspot.label}`}
                aria-expanded={isSelected}
              >
                {/* Visual pulse / core dot */}
                <span className="relative flex h-3.5 w-3.5 items-center justify-center">
                  {(isSelected || isHovered) && (
                    <span className={`absolute inline-flex h-7 w-7 rounded-full bg-amber-400 opacity-60 ${
                      prefersReducedMotion ? '' : 'animate-ping'
                    }`} />
                  )}
                  <span className={`relative inline-flex rounded-full h-3 w-3 bg-amber-500 border border-white shadow-md transition-shadow ${
                    isSelected || isHovered ? 'ring-4 ring-amber-500/20' : ''
                  }`} />
                </span>
              </button>

              {/* Tooltip Card (Snap to bottom overlay on mobile, floats on desktop) */}
              {isSelected && (
                <div
                  className={`md:absolute md:bottom-full md:mb-3 md:w-72 p-4 rounded-2xl bg-[#FDFBF7] border border-[#EBE3D5] shadow-2xl backdrop-blur-md z-20 text-left transition-all duration-300 animate-fade-in ${tooltipAlignClass} fixed bottom-4 left-4 right-4 md:right-auto md:-translate-x-1/2`}
                  onClick={(e) => e.stopPropagation()}
                >
                  <div className="flex gap-3.5 items-start">
                    {hotspot.thumbnail && (
                      <img 
                        src={hotspot.thumbnail} 
                        alt={hotspot.label} 
                        className="w-14 h-14 rounded-xl object-cover border border-[#EBE3D5] shrink-0" 
                      />
                    )}
                    <div className="flex-1 min-w-0">
                      <h4 className="text-earth text-sm font-bold tracking-tight mb-0.5">
                        {hotspot.label}
                      </h4>
                      <p className="text-muted-earth text-xs leading-relaxed mb-3">
                        {hotspot.description}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center justify-between border-t border-[#EBE3D5] pt-3 mt-1.5">
                    {/* Primary Route Link */}
                    <Link
                      href={hotspot.href}
                      className="inline-flex items-center gap-1.5 text-xs font-black text-brand hover:text-brand-accent transition-colors"
                    >
                      <span>Explore</span>
                      <ArrowRight size={12} />
                    </Link>

                    {/* Guided Tour Actions */}
                    {tourIndex !== null && (
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-semibold text-muted-earth mr-1">
                          {tourIndex + 1}/5
                        </span>
                        
                        {/* Back control */}
                        <button
                          type="button"
                          onClick={handleBackTour}
                          disabled={tourIndex === 0}
                          className="w-6 h-6 flex items-center justify-center rounded-lg border border-[#EBE3D5] text-muted-earth hover:text-earth disabled:opacity-30 disabled:pointer-events-none hover:bg-warm transition-colors"
                          aria-label="Previous step"
                        >
                          <ChevronLeft size={14} />
                        </button>

                        {/* Next / Finish control */}
                        <button
                          type="button"
                          onClick={handleNextTour}
                          className="h-6 px-2.5 flex items-center justify-center rounded-lg bg-brand text-white font-bold text-[10px] hover:bg-brand-accent transition-colors"
                          aria-label={tourIndex === HOTSPOTS.length - 1 ? 'Finish tour' : 'Next step'}
                        >
                          {tourIndex === HOTSPOTS.length - 1 ? 'Finish' : <ChevronRight size={14} />}
                        </button>

                        {/* Close control */}
                        <button
                          type="button"
                          onClick={handleCloseTour}
                          className="w-6 h-6 flex items-center justify-center rounded-lg border border-red-200 text-red-700 hover:bg-red-50 transition-colors"
                          aria-label="Close tour"
                        >
                          <X size={12} />
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          );
        })}
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

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-5 w-full">
          {HOTSPOTS.map((hotspot) => {
            const Icon = hotspot.icon;
            return (
              <Link
                key={hotspot.id}
                href={hotspot.href}
                className="bg-white border border-[#EBE3D5] hover:border-brand rounded-2xl p-4 flex flex-col justify-between transition-all duration-300 hover:shadow-md hover:-translate-y-0.5 group"
              >
                <div>
                  {/* Thumbnail with overlay icon */}
                  <div className="relative w-full h-32 rounded-xl overflow-hidden mb-4 border border-[#EBE3D5]">
                    <img 
                      src={hotspot.thumbnail} 
                      alt={hotspot.label} 
                      className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105" 
                    />
                    <div className="absolute top-3 right-3 w-8 h-8 rounded-lg bg-white/90 backdrop-blur-xs text-brand flex items-center justify-center shadow-sm">
                      <Icon size={16} />
                    </div>
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
