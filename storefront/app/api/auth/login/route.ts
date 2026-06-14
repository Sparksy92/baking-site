import { NextResponse, NextRequest } from 'next/server';
import { createSession, verifyPassword } from '@/lib/auth';

export async function POST(req: NextRequest) {
  try {
    const { username, password } = await req.json();
    
    const adminEmail = process.env.ADMIN_EMAIL || 'admin@cedarandsagehomestead.ca';
    // Default fallback hash is pbkdf2 hash of 'admin123' with salt 'cedar-salt-homestead'
    const expectedHash = process.env.ADMIN_PASSWORD_HASH || 'b1a20bf155239e240212f45ec926719cd227eb0d507119ecb001a1db6c1bf9eb9d5929532ea4a5690bfa3fcd6d8174f84a4a581458dc6b4b455b5f2cd796f6e5';

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
