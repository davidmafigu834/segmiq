import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { resolveApiAuth } from "@/lib/auth/resolveApiAuth";

export const dynamic = "force-dynamic";

export async function GET(req: Request, { params }: { params: { executionId: string } }) {
  const auth = await resolveApiAuth(req);
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const supabase = createAdminClient();
  const { data: execution } = await supabase
    .from("agent_executions")
    .select("*")
    .eq("id", params.executionId)
    .maybeSingle();
  if (!execution) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const clientId = execution.client_id as string;
  const inTenant = auth.role === "SUPER_ADMIN" || auth.clientId === clientId;
  if (!inTenant) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const [{ data: actions }, { data: lead }, { data: escalations }] = await Promise.all([
    supabase
      .from("agent_execution_actions")
      .select("*")
      .eq("execution_id", params.executionId)
      .order("performed_at", { ascending: true }),
    supabase
      .from("leads")
      .select("id, name, phone, status, assigned_to_id")
      .eq("id", execution.lead_id as string)
      .maybeSingle(),
    supabase
      .from("agent_escalations")
      .select("id, reason, severity, summary, status, created_at")
      .eq("execution_id", params.executionId),
  ]);

  return NextResponse.json({
    execution,
    actions: actions ?? [],
    escalations: escalations ?? [],
    lead: lead
      ? { id: lead.id, name: lead.name ?? lead.phone ?? "Unknown", status: lead.status }
      : null,
  });
}
