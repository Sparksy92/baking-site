import { NextResponse, NextRequest } from 'next/server';
import { getSessionUser } from '@/lib/auth';
import { query } from '@/lib/db';

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
      is_active: r.availability_status !== 'hidden'
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
    const {
      name, slug, description, category_id,
      pricing_mode, availability_status, lead_time_days,
      allergy_notes, pickup_notes, is_featured
    } = body;

    const sql = `
      INSERT INTO menu_items (
        name, slug, description, category_id,
        pricing_mode, availability_status, lead_time_days,
        allergy_notes, pickup_notes, is_featured, sort_order
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 0)
      RETURNING id
    `;
    const params = [
      name, slug, description, category_id || null,
      pricing_mode || 'fixed', availability_status || 'available',
      parseInt(lead_time_days || '0', 10),
      allergy_notes || null, pickup_notes || null,
      !!is_featured
    ];

    const res = await query(sql, params);
    return NextResponse.json(res.rows[0], { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ detail: error.message }, { status: 500 });
  }
}
