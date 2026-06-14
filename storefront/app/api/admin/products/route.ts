import { NextResponse, NextRequest } from 'next/server';
import { getSessionUser } from '@/lib/auth';
import { query } from '@/lib/db';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const validPricingModes = ['fixed', 'starting_at', 'quote_only', 'seasonal'];
const validAvailabilityStatuses = ['available', 'preorder', 'weekend_only', 'sold_out', 'seasonal', 'hidden'];

function validateMenuItem(body: any) {
  const errors: Record<string, string> = {};
  const { name, slug, pricing_mode, availability_status, price_cents, lead_time_days } = body;

  if (!name || typeof name !== 'string' || name.trim() === '') {
    errors.name = 'Name is required.';
  }
  if (!slug || typeof slug !== 'string' || !/^[a-z0-9-]+$/.test(slug)) {
    errors.slug = 'Slug is required and must be lowercase alphanumeric with hyphens.';
  }
  if (!pricing_mode || !validPricingModes.includes(pricing_mode)) {
    errors.pricing_mode = `Pricing mode must be one of: ${validPricingModes.join(', ')}`;
  }
  if (!availability_status || !validAvailabilityStatuses.includes(availability_status)) {
    errors.availability_status = `Availability status must be one of: ${validAvailabilityStatuses.join(', ')}`;
  }
  if (price_cents !== undefined) {
    const cents = Number(price_cents);
    if (!Number.isInteger(cents) || cents < 0) {
      errors.price_cents = 'Price cents must be a non-negative integer.';
    }
  } else {
    errors.price_cents = 'Price cents is required.';
  }
  if (lead_time_days !== undefined) {
    const days = Number(lead_time_days);
    if (!Number.isInteger(days) || days < 0) {
      errors.lead_time_days = 'Lead time days must be a non-negative integer.';
    }
  }

  return {
    isValid: Object.keys(errors).length === 0,
    errors,
  };
}

export async function GET() {
  const user = await getSessionUser();
  if (!user || user.role !== 'admin') {
    return NextResponse.json({ detail: 'Unauthorized' }, { status: 401 });
  }

  try {
    const sql = `
      SELECT m.*, c.name as category_name 
      FROM menu_items m
      LEFT JOIN categories c ON m.category_id = c.id
      ORDER BY m.sort_order ASC, m.id DESC
    `;
    const res = await query(sql);
    
    const products = res.rows.map(r => ({
      id: r.id,
      name: r.name,
      slug: r.slug,
      category_name: r.category_name,
      total_stock: r.availability_status === 'sold_out' ? 0 : 99,
      is_active: r.availability_status !== 'hidden',
      price_cents: r.price_cents,
      pricing_mode: r.pricing_mode,
      availability_status: r.availability_status,
      image_url: r.image_url
    }));

    return NextResponse.json(products);
  } catch (error: any) {
    return NextResponse.json({ detail: error.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const user = await getSessionUser();
  if (!user || user.role !== 'admin') {
    return NextResponse.json({ detail: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await req.json();
    const { isValid, errors } = validateMenuItem(body);
    if (!isValid) {
      return NextResponse.json({ errors }, { status: 400 });
    }

    const {
      name, slug, description, category_id,
      pricing_mode, availability_status, lead_time_days,
      allergy_notes, pickup_notes, is_featured, price_cents, image_url, sort_order
    } = body;

    const sql = `
      INSERT INTO menu_items (
        name, slug, description, category_id,
        pricing_mode, availability_status, lead_time_days,
        allergy_notes, pickup_notes, is_featured, price_cents, image_url, sort_order
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
      RETURNING id
    `;
    const params = [
      name, slug, description || null, category_id || null,
      pricing_mode, availability_status, parseInt(lead_time_days || '0', 10),
      allergy_notes || null, pickup_notes || null, !!is_featured,
      parseInt(price_cents, 10), image_url || null, parseInt(sort_order || '0', 10)
    ];

    const res = await query(sql, params);
    return NextResponse.json(res.rows[0], { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ detail: error.message }, { status: 500 });
  }
}
