'use client';

import Link from 'next/link';
import { X, ArrowRight } from 'lucide-react';
import { CATEGORIES } from './HomesteadDioramaFallback';

interface HomesteadDioramaOverlayProps {
  selectedId: string | null;
  onClose: () => void;
}

export default function HomesteadDioramaOverlay({ selectedId, onClose }: HomesteadDioramaOverlayProps) {
  if (!selectedId) return null;

  const category = CATEGORIES.find((c) => c.id === selectedId);
  if (!category) return null;

  const Icon = category.icon;

  return (
    <>
      {/* Backdrop for mobile to click-close */}
      <div 
        className="fixed inset-0 z-40 bg-black/10 md:hidden transition-opacity duration-300" 
        onClick={onClose}
      />
      
      <div className="fixed md:absolute z-50 transition-all duration-300 ease-out
        /* Mobile Bottom Sheet styles */
        bottom-0 left-0 right-0 rounded-t-[2.5rem] bg-white/95 backdrop-blur-md shadow-2xl border-t border-sand/50 p-6 md:p-0
        /* Desktop Floating Card styles */
        md:bottom-auto md:left-8 md:top-24 md:right-auto md:w-[360px] md:rounded-3xl md:bg-white/90 md:border md:border-sand/40 md:shadow-lg"
      >
        <div className="relative p-6 flex flex-col justify-between h-full">
          {/* Close button */}
          <button
            onClick={onClose}
            className="absolute top-4 right-4 p-2 rounded-full hover:bg-black/5 text-muted-earth transition-colors focus:ring-2 focus:ring-brand outline-none"
            aria-label="Close details"
          >
            <X size={18} />
          </button>

          <div>
            <div className="flex items-center gap-3 mb-4">
              <span className="w-10 h-10 rounded-xl bg-brand/10 text-brand flex items-center justify-center">
                <Icon size={20} />
              </span>
              <span className="text-[10px] font-black uppercase tracking-[0.25em] text-terracotta">
                Category
              </span>
            </div>

            <h3 className="text-2xl font-black text-earth tracking-[-0.02em] leading-tight mb-2">
              {category.title}
            </h3>
            <h4 className="text-brand font-semibold text-sm mb-3">
              {category.tagline}
            </h4>
            <p className="text-muted-earth text-sm leading-relaxed mb-6">
              {category.description}
            </p>
          </div>

          <div className="flex items-center gap-4">
            <Link
              href={category.href}
              className="flex-1 inline-flex items-center justify-center gap-2 px-5 py-3 rounded-2xl bg-brand text-white font-bold text-sm hover:bg-brand-accent transition-colors shadow-sm focus:ring-2 focus:ring-brand focus:ring-offset-2 outline-none group"
            >
              <span>Explore Section</span>
              <ArrowRight size={16} className="transform group-hover:translate-x-1 transition-transform" />
            </Link>
            <button
              onClick={onClose}
              className="hidden md:inline-flex px-4 py-3 rounded-2xl border border-sand hover:bg-black/5 text-earth font-bold text-sm transition-colors"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
