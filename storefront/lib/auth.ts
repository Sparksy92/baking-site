import crypto from 'crypto';
import { cookies } from 'next/headers';

const SESSION_COOKIE_NAME = 'admin_session';

function getSessionSecret(): string {
  return process.env.ADMIN_SESSION_SECRET || 'fallback-secret-use-a-real-one-in-production-12345';
}

export function signPayload(payload: any): string {
  const secret = getSessionSecret();
  const data = JSON.stringify(payload);
  const signature = crypto.createHmac('sha256', secret).update(data).digest('base64');
  return `${Buffer.from(data).toString('base64')}.${signature}`;
}

export function verifySignature(sessionToken: string): any | null {
  try {
    const secret = getSessionSecret();
    const parts = sessionToken.split('.');
    if (parts.length !== 2) return null;
    
    const [dataBase64, signature] = parts;
    const data = Buffer.from(dataBase64, 'base64').toString('utf8');
    const expectedSignature = crypto.createHmac('sha256', secret).update(data).digest('base64');
    
    if (signature === expectedSignature) {
      return JSON.parse(data);
    }
  } catch {}
  return null;
}

export async function getSessionUser() {
  const cookieStore = await cookies();
  const sessionToken = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  if (!sessionToken) return null;
  
  const payload = verifySignature(sessionToken);
  if (!payload) return null;
  
  if (Date.now() > payload.exp) {
    return null;
  }
  
  return payload.user;
}

export async function createSession(user: { email: string; username: string; role: string }) {
  const exp = Date.now() + 8 * 60 * 60 * 1000; // 8 hours
  const token = signPayload({ user, exp });
  
  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 8 * 60 * 60 // 8 hours
  });
}

export async function destroySession() {
  const cookieStore = await cookies();
  cookieStore.delete(SESSION_COOKIE_NAME);
}

// Password hashing utility using pbkdf2
export function hashPassword(password: string): string {
  const salt = 'cedar-salt-homestead'; // Fixed salt for simplicity, or we can use pbkdf2 with a random salt if needed
  return crypto.pbkdf2Sync(password, salt, 1000, 64, 'sha512').toString('hex');
}

export function verifyPassword(password: string, expectedHash: string): boolean {
  return hashPassword(password) === expectedHash;
}
