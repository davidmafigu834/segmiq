import { NextResponse } from "next/server";
import { z } from "zod";
import { randomBytes } from "crypto";
import { createAdminClient } from "@/lib/supabase/admin";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { canReassignLeads, canManageClientTeam } from "@/lib/auth/permissions";
import { countUncontactedLeadsForUser } from "@/lib/leads/migrateUncontactedLeads";
import { hashPassword } from "@/lib/password";
import { normalizeToE164 } from "@/lib/phone-validate";
import { sendEmail } from "@/lib/email/resend";
import { inviteSalespersonEmail } from "@/lib/email/templates/invite-salesperson";

export const dynamic = "force-dynamic";

/** Active salespeople for reassignment pickers; full roster when ?manage=1. */
export async function GET(req: Request, { params }: { params: { clientId: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = new URL(req.url);
  const manage = url.searchParams.get("manage") === "1";
  const roleFilter = url.searchParams.get("role");

  if (manage) {
    if (!canManageClientTeam(session, params.clientId)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    const role = roleFilter === "CLIENT_MANAGER" ? "CLIENT_MANAGER" : "SALESPERSON";
    const supabase = createAdminClient();

    if (role === "CLIENT_MANAGER") {
      const { data, error } = await supabase
        .from("users")
        .select("id, name, email, phone, is_active")
        .eq("client_id", params.clientId)
        .eq("role", "CLIENT_MANAGER")
        .order("created_at", { ascending: true });
      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }
      return NextResponse.json({ users: data ?? [] });
    }

    const { data, error } = await supabase
      .from("users")
      .select("id, name, email, phone, is_active, round_robin_order")
      .eq("client_id", params.clientId)
      .eq("role", "SALESPERSON")
      .order("round_robin_order", { ascending: true });
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const users = data ?? [];
    const withCounts = await Promise.all(
      users.map(async (user) => ({
        id: user.id as string,
        name: user.name as string,
        email: user.email as string,
        phone: (user.phone as string | null) ?? null,
        is_active: user.is_active as boolean,
        round_robin_order: user.round_robin_order as number,
        uncontacted_lead_count: await countUncontactedLeadsForUser(
          supabase,
          params.clientId,
          user.id as string
        ),
      }))
    );
    return NextResponse.json({ users: withCounts });
  }

  if (!canReassignLeads(session, params.clientId)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("users")
    .select("id, name")
    .eq("client_id", params.clientId)
    .eq("role", "SALESPERSON")
    .eq("is_active", true)
    .order("name", { ascending: true });
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ users: data ?? [] });
}

const inviteSalesSchema = z.object({
  role: z.enum(["SALESPERSON", "CLIENT_MANAGER"]),
  name: z.string().min(1).max(120),
  email: z.string().email(),
  phone: z.string().max(32).optional(),
});

export async function POST(req: Request, { params }: { params: { clientId: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!canManageClientTeam(session, params.clientId)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const parsed = inviteSalesSchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid body", details: parsed.error.flatten() }, { status: 400 });
  }

  const rawPhone = parsed.data.phone?.trim() ?? "";
  const phoneNorm = rawPhone ? normalizeToE164(rawPhone) : null;
  if (parsed.data.role === "SALESPERSON" && !phoneNorm) {
    return NextResponse.json(
      { error: "Salesperson phone is required. Use international format like +263 77 123 4567." },
      { status: 400 }
    );
  }
  if (parsed.data.role === "CLIENT_MANAGER" && rawPhone && !phoneNorm) {
    return NextResponse.json(
      { error: "Manager phone looks invalid. Use international format like +263 77 123 4567." },
      { status: 400 }
    );
  }

  const supabase = createAdminClient();
  const { data: client } = await supabase.from("clients").select("id, name").eq("id", params.clientId).maybeSingle();
  if (!client) {
    return NextResponse.json({ error: "Client not found" }, { status: 404 });
  }

  const email = parsed.data.email.toLowerCase().trim();
  const { data: dupe } = await supabase
    .from("users")
    .select("id, name, email, role, client_id, is_active, phone")
    .eq("email", email)
    .maybeSingle();
  if (dupe) {
    const sameClient = (dupe.client_id as string | null) === params.clientId;
    const sameRole = (dupe.role as string | null) === parsed.data.role;
    if (sameClient && sameRole) {
      const tempPass = randomBytes(12).toString("base64url").slice(0, 16);
      const hash = await hashPassword(tempPass);
      const updates: Record<string, unknown> = {
        name: parsed.data.name.trim(),
        is_active: true,
        password: hash,
      };
      if (phoneNorm) updates.phone = phoneNorm;
      const { data: updated, error: updateErr } = await supabase
        .from("users")
        .update(updates)
        .eq("id", dupe.id as string)
        .select("id, name, email, phone, role")
        .single();
      if (updateErr) {
        return NextResponse.json({ error: updateErr.message }, { status: 500 });
      }
      const loginUrl = `${process.env.NEXTAUTH_URL}/login`;
      const { subject: reactivateSubject, html: reactivateHtml } = inviteSalespersonEmail({
        inviteeName: parsed.data.name.trim(),
        invitedByName: session.user?.name || "Your manager",
        clientName: (client as { id: string; name: string }).name,
        role: parsed.data.role,
        email,
        temporaryPassword: tempPass,
        loginUrl,
      });
      const reactivateEmailResult = await sendEmail({ to: email, subject: reactivateSubject, html: reactivateHtml });
      if (!reactivateEmailResult.success) {
        console.error("Reactivation invite email failed:", reactivateEmailResult.error);
      }
      return NextResponse.json({
        user: updated,
        temporaryPassword: tempPass,
        emailSent: reactivateEmailResult.success,
        message: "Existing user reactivated with a new temporary password.",
      });
    }
    return NextResponse.json({ error: "Email already registered to another account" }, { status: 400 });
  }

  let rr = 0;
  if (parsed.data.role === "SALESPERSON") {
    const { data: maxRow } = await supabase
      .from("users")
      .select("round_robin_order")
      .eq("client_id", params.clientId)
      .eq("role", "SALESPERSON")
      .order("round_robin_order", { ascending: false })
      .limit(1)
      .maybeSingle();
    rr = Number((maxRow as { round_robin_order?: number } | null)?.round_robin_order ?? -1) + 1;
  }

  const tempPass = randomBytes(12).toString("base64url").slice(0, 16);
  const hash = await hashPassword(tempPass);

  const { data: user, error } = await supabase
    .from("users")
    .insert({
      name: parsed.data.name.trim(),
      email,
      phone: phoneNorm,
      password: hash,
      role: parsed.data.role,
      client_id: params.clientId,
      is_active: true,
      round_robin_order: parsed.data.role === "SALESPERSON" ? rr : 0,
    })
    .select("id, name, email, phone, role")
    .single();

  if (error) {
    console.error("[client users POST]", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const loginUrl = `${process.env.NEXTAUTH_URL}/login`;
  const { subject, html } = inviteSalespersonEmail({
    inviteeName: parsed.data.name.trim(),
    invitedByName: session.user?.name || "Your manager",
    clientName: (client as { id: string; name: string }).name,
    role: parsed.data.role,
    email,
    temporaryPassword: tempPass,
    loginUrl,
  });
  const emailResult = await sendEmail({ to: email, subject, html });
  if (!emailResult.success) {
    console.error("Invite email failed to send:", emailResult.error);
  }

  return NextResponse.json({
    user,
    temporaryPassword: tempPass,
    emailSent: emailResult.success,
  });
}
