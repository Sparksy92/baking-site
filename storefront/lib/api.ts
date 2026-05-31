const BASE = '';

export class ApiError extends Error {
  status: number;
  detail: string;
  constructor(status: number, detail: string) {
    super(detail);
    this.status = status;
    this.detail = detail;
  }
}

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    ...options,
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({ detail: res.statusText }));
    throw new ApiError(res.status, body.detail || res.statusText);
  }

  return res.json();
}

export const api = {
  get: <T>(path: string) => request<T>(path),
  post: <T>(path: string, body?: unknown) =>
    request<T>(path, { method: 'POST', body: JSON.stringify(body) }),
  patch: <T>(path: string, body?: unknown) =>
    request<T>(path, { method: 'PATCH', body: JSON.stringify(body) }),
  put: <T>(path: string, body?: unknown) =>
    request<T>(path, { method: 'PUT', body: JSON.stringify(body) }),
  delete: <T>(path: string) =>
    request<T>(path, { method: 'DELETE' }),
  upload: async <T>(path: string, formData: FormData): Promise<T> => {
    const res = await fetch(`${BASE}${path}`, {
      method: 'POST',
      credentials: 'include',
      body: formData,
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({ detail: res.statusText }));
      throw new ApiError(res.status, body.detail || res.statusText);
    }
    return res.json();
  },
};

// ── Server-side fetch (used in Server Components) ─────────
const API_INTERNAL = process.env.API_URL || 'http://localhost:8100';

export async function apiFetch<T>(path: string): Promise<T> {
  const res = await fetch(`${API_INTERNAL}${path}`, {
    next: { revalidate: 60 },
  });
  if (!res.ok) throw new Error(`API ${res.status}: ${path}`);
  return res.json();
}

// ── Types ───────────────────────────────────────────────────

export interface Category {
  id: number;
  name: string;
  slug: string;
  description: string | null;
  image_url: string | null;
  sort_order: number;
  is_active: boolean;
  product_count: number;
}

export interface Variant {
  id: number;
  product_id: number;
  size: string;
  color: string;
  color_hex: string | null;
  price_cents: number;
  compare_at_price_cents: number | null;
  sku: string | null;
  stock_quantity: number;
  is_active: boolean;
  sort_order: number;
}

export interface ProductImage {
  id: number;
  product_id: number;
  url: string;
  alt_text: string | null;
  sort_order: number;
  is_primary: boolean;
}

export interface Product {
  id: number;
  name: string;
  slug: string;
  description: string | null;
  category: Category | null;
  category_id: number | null;
  is_active: boolean;
  is_featured: boolean;
  sort_order: number;
  weight_g: number | null;
  variants: Variant[];
  images: ProductImage[];
}

export interface ProductListItem {
  id: number;
  name: string;
  slug: string;
  description: string | null;
  category_id: number | null;
  is_active: boolean;
  is_featured: boolean;
  image_url: string | null;
  min_price_cents: number | null;
  max_price_cents: number | null;
  compare_at_price_cents: number | null;
  total_stock: number;
}

export interface Collection {
  id: number;
  name: string;
  slug: string;
  description: string | null;
  image_url: string | null;
  is_active: boolean;
  sort_order: number;
  product_count: number;
}

export interface PublicSettings {
  brand_name: string;
  store_announcement: string;
  shipping_flat_rate_cents: number;
  shipping_free_threshold_cents: number;
  tax_rate: number;
  currency: string;
  analytics_id: string;
}

export interface CheckoutResponse {
  order_number: string;
  stripe_checkout_url: string;
}

export interface OrderLookup {
  order_number: string;
  status: string;
  payment_status: string;
  items: {
    product_name: string;
    variant_size: string;
    variant_color: string;
    quantity: number;
    unit_price_cents: number;
    line_total_cents: number;
  }[];
  subtotal_cents: number;
  shipping_cents: number;
  tax_cents: number;
  total_cents: number;
  tracking_number: string | null;
  tracking_carrier: string | null;
  created_at: string;
}

export interface Customer {
  id: number;
  email: string;
  first_name: string;
  last_name: string;
  phone: string | null;
}

export interface CustomerAddress {
  id: number;
  label: string;
  first_name: string;
  last_name: string;
  line1: string;
  line2: string | null;
  city: string;
  province: string;
  postal_code: string;
  country: string;
  phone: string | null;
  is_default: boolean;
}

export interface CustomerOrder {
  order_number: string;
  status: string;
  payment_status: string;
  total_cents: number;
  tracking_number: string | null;
  tracking_carrier: string | null;
  created_at: string;
  item_count: number;
}
