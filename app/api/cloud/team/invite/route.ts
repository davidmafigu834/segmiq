import { NextResponse } from "next/server";
import { z } from "zod";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { hashPassword } from "@/lib/password";
import { Resend } from "resend";

export const dynamic = "force-dynamic";

const inviteSchema = z.object({
  name: z.string().min(2).max(120),
  email: z.string().email().max(254),
  phone: z.string().min(8).max(30),
  role: z.enum(["CLIENT_MANAGER", "SALESPERSON"]),
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

  const parsed = inviteSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.flatten().fieldErrors },
      { status: 400 }
    );
  }

  const { name, email, phone, role, clientId } = parsed.data;

  if (session.role === "CLIENT_MANAGER" && session.clientId !== clientId) {
    return NextResponse.json({ error: "Forbidden: cannot invite to another client." }, { status: 403 });
  }

  const supabase = createAdminClient();

  const { data: existing } = await supabase
    .from("users")
    .select("id")
    .eq("email", email.toLowerCase().trim())
    .maybeSingle();

  if (existing) {
    return NextResponse.json({ error: "A user with this email already exists." }, { status: 409 });
  }

  const { data: client } = await supabase
    .from("clients")
    .select("name")
    .eq("id", clientId)
    .maybeSingle();

  const clientName = (client as { name?: string } | null)?.name ?? "your team";

  const tempPassword = randomPassword();
  const hashedPw = await hashPassword(tempPassword);

  const { error: userErr } = await supabase.from("users").insert({
    name: name.trim(),
    email: email.toLowerCase().trim(),
    password: hashedPw,
    role,
    client_id: clientId,
    phone: phone.trim(),
    is_active: true,
  });

  if (userErr) {
    console.error("[cloud/team/invite] user insert:", userErr);
    return NextResponse.json({ error: "Failed to create user." }, { status: 500 });
  }

  const resendKey = process.env.RESEND_API_KEY;
  if (resendKey) {
    try {
      const resend = new Resend(resendKey);
      const fromEmail = process.env.RESEND_FROM_EMAIL ?? "noreply@leadstaq.tech";
      await resend.emails.send({
        from: fromEmail,
        to: email.toLowerCase().trim(),
        subject: `You've been added to ${clientName} on Segmiq Cloud`,
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
        You've been added to ${clientName}
      </h1>
      <p style="font-size:14px;color:rgba(255,255,255,0.6);line-height:1.6;margin:0 0 24px;">
        Hi ${name}, you've been added to <strong style="color:#ffffff;">${clientName}</strong> on Segmiq Cloud as a <strong style="color:#ffffff;">${role === "CLIENT_MANAGER" ? "Manager" : "Salesperson"}</strong>.
      </p>
      <table width="100%" cellpadding="0" cellspacing="0" style="background:rgba(255,255,255,0.05);border-radius:10px;padding:16px;margin-bottom:24px;">
        <tr><td style="font-size:11px;color:rgba(255,255,255,0.4);padding-bottom:4px;">Email</td></tr>
        <tr><td style="font-size:14px;color:#ffffff;padding-bottom:12px;">${email}</td></tr>
        <tr><td style="font-size:11px;color:rgba(255,255,255,0.4);padding-bottom:4px;">Temporary password</td></tr>
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
      console.error("[cloud/team/invite] email send failed:", e);
    }
  }

  return NextResponse.json({ success: true });
}
