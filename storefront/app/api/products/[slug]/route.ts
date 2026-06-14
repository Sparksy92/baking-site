import { NextResponse, NextRequest } from 'next/server';
import { getProductBySlug } from '@/lib/db-service';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;
  try {
    const product = await getProductBySlug(slug);
    if (!product) {
      return NextResponse.json({ detail: 'Product not found' }, { status: 404 });
    }
    return NextResponse.json(product);
  } catch (error: any) {
    return NextResponse.json({ detail: error.message }, { status: 500 });
  }
}
