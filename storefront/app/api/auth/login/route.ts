import { NextResponse, NextRequest } from 'next/server';
import { createSession, verifyPassword, DEFAULT_PASSWORD_HASH } from '@/lib/auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function isProduction(): boolean {
  return process.env.NODE_ENV === 'production' || process.env.DEV_MODE === 'false';
}

export async function POST(req: NextRequest) {
  try {
    const { username, password } = await req.json();
    
    const adminEmail = process.env.ADMIN_EMAIL || 'admin@cedarandsagehomestead.ca';
    const expectedHash = process.env.ADMIN_PASSWORD_HASH || DEFAULT_PASSWORD_HASH;

    // Strict Production Check: Block default fallback credentials
    if (expectedHash === DEFAULT_PASSWORD_HASH) {
      if (isProduction()) {
        console.error('CRITICAL: Access blocked. Default admin password hash is not allowed in production.');
        return NextResponse.json({ detail: 'Server configuration error: Fallback credentials are not permitted in production.' }, { status: 500 });
      } else {
        console.warn('WARNING: Using default admin password hash. Configure ADMIN_PASSWORD_HASH for production.');
      }
    }

    if ((username === adminEmail || username === 'admin') && verifyPassword(password, expectedHash)) {
      const user = { email: adminEmail, username: 'Admin', role: 'admin' };
      await createSession(user);
      return NextResponse.json({ success: true, user });
    }
    
    return NextResponse.json({ detail: 'Invalid email or password' }, { status: 401 });
  } catch (error: any) {
    return NextResponse.json({ detail: error.message }, { status: 500 });
  }
}
