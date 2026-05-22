import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { sendEmail } from '@/lib/email/resend';
import { passwordResetEmail } from '@/lib/email/templates/password-reset';
import crypto from 'crypto';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  const { email } = await req.json();

  if (!email || typeof email !== 'string') {
    return NextResponse.json(
      { error: 'Email is required' },
      { status: 400 }
    );
  }

  const supabase = createAdminClient();

  // Always return success regardless of whether email exists
  // This prevents email enumeration attacks
  const successResponse = NextResponse.json({
    success: true,
    message: 'If an account exists with that email, a reset link has been sent.',
  });

  // Look up the user — only main portal users, not Cloud-only accounts
  // Main portal users are AGENCY_ADMIN, CLIENT_MANAGER, SALESPERSON
  const { data: user } = await supabase
    .from('users')
    .select('id, name, email, role, is_active')
    .eq('email', email.toLowerCase().trim())
    .in('role', ['AGENCY_ADMIN', 'CLIENT_MANAGER', 'SALESPERSON'])
    .eq('is_active', true)
    .maybeSingle();

  if (!user) {
    return successResponse;
  }

  const typedUser = user as { id: string; name: string; email: string; role: string };

  // Generate a secure token
  const token = crypto.randomBytes(32).toString('hex');
  const expiresAt = new Date(Date.now() + 60 * 60 * 1000).toISOString();

  // Invalidate any existing unused tokens for this user
  await supabase
    .from('password_reset_tokens')
    .update({ used: true })
    .eq('user_id', typedUser.id)
    .eq('used', false);

  // Insert new token
  const { error: tokenError } = await supabase
    .from('password_reset_tokens')
    .insert({
      user_id: typedUser.id,
      token,
      expires_at: expiresAt,
      used: false,
    });

  if (tokenError) {
    console.error('[forgot-password] Failed to create reset token:', tokenError);
    return successResponse;
  }

  // Build reset URL pointing to the main portal reset page
  const siteUrl = (process.env.NEXTAUTH_URL ?? 'http://localhost:3000').replace(/\/$/, '');
  const resetUrl = `${siteUrl}/reset-password?token=${token}`;

  const { subject, html } = passwordResetEmail({
    userName: typedUser.name,
    resetUrl,
    expiresInMinutes: 60,
  });

  try {
    await sendEmail({ to: typedUser.email, subject, html });
  } catch (e) {
    console.error('[forgot-password] email send failed:', e);
  }

  return successResponse;
}
