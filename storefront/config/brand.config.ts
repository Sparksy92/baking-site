import { BrandConfig } from '../types/brand';

export const brandConfig: BrandConfig = {
  id: 'baseline-store',
  metadata: {
    name: 'Baseline Store',
    tagline: 'Your Tagline Here',
    description: 'High quality products for your brand.',
    siteName: 'Baseline Store',
    baseUrl: 'https://yourdomain.com',
    locale: 'en-US',
    defaultRegion: 'ca',
  },
  colors: {
    primary: '#0f172a', // slate-900 (brand color previously used)
    secondary: '#334155', // slate-700
    accent: '#ef4444', // red-500
    background: '#ffffff',
    surface: '#f8fafc',
    text: '#0f172a',
    textMuted: '#64748b',
    border: '#e2e8f0',
    error: '#ef4444',
    success: '#10b981',
    warning: '#f59e0b',
  },
  fonts: {
    heading: 'var(--font-geist-sans), sans-serif',
    body: 'var(--font-geist-sans), sans-serif',
  },
  assets: {
    logo: '/images/brand/logo.png',
    favicon: '/images/brand/favicon.ico',
  },
  payment: {
    provider: 'stripe',
  },
  features: {
    blog: false,
    accounts: true,
    search: false,
    newsletter: false,
    reviews: false,
    wishlists: false,
    multiCurrency: false,
    analytics: false,
  },
  navigation: {
    mainLinks: [
      { label: 'Shop', href: '/' },
      { label: 'New Arrivals', href: '/collections/new-arrivals' },
      { label: 'Categories', href: '/categories' },
      { label: 'About', href: '/about' },
    ],
    footerColumns: [
      {
        title: 'Shop',
        links: [
          { label: 'All Products', href: '/search' },
          { label: 'New Arrivals', href: '/collections/new-arrivals' },
          { label: 'Categories', href: '/categories' },
          { label: 'Search', href: '/search' },
        ],
      },
      {
        title: 'Company',
        links: [
          { label: 'Our Story', href: '/about' },
          { label: 'Contact', href: '/contact' },
          { label: 'FAQ', href: '/faq' },
          { label: 'Track Order', href: '/order-lookup' },
        ],
      },
      {
        title: 'Policies',
        links: [
          { label: 'Shipping', href: '/shipping-policy' },
          { label: 'Returns & Exchanges', href: '/return-policy' },
          { label: 'Privacy Policy', href: '/privacy-policy' },
          { label: 'Terms of Service', href: '/terms-of-service' },
        ],
      },
    ],
  },
  content: {
    copyright: '© {year} Baseline Store. All rights reserved.',
    poweredBy: '',
    pages: {},
  },
  announcementBar: {
    enabled: true,
    text: 'Free shipping on orders over $100',
  },
  trustIndicators: [],
  socialLinks: [],
  newsletter: {
    enabled: false,
    heading: 'Subscribe',
    description: 'Get the latest news and offers.',
    placeholder: 'Email address',
    buttonLabel: 'Subscribe',
  },
};
