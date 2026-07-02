import { NextResponse } from "next/server";
import { z } from "zod";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { canManageClientTeam } from "@/lib/auth/permissions";
import { migrateUncontactedLeads } from "@/lib/leads/migrateUncontactedLeads";

export const dynamic = "force-dynamic";

const patchSchema = z
  .object({
    is_active: z.boolean().optional(),
    role: z.enum(["CLIENT_MANAGER"]).optional(),
  })
  .refine((data) => data.is_active !== undefined || data.role !== undefined, {
    message: "Provide is_active and/or role",
  });

export async function PATCH(req: Request, { params }: { params: { clientId: string; userId: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!canManageClientTeam(session, params.clientId)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const parsed = patchSchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  const supabase = createAdminClient();
  const { data: u } = await supabase
    .from("users")
    .select("id, name, role, client_id, is_active")
    .eq("id", params.userId)
    .maybeSingle();
  if (!u || u.client_id !== params.clientId) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const role = u.role as string;
  if (role !== "SALESPERSON" && role !== "CLIENT_MANAGER") {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  if (role === "CLIENT_MANAGER" && parsed.data.role === "CLIENT_MANAGER") {
    return NextResponse.json({ error: "User is already a manager" }, { status: 400 });
  }

  if (role === "CLIENT_MANAGER" && parsed.data.is_active === false && params.userId === session.userId) {
    return NextResponse.json({ error: "You cannot deactivate yourself" }, { status: 400 });
  }

  const actorName = session.user?.name ?? "Manager";
  const actor = { id: session.userId, name: actorName, role: session.role ?? "UNKNOWN" };

  let migration = { migrated: 0, unassigned: 0 };

  if (role === "SALESPERSON" && parsed.data.role === "CLIENT_MANAGER") {
    migration = await migrateUncontactedLeads(supabase, {
      clientId: params.clientId,
      fromUserId: params.userId,
      actor,
      handoverNotes: "Uncontacted leads redistributed when salesperson was promoted to manager.",
    });

    const { error } = await supabase
      .from("users")
      .update({ role: "CLIENT_MANAGER", round_robin_order: 0, is_active: true })
      .eq("id", params.userId);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    const { data: promoted } = await supabase
      .from("users")
      .select("id, name, email, phone, role, is_active")
      .eq("id", params.userId)
      .single();

    return NextResponse.json({
      ok: true,
      promoted: true,
      manager: promoted,
      migration,
    });
  }

  if (role === "SALESPERSON" && parsed.data.is_active === false) {
    migration = await migrateUncontactedLeads(supabase, {
      clientId: params.clientId,
      fromUserId: params.userId,
      actor,
      handoverNotes: "Uncontacted leads redistributed when salesperson was deactivated.",
    });
  }

  if (parsed.data.is_active !== undefined) {
    const { error } = await supabase
      .from("users")
      .update({ is_active: parsed.data.is_active })
      .eq("id", params.userId);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, migration });
}

export async function DELETE(_req: Request, { params }: { params: { clientId: string; userId: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!canManageClientTeam(session, params.clientId)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  if (params.userId === session.userId) {
    return NextResponse.json({ error: "You cannot remove yourself" }, { status: 400 });
  }

  const supabase = createAdminClient();
  const { data: u } = await supabase
    .from("users")
    .select("id, role, client_id")
    .eq("id", params.userId)
    .maybeSingle();
  if (!u || u.client_id !== params.clientId) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const role = u.role as string;
  if (role !== "SALESPERSON" && role !== "CLIENT_MANAGER") {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const actorName = session.user?.name ?? "Manager";
  const actor = { id: session.userId, name: actorName, role: session.role ?? "UNKNOWN" };

  if (role === "SALESPERSON") {
    await migrateUncontactedLeads(supabase, {
      clientId: params.clientId,
      fromUserId: params.userId,
      actor,
      handoverNotes: "Uncontacted leads redistributed when salesperson was removed.",
    });
  }

  const { error } = await supabase.from("users").delete().eq("id", params.userId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
