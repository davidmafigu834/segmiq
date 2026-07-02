import { NextResponse } from "next/server";
import { z } from "zod";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { migrateUncontactedLeads } from "@/lib/leads/migrateUncontactedLeads";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  let clientId = searchParams.get("clientId") ?? session.clientId;

  if (session.role !== "AGENCY_ADMIN") {
    clientId = session.clientId;
  }
  if (!clientId) return NextResponse.json({ error: "No client" }, { status: 400 });

  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("users")
    .select("id, name, email, phone, role, is_active, created_at, client_id")
    .eq("client_id", clientId)
    .order("created_at", { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data ?? []);
}

const patchSchema = z.object({
  userId: z.string().uuid(),
  is_active: z.boolean(),
});

export async function PATCH(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const parsed = patchSchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: "Invalid body" }, { status: 400 });

  const { userId, is_active } = parsed.data;
  if (userId === session.userId) {
    return NextResponse.json({ error: "You cannot deactivate yourself." }, { status: 400 });
  }

  const supabase = createAdminClient();
  const { data: target } = await supabase
    .from("users")
    .select("client_id, role, name")
    .eq("id", userId)
    .maybeSingle();

  if (!target) return NextResponse.json({ error: "User not found" }, { status: 404 });

  const targetClientId = (target as { client_id: string; role: string }).client_id;
  if (session.role !== "AGENCY_ADMIN" && targetClientId !== session.clientId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let migration = { migrated: 0, unassigned: 0 };
  if (!is_active && (target as { role: string }).role === "SALESPERSON") {
    const actorName = session.user?.name ?? "Manager";
    migration = await migrateUncontactedLeads(supabase, {
      clientId: targetClientId,
      fromUserId: userId,
      actor: { id: session.userId, name: actorName, role: session.role ?? "UNKNOWN" },
      handoverNotes: "Uncontacted leads redistributed when salesperson was deactivated.",
    });
  }

  const { error } = await supabase
    .from("users")
    .update({ is_active })
    .eq("id", userId);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, migration });
}
