'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';

interface LoyaltyStats {
  members_with_points: number;
  total_outstanding_points: number;
  total_redeemed_points: number;
}

export default function LoyaltyPage() {
  const [stats, setStats] = useState<LoyaltyStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [helpOpen, setHelpOpen] = useState(false);

  useEffect(() => {
    api.get<LoyaltyStats>('/api/admin/loyalty/stats').then(setStats).catch(() => {}).finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="text-gray-400">Loading...</div>;

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Loyalty Program</h1>
        <button onClick={() => setHelpOpen(!helpOpen)} className="text-xs text-blue-600 hover:underline mt-0.5">What is the loyalty program?</button>
        {helpOpen && <p className="text-sm text-gray-500 mt-2 bg-blue-50 border border-blue-100 rounded-lg p-3">Customers earn points on every purchase. Points can be redeemed for discounts on future orders. The earn rate (points per dollar) and redemption value (dollars per point) are configured in Settings. This page shows aggregate program stats.</p>}
      </div>

      {stats && (
        <div className="grid grid-cols-3 gap-4 mb-6">
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <p className="text-xs text-gray-500">Members</p>
            <p className="text-2xl font-bold text-gray-900 mt-1">{stats.members_with_points}</p>
          </div>
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <p className="text-xs text-gray-500">Points Outstanding</p>
            <p className="text-2xl font-bold text-gray-900 mt-1">{(stats.total_outstanding_points ?? 0).toLocaleString()}</p>
          </div>
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <p className="text-xs text-gray-500">Points Redeemed</p>
            <p className="text-2xl font-bold text-gray-900 mt-1">{(stats.total_redeemed_points ?? 0).toLocaleString()}</p>
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
