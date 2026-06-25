'use client';

import { useState, useEffect } from 'react';
import Image from 'next/image';
import { ImageIcon, ChevronLeft, ChevronRight } from 'lucide-react';
import type { ProductImage } from '@/lib/api';

export function ImageGallery({ images, productName, selectedColor }: { images: ProductImage[]; productName: string; selectedColor?: string }) {
  const sortedImages = selectedColor
    ? [
        ...images.filter((img) => img.color === selectedColor),
        ...images.filter((img) => !img.color),
        ...images.filter((img) => img.color && img.color !== selectedColor),
      ]
    : images;

  const [activeIndex, setActiveIndex] = useState(0);

  useEffect(() => { setActiveIndex(0); }, [selectedColor]);

  const activeImage = sortedImages[activeIndex];
  const canPrev = activeIndex > 0;
  const canNext = activeIndex < sortedImages.length - 1;

  function prev() { if (canPrev) setActiveIndex((i) => i - 1); }
  function next() { if (canNext) setActiveIndex((i) => i + 1); }

  if (images.length === 0) {
    return (
      <div className="aspect-[3/4] bg-gradient-to-br from-warm via-sand to-cream rounded-3xl border border-sand/70 flex flex-col items-center justify-center text-earth/20 shadow-earth-sm gap-3">
        <ImageIcon className="h-14 w-14" strokeWidth={1.0} aria-hidden="true" />
        <span className="text-[10px] uppercase tracking-[0.2em] font-semibold text-earth/20">No image</span>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Main image */}
      <div className="relative group aspect-[3/4] bg-sand rounded-3xl overflow-hidden shadow-earth">
        <Image
          key={activeImage.url}
          src={activeImage.url}
          alt={activeImage.alt_text || productName}
          fill
          sizes="(max-width: 1024px) 100vw, 50vw"
          priority
          className="object-cover transition-opacity duration-300"
        />

        {/* Prev / next arrows */}
        {sortedImages.length > 1 && (
          <>
            <button
              onClick={prev}
              disabled={!canPrev}
              className={`absolute left-3 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full bg-cream/90 backdrop-blur-sm border border-sand/60 shadow-earth-sm flex items-center justify-center text-earth transition-all duration-200 ${
                canPrev ? 'opacity-100 lg:opacity-0 lg:group-hover:opacity-100 hover:bg-cream hover:scale-105' : 'opacity-0 cursor-default'
              }`}
              aria-label="Previous image"
            >
              <ChevronLeft size={18} />
            </button>
            <button
              onClick={next}
              disabled={!canNext}
              className={`absolute right-3 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full bg-cream/90 backdrop-blur-sm border border-sand/60 shadow-earth-sm flex items-center justify-center text-earth transition-all duration-200 ${
                canNext ? 'opacity-100 lg:opacity-0 lg:group-hover:opacity-100 hover:bg-cream hover:scale-105' : 'opacity-0 cursor-default'
              }`}
              aria-label="Next image"
            >
              <ChevronRight size={18} />
            </button>
          </>
        )}

        {/* Image counter pill */}
        {sortedImages.length > 1 && (
          <div className="absolute bottom-3 right-3 bg-deep/70 backdrop-blur-sm text-white text-[10px] font-bold px-2.5 py-1 rounded-full">
            {activeIndex + 1} / {sortedImages.length}
          </div>
        )}
      </div>

      {/* Thumbnail strip */}
      {sortedImages.length > 1 && (
        <div className="flex gap-2.5 overflow-x-auto no-scrollbar pb-1">
          {sortedImages.map((img, i) => (
            <button
              key={img.id}
              onClick={() => setActiveIndex(i)}
              className={`relative flex-shrink-0 w-[72px] h-[90px] rounded-2xl overflow-hidden border-2 transition-all duration-200 ${
                i === activeIndex
                  ? 'border-terracotta shadow-earth-sm scale-[1.04]'
                  : 'border-sand/60 opacity-55 hover:opacity-90 hover:border-muted-earth/60'
              }`}
              aria-label={`View ${productName} image ${i + 1}`}
              aria-current={i === activeIndex ? 'true' : undefined}
            >
              <Image
                src={img.url}
                alt={img.alt_text || `${productName} ${i + 1}`}
                fill
                sizes="72px"
                className="object-cover"
              />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
