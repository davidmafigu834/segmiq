import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { resolveApiAuth } from "@/lib/auth/resolveApiAuth";
import { evaluateLeadReadAccess } from "@/lib/auth/permissions";
import { asRow, asRows } from "@/lib/agent/rows";

export const dynamic = "force-dynamic";

export async function GET(req: Request, { params }: { params: { executionId: string } }) {
  const auth = await resolveApiAuth(req);
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const supabase = createAdminClient();
  const { data: executionData } = await supabase
    .from("agent_executions")
    .select("*")
    .eq("id", params.executionId)
    .maybeSingle();
  const execution = asRow<{ client_id: string; lead_id: string } & Record<string, unknown>>(
    executionData
  );
  if (!execution) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const clientId = execution.client_id;
  // SECURITY: fail closed + no existence leak across tenants.
  // Impersonating SUPER_ADMIN uses effective role/clientId from resolveApiAuth.
  const inTenant =
    (auth.role === "SUPER_ADMIN" && !auth.isImpersonating) || auth.clientId === clientId;
  if (!inTenant) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const isManager =
    auth.role === "CLIENT_MANAGER" || (auth.role === "SUPER_ADMIN" && !auth.isImpersonating);
  if (!isManager) {
    const { data: leadRow } = await supabase
      .from("leads")
      .select("client_id, assigned_to_id")
      .eq("id", execution.lead_id)
      .maybeSingle();
    if (!leadRow) return NextResponse.json({ error: "Not found" }, { status: 404 });
    const read = evaluateLeadReadAccess(auth, {
      client_id: leadRow.client_id as string,
      assigned_to_id: (leadRow.assigned_to_id as string | null) ?? null,
    });
    if (!read.ok) return NextResponse.json({ error: "Not found" }, { status: read.status });
  }

  const [{ data: actions }, { data: lead }, { data: escalations }] = await Promise.all([
    supabase
      .from("agent_execution_actions")
      .select("*")
      .eq("execution_id", params.executionId)
      .order("performed_at", { ascending: true }),
    supabase
      .from("leads")
      .select("id, name, phone, status, assigned_to_id")
      .eq("id", execution.lead_id)
      .maybeSingle(),
    supabase
      .from("agent_escalations")
      .select("id, reason, severity, summary, status, created_at")
      .eq("execution_id", params.executionId),
  ]);

  return NextResponse.json({
    execution,
    actions: asRows(actions),
    escalations: asRows(escalations),
    lead: lead
      ? { id: lead.id, name: lead.name ?? lead.phone ?? "Unknown", status: lead.status }
      : null,
  });
}
