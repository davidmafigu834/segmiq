import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const token = searchParams.get('token');

  if (!token || token.length < 64) {
    return NextResponse.json({ valid: false, error: 'Token missing' }, { status: 400 });
  }

  const supabase = createAdminClient();

  const { data } = await supabase
    .from('password_reset_tokens')
    .select('id, expires_at, used, users(name, email)')
    .eq('token', token)
    .maybeSingle();

  if (!data) {
    return NextResponse.json({ valid: false, error: 'Invalid token' }, { status: 404 });
  }

  const typedData = data as unknown as { id: string; expires_at: string; used: boolean; users: { name: string; email: string } | null };

  if (typedData.used) {
    return NextResponse.json({ valid: false, error: 'Token already used' }, { status: 400 });
  }

  if (new Date(typedData.expires_at) < new Date()) {
    return NextResponse.json({ valid: false, error: 'Token expired' }, { status: 400 });
  }

  return NextResponse.json({
    valid: true,
    userName: typedData.users?.name ?? '',
  });
}
