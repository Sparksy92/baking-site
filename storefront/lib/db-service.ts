import { query } from './db';
import { type Product, type ProductListItem, type PublicSettings, type Category } from './api';

export async function getCategories(): Promise<Category[]> {
  const res = await query('SELECT * FROM categories ORDER BY sort_order ASC');
  return res.rows.map(r => ({
    id: r.id,
    name: r.name,
    slug: r.slug,
    description: r.description,
    image_url: r.image_url,
    sort_order: r.sort_order,
    is_active: r.is_active,
    product_count: 0 // Mocked or calculated
  }));
}

export async function getCategoryBySlug(slug: string): Promise<Category | null> {
  const res = await query('SELECT * FROM categories WHERE slug = $1', [slug]);
  if (res.rows.length === 0) return null;
  const r = res.rows[0];
  return {
    id: r.id,
    name: r.name,
    slug: r.slug,
    description: r.description,
    image_url: r.image_url,
    sort_order: r.sort_order,
    is_active: r.is_active,
    product_count: 0
  };
}

export async function getProducts(categorySlug?: string | null, limit: number = 48, sortBy?: string | null, featuredOnly: boolean = false): Promise<{ products: ProductListItem[]; total: number }> {
  let sql = `
    SELECT m.*, c.slug as category_slug, c.name as category_name 
    FROM menu_items m
    LEFT JOIN categories c ON m.category_id = c.id
    WHERE m.availability_status != 'hidden'
  `;
  const params: any[] = [];

  if (categorySlug) {
    sql += ` AND c.slug = $${params.length + 1}`;
    params.push(categorySlug);
  }

  if (featuredOnly) {
    sql += ` AND m.is_featured = TRUE`;
  }

  if (sortBy === 'price_asc') {
    sql += ` ORDER BY m.price_cents ASC`;
  } else if (sortBy === 'price_desc') {
    sql += ` ORDER BY m.price_cents DESC`;
  } else {
    sql += ` ORDER BY m.sort_order ASC, m.id ASC`;
  }

  sql += ` LIMIT $${params.length + 1}`;
  params.push(limit);

  const res = await query(sql, params);
  
  // Count query
  let countSql = `
    SELECT COUNT(*) as count 
    FROM menu_items m
    LEFT JOIN categories c ON m.category_id = c.id
    WHERE m.availability_status != 'hidden'
  `;
  const countParams: any[] = [];
  if (categorySlug) {
    countSql += ` AND c.slug = $1`;
    countParams.push(categorySlug);
  }
  if (featuredOnly) {
    countSql += ` AND m.is_featured = TRUE`;
  }
  const countRes = await query(countSql, countParams);
  const total = parseInt(countRes.rows[0]?.count || '0', 10);

  const products = res.rows.map(r => ({
    id: r.id,
    name: r.name,
    slug: r.slug,
    description: r.description,
    category_id: r.category_id,
    is_active: r.availability_status !== 'hidden',
    is_featured: r.is_featured,
    image_url: r.image_url,
    min_price_cents: r.price_cents,
    max_price_cents: r.price_cents,
    compare_at_price_cents: null,
    total_stock: r.availability_status === 'sold_out' ? 0 : 99,
    pricing_mode: r.pricing_mode,
    availability_status: r.availability_status,
    is_preorder_only: r.availability_status === 'preorder',
    is_weekend_only: r.availability_status === 'weekend_only',
    is_quote_only: r.pricing_mode === 'quote_only'
  }));

  return { products, total };
}

export async function getProductBySlug(slug: string): Promise<Product | null> {
  const sql = `
    SELECT m.*, c.slug as category_slug, c.name as category_name, c.description as category_description, c.image_url as category_image_url
    FROM menu_items m
    LEFT JOIN categories c ON m.category_id = c.id
    WHERE m.slug = $1 AND m.availability_status != 'hidden'
  `;
  const res = await query(sql, [slug]);
  if (res.rows.length === 0) return null;
  const r = res.rows[0];

  const category: Category | null = r.category_id ? {
    id: r.category_id,
    name: r.category_name,
    slug: r.category_slug,
    description: r.category_description,
    image_url: r.category_image_url,
    sort_order: 0,
    is_active: true,
    product_count: 0
  } : null;

  return {
    id: r.id,
    name: r.name,
    slug: r.slug,
    description: r.description,
    category,
    category_id: r.category_id,
    is_active: r.availability_status !== 'hidden',
    is_featured: r.is_featured,
    sort_order: r.sort_order,
    weight_g: null,
    meta_title: r.name,
    meta_description: r.description ? r.description.substring(0, 155) : null,
    noindex: false,
    canonical_url: null,
    og_image_url: r.image_url,
    allow_preorder: r.availability_status === 'preorder' || r.availability_status === 'available',
    available_at: null,
    variants: [{
      id: r.id,
      product_id: r.id,
      size: 'Standard',
      color: 'Default',
      color_hex: null,
      price_cents: r.price_cents,
      compare_at_price_cents: null,
      sku: r.slug,
      stock_quantity: r.availability_status === 'sold_out' ? 0 : 99,
      is_active: true,
      sort_order: 1,
      available_at: null
    }],
    images: r.image_url ? [{
      id: r.id,
      product_id: r.id,
      url: r.image_url,
      alt_text: r.name,
      sort_order: 1,
      is_primary: true,
      color: null,
      variant_id: null
    }] : [],
    tags: [],
    pricing_mode: r.pricing_mode,
    availability_status: r.availability_status,
    lead_time_days: r.lead_time_days,
    is_preorder_only: r.availability_status === 'preorder',
    is_weekend_only: r.availability_status === 'weekend_only',
    is_quote_only: r.pricing_mode === 'quote_only',
    allergy_notes: r.allergy_notes,
    pickup_notes: r.pickup_notes
  };
}

export async function getPublicSettings(): Promise<PublicSettings> {
  const res = await query('SELECT key, value FROM site_settings');
  const settingsMap: Record<string, string> = {};
  res.rows.forEach(r => {
    let val = r.value || '';
    if (typeof val === 'string') {
      val = val.replace(/Cedar\s*&\s*Sage/gi, 'Sage & Sweetgrass Homestead');
      val = val.replace(/Cedar\s+and\s+Sage/gi, 'Sage & Sweetgrass Homestead');
      
      // Self-healing email domain replacements
      val = val.replace(/[a-zA-Z0-9._%+-]+@cedar(?:and)?sage(?:homestead)?\.(?:ca|com)/gi, (match: string) => {
        if (match.toLowerCase().includes('payment') || match.toLowerCase().includes('etransfer')) {
          return 'payments@sageandsweetgrass.ca';
        }
        return 'hello@sageandsweetgrass.ca';
      });
    }
    settingsMap[r.key] = val;
  });

  return {
    brand_name: settingsMap['brand_name'] || 'Sage & Sweetgrass Homestead',
    brand_tagline: settingsMap['brand_tagline'] || 'Fresh baking, pantry goods & handmade home and body care',
    store_announcement: settingsMap['store_announcement'] || '',
    shipping_flat_rate_cents: parseInt(settingsMap['shipping_flat_rate_cents'] || '0', 10),
    shipping_free_threshold_cents: parseInt(settingsMap['shipping_free_threshold_cents'] || '0', 10),
    tax_rate: parseFloat(settingsMap['tax_rate'] || '0'),
    currency: settingsMap['currency'] || 'CAD',
    analytics_id: settingsMap['analytics_id'] || '',
    etransfer_email: settingsMap['etransfer_email'] || 'payments@sageandsweetgrass.ca',
    contact_email: settingsMap['contact_email'] || 'hello@sageandsweetgrass.ca',
    payment_method: 'etransfer',
    about_content: settingsMap['about_content'] || '',
    faq_content: settingsMap['faq_content'] || '',
    pickup_instructions: settingsMap['pickup_instructions'] || '',
    payment_instructions: settingsMap['payment_instructions'] || '',
    allergy_disclaimer: settingsMap['allergy_disclaimer'] || '',
    preorder_instructions: settingsMap['preorder_instructions'] || '',
    oven_fund_title: settingsMap['oven_fund_title'] || 'Commercial Oven Upgrade Fund — Phase 1',
    oven_fund_goal: settingsMap['oven_fund_goal'] || '2500',
    oven_fund_current_amount: settingsMap['oven_fund_current_amount'] || '0',
    oven_fund_description: settingsMap['oven_fund_description'] || '',
    oven_fund_title_2: settingsMap['oven_fund_title_2'] || 'Outdoor Wood-Fired Brick Oven',
    oven_fund_goal_2: settingsMap['oven_fund_goal_2'] || '5000',
    oven_fund_current_amount_2: settingsMap['oven_fund_current_amount_2'] || '0',
    oven_fund_description_2: settingsMap['oven_fund_description_2'] || ''
  };
}
