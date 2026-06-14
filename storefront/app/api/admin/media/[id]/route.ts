import { NextResponse, NextRequest } from 'next/server';
import { getSessionUser } from '@/lib/auth';
import { query } from '@/lib/db';
import { del } from '@vercel/blob';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function PATCH(
  req: NextRequest,
  { params }: RouteContext
) {
  // 1. Admin Authentication Check
  const user = await getSessionUser();
  if (!user || user.role !== 'admin') {
    return NextResponse.json({ detail: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;

  try {
    const body = await req.json();
    const { alt_text, filename } = body;

    // Check if asset exists
    const checkRes = await query('SELECT * FROM media_assets WHERE id = $1', [id]);
    if (checkRes.rows.length === 0) {
      return NextResponse.json({ detail: 'Media asset not found.' }, { status: 404 });
    }

    const updateSql = `
      UPDATE media_assets
      SET alt_text = COALESCE($1, alt_text),
          filename = COALESCE($2, filename),
          updated_at = NOW()
      WHERE id = $3
      RETURNING id, url, pathname, filename, alt_text, content_type, size_bytes, source, created_at, updated_at
    `;
    const res = await query(updateSql, [alt_text, filename, id]);

    return NextResponse.json(res.rows[0]);
  } catch (error: any) {
    console.error('Failed to update media asset:', error);
    return NextResponse.json({ detail: error.message || 'Failed to update media asset.' }, { status: 500 });
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: RouteContext
) {
  // 1. Admin Authentication Check
  const user = await getSessionUser();
  if (!user || user.role !== 'admin') {
    return NextResponse.json({ detail: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;
  const { searchParams } = new URL(req.url);
  const force = searchParams.get('force') === 'true';

  try {
    // Check if asset exists
    const checkRes = await query('SELECT * FROM media_assets WHERE id = $1', [id]);
    if (checkRes.rows.length === 0) {
      return NextResponse.json({ detail: 'Media asset not found.' }, { status: 404 });
    }
    const asset = checkRes.rows[0];

    // Check if used by products
    const usageRes = await query('SELECT COUNT(*) as count FROM menu_items WHERE image_url = $1', [asset.url]);
    const usageCount = parseInt(usageRes.rows[0]?.count || '0', 10);

    if (usageCount > 0 && !force) {
      return NextResponse.json(
        {
          detail: `This image is currently used by ${usageCount} menu item(s).`,
          inUse: true,
          usageCount
        },
        { status: 400 }
      );
    }

    // Delete from Vercel Blob if source is vercel_blob and url exists
    let blobDeleteError = null;
    if (asset.source === 'vercel_blob' && asset.url && asset.url.startsWith('http')) {
      const token = process.env.BLOB_READ_WRITE_TOKEN;
      if (token) {
        try {
          await del(asset.url, { token });
        } catch (err: any) {
          console.warn('Failed to delete from Vercel Blob:', err);
          blobDeleteError = err.message || 'Vercel Blob deletion failed';
        }
      } else {
        console.warn('BLOB_READ_WRITE_TOKEN missing during DELETE request.');
        blobDeleteError = 'BLOB_READ_WRITE_TOKEN env var is missing.';
      }
    }

    // Delete from database
    await query('DELETE FROM media_assets WHERE id = $1', [id]);

    return NextResponse.json({
      success: true,
      id: asset.id,
      blobDeleted: !blobDeleteError && asset.source === 'vercel_blob',
      blobDeleteError
    });
  } catch (error: any) {
    console.error('Failed to delete media asset:', error);
    return NextResponse.json({ detail: error.message || 'Failed to delete media asset.' }, { status: 500 });
  }
}
