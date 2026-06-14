import { NextResponse, NextRequest } from 'next/server';
import { getSessionUser } from '@/lib/auth';
import { query } from '@/lib/db';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const user = await getSessionUser();
  if (!user || user.role !== 'admin') {
    return NextResponse.json({ detail: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const status = searchParams.get('status');
  const limit = parseInt(searchParams.get('limit') || '100', 10);

  try {
    let sql = 'SELECT * FROM order_requests';
    const params: any[] = [];

    if (status) {
      sql += ' WHERE status = $1';
      params.push(status);
    }

    sql += ' ORDER BY id DESC LIMIT $' + (params.length + 1);
    params.push(limit);

    const res = await query(sql, params);
    
    // Calculate total
    let countSql = 'SELECT COUNT(*) as count FROM order_requests';
    const countParams: any[] = [];
    if (status) {
      countSql += ' WHERE status = $1';
      countParams.push(status);
    }
    const countRes = await query(countSql, countParams);
    const total = parseInt(countRes.rows[0]?.count || '0', 10);

    return NextResponse.json({
      order_requests: res.rows,
      total
    });
  } catch (error: any) {
    return NextResponse.json({ detail: error.message }, { status: 500 });
  }
}
