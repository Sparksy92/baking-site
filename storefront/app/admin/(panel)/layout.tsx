'use client';

import { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import { LayoutDashboard, Package, ShoppingCart, Layers, FolderOpen, Tag, Settings, LogOut, Mail } from 'lucide-react';
import { api } from '@/lib/api';
import { Toaster } from '@/components/Toaster';

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [user, setUser] = useState<{ username: string; role: string } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get<{ username: string; role: string }>('/api/auth/me')
      .then(setUser)
      .catch(() => router.push('/admin/login'))
      .finally(() => setLoading(false));
  }, [router]);

  if (loading) return <div className="flex h-screen items-center justify-center text-gray-400">Loading...</div>;
  if (!user) return null;

  const nav = [
    { label: 'Dashboard', to: '/admin', icon: LayoutDashboard },
    { label: 'Orders', to: '/admin/orders', icon: ShoppingCart },
    { label: 'Products', to: '/admin/products', icon: Package },
    { label: 'Collections', to: '/admin/collections', icon: Layers },
    { label: 'Categories', to: '/admin/categories', icon: FolderOpen },
    { label: 'Promos', to: '/admin/promos', icon: Tag },
    { label: 'Newsletter', to: '/admin/newsletter', icon: Mail },
    { label: 'Settings', to: '/admin/settings', icon: Settings },
  ];

  async function handleLogout() {
    await api.post('/api/auth/logout');
    router.push('/admin/login');
  }

  return (
    <div className="flex h-screen bg-gray-50">
      <aside className="w-56 bg-white border-r border-gray-200 flex flex-col">
        <div className="p-4 border-b border-gray-100">
          <h1 className="font-bold text-brand text-sm">Admin Panel</h1>
          <p className="text-xs text-gray-500 mt-0.5">{user.username}</p>
        </div>
        <nav className="flex-1 p-2 space-y-1">
          {nav.map((item) => {
            const active = pathname === item.to;
            const Icon = item.icon;
            return (
              <Link
                key={item.to}
                href={item.to}
                className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-colors ${
                  active ? 'bg-brand text-white' : 'text-gray-700 hover:bg-gray-100'
                }`}
              >
                <Icon size={16} />
                {item.label}
              </Link>
            );
          })}
        </nav>
        <div className="p-2 border-t border-gray-100">
          <button
            onClick={handleLogout}
            className="flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm text-gray-700 hover:bg-gray-100 w-full"
          >
            <LogOut size={16} />
            Logout
          </button>
        </div>
      </aside>
      <main className="flex-1 overflow-y-auto p-6">{children}</main>
      <Toaster />
    </div>
  );
}
