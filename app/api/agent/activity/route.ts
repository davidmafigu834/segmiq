import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { resolveApiAuth } from "@/lib/auth/resolveApiAuth";

export const dynamic = "force-dynamic";

const TAB_STATES: Record<string, string[]> = {
  active: ["QUEUED", "RUNNING", "WAITING_FOR_TOOL"],
  human: ["WAITING_FOR_HUMAN"],
  completed: ["COMPLETED"],
  failed: ["FAILED", "CANCELLED", "SKIPPED"],
};

export async function GET(req: Request) {
  const auth = await resolveApiAuth(req);
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const url = new URL(req.url);
  const requestedClient = url.searchParams.get("clientId");
  let clientId: string | null = null;
  if (auth.role === "SUPER_ADMIN") {
    clientId = requestedClient ?? auth.clientId;
  } else if (auth.role === "CLIENT_MANAGER" && auth.clientId) {
    if (requestedClient && requestedClient !== auth.clientId) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    clientId = auth.clientId;
  }
  if (!clientId) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const tab = url.searchParams.get("tab") ?? "completed";
  const states = TAB_STATES[tab] ?? TAB_STATES.completed;
  const limit = Math.min(Number(url.searchParams.get("limit")) || 50, 100);
  const leadId = url.searchParams.get("leadId");

  const supabase = createAdminClient();

  let query = supabase
    .from("agent_executions")
    .select(
      "id, lead_id, state, intents, confidence, decision_summary, customer_reply, reply_status, " +
        "autonomy_mode, model, tool_call_count, latency_ms, error_code, test_mode, created_at, completed_at"
    )
    .eq("client_id", clientId)
    .in("state", states)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (leadId) query = query.eq("lead_id", leadId);
  const { data: executions } = await query;

  // Tab counters + lead labels for the rows.
  const dayStart = new Date();
  dayStart.setUTCHours(0, 0, 0, 0);
  const counts: Record<string, number> = {};
  await Promise.all(
    Object.entries(TAB_STATES).map(async ([key, tabStates]) => {
      const { count } = await supabase
        .from("agent_executions")
        .select("id", { count: "exact", head: true })
        .eq("client_id", clientId)
        .in("state", tabStates);
      counts[key] = count ?? 0;
    })
  );
  const { count: todayCount } = await supabase
    .from("agent_executions")
    .select("id", { count: "exact", head: true })
    .eq("client_id", clientId)
    .gte("created_at", dayStart.toISOString());

  const leadIds = Array.from(new Set((executions ?? []).map((e) => e.lead_id as string)));
  const { data: leads } = leadIds.length
    ? await supabase.from("leads").select("id, name, phone").in("id", leadIds)
    : { data: [] as Array<Record<string, unknown>> };
  const leadById = new Map((leads ?? []).map((l) => [l.id as string, l]));

  const { data: openEscalations } = await supabase
    .from("agent_escalations")
    .select("id, lead_id, execution_id, reason, severity, summary, status, created_at")
    .eq("client_id", clientId)
    .eq("status", "OPEN")
    .order("created_at", { ascending: false })
    .limit(50);

  return NextResponse.json({
    executions: (executions ?? []).map((e) => {
      const lead = leadById.get(e.lead_id as string);
      return {
        ...e,
        customer_name: (lead?.name as string | null) ?? (lead?.phone as string | null) ?? "Unknown",
      };
    }),
    counts: { ...counts, today: todayCount ?? 0 },
    openEscalations: openEscalations ?? [],
  });
}
