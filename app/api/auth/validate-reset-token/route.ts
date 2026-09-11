import { NextResponse } from 'next/server';
import { findValidPasswordResetToken } from '@/lib/auth/password-reset-tokens';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const token = searchParams.get('token');

  if (!token || token.length < 64) {
    return NextResponse.json({ valid: false, error: 'Token missing' }, { status: 400 });
  }

  const data = await findValidPasswordResetToken(token);
  if (!data) {
    return NextResponse.json({ valid: false, error: 'Invalid or expired token' }, { status: 404 });
  }

  // Do not leak PII (name/email) for token validation.
  return NextResponse.json({ valid: true });
}
