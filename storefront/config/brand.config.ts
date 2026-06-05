import { BrandConfig } from '../types/brand';

export const brandConfig: BrandConfig = {
  id: 'terra-supply-co',
  metadata: {
    name: 'Terra Supply Co.',
    tagline: 'Built for the Long Haul.',
    description: 'Durable, ethically made clothing for people who live and work outdoors. No fluff, no fast fashion.',
    siteName: 'Terra Supply Co.',
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
    copyright: '© {year} Terra Supply Co. All rights reserved.',
    poweredBy: '',
    pages: {},
  },
  announcementBar: {
    enabled: true,
    text: 'Free shipping on orders over $75 — Built to last, made to matter.',
  },
  trustIndicators: [
    { label: 'Ethically Made', icon: 'leaf', description: 'Responsible sourcing, fair wages, lower footprint.' },
    { label: 'Built to Last', icon: 'shield', description: 'No fast fashion. Every piece is meant to go the distance.' },
    { label: 'Free Returns', icon: 'refresh-cw', description: '60-day hassle-free returns on everything we sell.' },
    { label: 'Ships from Canada', icon: 'truck', description: 'Fast domestic shipping, carbon offset on every order.' },
  ],
  socialLinks: [],
  seo: {
    abbreviation: 'TERRA',
    currency: 'CAD',
    twitterHandle: '',
    googleVerification: '',
    defaultOgImage: '/images/brand/og-default.jpg',
    blogSectionName: 'Field Notes',
    blogPostLabel: 'Field Note',
    heroStats: [
      { value: '60-day', label: 'Free returns' },
      { value: '$75+', label: 'Free shipping' },
      { value: '5yr', label: 'Craftsmanship guarantee' },
    ],
  },
  newsletter: {
    enabled: true,
    heading: 'Less noise. More good stuff.',
    description: 'New drops, field notes, and occasional deals. Never spam — we hate it too.',
    placeholder: 'your@email.com',
    buttonLabel: 'Subscribe',
  },
  // localBusiness: {
  //   type: 'ClothingStore',          // schema.org type — change per fork
  //   streetAddress: '123 Main St',
  //   addressLocality: 'Toronto',
  //   addressRegion: 'ON',
  //   postalCode: 'M5V 1A1',
  //   addressCountry: 'CA',
  //   telephone: '+1-416-555-0100',
  //   openingHours: ['Mo-Fr 10:00-18:00', 'Sa 10:00-16:00'],
  //   priceRange: '$$',
  // },
};
