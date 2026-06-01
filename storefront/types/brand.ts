/**
 * Brand Configuration Type System
 *
 * Defines the contract for per-brand configuration.
 * Each customer site implements this interface in sites/<brand>/brand.config.ts
 */

export interface BrandColors {
  /** Primary brand color (buttons, links, accents) */
  primary: string
  /** Secondary brand color (hover states, secondary actions) */
  secondary: string
  /** Accent color (highlights, badges, callouts) */
  accent: string
  /** Background color (page background) */
  background: string
  /** Surface color (card backgrounds, elevated surfaces) */
  surface: string
  /** Primary text color */
  text: string
  /** Muted text color (descriptions, secondary text) */
  textMuted: string
  /** Border color */
  border: string
  /** Error/destructive color */
  error: string
  /** Success color */
  success: string
  /** Warning color */
  warning: string
}

export interface BrandFonts {
  /** Primary font family for headings */
  heading: string
  /** Body text font family */
  body: string
  /** Monospace font family (code, prices) */
  mono?: string
}

export interface BrandMetadata {
  /** Brand display name */
  name: string
  /** Short tagline */
  tagline: string
  /** Meta description for SEO */
  description: string
  /** Default page title template: "Page | {siteName}" */
  siteName: string
  /** Base URL for the storefront (e.g., https://example.com) */
  baseUrl: string
  /** Default locale/language */
  locale: string
  /** Default region/country code for Medusa */
  defaultRegion: string
  /** Twitter/X handle (without @) */
  twitterHandle?: string
  /** Open Graph image path (relative to public/) */
  ogImage?: string
}

export interface BrandAssets {
  /** Path to logo image (relative to public/) */
  logo: string
  /** Path to logo for dark backgrounds */
  logoDark?: string
  /** Path to favicon */
  favicon: string
  /** Path to hero/banner image (relative to public/) */
  heroImage?: string
}

export interface BrandPaymentConfig {
  /** Payment provider: 'stripe' | 'moneris' */
  provider: "stripe" | "moneris"
  /** Moneris-specific: environment */
  monerisEnvironment?: "qa" | "prod"
}

export interface BrandFeatureFlags {
  /** Enable blog/CMS content pages */
  blog: boolean
  /** Enable customer accounts */
  accounts: boolean
  /** Enable product search */
  search: boolean
  /** Enable newsletter signup */
  newsletter: boolean
  /** Enable product reviews */
  reviews: boolean
  /** Enable wishlists */
  wishlists: boolean
  /** Enable multi-currency support */
  multiCurrency: boolean
  /** Enable Google Analytics */
  analytics: boolean
}

export interface BrandNavLink {
  /** Display label */
  label: string
  /** URL path (internal) or full URL (external) */
  href: string
  /** Open in new tab (for external links) */
  external?: boolean
}

export interface BrandNavigation {
  /** Main navigation links shown in the side menu */
  mainLinks: BrandNavLink[]
  /** Footer link columns (each column has a title and links) */
  footerColumns: {
    title: string
    links: BrandNavLink[]
  }[]
}

export interface BrandPageContent {
  /** Page title (h1 heading) */
  title: string
  /** Meta description for SEO */
  description: string
  /** Page body sections — each string is a paragraph of text or HTML */
  sections: string[]
}

export interface BrandContent {
  /** Copyright text template — use {year} for dynamic year */
  copyright: string
  /** "Powered by" text in footer (empty string to hide) */
  poweredBy: string
  /** Static page content keyed by slug (about, contact, privacy-policy, etc.) */
  pages: Record<string, BrandPageContent>
}

export interface BrandAnnouncementBar {
  /** Whether to show the announcement bar */
  enabled: boolean
  /** Announcement text */
  text: string
  /** Optional link URL */
  href?: string
  /** Optional link label (if different from text) */
  linkLabel?: string
}

export interface BrandTrustIndicator {
  /** Icon name or emoji */
  icon: string
  /** Short label */
  label: string
  /** Slightly longer description */
  description: string
}

export interface BrandSocialLink {
  /** Platform name */
  platform: string
  /** Full URL */
  href: string
  /** Label for accessibility */
  label: string
}

export interface BrandNewsletterConfig {
  /** Whether to show newsletter signup in footer */
  enabled: boolean
  /** Headline text */
  heading: string
  /** Description text */
  description: string
  /** Placeholder for email input */
  placeholder: string
  /** Button label */
  buttonLabel: string
}

export interface BrandConfig {
  /** Unique brand identifier (matches directory name in sites/) */
  id: string
  colors: BrandColors
  fonts: BrandFonts
  metadata: BrandMetadata
  assets: BrandAssets
  payment: BrandPaymentConfig
  features: BrandFeatureFlags
  navigation: BrandNavigation
  content: BrandContent
  /** Announcement bar at top of page */
  announcementBar: BrandAnnouncementBar
  /** Trust indicators shown below hero */
  trustIndicators: BrandTrustIndicator[]
  /** Social media links */
  socialLinks: BrandSocialLink[]
  /** Newsletter signup configuration */
  newsletter: BrandNewsletterConfig
}
