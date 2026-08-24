import { NextResponse } from "next/server";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { resolveApiAuth } from "@/lib/auth/resolveApiAuth";
import { updateConversationAgentState } from "@/lib/agent/conversation-state";

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
  const { data: escalation } = await supabase
    .from("agent_escalations")
    .select("id, client_id, lead_id, status")
    .eq("id", params.escalationId)
    .maybeSingle();
  if (!escalation) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const clientId = escalation.client_id as string;
  if (auth.role !== "SUPER_ADMIN" && auth.clientId !== clientId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
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
    await updateConversationAgentState(clientId, escalation.lead_id as string, {
      status: parsed.data.resumeAgent ? "IDLE" : "HUMAN_HANDLING",
      humanNeededReason: null,
      ...(parsed.data.resumeAgent ? { humanTakeover: false } : {}),
    });
  }

  return NextResponse.json({ ok: true });
}
