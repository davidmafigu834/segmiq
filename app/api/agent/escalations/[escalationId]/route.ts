import { NextResponse } from "next/server";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { resolveApiAuth } from "@/lib/auth/resolveApiAuth";
import { evaluateLeadModifyAccess } from "@/lib/auth/permissions";
import { updateConversationAgentState } from "@/lib/agent/conversation-state";
import { asRow } from "@/lib/agent/rows";

export const dynamic = "force-dynamic";

const patchSchema = z.object({
  status: z.enum(["ACKNOWLEDGED", "RESOLVED"]),
  /** On resolve: hand the conversation back to the agent or keep it human. */
  resumeAgent: z.boolean().optional(),
});

export async function PATCH(req: Request, { params }: { params: { escalationId: string } }) {
  const auth = await resolveApiAuth(req);
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const supabase = createAdminClient();
  const { data: escalationData } = await supabase
    .from("agent_escalations")
    .select("id, client_id, lead_id, status")
    .eq("id", params.escalationId)
    .maybeSingle();
  const escalation = asRow<{ id: string; client_id: string; lead_id: string; status: string }>(
    escalationData
  );
  if (!escalation) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const clientId = escalation.client_id;
  const inTenant =
    (auth.role === "SUPER_ADMIN" && !auth.isImpersonating) || auth.clientId === clientId;
  if (!inTenant) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const isManager =
    auth.role === "CLIENT_MANAGER" || (auth.role === "SUPER_ADMIN" && !auth.isImpersonating);
  if (!isManager) {
    const { data: lead } = await supabase
      .from("leads")
      .select("client_id, assigned_to_id")
      .eq("id", escalation.lead_id)
      .maybeSingle();
    if (!lead) return NextResponse.json({ error: "Not found" }, { status: 404 });
    const mod = evaluateLeadModifyAccess(auth, {
      client_id: lead.client_id as string,
      assigned_to_id: (lead.assigned_to_id as string | null) ?? null,
    });
    if (!mod.allowed) {
      return NextResponse.json({ error: mod.reason }, { status: mod.status });
    }
  }

  const body = await req.json().catch(() => null);
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Invalid update" }, { status: 400 });

  const now = new Date().toISOString();
  const update: Record<string, unknown> = { status: parsed.data.status };
  if (parsed.data.status === "RESOLVED") {
    update.resolved_at = now;
    update.resolved_by_id = auth.userId;
  }
  await supabase.from("agent_escalations").update(update).eq("id", params.escalationId);

  if (parsed.data.status === "RESOLVED") {
    await updateConversationAgentState(clientId, escalation.lead_id, {
      status: parsed.data.resumeAgent ? "IDLE" : "HUMAN_HANDLING",
      humanNeededReason: null,
      ...(parsed.data.resumeAgent ? { humanTakeover: false } : {}),
    });
  }

  return NextResponse.json({ ok: true });
}
