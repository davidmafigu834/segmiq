import { NextResponse } from "next/server";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { resolveApiAuth } from "@/lib/auth/resolveApiAuth";
import {
  getConversationAgentState,
  updateConversationAgentState,
} from "@/lib/agent/conversation-state";
import { getAgentCompanySettings } from "@/lib/agent/settings";
import {
  applySuggestedAgentActions,
  escalateConversationFromHub,
  rejectAgentDraft,
  sendAgentDraft,
  suggestedActionsFromRows,
} from "@/lib/agent/hub-actions";

export const dynamic = "force-dynamic";

async function resolveLeadAccess(req: Request, leadId: string) {
  const auth = await resolveApiAuth(req);
  if (!auth) return { ok: false as const, status: 401, error: "Unauthorized" };
  const supabase = createAdminClient();
  const { data: lead } = await supabase
    .from("leads")
    .select("id, client_id, assigned_to_id")
    .eq("id", leadId)
    .maybeSingle();
  if (!lead) return { ok: false as const, status: 404, error: "Lead not found" };
  const clientId = lead.client_id as string;
  const allowed =
    auth.role === "SUPER_ADMIN" ||
    (auth.clientId === clientId &&
      (auth.role === "CLIENT_MANAGER" || (lead.assigned_to_id as string | null) === auth.userId));
  if (!allowed) return { ok: false as const, status: 403, error: "Forbidden" };
  return { ok: true as const, auth, clientId, leadId };
}

export async function GET(req: Request, { params }: { params: { leadId: string } }) {
  const access = await resolveLeadAccess(req, params.leadId);
  if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status });

  const [state, settings] = await Promise.all([
    getConversationAgentState(access.clientId, access.leadId),
    getAgentCompanySettings(access.clientId),
  ]);

  const supabase = createAdminClient();
  const { data: recentExecutions } = await supabase
    .from("agent_executions")
    .select("id, state, intents, confidence, decision_summary, customer_reply, reply_status, created_at")
    .eq("lead_id", access.leadId)
    .order("created_at", { ascending: false })
    .limit(5);
  const { data: openEscalation } = await supabase
    .from("agent_escalations")
    .select("id, reason, severity, summary, briefing, status, created_at")
    .eq("lead_id", access.leadId)
    .eq("status", "OPEN")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const latest = recentExecutions?.[0] ?? null;
  let suggestedActions: ReturnType<typeof suggestedActionsFromRows> = [];
  if (latest?.id) {
    const { data: actionRows } = await supabase
      .from("agent_execution_actions")
      .select("id, tool_name, status, input_summary")
      .eq("execution_id", latest.id);
    suggestedActions = suggestedActionsFromRows(
      (actionRows ?? []) as Array<{
        id: string;
        tool_name: string;
        status: string;
        input_summary: Record<string, unknown> | null;
      }>
    );
  }

  const drafted = (recentExecutions ?? []).find((run) => run.reply_status === "DRAFTED");

  return NextResponse.json({
    agentEnabledForCompany: settings.enabled,
    autonomyMode: settings.autonomyMode,
    state,
    recentExecutions: recentExecutions ?? [],
    openEscalation: openEscalation ?? null,
    draftedReply: drafted?.customer_reply
      ? { executionId: drafted.id, text: drafted.customer_reply as string }
      : null,
    suggestedActions,
  });
}

const actionSchema = z.object({
  action: z.enum([
    "pause",
    "resume",
    "disable",
    "enable",
    "takeover",
    "release",
    "send_draft",
    "reject_draft",
    "apply_suggestions",
    "escalate",
  ]),
  pauseMinutes: z.number().int().min(5).max(7 * 24 * 60).optional(),
  pauseFor: z.enum(["indefinite", "1h", "tomorrow"]).optional(),
  reason: z.string().max(300).optional(),
  reply: z.string().max(2000).optional(),
});

export async function PATCH(req: Request, { params }: { params: { leadId: string } }) {
  const access = await resolveLeadAccess(req, params.leadId);
  if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status });

  const body = await req.json().catch(() => null);
  const parsed = actionSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Invalid action" }, { status: 400 });

  const { action, pauseMinutes, pauseFor, reason, reply } = parsed.data;
  const now = new Date().toISOString();

  switch (action) {
    case "pause": {
      const until = pauseUntilIso(pauseFor, pauseMinutes);
      await updateConversationAgentState(access.clientId, access.leadId, {
        status: "PAUSED",
        pausedUntil: until,
        pausedById: access.auth.userId,
        pauseReason: reason ?? null,
      });
      break;
    }
    case "resume":
      await updateConversationAgentState(access.clientId, access.leadId, {
        status: "IDLE",
        pausedUntil: null,
        pausedById: null,
        pauseReason: null,
        humanTakeover: false,
        humanNeededReason: null,
      });
      break;
    case "disable":
      await updateConversationAgentState(access.clientId, access.leadId, {
        agentEnabled: false,
        status: "HUMAN_HANDLING",
      });
      break;
    case "enable":
      await updateConversationAgentState(access.clientId, access.leadId, {
        agentEnabled: true,
        status: "IDLE",
        humanTakeover: false,
        humanNeededReason: null,
      });
      break;
    case "takeover":
      await updateConversationAgentState(access.clientId, access.leadId, {
        humanTakeover: true,
        status: "HUMAN_HANDLING",
        lastHumanMessageAt: now,
      });
      break;
    case "release":
      await updateConversationAgentState(access.clientId, access.leadId, {
        humanTakeover: false,
        status: "IDLE",
        humanNeededReason: null,
      });
      break;
    case "send_draft": {
      const sent = await sendAgentDraft({
        clientId: access.clientId,
        leadId: access.leadId,
        reply,
      });
      if (!sent.ok) return NextResponse.json({ error: sent.error }, { status: 409 });
      break;
    }
    case "reject_draft":
      await rejectAgentDraft({ clientId: access.clientId, leadId: access.leadId });
      break;
    case "apply_suggestions": {
      const result = await applySuggestedAgentActions({
        clientId: access.clientId,
        leadId: access.leadId,
      });
      const state = await getConversationAgentState(access.clientId, access.leadId);
      return NextResponse.json({ state, applied: result.applied, failed: result.failed });
    }
    case "escalate": {
      const supabase = createAdminClient();
      const { data: lead } = await supabase
        .from("leads")
        .select("assigned_to_id")
        .eq("id", access.leadId)
        .maybeSingle();
      await escalateConversationFromHub({
        clientId: access.clientId,
        leadId: access.leadId,
        ownerId: (lead?.assigned_to_id as string | null) ?? access.auth.userId,
        summary: reason,
      });
      break;
    }
  }

  const state = await getConversationAgentState(access.clientId, access.leadId);
  return NextResponse.json({ state });
}

function pauseUntilIso(
  pauseFor: "indefinite" | "1h" | "tomorrow" | undefined,
  pauseMinutes: number | undefined
): string | null {
  if (pauseFor === "indefinite") return null;
  if (pauseFor === "1h") return new Date(Date.now() + 60 * 60 * 1000).toISOString();
  if (pauseFor === "tomorrow") {
    const until = new Date();
    until.setDate(until.getDate() + 1);
    until.setHours(8, 0, 0, 0);
    return until.toISOString();
  }
  return new Date(Date.now() + (pauseMinutes ?? 240) * 60_000).toISOString();
}
