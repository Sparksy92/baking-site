import { NextResponse, NextRequest } from 'next/server';
import { getPublicSettings } from '@/lib/db-service';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const settings = await getPublicSettings();
    return NextResponse.json(settings);
  } catch (error: any) {
    return NextResponse.json({ detail: error.message }, { status: 500 });
  }
}
