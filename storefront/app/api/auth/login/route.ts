import { NextResponse, NextRequest } from 'next/server';
import { cookies } from 'next/headers';
import { createSession, verifyPassword, validateProductionConfig, isProduction, DEFAULT_PASSWORD_HASH } from '@/lib/auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const loginAttempts = new Map<string, { count: number; resetTime: number }>();

function isRateLimited(ip: string): boolean {
  const now = Date.now();
  const attempt = loginAttempts.get(ip);
  if (!attempt) {
    loginAttempts.set(ip, { count: 1, resetTime: now + 15 * 60 * 1000 }); // 15 mins
    return false;
  }
  if (now > attempt.resetTime) {
    loginAttempts.set(ip, { count: 1, resetTime: now + 15 * 60 * 1000 });
    return false;
  }
  attempt.count += 1;
  if (attempt.count > 5) {
    return true;
  }
  return false;
}

export async function POST(req: NextRequest) {
  try {
    const rawIp = req.headers.get('x-forwarded-for') || 'unknown';
    const ip = rawIp.split(',')[0].trim();
    
    if (isRateLimited(ip)) {
      return NextResponse.json(
        { detail: 'Too many requests. Please try again later.' },
        { status: 429 }
      );
    }

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
    
    // 2. Try authenticating with python backend first to sync session/cookies
    let backendCookie = null;
    let backendSuccess = false;
    try {
      const backendRes = await fetch('http://localhost:8100/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      });
      if (backendRes.ok) {
        backendSuccess = true;
        backendCookie = backendRes.headers.get('set-cookie');
      }
    } catch (err) {
      console.warn("Backend auth failed or unreachable:", err);
    }

    const adminEmail = process.env.ADMIN_EMAIL || 'admin@sageandsweetgrass.ca';
    const expectedHash = process.env.ADMIN_PASSWORD_HASH || DEFAULT_PASSWORD_HASH;

    // 3. Resolve matching criteria
    const isProd = isProduction();
    
    const inputUser = username?.toLowerCase().trim();
    const targetEmail = adminEmail.toLowerCase().trim();
    
    // Do not allow "admin" alias in production, require exact configured ADMIN_EMAIL
    const usernameMatched = isProd
      ? inputUser === targetEmail
      : (inputUser === targetEmail || inputUser === 'admin' || inputUser === 'testadmin');

    if ((backendSuccess && usernameMatched) || (usernameMatched && verifyPassword(password, expectedHash))) {
      const user = { email: adminEmail, username: username || 'Admin', role: 'admin' };
      await createSession(user);

      if (backendCookie) {
        // e.g. _auth_token=TOKEN_VALUE; Max-Age=28800; Path=/; SameSite=lax
        const tokenMatch = backendCookie.match(/_auth_token=([^;]+)/);
        if (tokenMatch) {
          const tokenValue = tokenMatch[1];
          const cookieStore = await cookies();
          cookieStore.set('_auth_token', tokenValue, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'lax',
            path: '/',
            maxAge: 8 * 60 * 60 // 8 hours
          });
        }
      }

      // Successful login clears attempts
      loginAttempts.delete(ip);

      return NextResponse.json({ success: true, user });
    }
    
    return NextResponse.json({ detail: 'Invalid email or password' }, { status: 401 });
  } catch (error: any) {
    return NextResponse.json({ detail: error.message }, { status: 500 });
  }
}
