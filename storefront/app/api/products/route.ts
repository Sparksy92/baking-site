import { NextResponse, NextRequest } from 'next/server';
import { getProducts } from '@/lib/db-service';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const category = searchParams.get('category');
  const limit = parseInt(searchParams.get('limit') || '48', 10);
  const sort = searchParams.get('sort');

  try {
    const data = await getProducts(category, limit, sort);
    return NextResponse.json(data);
  } catch (error: any) {
    return NextResponse.json({ detail: error.message }, { status: 500 });
  }
}
