import { BrandConfig } from '../types/brand';

export const brandConfig: BrandConfig = {
  id: 'baseline-store',
  metadata: {
    name: 'Baseline Store',
    tagline: 'Rooted in Culture. Made with Purpose.',
    description: 'Ethically crafted goods rooted in Indigenous culture and tradition.',
    siteName: 'Baseline Store',
    baseUrl: 'https://yourdomain.com',
    locale: 'en-CA',
    defaultRegion: 'ca',
  },
  colors: {
    primary: '#5C3D2E', // earth brown
    secondary: '#6B7F5E', // sage green
    accent: '#B85C38', // terracotta
    background: '#FBF7F4', // warm cream
    surface: '#F5EDE8', // warm white
    text: '#3D2E1F', // deep brown
    textMuted: '#8B7B6B', // muted earth
    border: '#E8DDD3', // sand
    error: '#C53030',
    success: '#6B7F5E', // sage
    warning: '#D4A574', // warm amber
  },
  fonts: {
    heading: 'var(--font-geist-sans), sans-serif',
    body: 'var(--font-geist-sans), sans-serif',
  },
  assets: {
    logo: '/images/brand/logo.svg',
    favicon: '/images/brand/favicon.svg',
  },
  payment: {
    provider: 'stripe',
  },
  features: {
    blog: true,
    accounts: true,
    search: true,
    newsletter: true,
    reviews: false,
    wishlists: false,
    multiCurrency: false,
    analytics: false,
  },
  navigation: {
    mainLinks: [
      { label: 'Shop', href: '/search' },
      { label: 'New Arrivals', href: '/collections/new-arrivals' },
      { label: 'Categories', href: '/categories' },
      { label: 'Blog', href: '/blog' },
      { label: 'About', href: '/about' },
    ],
    footerColumns: [
      {
        title: 'Shop',
        links: [
          { label: 'All Products', href: '/search' },
          { label: 'New Arrivals', href: '/collections/new-arrivals' },
          { label: 'Categories', href: '/categories' },
        ],
      },
      {
        title: 'Company',
        links: [
          { label: 'Our Story', href: '/about' },
          { label: 'Blog', href: '/blog' },
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
    copyright: '© {year} Baseline Store. All rights reserved. | Indigenous owned & operated.',
    poweredBy: '',
    pages: {},
  },
  announcementBar: {
    enabled: true,
    text: 'Free shipping on orders over $100 | Indigenous owned & operated',
  },
  trustIndicators: [
    { label: 'Ethically Made', icon: 'leaf', description: 'Thoughtful production and responsible sourcing.' },
    { label: 'Indigenous Owned', icon: 'feather', description: 'Rooted in culture, care, and community pride.' },
    { label: 'Community First', icon: 'heart-handshake', description: 'Built to support cultural and local impact.' },
  ],
  socialLinks: [],
  newsletter: {
    enabled: true,
    heading: 'First access to meaningful drops.',
    description: 'New releases, restocks, stories, and community updates sent with care.',
    placeholder: 'Email address',
    buttonLabel: 'Join',
  },
};
