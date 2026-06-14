import { NextResponse, NextRequest } from 'next/server';
import { getSessionUser } from '@/lib/auth';
import { query } from '@/lib/db';
import { put } from '@vercel/blob';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const MAX_FILE_SIZE_BYTES = 4 * 1024 * 1024; // 4 MB limit

export async function POST(req: NextRequest) {
  // 1. Admin Authentication Check
  const user = await getSessionUser();
  if (!user || user.role !== 'admin') {
    return NextResponse.json({ detail: 'Unauthorized' }, { status: 401 });
  }

  // 2. Token Check
  const token = process.env.BLOB_READ_WRITE_TOKEN;
  if (!token) {
    return NextResponse.json(
      { detail: 'Vercel Blob storage is not configured. BLOB_READ_WRITE_TOKEN is missing.' },
      { status: 500 }
    );
  }

  try {
    const formData = await req.formData();
    const file = formData.get('file') as File | null;
    if (!file) {
      return NextResponse.json({ detail: 'No file uploaded.' }, { status: 400 });
    }

    // 3. Size Validation
    if (file.size > MAX_FILE_SIZE_BYTES) {
      return NextResponse.json(
        { detail: `File size exceeds the 4 MB limit (got ${(file.size / (1024 * 1024)).toFixed(2)} MB).` },
        { status: 400 }
      );
    }

    // 4. Mime Type Validation
    if (!ALLOWED_MIME_TYPES.includes(file.type)) {
      return NextResponse.json(
        { detail: 'Invalid file type. Only JPEG, PNG, and WebP images are allowed.' },
        { status: 400 }
      );
    }

    // 5. Filename Sanitization
    const originalName = file.name || 'image.jpg';
    const lastDotIdx = originalName.lastIndexOf('.');
    const ext = lastDotIdx !== -1 ? originalName.slice(lastDotIdx + 1).toLowerCase() : 'jpg';
    const rawBaseName = lastDotIdx !== -1 ? originalName.slice(0, lastDotIdx) : originalName;
    const sanitizedBase = rawBaseName
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '');
    const sanitizedFilename = `media/${sanitizedBase || 'upload'}-${Date.now()}.${ext}`;

    // 6. Upload to Vercel Blob
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const blob = await put(sanitizedFilename, buffer, {
      access: 'public',
      token,
      contentType: file.type,
    });

    // 7. Insert to DB
    // Alt text defaults to sanitized base name
    const altText = sanitizedBase
      .replace(/-/g, ' ')
      .replace(/\b\w/g, c => c.toUpperCase());

    const insertSql = `
      INSERT INTO media_assets (url, pathname, filename, alt_text, content_type, size_bytes, source)
      VALUES ($1, $2, $3, $4, $5, $6, 'vercel_blob')
      RETURNING id, url, pathname, filename, alt_text, content_type, size_bytes, source, created_at
    `;
    const dbRes = await query(insertSql, [
      blob.url,
      blob.pathname,
      originalName,
      altText,
      file.type,
      file.size
    ]);

    const record = dbRes.rows[0];
    return NextResponse.json(record);
  } catch (err: any) {
    console.error('File upload failed:', err);
    return NextResponse.json({ detail: err.message || 'An error occurred during upload.' }, { status: 500 });
  }
}
