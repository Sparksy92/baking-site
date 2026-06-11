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
  { label: 'Dashboard',   to: '/admin',            icon: LayoutDashboard },
  { label: 'Orders',      to: '/admin/orders',     icon: ShoppingCart },
  { label: 'Products',    to: '/admin/products',   icon: Package },
  { label: 'Collections', to: '/admin/collections',icon: Layers },
  { label: 'Categories',  to: '/admin/categories', icon: FolderOpen },
  { label: 'Returns',     to: '/admin/returns',    icon: RotateCcw },
  { label: 'Pages',       to: '/admin/pages',      icon: FileText },
  { label: 'Settings',    to: '/admin/settings',   icon: Settings },
];

const SECTIONS: NavSection[] = [
  {
    id: 'marketing',
    label: 'Marketing',
    icon: Megaphone,
    items: [
      { label: 'Promos',      to: '/admin/promos',      icon: Tag },
      { label: 'Gift Cards',  to: '/admin/gift-cards',  icon: Gift },
      { label: 'Loyalty',     to: '/admin/loyalty',     icon: Star },
      { label: 'Store Credit',to: '/admin/store-credit',icon: CreditCard },
      { label: 'Segments',    to: '/admin/segments',    icon: Users },
      { label: 'Newsletter',  to: '/admin/newsletter',  icon: Mail },
      { label: 'Analytics',   to: '/admin/analytics',   icon: BarChart3 },
      { label: 'LTV Report',  to: '/admin/ltv',          icon: TrendingUp },
    ],
  },
  {
    id: 'social',
    label: 'Social & AI',
    icon: Share2,
    items: [
      { label: 'Dashboard',      to: '/admin/social',           icon: LayoutDashboard },
      { label: 'Outbox',         to: '/admin/social/outbox',    icon: Inbox },
      { label: 'Crisis Alerts',  to: '/admin/social/crisis',    icon: AlertTriangle },
      { label: 'Strategy',       to: '/admin/social/strategy',  icon: TrendingUp },
      { label: 'A/B Tests',      to: '/admin/social/ab-tests',  icon: BarChart3 },
      { label: 'Brand Persona',  to: '/admin/social/persona',   icon: Bot },
      { label: 'Platforms',      to: '/admin/social/platforms', icon: Share2 },
    ],
  },
  {
    id: 'advanced',
    label: 'Advanced',
    icon: Wrench,
    items: [
      { label: 'Bundles',     to: '/admin/bundles',     icon: PackageOpen },
      { label: 'Tags',        to: '/admin/tags',        icon: Tags },
      { label: 'Size Guides', to: '/admin/size-guides', icon: Ruler },
      { label: 'Redirects',   to: '/admin/redirects',   icon: ArrowLeftRight },
      { label: 'Webhooks',    to: '/admin/webhooks',    icon: Webhook },
      { label: 'Staff',       to: '/admin/staff',       icon: Shield },
    ],
  },
];

const LS_KEY = 'admin_nav_open_sections';

function readOpenSections(): Record<string, boolean> {
  if (typeof window === 'undefined') return {};
  try {
    return JSON.parse(localStorage.getItem(LS_KEY) ?? '{}');
  } catch {
    return {};
  }
}

function NavLink({ item, pathname }: { item: NavItem; pathname: string }) {
  const isExactParent = item.to === '/admin' || item.to === '/admin/social';
  const active = isExactParent ? pathname === item.to : pathname.startsWith(item.to);
  const Icon = item.icon;
  return (
    <Link
      href={item.to}
      className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-colors ${
        active ? 'bg-brand text-white' : 'text-gray-700 hover:bg-gray-100'
      }`}
    >
      <Icon size={16} />
      {item.label}
    </Link>
  );
}

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [user, setUser] = useState<{ username: string; role: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({});

  useEffect(() => {
    setOpenSections(readOpenSections());
  }, []);

  useEffect(() => {
    api.get<{ username: string; role: string }>('/api/auth/me')
      .then(setUser)
      .catch(() => router.push('/admin/login'))
      .finally(() => setLoading(false));
  }, [router]);

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
            <NavLink key={item.to} item={item} pathname={pathname} />
          ))}

          {SECTIONS.map((section) => {
            const isOpen = !!openSections[section.id];
            const SectionIcon = section.icon;
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
