import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { canAccessClient } from "@/lib/auth/permissions";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const clientId = searchParams.get("clientId");

  if (!clientId) {
    return NextResponse.json({ error: "clientId required" }, { status: 400 });
  }

  if (!canAccessClient(session.role, session.clientId, clientId)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const supabase = createAdminClient();

  const { data: staleLeads } = await supabase
    .from("leads")
    .select("id, name, phone, status, score, stale_since, assigned_to_id")
    .eq("client_id", clientId)
    .eq("is_stale", true)
    .order("stale_since", { ascending: true })
    .limit(20);

  if (!staleLeads || staleLeads.length === 0) {
    return NextResponse.json({ staleLeads: [] });
  }

  const assignedIds = Array.from(new Set(
    staleLeads
      .map((l) => l.assigned_to_id as string | null)
      .filter((id): id is string => id !== null)
  ));

  const assignedNamesMap = new Map<string, string>();
  if (assignedIds.length > 0) {
    const { data: users } = await supabase
      .from("users")
      .select("id, name")
      .in("id", assignedIds);
    for (const u of users ?? []) {
      assignedNamesMap.set(u.id as string, u.name as string);
    }
  }

  const enriched = staleLeads.map((l) => ({
    ...l,
    assignedToName: (l.assigned_to_id as string | null)
      ? (assignedNamesMap.get(l.assigned_to_id as string) ?? null)
      : null,
  }));

  return NextResponse.json({ staleLeads: enriched });
}
