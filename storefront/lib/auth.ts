import crypto from 'crypto';
import { cookies } from 'next/headers';

const SESSION_COOKIE_NAME = 'admin_session';

export const DEFAULT_SESSION_SECRET = 'fallback-secret-use-a-real-one-in-production-12345';
export const DEFAULT_PASSWORD_HASH = 'b1a20bf155239e240212f45ec926719cd227eb0d507119ecb001a1db6c1bf9eb9d5929532ea4a5690bfa3fcd6d8174f84a4a581458dc6b4b455b5f2cd796f6e5';

function isProduction(): boolean {
  return process.env.NODE_ENV === 'production' || process.env.DEV_MODE === 'false';
}

function getSessionSecret(): string {
  const secret = process.env.ADMIN_SESSION_SECRET;
  
  if (!secret || secret === DEFAULT_SESSION_SECRET) {
    if (isProduction()) {
      throw new Error('CRITICAL: Fallback ADMIN_SESSION_SECRET is in use in production mode. Deployment blocked for safety.');
    } else {
      console.warn('WARNING: Fallback ADMIN_SESSION_SECRET is in use. This must be changed in production!');
    }
    return DEFAULT_SESSION_SECRET;
  }
  
  return secret;
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
    
    const signatureBuffer = Buffer.from(signature, 'utf8');
    const expectedBuffer = Buffer.from(expectedSignature, 'utf8');
    
    if (signatureBuffer.length === expectedBuffer.length && crypto.timingSafeEqual(signatureBuffer, expectedBuffer)) {
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
  const salt = 'cedar-salt-homestead';
  return crypto.pbkdf2Sync(password, salt, 1000, 64, 'sha512').toString('hex');
}

export function verifyPassword(password: string, expectedHash: string): boolean {
  const inputHash = hashPassword(password);
  const inputBuffer = Buffer.from(inputHash, 'hex');
  const expectedBuffer = Buffer.from(expectedHash, 'hex');
  
  if (inputBuffer.length !== expectedBuffer.length) {
    return false;
  }
  
  return crypto.timingSafeEqual(inputBuffer, expectedBuffer);
}
