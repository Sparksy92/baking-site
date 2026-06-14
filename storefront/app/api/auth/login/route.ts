import { NextResponse, NextRequest } from 'next/server';
import { createSession, verifyPassword, validateProductionConfig, isProduction, DEFAULT_PASSWORD_HASH } from '@/lib/auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const { username, password } = await req.json();
    
    // 1. Production config validation check
    const configCheck = validateProductionConfig();
    if (!configCheck.isValid) {
      console.error(`CRITICAL PRODUCTION CONFIG ERROR: ${configCheck.error}`);
      return NextResponse.json(
        { detail: 'Server configuration error: Administrator access is misconfigured.' },
        { status: 500 }
      );
    }
    
    const adminEmail = process.env.ADMIN_EMAIL || 'admin@cedarandsagehomestead.ca';
    const expectedHash = process.env.ADMIN_PASSWORD_HASH || DEFAULT_PASSWORD_HASH;

    // 2. Resolve matching criteria
    const isProd = isProduction();
    
    // Do not allow "admin" alias in production, require exact configured ADMIN_EMAIL
    const usernameMatched = isProd
      ? username === adminEmail
      : (username === adminEmail || username === 'admin');

    if (usernameMatched && verifyPassword(password, expectedHash)) {
      const user = { email: adminEmail, username: 'Admin', role: 'admin' };
      await createSession(user);
      return NextResponse.json({ success: true, user });
    }
    
    return NextResponse.json({ detail: 'Invalid email or password' }, { status: 401 });
  } catch (error: any) {
    return NextResponse.json({ detail: error.message }, { status: 500 });
  }
}
