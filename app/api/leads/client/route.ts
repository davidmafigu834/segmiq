import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireSession } from "@/lib/api-guards";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 50;

export async function GET(req: Request) {
  const g = await requireSession();
  if ("error" in g) return g.error;

  const { session } = g;
  if (session.role !== "CLIENT_MANAGER" && session.role !== "AGENCY_ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const url = new URL(req.url);
  const clientId =
    session.role === "CLIENT_MANAGER"
      ? session.clientId
      : url.searchParams.get("clientId");

  if (!clientId) {
    return NextResponse.json({ error: "clientId required" }, { status: 400 });
  }

  if (session.role === "CLIENT_MANAGER" && session.clientId !== clientId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const page = Math.max(1, Number(url.searchParams.get("page") ?? "1"));
  const limit = Math.min(200, Math.max(1, Number(url.searchParams.get("limit") ?? String(PAGE_SIZE))));
  const from = (page - 1) * limit;
  const to = from + limit - 1;

  const supabase = createAdminClient();

  const { data: leads, count, error } = await supabase
    .from("leads")
    .select("*, assigned_to:users!assigned_to_id ( id, name, avatar_url )", { count: "exact" })
    .eq("client_id", clientId)
    .order("created_at", { ascending: false })
    .range(from, to);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const rows = leads ?? [];
  const ids = rows.map((l) => l.id as string);

  const lastCallMap: Record<string, string> = {};
  if (ids.length > 0) {
    const { data: logs } = await supabase
      .from("call_logs")
      .select("lead_id, created_at")
      .in("lead_id", ids)
      .order("created_at", { ascending: false });
    for (const log of logs ?? []) {
      const lid = log.lead_id as string;
      if (!lastCallMap[lid]) lastCallMap[lid] = log.created_at as string;
    }
  }

  const leadsWithCallData = rows.map((row) => ({
    ...row,
    last_call_at: lastCallMap[row.id as string] ?? null,
  }));

  const total = count ?? 0;
  const hasMore = to < total - 1;

  return NextResponse.json({
    leads: leadsWithCallData,
    total,
    page,
    limit,
    hasMore,
  });
}
