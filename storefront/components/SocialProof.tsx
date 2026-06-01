'use client';

import { useEffect, useState } from 'react';
import { Eye, ShoppingBag } from 'lucide-react';

interface SocialProofData {
  viewers: number;
  sold_this_week: number;
}

export function SocialProof({ productId }: { productId: number }) {
  const [data, setData] = useState<SocialProofData | null>(null);

  useEffect(() => {
    fetch(`/api/social-proof/${productId}`)
      .then((r) => r.json())
      .then(setData)
      .catch(() => {});
  }, [productId]);

  if (!data) return null;

  return (
    <div className="flex items-center gap-4 mt-3">
      {data.viewers > 0 && (
        <div className="flex items-center gap-1.5 text-xs text-gray-500">
          <Eye size={13} className="text-amber-500" />
          <span><strong className="text-gray-700">{data.viewers}</strong> {data.viewers === 1 ? 'person' : 'people'} viewing</span>
        </div>
      )}
      {data.sold_this_week > 0 && (
        <div className="flex items-center gap-1.5 text-xs text-gray-500">
          <ShoppingBag size={13} className="text-green-500" />
          <span><strong className="text-gray-700">{data.sold_this_week}</strong> sold this week</span>
        </div>
      )}
    </div>
  );
}
