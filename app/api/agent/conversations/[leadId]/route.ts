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
  isAgentConversationMode,
  patchForConversationMode,
  resolveConversationMode,
} from "@/lib/agent/real-estate/conversation-mode";
import { AGENT_CONVERSATION_MODE_LABELS } from "@/lib/agent/real-estate/types";
import {
  applySuggestedAgentActions,
  applyAgentActionById,
  approveViewingFromHub,
  escalateConversationFromHub,
  rejectAgentDraft,
  sendAgentDraft,
  suggestedActionsFromRows,
} from "@/lib/agent/hub-actions";
import { buildAgentActionCards } from "@/lib/agent/hub-action-cards";
import { buildHandoffForLead, loadReIntelligenceForLead } from "@/lib/agent/real-estate/intelligence";
import { isRealEstate } from "@/lib/terminology";
import { asRow, asRows } from "@/lib/agent/rows";

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

  const supabase = createAdminClient();
  const [state, settings, clientRow] = await Promise.all([
    getConversationAgentState(access.clientId, access.leadId),
    getAgentCompanySettings(access.clientId),
    supabase.from("clients").select("business_type").eq("id", access.clientId).maybeSingle(),
  ]);
  const realEstateClient = isRealEstate(clientRow.data?.business_type);
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

  type ExecutionPreview = {
    id: string;
    state: string;
    intents: string[] | null;
    confidence: number | null;
    decision_summary: string | null;
    customer_reply: string | null;
    reply_status: string | null;
    created_at: string;
  };
  const executions = asRows<ExecutionPreview>(recentExecutions);
  const latest = executions[0] ?? null;
  let suggestedActions: ReturnType<typeof suggestedActionsFromRows> = [];
  if (latest?.id) {
    const { data: actionRows } = await supabase
      .from("agent_execution_actions")
      .select("id, tool_name, status, input_summary")
      .eq("execution_id", latest.id);
    suggestedActions = suggestedActionsFromRows(
      asRows<{
        id: string;
        tool_name: string;
        status: string;
        input_summary: Record<string, unknown> | null;
      }>(actionRows)
    );
  }

  const drafted = executions.find((run) => run.reply_status === "DRAFTED");
  const { upcomingJobForLead } = await import("@/lib/agent/proactive");
  const nextProactive = await upcomingJobForLead(access.clientId, access.leadId);
  const { getLearningSettings } = await import("@/lib/agent/learning/settings");
  const { conversationLearningSummary } = await import("@/lib/agent/learning/store");
  const learning = await getLearningSettings(access.clientId);
  const conversationLearning = learning.enabled
    ? await conversationLearningSummary(access.clientId, access.leadId)
    : { evidence: [], candidates: [] };

  const openEscalationRow = asRow(openEscalation) ?? null;
  const actionCards = buildAgentActionCards({
    blockedActions: suggestedActions,
    openEscalation: openEscalationRow,
  });

  const [handoffSummary, reIntelligence] = realEstateClient
    ? await Promise.all([
        buildHandoffForLead({
          clientId: access.clientId,
          leadId: access.leadId,
          decisionSummary: latest?.decision_summary ?? null,
          escalationSummary: openEscalationRow?.summary ?? null,
          escalationBriefing: openEscalationRow?.briefing ?? null,
        }),
        loadReIntelligenceForLead({ clientId: access.clientId, leadId: access.leadId }),
      ])
    : [null, null];

  return NextResponse.json({
    agentEnabledForCompany: settings.enabled,
    suggestReplies: settings.suggestReplies,
    learningEnabled: learning.enabled,
    autonomyMode: settings.autonomyMode,
    realEstateSettings: settings.realEstate ?? null,
    conversationMode: state ? resolveConversationMode(state) : "AI_HANDLING",
    conversationModeLabel: state
      ? AGENT_CONVERSATION_MODE_LABELS[resolveConversationMode(state)]
      : AGENT_CONVERSATION_MODE_LABELS.AI_HANDLING,
    state,
    recentExecutions: executions,
    openEscalation: openEscalationRow,
    actionCards,
    handoffSummary,
    reIntelligence,
    realEstateHub: realEstateClient,
    draftedReply: drafted?.customer_reply
      ? { executionId: drafted.id, text: drafted.customer_reply }
      : null,
    suggestedActions,
    nextProactive: nextProactive
      ? {
          id: nextProactive.id,
          triggerType: nextProactive.triggerType,
          scheduledAt: nextProactive.scheduledAt,
          status: nextProactive.status,
          decisionSummary: nextProactive.decisionSummary,
        }
      : null,
    learningSignals: conversationLearning.candidates.length,
    learningCandidates: conversationLearning.candidates.map((c) => ({
      id: c.id,
      title: c.title,
      category: c.category,
      status: c.status,
    })),
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
    "set_mode",
    "send_draft",
    "reject_draft",
    "apply_suggestions",
    "apply_action",
    "approve_viewing",
    "escalate",
    "cancel_proactive",
  ]),
  actionId: z.string().uuid().optional(),
  escalationId: z.string().uuid().optional(),
  listing_id: z.string().uuid().optional(),
  date: z.string().max(32).optional(),
  time: z.string().max(16).optional(),
  mode: z.enum(["AI_HANDLING", "AI_COPILOT", "HUMAN_ONLY"]).optional(),
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

  const { action, pauseMinutes, pauseFor, reason, reply, actionId, escalationId, listing_id, date, time } =
    parsed.data;
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
      {
        const { hookAgentResumed } = await import("@/lib/agent/proactive");
        void hookAgentResumed({
          clientId: access.clientId,
          leadId: access.leadId,
          actorType: "HUMAN",
          actorId: access.auth.userId,
        });
      }
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
    case "takeover": {
      const modePatch = patchForConversationMode("AI_COPILOT");
      await updateConversationAgentState(access.clientId, access.leadId, {
        ...modePatch,
        lastHumanMessageAt: now,
      });
      {
        const { hookHumanTakeover } = await import("@/lib/agent/proactive");
        void hookHumanTakeover({
          clientId: access.clientId,
          leadId: access.leadId,
          actorType: "HUMAN",
          actorId: access.auth.userId,
        });
      }
      break;
    }
    case "set_mode": {
      if (!parsed.data.mode || !isAgentConversationMode(parsed.data.mode)) {
        return NextResponse.json({ error: "Invalid mode" }, { status: 400 });
      }
      const modePatch = patchForConversationMode(parsed.data.mode);
      await updateConversationAgentState(access.clientId, access.leadId, modePatch);
      break;
    }
    case "release":
      {
        const modePatch = patchForConversationMode("AI_HANDLING");
        await updateConversationAgentState(access.clientId, access.leadId, {
          ...modePatch,
          humanNeededReason: null,
          pausedUntil: null,
          pausedById: null,
          pauseReason: null,
        });
      }
      {
        const { hookAgentResumed } = await import("@/lib/agent/proactive");
        void hookAgentResumed({
          clientId: access.clientId,
          leadId: access.leadId,
          actorType: "HUMAN",
          actorId: access.auth.userId,
        });
      }
      break;
    case "cancel_proactive": {
      const { cancelJobs } = await import("@/lib/agent/proactive");
      await cancelJobs({
        clientId: access.clientId,
        leadId: access.leadId,
        reason: reason?.trim() || "Salesperson is handling this.",
        cancelledById: access.auth.userId,
      });
      break;
    }
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
    case "apply_action": {
      if (!actionId) return NextResponse.json({ error: "actionId required" }, { status: 400 });
      const result = await applyAgentActionById({
        clientId: access.clientId,
        leadId: access.leadId,
        actionId,
      });
      if (!result.ok) return NextResponse.json({ error: result.error }, { status: 409 });
      const state = await getConversationAgentState(access.clientId, access.leadId);
      return NextResponse.json({ state, applied: [result.label] });
    }
    case "approve_viewing": {
      if (!date?.trim() || !time?.trim()) {
        return NextResponse.json({ error: "date and time required" }, { status: 400 });
      }
      const result = await approveViewingFromHub({
        clientId: access.clientId,
        leadId: access.leadId,
        escalationId: escalationId ?? null,
        input: {
          listing_id: listing_id ?? undefined,
          date: date.trim(),
          time: time.trim(),
          customer_request: reason?.trim() || undefined,
        },
      });
      if (!result.ok) return NextResponse.json({ error: result.error }, { status: 409 });
      const state = await getConversationAgentState(access.clientId, access.leadId);
      return NextResponse.json({ state, applied: ["Schedule viewing"] });
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
