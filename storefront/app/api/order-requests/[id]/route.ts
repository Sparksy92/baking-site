import { NextResponse, NextRequest } from 'next/server';
import { query } from '@/lib/db';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const searchParams = req.nextUrl.searchParams;
  const email = searchParams.get('email');

  if (!email) {
    return NextResponse.json({ detail: 'Email parameter is required.' }, { status: 400 });
  }

  // Strip prefix (e.g. from CSH-123, SSH-123 or 123)
  const numericId = id.replace(/^(CSH-|SSH-)/i, '');

  try {
    const res = await query(
      'SELECT id, customer_name, customer_email, customer_phone, requested_items, desired_date, pickup_or_delivery, preferred_contact_method, allergy_notes, special_instructions, status, created_at FROM order_requests WHERE id = $1 AND LOWER(customer_email) = LOWER($2)',
      [numericId, email.trim()]
    );

    if (res.rows.length === 0) {
      return NextResponse.json({ detail: 'Order request not found.' }, { status: 404 });
    }

    const row = res.rows[0];
    
    // Parse requested_items if it is stored as a string
    let parsedItems = row.requested_items;
    if (typeof parsedItems === 'string') {
      try {
        parsedItems = JSON.parse(parsedItems);
      } catch {
        // ignore
      }
    }

    return NextResponse.json({
      order_number: `SSH-${row.id}`,
      status: row.status,
      customer_name: row.customer_name,
      customer_email: row.customer_email,
      customer_phone: row.customer_phone,
      requested_items: parsedItems,
      desired_date: row.desired_date,
      pickup_or_delivery: row.pickup_or_delivery,
      preferred_contact_method: row.preferred_contact_method,
      allergy_notes: row.allergy_notes,
      special_instructions: row.special_instructions,
      created_at: row.created_at
    });
  } catch (error: any) {
    return NextResponse.json({ detail: error.message }, { status: 500 });
  }
}
