import { vi, describe, it, expect, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

const { mockUserRef, mockQueryFn, mockPutFn, mockDelFn } = vi.hoisted(() => {
  return {
    mockUserRef: { current: null as any },
    mockQueryFn: vi.fn(async (sql?: string, params?: any[]) => ({ rows: [] as any[] })),
    mockPutFn: vi.fn(async (pathname: string) => ({
      url: `https://blob.vercel-storage.com/${pathname}`,
      pathname
    })),
    mockDelFn: vi.fn(async () => {})
  };
});

vi.mock('../../lib/auth', () => ({
  getSessionUser: vi.fn(async () => mockUserRef.current)
}));

vi.mock('../../lib/db', () => ({
  query: mockQueryFn
}));

vi.mock('@vercel/blob', () => ({
  put: mockPutFn,
  del: mockDelFn
}));

// Import after mocks are hoisted
import { POST as uploadPost } from '../../app/api/admin/media/upload/route';
import { GET as mediaListGet } from '../../app/api/admin/media/route';
import { DELETE as mediaDelete } from '../../app/api/admin/media/[id]/route';

describe('Media API Routes - Authentication & Security', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUserRef.current = null;
    mockQueryFn.mockReset();
    mockQueryFn.mockImplementation(async () => ({ rows: [] }));
    process.env.BLOB_READ_WRITE_TOKEN = 'test-token';
  });

  it('upload route rejects unauthenticated request', async () => {
    mockUserRef.current = null;
    const req = new NextRequest('http://localhost/api/admin/media/upload', {
      method: 'POST'
    });
    const res = await uploadPost(req);
    expect(res.status).toBe(401);
  });

  it('media list requires auth', async () => {
    mockUserRef.current = null;
    const res = await mediaListGet();
    expect(res.status).toBe(401);
  });

  it('upload route rejects invalid content type', async () => {
    mockUserRef.current = { role: 'admin', username: 'admin' };
    
    const req = new NextRequest('http://localhost/api/admin/media/upload', {
      method: 'POST'
    });
    req.formData = async () => {
      const fd = new FormData();
      const file = new File([new Uint8Array(100)], 'test.pdf', { type: 'application/pdf' });
      fd.append('file', file);
      return fd;
    };

    const res = await uploadPost(req);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.detail).toContain('Invalid file type');
  });

  it('upload route rejects files over size limit', async () => {
    mockUserRef.current = { role: 'admin', username: 'admin' };
    
    const req = new NextRequest('http://localhost/api/admin/media/upload', {
      method: 'POST'
    });
    req.formData = async () => {
      const fd = new FormData();
      const file = new File([new Uint8Array(5 * 1024 * 1024)], 'large.jpg', { type: 'image/jpeg' });
      fd.append('file', file);
      return fd;
    };

    const res = await uploadPost(req);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.detail).toContain('exceeds the 4 MB limit');
  });

  it('upload route succeeds and saves records on valid files', async () => {
    mockUserRef.current = { role: 'admin', username: 'admin' };
    
    mockQueryFn.mockImplementation(async (sql: any) => {
      if (sql.includes('INSERT INTO media_assets')) {
        return {
          rows: [{
            id: 1,
            url: 'https://blob.vercel-storage.com/media/artisan-bread-12345.jpg',
            pathname: 'media/artisan-bread-12345.jpg',
            filename: 'artisan-bread.jpg',
            alt_text: 'Artisan Bread',
            content_type: 'image/jpeg',
            size_bytes: 1024
          }]
        };
      }
      return { rows: [] };
    });

    const req = new NextRequest('http://localhost/api/admin/media/upload', {
      method: 'POST'
    });
    req.formData = async () => {
      const fd = new FormData();
      const file = new File([new Uint8Array(1024)], 'artisan-bread.jpg', { type: 'image/jpeg' });
      fd.append('file', file);
      return fd;
    };

    const res = await uploadPost(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.id).toBe(1);
    expect(body.url).toContain('https://blob.vercel-storage.com/');
    expect(body.pathname).toContain('media/artisan-bread-');
  });

  it('delete route blocks deletion when image is used by a product', async () => {
    mockUserRef.current = { role: 'admin', username: 'admin' };
    
    mockQueryFn.mockImplementation(async (sql: any) => {
      if (sql.includes('SELECT * FROM media_assets')) {
        return { rows: [{ id: 1, url: 'https://blob.vercel-storage.com/media/test.jpg', source: 'vercel_blob' }] };
      }
      if (sql.includes('COUNT(*)')) {
        return { rows: [{ count: '2' }] };
      }
      return { rows: [] };
    });

    const req = new NextRequest('http://localhost/api/admin/media/1', {
      method: 'DELETE'
    });

    const res = await mediaDelete(req, { params: Promise.resolve({ id: '1' }) });
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.inUse).toBe(true);
    expect(body.detail).toContain('currently used by 2 menu item(s)');
  });

  it('delete route allows deletion with force=true', async () => {
    mockUserRef.current = { role: 'admin', username: 'admin' };
    
    mockQueryFn.mockImplementation(async (sql: any) => {
      if (sql.includes('SELECT * FROM media_assets')) {
        return { rows: [{ id: 1, url: 'https://blob.vercel-storage.com/media/test.jpg', source: 'vercel_blob' }] };
      }
      if (sql.includes('COUNT(*)')) {
        return { rows: [{ count: '2' }] };
      }
      return { rows: [] };
    });

    const req = new NextRequest('http://localhost/api/admin/media/1?force=true', {
      method: 'DELETE'
    });

    const res = await mediaDelete(req, { params: Promise.resolve({ id: '1' }) });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
  });
});
