import { NextResponse } from 'next/server';
import { z } from 'zod';
import { createAdminClient } from '@/lib/supabase/admin';
import { hashPassword } from '@/lib/password';

export const dynamic = 'force-dynamic';

const schema = z.object({
  token: z.string().min(64),
  password: z.string().min(8),
});

export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Token and password are required' }, { status: 400 });
  }

  const { token, password } = parsed.data;
  const supabase = createAdminClient();

  // Fetch and validate the token
  const { data: resetToken } = await supabase
    .from('password_reset_tokens')
    .select('id, user_id, expires_at, used')
    .eq('token', token)
    .maybeSingle();

  if (!resetToken) {
    return NextResponse.json({ error: 'Invalid token' }, { status: 400 });
  }

  const typedToken = resetToken as { id: string; user_id: string; expires_at: string; used: boolean };

  if (typedToken.used) {
    return NextResponse.json({ error: 'Token already used' }, { status: 400 });
  }

  if (new Date(typedToken.expires_at) < new Date()) {
    return NextResponse.json({ error: 'Token has expired' }, { status: 400 });
  }

  // Hash the new password
  const hashed = await hashPassword(password);

  // Fetch current session_version then increment manually
  const { data: userRow } = await supabase
    .from('users')
    .select('session_version')
    .eq('id', typedToken.user_id)
    .maybeSingle();

  const currentVersion = (userRow as { session_version?: number } | null)?.session_version ?? 0;

  // Update password and increment session_version to invalidate all existing sessions
  await supabase
    .from('users')
    .update({
      password: hashed,
      session_version: currentVersion + 1,
      updated_at: new Date().toISOString(),
    })
    .eq('id', typedToken.user_id);

  // Mark token as used
  await supabase
    .from('password_reset_tokens')
    .update({ used: true })
    .eq('id', typedToken.id);

  return NextResponse.json({ success: true });
}
