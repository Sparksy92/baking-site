import { NextResponse, NextRequest } from 'next/server';
import { getSessionUser } from '@/lib/auth';
import { query } from '@/lib/db';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getSessionUser();
  if (!user || user.role !== 'admin') {
    return NextResponse.json({ detail: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;
  try {
    const sql = `
      SELECT m.*, c.slug as category_slug, c.name as category_name, c.description as category_description, c.image_url as category_image_url
      FROM menu_items m
      LEFT JOIN categories c ON m.category_id = c.id
      WHERE m.id = $1
    `;
    const res = await query(sql, [parseInt(id, 10)]);
    if (res.rows.length === 0) {
      return NextResponse.json({ detail: 'Product not found' }, { status: 404 });
    }
    const r = res.rows[0];

    const category = r.category_id ? {
      id: r.category_id,
      name: r.category_name,
      slug: r.category_slug,
      description: r.category_description,
      image_url: r.category_image_url,
      sort_order: 0,
      is_active: true,
      product_count: 0
    } : null;

    const product = {
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

    return NextResponse.json(product);
  } catch (error: any) {
    return NextResponse.json({ detail: error.message }, { status: 500 });
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getSessionUser();
  if (!user || user.role !== 'admin') {
    return NextResponse.json({ detail: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;
  try {
    const body = await req.json();
    const {
      name, slug, description, category_id,
      pricing_mode, availability_status, lead_time_days,
      allergy_notes, pickup_notes, is_featured
    } = body;

    const sql = `
      UPDATE menu_items
      SET name = $1, slug = $2, description = $3, category_id = $4,
          pricing_mode = $5, availability_status = $6, lead_time_days = $7,
          allergy_notes = $8, pickup_notes = $9, is_featured = $10
      WHERE id = $11
      RETURNING *
    `;
    const paramsList = [
      name,
      slug,
      description || null,
      category_id || null,
      pricing_mode,
      availability_status,
      parseInt(lead_time_days || '0', 10),
      allergy_notes || null,
      pickup_notes || null,
      !!is_featured,
      parseInt(id, 10)
    ];

    const res = await query(sql, paramsList);
    if (res.rows.length === 0) {
      return NextResponse.json({ detail: 'Product not found' }, { status: 404 });
    }

    return NextResponse.json(res.rows[0]);
  } catch (error: any) {
    return NextResponse.json({ detail: error.message }, { status: 500 });
  }
}
