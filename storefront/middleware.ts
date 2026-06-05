import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

interface RedirectRule { from_path: string; to_path: string; status_code: number }

let redirectCache: RedirectRule[] = [];
let redirectCacheExpiry = 0;
const REDIRECT_CACHE_TTL_MS = 60_000;

async function getRedirects(): Promise<RedirectRule[]> {
  const now = Date.now();
  if (now < redirectCacheExpiry && redirectCache.length >= 0) return redirectCache;
  try {
    const apiBase = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
    const res = await fetch(`${apiBase}/api/admin/redirects/export`, {
      headers: { 'x-internal': '1' },
      next: { revalidate: 0 },
    });
    if (res.ok) {
      redirectCache = await res.json();
      redirectCacheExpiry = now + REDIRECT_CACHE_TTL_MS;
    }
  } catch {
    // If the API is unreachable, return the stale cache (or empty)
  }
  return redirectCache;
}

export async function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname;

  // Redirect lookup (active redirects from DB)
  const redirects = await getRedirects();
  const match = redirects.find((r) => r.from_path === pathname);
  if (match) {
    const destination = match.to_path.startsWith('http')
      ? match.to_path
      : `${request.nextUrl.origin}${match.to_path}`;
    return NextResponse.redirect(destination, { status: match.status_code });
  }

  const response = NextResponse.next();
  const isDev = process.env.NODE_ENV === 'development';

  // Security headers
  response.headers.set('X-Frame-Options', 'DENY');
  response.headers.set('X-Content-Type-Options', 'nosniff');
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  response.headers.set('X-DNS-Prefetch-Control', 'on');
  response.headers.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  response.headers.set(
    'Content-Security-Policy',
    [
      "default-src 'self'",
      `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ''} https://js.stripe.com`,
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: blob: https://*.yourdomain.com",
      "font-src 'self' data:",
      `connect-src 'self' https://api.stripe.com${isDev ? ' ws://localhost:* http://localhost:*' : ''}`,
      "frame-src 'self' https://js.stripe.com https://hooks.stripe.com",
      "base-uri 'self'",
      "form-action 'self'",
    ].join('; ')
  );

  // HSTS — only in production
  if (request.nextUrl.protocol === 'https:') {
    response.headers.set(
      'Strict-Transport-Security',
      'max-age=63072000; includeSubDomains; preload'
    );
  }

  return response;
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - api (API routes proxied to backend)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico, robots.txt, sitemap.xml
     */
    '/((?!api|_next/static|_next/image|favicon.ico|robots.txt|sitemap.xml).*)',
  ],
};
