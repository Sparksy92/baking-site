'use client';

import { useState } from 'react';
import Image from 'next/image';
import type { ProductImage } from '@/lib/api';

export function ImageGallery({ images, productName }: { images: ProductImage[]; productName: string }) {
  const [activeIndex, setActiveIndex] = useState(0);
  const activeImage = images[activeIndex];

  if (images.length === 0) {
    return (
      <div className="aspect-[3/4] bg-gray-100 rounded-xl flex items-center justify-center text-gray-400">
        No image
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="aspect-[3/4] bg-gray-100 rounded-xl overflow-hidden relative">
        <Image
          src={activeImage.url}
          alt={activeImage.alt_text || productName}
          fill
          sizes="(max-width: 1024px) 100vw, 50vw"
          priority
          className="object-cover"
        />
      </div>

      {images.length > 1 && (
        <div className="flex gap-2 overflow-x-auto pb-1">
          {images.map((img, i) => (
            <button
              key={img.id}
              onClick={() => setActiveIndex(i)}
              className={`relative flex-shrink-0 w-16 h-20 rounded-lg overflow-hidden border-2 transition-all ${
                i === activeIndex ? 'border-brand' : 'border-transparent opacity-60 hover:opacity-100'
              }`}
            >
              <Image
                src={img.url}
                alt={img.alt_text || `${productName} ${i + 1}`}
                fill
                sizes="64px"
                className="object-cover"
              />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
