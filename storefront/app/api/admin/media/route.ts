import { NextResponse } from 'next/server';
import { getSessionUser } from '@/lib/auth';
import { query } from '@/lib/db';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  // 1. Admin Authentication Check
  const user = await getSessionUser();
  if (!user || user.role !== 'admin') {
    return NextResponse.json({ detail: 'Unauthorized' }, { status: 401 });
  }

  try {
    const res = await query('SELECT * FROM media_assets ORDER BY created_at DESC, id DESC');
    return NextResponse.json(res.rows);
  } catch (error: any) {
    console.error('Failed to fetch media assets:', error);
    return NextResponse.json({ detail: error.message || 'Failed to fetch media assets.' }, { status: 500 });
  }
}
