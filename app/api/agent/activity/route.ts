import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { resolveApiAuth } from "@/lib/auth/resolveApiAuth";
import { asRows } from "@/lib/agent/rows";

export const dynamic = "force-dynamic";

const TAB_STATES: Record<string, string[]> = {
  active: ["QUEUED", "RUNNING", "WAITING_FOR_TOOL"],
  human: ["WAITING_FOR_HUMAN"],
  completed: ["COMPLETED"],
  failed: ["FAILED", "CANCELLED", "SKIPPED"],
  proactive: [],
  manager: [],
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
      "id, lead_id, state, intents, confidence, decision_summary, customer_reply, reply_status, autonomy_mode, model, tool_call_count, latency_ms, error_code, test_mode, created_at, completed_at, trigger_kind, reason_code"
    )
    .eq("client_id", clientId)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (tab === "proactive") {
    query = query.eq("trigger_kind", "PROACTIVE");
  } else if (tab === "manager") {
    query = query.eq("trigger_kind", "MANAGER");
  } else {
    query = query.in("state", states.length ? states : TAB_STATES.completed);
  }
  if (leadId) query = query.eq("lead_id", leadId);
  const { data: executionsData } = await query;

  type ExecutionRow = {
    id: string;
    lead_id: string;
    state: string;
    intents: string[] | null;
    confidence: number | null;
    decision_summary: string | null;
    customer_reply: string | null;
    reply_status: string | null;
    autonomy_mode: string | null;
    model: string | null;
    tool_call_count: number | null;
    latency_ms: number | null;
    error_code: string | null;
    test_mode: boolean | null;
    created_at: string;
    completed_at: string | null;
    trigger_kind?: string | null;
    reason_code?: string | null;
  };
  const executions = asRows<ExecutionRow>(executionsData);

  // Tab counters + lead labels for the rows.
  const dayStart = new Date();
  dayStart.setUTCHours(0, 0, 0, 0);
  const counts: Record<string, number> = {};
  await Promise.all(
    Object.entries(TAB_STATES).map(async ([key, tabStates]) => {
      if (key === "proactive" || key === "manager") {
        const { count } = await supabase
          .from("agent_executions")
          .select("id", { count: "exact", head: true })
          .eq("client_id", clientId)
          .eq("trigger_kind", key === "proactive" ? "PROACTIVE" : "MANAGER");
        counts[key] = count ?? 0;
        return;
      }
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

  const leadIds = Array.from(new Set(executions.map((e) => e.lead_id).filter(Boolean))) as string[];
  const { data: leadsData } = leadIds.length
    ? await supabase.from("leads").select("id, name, phone").in("id", leadIds)
    : { data: [] as Array<Record<string, unknown>> };
  const leadById = new Map(
    asRows<{ id: string; name: string | null; phone: string | null }>(leadsData).map((l) => [l.id, l])
  );

  const { data: openEscalationsData } = await supabase
    .from("agent_escalations")
    .select("id, lead_id, execution_id, reason, severity, summary, status, created_at")
    .eq("client_id", clientId)
    .eq("status", "OPEN")
    .order("created_at", { ascending: false })
    .limit(50);

  return NextResponse.json({
    executions: executions.map((e) => {
      const lead = leadById.get(e.lead_id);
      return {
        ...e,
        customer_name: e.trigger_kind === "MANAGER" ? "Command Center" : lead?.name ?? lead?.phone ?? "Unknown",
      };
    }),
    counts: { ...counts, today: todayCount ?? 0 },
    openEscalations: asRows(openEscalationsData),
  });
}
