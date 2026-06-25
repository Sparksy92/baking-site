'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { Heart, Trash2 } from 'lucide-react';
import { api } from '@/lib/api';
import { formatCents } from '@/lib/format';

interface WishlistItem {
  wishlist_id: number;
  product_id: number;
  name: string;
  slug: string;
  image_url: string | null;
  min_price_cents: number | null;
  added_at: string;
}

export default function WishlistPage() {
  const [items, setItems] = useState<WishlistItem[]>([]);
  const [loading, setLoading] = useState(true);

  async function loadWishlist() {
    try {
      const data = await api.get<WishlistItem[]>('/api/customers/me/wishlist');
      setItems(data);
    } catch {
      // Not logged in or error
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { loadWishlist(); }, []);

  async function handleRemove(productId: number) {
    await api.delete(`/api/customers/me/wishlist/${productId}`);
    setItems(items.filter((i) => i.product_id !== productId));
  }

  if (loading) return <div className="text-center py-12 text-gray-400">Loading...</div>;

  return (
    <div className="max-w-3xl mx-auto">
      <h1 className="text-2xl font-bold mb-6 flex items-center gap-2">
        <Heart size={24} /> My Wishlist
      </h1>

      {items.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-gray-500 mb-4">Your wishlist is empty.</p>
          <Link href="/shop" className="text-brand hover:underline text-sm">
            Browse Products
          </Link>
        </div>
      ) : (
        <div className="space-y-3">
          {items.map((item) => (
            <div key={item.wishlist_id} className="flex items-center gap-4 p-4 bg-white rounded-xl border border-gray-200">
              {item.image_url ? (
                <Image
                  src={item.image_url}
                  alt={item.name}
                  width={64}
                  height={64}
                  className="rounded-lg object-cover w-16 h-16"
                />
              ) : (
                <div className="w-16 h-16 bg-gray-100 rounded-lg" />
              )}
              <div className="flex-1 min-w-0">
                <Link href={`/products/${item.slug}`} className="font-medium hover:text-brand truncate block">
                  {item.name}
                </Link>
                {item.min_price_cents && (
                  <p className="text-sm text-gray-500 mt-0.5">From {formatCents(item.min_price_cents)}</p>
                )}
              </div>
              <button
                onClick={() => handleRemove(item.product_id)}
                className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg"
                title="Remove from wishlist"
              >
                <Trash2 size={16} />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
