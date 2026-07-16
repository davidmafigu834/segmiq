import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { canManageClientTeam } from "@/lib/auth/permissions";
import { generateTemporaryPassword, hashPassword } from "@/lib/password";
import { sendEmail } from "@/lib/email/resend";
import { temporaryPasswordResetEmail } from "@/lib/email/templates/temporary-password-reset";

export const dynamic = "force-dynamic";

export async function POST(_req: Request, { params }: { params: { clientId: string; userId: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!canManageClientTeam(session, params.clientId)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  if (params.userId === session.userId) {
    return NextResponse.json(
      { error: "Use Account settings to change your own password." },
      { status: 400 }
    );
  }

  const supabase = createAdminClient();
  const [{ data: user }, { data: client }] = await Promise.all([
    supabase
      .from("users")
      .select("id, name, email, role, client_id, is_active, session_version")
      .eq("id", params.userId)
      .maybeSingle(),
    supabase.from("clients").select("id, name").eq("id", params.clientId).maybeSingle(),
  ]);

  if (!client) {
    return NextResponse.json({ error: "Client not found" }, { status: 404 });
  }
  if (!user || user.client_id !== params.clientId) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  const role = user.role as string;
  if (role !== "SALESPERSON" && role !== "CLIENT_MANAGER") {
    return NextResponse.json({ error: "Cannot reset password for this user type" }, { status: 400 });
  }
  if (!user.is_active) {
    return NextResponse.json({ error: "Reactivate this user before resetting their password." }, { status: 400 });
  }

  const tempPass = generateTemporaryPassword();
  const hash = await hashPassword(tempPass);
  const currentVersion = Number((user as { session_version?: number }).session_version ?? 0);

  const { error: updateErr } = await supabase
    .from("users")
    .update({ password: hash, session_version: currentVersion + 1 })
    .eq("id", params.userId);

  if (updateErr) {
    console.error("[client users reset-password]", updateErr);
    return NextResponse.json({ error: "Failed to reset password" }, { status: 500 });
  }

  const email = (user.email as string).trim();
  const loginUrl = `${process.env.NEXTAUTH_URL?.replace(/\/$/, "") ?? "https://segmiq.com"}/login`;
  const { subject, html } = temporaryPasswordResetEmail({
    userName: user.name as string,
    resetByName: session.user?.name || "Your admin",
    clientName: client.name as string,
    role,
    email,
    temporaryPassword: tempPass,
    loginUrl,
  });
  const emailResult = await sendEmail({ to: email, subject, html });
  if (!emailResult.success) {
    console.error("[client users reset-password] email failed:", emailResult.error);
  }

  return NextResponse.json({
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
    },
    temporaryPassword: tempPass,
    emailSent: emailResult.success,
  });
}
