import { NextResponse } from 'next/server';
import { getSessionUser } from '@/lib/auth';
import { query } from '@/lib/db';

export async function GET() {
  const user = await getSessionUser();
  if (!user || user.role !== 'admin') {
    return NextResponse.json({ detail: 'Unauthorized' }, { status: 401 });
  }

  try {
    const totalRequestsRes = await query('SELECT COUNT(*) as count FROM order_requests');
    const newRequestsRes = await query("SELECT COUNT(*) as count FROM order_requests WHERE status = 'new'");
    const uniqueEmailsRes = await query('SELECT COUNT(DISTINCT customer_email) as count FROM order_requests');
    
    const totalRequests = parseInt(totalRequestsRes.rows[0]?.count || '0', 10);
    const newRequests = parseInt(newRequestsRes.rows[0]?.count || '0', 10);
    const customerCount = parseInt(uniqueEmailsRes.rows[0]?.count || '0', 10);

    const stats = {
      total_orders: totalRequests,
      total_revenue_cents: 0, // Request-based ordering, payment is not completed online
      pending_orders: newRequests,
      processing_orders: 0,
      shipped_orders: 0,
      monthly_revenue_cents: 0,
      monthly_orders: totalRequests,
      weekly_revenue_cents: 0,
      weekly_orders: totalRequests,
      top_products: [],
      low_stock: [],
      customer_count: customerCount,
      subscriber_count: 0
    };

    return NextResponse.json(stats);
  } catch (error: any) {
    return NextResponse.json({ detail: error.message }, { status: 500 });
  }
}
