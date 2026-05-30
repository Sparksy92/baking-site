'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';

interface LoyaltyStats {
  total_members: number;
  total_points_outstanding: number;
  total_points_redeemed: number;
}

export default function LoyaltyPage() {
  const [stats, setStats] = useState<LoyaltyStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get<LoyaltyStats>('/api/admin/loyalty/stats').then(setStats).catch(() => {}).finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="text-gray-400">Loading...</div>;

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Loyalty Program</h1>

      {stats && (
        <div className="grid grid-cols-3 gap-4 mb-6">
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <p className="text-xs text-gray-500">Members</p>
            <p className="text-2xl font-bold text-gray-900 mt-1">{stats.total_members}</p>
          </div>
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <p className="text-xs text-gray-500">Points Outstanding</p>
            <p className="text-2xl font-bold text-gray-900 mt-1">{stats.total_points_outstanding.toLocaleString()}</p>
          </div>
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <p className="text-xs text-gray-500">Points Redeemed</p>
            <p className="text-2xl font-bold text-gray-900 mt-1">{stats.total_points_redeemed.toLocaleString()}</p>
          </div>
        </div>
      )}

      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <h2 className="font-semibold text-gray-900 mb-3">Configuration</h2>
        <p className="text-sm text-gray-600">
          Customers earn points on every purchase. Points are automatically credited when an order is confirmed.
          The earn rate and redemption value are configured in Settings.
        </p>
      </div>
    </div>
  );
}
