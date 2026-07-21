import { BrandConfig } from '../types/brand';

export const brandConfig: BrandConfig = {
  id: 'the-artisan-bakery',
  metadata: {
    name: 'The Artisan Bakery',
    tagline: 'Fresh baking, pantry goods & handmade home and body care',
    description: 'Homemade fresh baking, desserts, pantry goods, jams, pickled goods, handmade tallow lotions, lip balms, salves, and herbal oils.',
    siteName: 'The Artisan Bakery',
    baseUrl: 'https://yourdomain.com',
    locale: 'en-CA',
    defaultRegion: 'ca',
  },
  colors: {
    primary: '#6F7D5C', // sage green
    secondary: '#C8A2A8', // dusty rose
    accent: '#C8A2A8', // dusty rose
    background: '#FAF7F2', // warm cream
    surface: '#F5EFE6', // soft cream-white
    text: '#2B2522', // deep brown/charcoal
    textMuted: '#6B605A', // muted brown
    border: '#E3DDD3', // soft sand border
    error: '#C53030',
    success: '#6F7D5C', // sage
    warning: '#D4A574', // warm amber
  },
  fonts: {
    heading: 'var(--font-geist-sans), sans-serif',
    body: 'var(--font-geist-sans), sans-serif',
  },
  assets: {
    logo: '/logo.png',
    favicon: '/logo.png',
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
      { label: 'Home', href: '/' },
      { label: 'Shop', href: '/shop' },
      { label: 'Oven Fund', href: '/oven-fund' },
      { label: 'About', href: '/about' },
      { label: 'Contact', href: '/contact' },
    ],
    footerColumns: [
      {
        title: 'Shop',
        links: [
          { label: 'All Products', href: '/shop' },
          { label: 'Baked Fresh', href: '/shop?category=baked-fresh' },
          { label: 'Pantry Goods', href: '/shop?category=pantry' },
          { label: 'Home & Body', href: '/shop?category=home-body' },
        ],
      },
      {
        title: 'Homestead',
        links: [
          { label: 'Oven Fund', href: '/oven-fund' },
          { label: 'Our Story', href: '/about' },
          { label: 'Contact', href: '/contact' },
          { label: 'Order Info', href: '/order-info' },
          { label: 'FAQ', href: '/faq' },
        ],
      },
      {
        title: 'Policies',
        links: [
          { label: 'Pickup & Delivery', href: '/shipping-policy' },
          { label: 'Return Policy', href: '/return-policy' },
          { label: 'Privacy Policy', href: '/privacy-policy' },
          { label: 'Terms of Service', href: '/terms-of-service' },
        ],
      },
    ],
  },
  content: {
    copyright: '© {year} The Artisan Bakery. All rights reserved.',
    poweredBy: '',
    pages: {},
  },
  announcementBar: {
    enabled: true,
    text: 'Fresh weekly baking preorders — Local pickup & custom requests welcome!',
  },
  trustIndicators: [
    { label: 'Small Batch', icon: 'leaf', description: 'Every item is handmade in small batches in our homestead kitchen.' },
    { label: 'Homemade', icon: 'heart-handshake', description: 'Baked fresh with quality ingredients and traditional methods.' },
    { label: 'Local Pickup', icon: 'truck', description: 'Freshly made for local pickup and delivery requests.' },
    { label: 'Homestead Care', icon: 'shield', description: '100% natural, hand-rendered tallow and herbal care products.' },
  ],
  socialLinks: [],
  seo: {
    abbreviation: 'TAB',
    currency: 'CAD',
    twitterHandle: '',
    googleVerification: '',
    defaultOgImage: '/images/brand/og-default.jpg',
    blogSectionName: 'Homestead Notes',
    blogPostLabel: 'Homestead Note',
    heroStats: [
      { value: '100%', label: 'Small batch' },
      { value: 'Fresh', label: 'Baked to order' },
      { value: 'Local', label: 'Homestead made' },
    ],
  },
  newsletter: {
    enabled: true,
    heading: 'Fresh from the Oven.',
    description: 'Get notified about our weekly baking menu, preorder schedules, and homestead recipes. No spam, just warm bread.',
    placeholder: 'your@email.com',
    buttonLabel: 'Subscribe',
  },
  // localBusiness: {
  //   type: 'Bakery',          // schema.org type
  //   streetAddress: '123 Homestead Rd',
  //   addressLocality: 'Homestead County',
  //   addressRegion: 'ON',
  //   postalCode: 'K0L 1L0',
  //   addressCountry: 'CA',
  //   telephone: '+1-555-0100',
  //   openingHours: ['Mo-Fr 08:00-17:00'],
  //   priceRange: '$$',
  // },
};
