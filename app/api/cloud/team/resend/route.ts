import { NextResponse } from "next/server";
import { z } from "zod";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { hashPassword } from "@/lib/password";
import { Resend } from "resend";

export const dynamic = "force-dynamic";

const resendSchema = z.object({
  userId: z.string().uuid(),
  clientId: z.string().uuid(),
});

function randomPassword(len = 12): string {
  const chars = "abcdefghijkmnopqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789!@#$%";
  return Array.from({ length: len }, () => chars[Math.floor(Math.random() * chars.length)]).join("");
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (session.role !== "AGENCY_ADMIN" && session.role !== "CLIENT_MANAGER") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let body: unknown;
  try { body = await req.json(); } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = resendSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten().fieldErrors }, { status: 400 });
  }

  const { userId, clientId } = parsed.data;

  if (session.role === "CLIENT_MANAGER" && session.clientId !== clientId) {
    return NextResponse.json({ error: "Forbidden: cannot manage another client." }, { status: 403 });
  }

  const supabase = createAdminClient();

  const { data: user } = await supabase
    .from("users")
    .select("id, name, email, role")
    .eq("id", userId)
    .eq("client_id", clientId)
    .maybeSingle();

  if (!user) {
    return NextResponse.json({ error: "User not found." }, { status: 404 });
  }

  const { data: client } = await supabase
    .from("clients")
    .select("name")
    .eq("id", clientId)
    .maybeSingle();

  const clientName = (client as { name?: string } | null)?.name ?? "your team";
  const typedUser = user as { id: string; name: string; email: string; role: string };

  const tempPassword = randomPassword();
  const hashedPw = await hashPassword(tempPassword);

  const { error: updateErr } = await supabase
    .from("users")
    .update({ password: hashedPw })
    .eq("id", userId);

  if (updateErr) {
    console.error("[cloud/team/resend] password update:", updateErr);
    return NextResponse.json({ error: "Failed to reset password." }, { status: 500 });
  }

  const resendKey = process.env.RESEND_API_KEY;
  if (resendKey) {
    try {
      const resendClient = new Resend(resendKey);
      const fromEmail = process.env.RESEND_FROM_EMAIL ?? "noreply@leadstaq.tech";
      await resendClient.emails.send({
        from: fromEmail,
        to: typedUser.email,
        subject: `Your Segmiq Cloud access — ${clientName}`,
        html: `
<!DOCTYPE html>
<html>
<body style="font-family:-apple-system,'Segoe UI',sans-serif;background:#0a0a0a;margin:0;padding:32px;">
  <table width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;margin:0 auto;background:#111111;border:1px solid rgba(255,255,255,0.1);border-radius:16px;padding:32px;">
    <tr><td>
      <div style="margin-bottom:24px;">
        <div style="display:inline-block;background:#D4FF4F;padding:6px 12px;border-radius:6px;font-size:11px;font-weight:700;color:#0a0a0a;letter-spacing:0.05em;text-transform:uppercase;">
          Segmiq Cloud
        </div>
      </div>
      <h1 style="font-family:Georgia,serif;font-size:24px;color:#ffffff;margin:0 0 16px;font-weight:400;">
        Your new login credentials
      </h1>
      <p style="font-size:14px;color:rgba(255,255,255,0.6);line-height:1.6;margin:0 0 24px;">
        Hi ${typedUser.name}, here are your updated login credentials for <strong style="color:#ffffff;">${clientName}</strong> on Segmiq Cloud.
      </p>
      <table width="100%" cellpadding="0" cellspacing="0" style="background:rgba(255,255,255,0.05);border-radius:10px;padding:16px;margin-bottom:24px;">
        <tr><td style="font-size:11px;color:rgba(255,255,255,0.4);padding-bottom:4px;">Email</td></tr>
        <tr><td style="font-size:14px;color:#ffffff;padding-bottom:12px;">${typedUser.email}</td></tr>
        <tr><td style="font-size:11px;color:rgba(255,255,255,0.4);padding-bottom:4px;">New temporary password</td></tr>
        <tr><td style="font-size:14px;color:#D4FF4F;font-family:monospace;">${tempPassword}</td></tr>
      </table>
      <p style="font-size:12px;color:rgba(255,255,255,0.4);margin-bottom:24px;">
        Please change your password after signing in.
      </p>
      <a href="https://cloud.leadstaq.tech/login" style="display:inline-block;background:#D4FF4F;color:#0a0a0a;text-decoration:none;padding:12px 24px;border-radius:10px;font-size:13px;font-weight:700;">
        Sign in to Segmiq Cloud →
      </a>
      <p style="font-size:11px;color:rgba(255,255,255,0.2);margin-top:32px;border-top:1px solid rgba(255,255,255,0.1);padding-top:16px;">
        Segmiq Cloud · ${clientName}
      </p>
    </td></tr>
  </table>
</body>
</html>`.trim(),
      });
    } catch (e) {
      console.error("[cloud/team/resend] email send failed:", e);
    }
  }

  return NextResponse.json({ success: true });
}
