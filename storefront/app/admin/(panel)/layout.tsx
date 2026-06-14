'use client';

import { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import {
  LayoutDashboard, Package, ShoppingCart, Layers, FolderOpen, Tag, Settings, LogOut, Mail,
  BarChart3, RotateCcw, Webhook, Gift, Star, PackageOpen, FileText, Tags, Users, Ruler, Shield,
  ArrowLeftRight, ChevronDown, ChevronRight, Megaphone, Wrench, CreditCard, TrendingUp, Share2, Bot, Inbox,
  AlertTriangle,
} from 'lucide-react';
import { api } from '@/lib/api';
import { Toaster } from '@/components/Toaster';

type NavItem = { label: string; to: string; icon: React.ElementType };

type NavSection = {
  id: string;
  label: string;
  icon: React.ElementType;
  items: NavItem[];
};

const CORE_NAV: NavItem[] = [
  { label: 'Dashboard',      to: '/admin',            icon: LayoutDashboard },
  { label: 'Order Requests', to: '/admin/order-requests', icon: Inbox },
  { label: 'Menu Items',     to: '/admin/products',   icon: Package },
  { label: 'Media',          to: '/admin/media',      icon: FolderOpen },
  { label: 'Settings',       to: '/admin/settings',   icon: Settings },
];

const SECTIONS: NavSection[] = [];

const LS_KEY = 'admin_nav_open_sections';

function readOpenSections(): Record<string, boolean> {
  if (typeof window === 'undefined') return {};
  try {
    return JSON.parse(localStorage.getItem(LS_KEY) ?? '{}');
  } catch {
    return {};
  }
}

function NavLink({ item, pathname, newRequestsCount = null }: { item: NavItem; pathname: string; newRequestsCount?: number | null }) {
  const isExactParent = item.to === '/admin' || item.to === '/admin/social';
  const active = isExactParent ? pathname === item.to : pathname.startsWith(item.to);
  const Icon = item.icon as any;
  return (
    <Link
      href={item.to}
      className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-colors ${
        active ? 'bg-brand text-white' : 'text-gray-700 hover:bg-gray-100'
      }`}
    >
      <Icon size={16} />
      <span className="flex-1">{item.label}</span>
      {item.label === 'Order Requests' && newRequestsCount !== null && newRequestsCount > 0 && (
        <span className="bg-rose-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full flex items-center justify-center min-w-5 h-5">
          {newRequestsCount}
        </span>
      )}
    </Link>
  );
}

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [user, setUser] = useState<{ username: string; role: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({});
  const [newRequestsCount, setNewRequestsCount] = useState<number | null>(null);

  useEffect(() => {
    setOpenSections(readOpenSections());
  }, []);

  useEffect(() => {
    api.get<{ username: string; role: string }>('/api/auth/me')
      .then(setUser)
      .catch(() => router.push('/admin/login'))
      .finally(() => setLoading(false));
  }, [router]);

  useEffect(() => {
    if (user) {
      api.get<{ total: number }>('/api/admin/order-requests?status=new&limit=1')
        .then((data) => setNewRequestsCount(data.total))
        .catch(() => {});
    }
  }, [user, pathname]); // Re-fetch on pathname changes to refresh when navigating

  function toggleSection(id: string) {
    setOpenSections((prev) => {
      const next = { ...prev, [id]: !prev[id] };
      try { localStorage.setItem(LS_KEY, JSON.stringify(next)); } catch {}
      return next;
    });
  }

  if (loading) return <div className="flex h-screen items-center justify-center text-gray-400">Loading...</div>;
  if (!user) return null;

  return (
    <div className="admin-surface flex h-screen bg-gray-50">
      <aside className="w-56 bg-white border-r border-gray-200 flex flex-col">
        <div className="p-4 border-b border-gray-100">
          <h1 className="font-bold text-brand text-sm">Admin Panel</h1>
          <p className="text-xs text-gray-500 mt-0.5">{user.username}</p>
        </div>

        <nav className="flex-1 p-2 space-y-0.5 overflow-y-auto">
          {CORE_NAV.map((item) => (
            <NavLink key={item.to} item={item} pathname={pathname} newRequestsCount={newRequestsCount} />
          ))}

          {SECTIONS.map((section) => {
            const isOpen = !!openSections[section.id];
            const SectionIcon = section.icon as any;
            const hasActive = section.items.some((i) => pathname.startsWith(i.to));
            return (
              <div key={section.id} className="pt-1">
                <button
                  onClick={() => toggleSection(section.id)}
                  className={`flex items-center justify-between w-full px-3 py-2 rounded-lg text-sm transition-colors ${
                    hasActive && !isOpen
                      ? 'text-brand font-medium hover:bg-gray-100'
                      : 'text-gray-500 hover:bg-gray-100 hover:text-gray-700'
                  }`}
                >
                  <span className="flex items-center gap-2.5">
                    <SectionIcon size={16} />
                    {section.label}
                  </span>
                  {isOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                </button>

                {isOpen && (
                  <div className="mt-0.5 ml-2 pl-2 border-l border-gray-100 space-y-0.5">
                    {section.items.map((item) => (
                      <NavLink key={item.to} item={item} pathname={pathname} />
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </nav>

        <div className="p-2 border-t border-gray-100">
          <button
            onClick={async () => { await api.post('/api/auth/logout'); router.push('/admin/login'); }}
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
