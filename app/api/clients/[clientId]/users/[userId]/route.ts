import { NextResponse } from "next/server";
import { z } from "zod";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { canManageClientTeam } from "@/lib/auth/permissions";
import { migrateUncontactedLeads } from "@/lib/leads/migrateUncontactedLeads";
import { getNextRoundRobinOrder } from "@/lib/auth/sales-capabilities";
import { normalizeToE164 } from "@/lib/phone-validate";
import { setSessionToken } from "@/lib/auth/session-token";
import type { ClientMode, UserRole } from "@/types";

export const dynamic = "force-dynamic";

const patchSchema = z
  .object({
    is_active: z.boolean().optional(),
    role: z.enum(["CLIENT_MANAGER"]).optional(),
    also_sells: z.boolean().optional(),
    phone: z.string().max(32).optional(),
  })
  .refine(
    (data) =>
      data.is_active !== undefined ||
      data.role !== undefined ||
      data.also_sells !== undefined,
    { message: "Provide is_active, role, and/or also_sells" }
  );

async function bumpSessionVersion(supabase: ReturnType<typeof createAdminClient>, userId: string) {
  const { data: row } = await supabase.from("users").select("session_version").eq("id", userId).maybeSingle();
  const next = Number((row as { session_version?: number } | null)?.session_version ?? 0) + 1;
  await supabase.from("users").update({ session_version: next }).eq("id", userId);
}

/** Refresh the active browser session when also_sells changes for the signed-in (or impersonated) user. */
async function refreshAlsoSellsInSession(
  session: {
    userId: string;
    role: UserRole;
    clientId: string | null;
    clientMode?: ClientMode;
    isImpersonating?: boolean;
    realUserId?: string | null;
    realUserName?: string | null;
    user?: { name?: string | null; email?: string | null };
  },
  alsoSells: boolean
) {
  const supabase = createAdminClient();
  const versionUserId =
    session.isImpersonating && session.realUserId ? session.realUserId : session.userId;
  const { data: versionRow } = await supabase
    .from("users")
    .select("session_version")
    .eq("id", versionUserId)
    .maybeSingle();

  await setSessionToken({
    userId: session.userId,
    role: session.role,
    clientId: session.clientId,
    clientMode: session.clientMode ?? "team",
    alsoSells,
    sessionVersion: Number((versionRow as { session_version?: number } | null)?.session_version ?? 0),
    email: session.user?.email ?? null,
    name: session.user?.name ?? "User",
    realUserId: session.realUserId ?? null,
    realUserName: session.realUserName ?? null,
  });
}

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
    .select("id, name, role, client_id, is_active, phone, also_sells, session_version")
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

  if (role === "CLIENT_MANAGER" && parsed.data.is_active === false) {
    const { count } = await supabase
      .from("users")
      .select("*", { count: "exact", head: true })
      .eq("client_id", params.clientId)
      .eq("role", "CLIENT_MANAGER")
      .eq("is_active", true);
    if ((count ?? 0) <= 1) {
      return NextResponse.json({ error: "At least one company manager is required." }, { status: 400 });
    }
  }

  if (parsed.data.also_sells !== undefined && role !== "CLIENT_MANAGER") {
    return NextResponse.json({ error: "Only managers can use also_sells" }, { status: 400 });
  }

  const actorName = session.user?.name ?? "Manager";
  const actor = { id: session.userId, name: actorName, role: session.role ?? "UNKNOWN" };

  let migration = { migrated: 0, unassigned: 0 };
  let requiresReauth = false;

  if (role === "SALESPERSON" && parsed.data.role === "CLIENT_MANAGER") {
    migration = await migrateUncontactedLeads(supabase, {
      clientId: params.clientId,
      fromUserId: params.userId,
      actor,
      handoverNotes: "Uncontacted leads redistributed when salesperson was promoted to manager.",
    });

    const { error } = await supabase
      .from("users")
      .update({ role: "CLIENT_MANAGER", round_robin_order: 0, also_sells: false, is_active: true })
      .eq("id", params.userId);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    await bumpSessionVersion(supabase, params.userId);

    const { data: promoted } = await supabase
      .from("users")
      .select("id, name, email, phone, role, is_active, also_sells")
      .eq("id", params.userId)
      .single();

    return NextResponse.json({
      ok: true,
      promoted: true,
      manager: promoted,
      migration,
      requiresReauth: params.userId === session.userId,
    });
  }

  if (role === "CLIENT_MANAGER" && parsed.data.also_sells === true) {
    const rawPhone = parsed.data.phone?.trim() ?? (u.phone as string | null) ?? "";
    const phoneNorm = rawPhone ? normalizeToE164(rawPhone) : null;
    if (!phoneNorm) {
      return NextResponse.json(
        {
          error:
            "A WhatsApp phone number is required before a manager can sell. Use international format like +263 77 123 4567.",
        },
        { status: 400 }
      );
    }

    const rr = await getNextRoundRobinOrder(supabase, params.clientId);
    const { error } = await supabase
      .from("users")
      .update({ also_sells: true, phone: phoneNorm, round_robin_order: rr, is_active: true })
      .eq("id", params.userId);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    if (params.userId === session.userId) {
      await refreshAlsoSellsInSession(session, true);
    } else {
      await bumpSessionVersion(supabase, params.userId);
      requiresReauth = true;
    }

    const { data: updated } = await supabase
      .from("users")
      .select("id, name, email, phone, role, is_active, also_sells, round_robin_order")
      .eq("id", params.userId)
      .single();

    return NextResponse.json({ ok: true, manager: updated, requiresReauth });
  }

  if (role === "CLIENT_MANAGER" && parsed.data.also_sells === false && Boolean(u.also_sells)) {
    migration = await migrateUncontactedLeads(supabase, {
      clientId: params.clientId,
      fromUserId: params.userId,
      actor,
      handoverNotes: "Uncontacted leads redistributed when manager selling was turned off.",
    });

    const { error } = await supabase
      .from("users")
      .update({ also_sells: false, round_robin_order: 0 })
      .eq("id", params.userId);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    if (params.userId === session.userId) {
      await refreshAlsoSellsInSession(session, false);
    } else {
      await bumpSessionVersion(supabase, params.userId);
      requiresReauth = true;
    }

    const { data: updated } = await supabase
      .from("users")
      .select("id, name, email, phone, role, is_active, also_sells")
      .eq("id", params.userId)
      .single();

    return NextResponse.json({ ok: true, manager: updated, migration, requiresReauth });
  }

  const shouldMigrateSales =
    role === "SALESPERSON" && parsed.data.is_active === false;
  const shouldMigrateSellingManager =
    role === "CLIENT_MANAGER" &&
    Boolean(u.also_sells) &&
    parsed.data.is_active === false;

  if (shouldMigrateSales || shouldMigrateSellingManager) {
    migration = await migrateUncontactedLeads(supabase, {
      clientId: params.clientId,
      fromUserId: params.userId,
      actor,
      handoverNotes: shouldMigrateSellingManager
        ? "Uncontacted leads redistributed when selling manager was deactivated."
        : "Uncontacted leads redistributed when salesperson was deactivated.",
    });

    if (shouldMigrateSellingManager) {
      await supabase
        .from("users")
        .update({ also_sells: false, round_robin_order: 0 })
        .eq("id", params.userId);
    }
  }

  if (parsed.data.is_active !== undefined) {
    const { error } = await supabase
      .from("users")
      .update({ is_active: parsed.data.is_active })
      .eq("id", params.userId);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    // Invalidate existing sessions when deactivating so the user can't keep working.
    if (parsed.data.is_active === false && params.userId !== session.userId) {
      await bumpSessionVersion(supabase, params.userId);
      requiresReauth = true;
    }
  }

  return NextResponse.json({ ok: true, migration, requiresReauth });
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
    .select("id, role, client_id, also_sells")
    .eq("id", params.userId)
    .maybeSingle();
  if (!u || u.client_id !== params.clientId) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const role = u.role as string;
  if (role !== "SALESPERSON" && role !== "CLIENT_MANAGER") {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  if (role === "CLIENT_MANAGER") {
    const { count } = await supabase
      .from("users")
      .select("*", { count: "exact", head: true })
      .eq("client_id", params.clientId)
      .eq("role", "CLIENT_MANAGER")
      .eq("is_active", true);
    if ((count ?? 0) <= 1) {
      return NextResponse.json({ error: "At least one company manager is required." }, { status: 400 });
    }
  }

  const actorName = session.user?.name ?? "Manager";
  const actor = { id: session.userId, name: actorName, role: session.role ?? "UNKNOWN" };

  if (role === "SALESPERSON" || Boolean(u.also_sells)) {
    await migrateUncontactedLeads(supabase, {
      clientId: params.clientId,
      fromUserId: params.userId,
      actor,
      handoverNotes:
        role === "SALESPERSON"
          ? "Uncontacted leads redistributed when salesperson was removed."
          : "Uncontacted leads redistributed when selling manager was removed.",
    });
  }

  const { error } = await supabase.from("users").delete().eq("id", params.userId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
