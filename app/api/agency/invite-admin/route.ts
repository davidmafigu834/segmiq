import { NextResponse } from "next/server";
import { z } from "zod";
import { randomBytes } from "crypto";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireRoles } from "@/lib/api-guards";
import { hashPassword } from "@/lib/password";
import { sendEmail } from "@/lib/email/resend";
import { inviteSalespersonEmail } from "@/lib/email/templates/invite-salesperson";

export const dynamic = "force-dynamic";

const bodySchema = z.object({
  email: z.string().email(),
  name: z.string().min(1).max(120).optional(),
});

export async function POST(req: Request) {
  const g = await requireRoles(["AGENCY_ADMIN"]);
  if ("error" in g) return g.error;

  const parsed = bodySchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  const email = parsed.data.email.toLowerCase().trim();
  const supabase = createAdminClient();
  const { data: existing } = await supabase.from("users").select("id").eq("email", email).maybeSingle();
  if (existing) {
    return NextResponse.json({ error: "User with this email already exists" }, { status: 400 });
  }

  const tempPass = randomBytes(12).toString("base64url").slice(0, 16);
  const hash = await hashPassword(tempPass);

  const { data: row, error } = await supabase
    .from("users")
    .insert({
      name: parsed.data.name?.trim() || email.split("@")[0],
      email,
      password: hash,
      role: "AGENCY_ADMIN",
      client_id: null,
      is_active: true,
    })
    .select("id, email, name")
    .single();

  if (error) {
    console.error("[invite-admin]", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const loginUrl = `${process.env.NEXTAUTH_URL}/login`;
  const name = parsed.data.name?.trim() || email.split("@")[0];
  const { subject, html } = inviteSalespersonEmail({
    inviteeName: name,
    invitedByName: g.session.user?.name || "Segmiq",
    clientName: "Segmiq Agency",
    role: "AGENCY_ADMIN",
    email,
    temporaryPassword: tempPass,
    loginUrl,
  });
  const emailResult = await sendEmail({ to: email, subject, html });
  if (!emailResult.success) {
    console.error("Admin invite email failed:", emailResult.error);
  }

  return NextResponse.json({
    user: row,
    temporaryPassword: tempPass,
    emailSent: emailResult.success,
    message: "Share this password with the new admin once. They should change it after signing in.",
  });
}
