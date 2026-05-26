import { NextResponse } from "next/server";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { Resend } from "resend";
import { randomBytes } from "crypto";

export const dynamic = "force-dynamic";

const schema = z.object({
  email: z.string().email(),
});

export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ success: true });
  }

  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Valid email required" }, { status: 400 });
  }

  const { email } = parsed.data;
  const supabase = createAdminClient();

  const { data: user } = await supabase
    .from("users")
    .select("id, name, email")
    .eq("email", email.toLowerCase().trim())
    .eq("is_active", true)
    .maybeSingle();

  if (user) {
    const typedUser = user as { id: string; name: string; email: string };
    const token = randomBytes(32).toString("hex");
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000).toISOString();

    await supabase.from("password_reset_tokens").insert({
      user_id: typedUser.id,
      token,
      expires_at: expiresAt,
      used: false,
    });

    const resendKey = process.env.RESEND_API_KEY;
    if (resendKey) {
      try {
        const resendClient = new Resend(resendKey);
        const fromEmail = process.env.RESEND_FROM_EMAIL ?? "noreply@leadstaq.tech";
        const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL ?? "https://leadstaq.tech").replace(/\/$/, "");
        const resetUrl = `${siteUrl}/cloud/reset-password?token=${token}`;

        await resendClient.emails.send({
          from: fromEmail,
          to: typedUser.email,
          subject: "Reset your Segmiq Cloud password",
          html: `
<!DOCTYPE html>
<html>
<body style="font-family:-apple-system,'Segoe UI',sans-serif;background:#f9f9f9;margin:0;padding:32px 16px;">
  <div style="max-width:480px;margin:0 auto;background:#ffffff;border-radius:12px;padding:32px;border:1px solid #eaeaea;">
    <h2 style="font-size:20px;font-weight:600;color:#111;margin:0 0 8px;">Reset your password</h2>
    <p style="color:#555;font-size:14px;line-height:1.6;margin:0 0 24px;">
      Hi ${typedUser.name}, we received a request to reset your Segmiq Cloud password.
      Click the button below to choose a new password. This link expires in 1 hour.
    </p>
    <a href="${resetUrl}"
       style="display:inline-block;background:#D4FF4F;color:#000;font-size:13px;font-weight:600;
              padding:10px 20px;border-radius:6px;text-decoration:none;">
      Reset password
    </a>
    <p style="color:#888;font-size:12px;margin-top:24px;">
      If you didn't request this, you can safely ignore this email. Your password won't change.
    </p>
    <p style="color:#aaa;font-size:11px;margin-top:8px;word-break:break-all;">
      Or copy this link: ${resetUrl}
    </p>
  </div>
</body>
</html>`.trim(),
        });
      } catch (e) {
        console.error("[forgot-password] email send failed:", e);
      }
    }
  }

  return NextResponse.json({ success: true });
}
