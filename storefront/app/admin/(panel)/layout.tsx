'use client';

import { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import {
  LayoutDashboard, Package, ShoppingCart, Layers, FolderOpen, Tag, Settings, LogOut, Mail,
  BarChart3, RotateCcw, Webhook, Gift, Star, PackageOpen, FileText, Tags, Users, Ruler, Shield,
  ArrowLeftRight, ChevronDown, ChevronRight, Megaphone, Wrench, CreditCard, TrendingUp, Share2, Bot, Inbox,
  AlertTriangle, Menu, CalendarDays, MessageSquare, BarChart2, UserCheck, Crosshair, Link2, Rss, Cpu
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
  { label: 'Orders',         to: '/admin/orders',     icon: ShoppingCart },
  { label: 'Menu Items',     to: '/admin/products',   icon: Package },
  { label: 'Collections',    to: '/admin/collections',icon: Layers },
  { label: 'Categories',     to: '/admin/categories', icon: FolderOpen },
  { label: 'Pages',          to: '/admin/pages',      icon: FileText },
  { label: 'Media',          to: '/admin/media',      icon: FolderOpen },
  { label: 'Settings',       to: '/admin/settings',   icon: Settings },
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
      { label: 'Dashboard',      to: '/admin/social',                icon: LayoutDashboard },
      { label: 'Platforms',      to: '/admin/social/platforms',      icon: Share2 },
      { label: 'Outbox',         to: '/admin/social/outbox',         icon: Inbox },
      { label: 'Calendar',       to: '/admin/social/calendar',       icon: CalendarDays },
      { label: 'Inbox',          to: '/admin/social/inbox',          icon: MessageSquare },
      { label: 'Crisis Alerts',  to: '/admin/social/crisis',         icon: AlertTriangle },
      { label: 'Content Analytics', to: '/admin/social/strategy',    icon: TrendingUp },
      { label: 'Reports',        to: '/admin/social/reports',        icon: BarChart2 },
      { label: 'A/B Tests',      to: '/admin/social/ab-tests',       icon: BarChart3 },
      { label: 'Influencers',    to: '/admin/social/influencers',    icon: UserCheck },
      { label: 'Competitors',    to: '/admin/social/competitors',    icon: Crosshair },
      { label: 'Link in Bio',    to: '/admin/social/linkinbio',      icon: Link2 },
      { label: 'RSS Feeds',      to: '/admin/social/rss',            icon: Rss },
      { label: 'Brand Persona',  to: '/admin/social/persona',        icon: Bot },
      { label: 'AI Models',      to: '/admin/social/ai-models',      icon: Cpu },
      { label: 'Compliance',     to: '/admin/compliance/policies',    icon: Shield },
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
  const [sidebarOpen, setSidebarOpen] = useState(false);

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

  useEffect(() => {
    setSidebarOpen(false);
  }, [pathname]);

  function toggleSection(id: string) {
    setOpenSections((prev) => {
      const section = SECTIONS.find((s) => s.id === id);
      const hasActive = section ? section.items.some((i) => pathname.startsWith(i.to)) : false;
      const currentIsOpen = prev[id] !== undefined ? prev[id] : hasActive;
      const next = { ...prev, [id]: !currentIsOpen };
      try { localStorage.setItem(LS_KEY, JSON.stringify(next)); } catch {}
      return next;
    });
  }

  if (loading) return <div className="flex h-screen items-center justify-center text-gray-400">Loading...</div>;
  if (!user) return null;

  return (
    <div className="admin-surface flex h-screen bg-gray-50 overflow-hidden">
      {/* Sidebar Backdrop Overlay - Mobile Only */}
      {sidebarOpen && (
        <div 
          className="fixed inset-0 bg-black/45 z-40 md:hidden transition-opacity duration-300"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar - sliding drawer on mobile, static sidebar on desktop */}
      <aside 
        className={`fixed inset-y-0 left-0 w-64 bg-white border-r border-gray-200 z-50 transform transition-transform duration-300 ease-in-out md:translate-x-0 md:static md:w-56 md:flex-shrink-0 flex flex-col h-full ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="p-4 border-b border-gray-100 flex items-center justify-between">
          <div>
            <h1 className="font-bold text-brand text-sm">Admin Panel</h1>
            <p className="text-xs text-gray-500 mt-0.5">{user.username}</p>
          </div>
          {/* Close button on mobile drawer */}
          <button
            onClick={() => setSidebarOpen(false)}
            className="md:hidden p-1 rounded-lg text-gray-500 hover:bg-gray-100"
            aria-label="Close Sidebar"
          >
            <ChevronRight className="rotate-180" size={18} />
          </button>
        </div>

        <nav className="flex-1 p-2 space-y-0.5 overflow-y-auto">
          {CORE_NAV.map((item) => (
            <NavLink key={item.to} item={item} pathname={pathname} newRequestsCount={newRequestsCount} />
          ))}

          {SECTIONS.map((section) => {
            const hasActive = section.items.some((i) => pathname.startsWith(i.to));
            const isOpen = openSections[section.id] !== undefined ? openSections[section.id] : hasActive;
            const SectionIcon = section.icon as any;
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
            onClick={async () => {
              try {
                await api.post('/api/auth/logout');
              } catch (err) {
                console.error('Logout error:', err);
              }
              router.push('/admin/login');
            }}
            className="flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm text-gray-700 hover:bg-gray-100 w-full"
          >
            <LogOut size={16} />
            Logout
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Mobile top header */}
        <header className="flex md:hidden items-center justify-between px-4 h-14 bg-white border-b border-gray-200 flex-shrink-0">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setSidebarOpen(true)}
              className="p-1.5 rounded-lg text-gray-500 hover:bg-gray-100 hover:text-gray-700"
              aria-label="Open Sidebar"
            >
              <Menu size={20} />
            </button>
            <span className="font-bold text-brand text-sm">Admin Panel</span>
          </div>
          {newRequestsCount !== null && newRequestsCount > 0 && (
            <Link href="/admin/order-requests" className="bg-rose-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center justify-center min-w-5 h-5 mr-1">
              {newRequestsCount}
            </Link>
          )}
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-y-auto p-4 md:p-6">{children}</main>
      </div>
      <Toaster />
    </div>
  );
}
