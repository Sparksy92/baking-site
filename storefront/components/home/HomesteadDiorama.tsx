'use client';

import { useState, useEffect } from 'react';
import dynamic from 'next/dynamic';
import HomesteadDioramaOverlay from './HomesteadDioramaOverlay';
import HomesteadDioramaFallback from './HomesteadDioramaFallback';
import { RotateCw, HelpCircle } from 'lucide-react';

const HomesteadDioramaScene = dynamic(() => import('./HomesteadDioramaScene'), {
  ssr: false,
  loading: () => (
    <div className="flex flex-col items-center justify-center h-full w-full bg-warm/40 border border-sand rounded-[2.5rem] p-8 text-center animate-pulse">
      <div className="w-10 h-10 border-4 border-brand border-t-transparent rounded-full animate-spin mb-4" />
      <span className="text-sm text-muted-earth font-bold uppercase tracking-[0.15em]">Preparing diorama...</span>
    </div>
  ),
});

export default function HomesteadDiorama() {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);
  const [webGLSupported, setWebGLSupported] = useState(true);
  const [showHelper, setShowHelper] = useState(true);

  useEffect(() => {
    // Check reduced motion media query
    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    setPrefersReducedMotion(mediaQuery.matches);
    
    const handler = (e: MediaQueryListEvent) => setPrefersReducedMotion(e.matches);
    mediaQuery.addEventListener('change', handler);

    // Check WebGL support
    try {
      const canvas = document.createElement('canvas');
      const support = !!(
        window.WebGLRenderingContext && 
        (canvas.getContext('webgl') || canvas.getContext('experimental-webgl'))
      );
      setWebGLSupported(support);
    } catch {
      setWebGLSupported(false);
    }

    // Dismiss helper after 5 seconds
    const timer = setTimeout(() => {
      setShowHelper(false);
    }, 6000);

    return () => {
      mediaQuery.removeEventListener('change', handler);
      clearTimeout(timer);
    };
  }, []);

  if (!webGLSupported) {
    return (
      <div className="py-6">
        <HomesteadDioramaFallback />
      </div>
    );
  }

  return (
    <section className="relative w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 flex flex-col items-center">
      <div className="text-center mb-8 max-w-xl">
        <span className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-brand/10 border border-brand/20 text-brand text-xs font-bold uppercase tracking-[0.2em] mb-4">
          <RotateCw size={12} className="animate-spin-slow" />
          Interactive 3D Menu
        </span>
        <h2 className="text-3xl sm:text-4xl font-black text-earth tracking-[-0.02em] leading-none mb-3">
          Explore Our Homestead
        </h2>
        <p className="text-sm text-muted-earth leading-relaxed">
          Drag horizontally to rotate the display board. Click or tap any object to explore our fresh baking, preserve pantry, hand-rendered tallow, or support the brick oven fund!
        </p>
      </div>

      {/* Main Diorama Window */}
      <div className="relative w-full aspect-[4/3] max-h-[520px] rounded-[2.5rem] bg-gradient-to-b from-[#F5EFE6]/40 to-[#FAF7F2] border border-sand/40 overflow-hidden shadow-inner flex items-center justify-center">
        {/* Interaction helper note */}
        {showHelper && !selectedId && (
          <div className="absolute top-4 z-20 bg-brand/90 backdrop-blur-sm text-white text-[11px] font-bold tracking-[0.1em] uppercase px-4 py-2 rounded-full flex items-center gap-1.5 shadow-md animate-fade-in-out pointer-events-none">
            <HelpCircle size={14} /> Swipe to rotate countertop
          </div>
        )}

        <HomesteadDioramaScene
          selectedId={selectedId}
          onSelect={(id) => setSelectedId(id === selectedId ? null : id)}
          prefersReducedMotion={prefersReducedMotion}
        />

        {/* Selected Details Overlay */}
        <HomesteadDioramaOverlay
          selectedId={selectedId}
          onClose={() => setSelectedId(null)}
        />
      </div>

      {/* Standard Fallback Cards always rendered below for accessibility */}
      <div className="w-full mt-16">
        <div className="text-center mb-10">
          <span className="text-[10px] font-black uppercase tracking-[0.25em] text-terracotta block mb-2">
            Catalog Sections
          </span>
          <h3 className="text-2xl font-black text-earth tracking-[-0.01em]">
            Homestead Category Guide
          </h3>
        </div>
        <HomesteadDioramaFallback />
      </div>
    </section>
  );
}
