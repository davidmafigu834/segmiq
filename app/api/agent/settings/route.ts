import { NextResponse } from "next/server";
import { z } from "zod";
import { resolveApiAuth } from "@/lib/auth/resolveApiAuth";
import { describeAgentLlm } from "@/lib/agent/provider";
import {
  getAgentCompanySettings,
  updateAgentCompanySettings,
  isAgentGloballyEnabled,
} from "@/lib/agent/settings";
import { getProactiveSettings, updateProactiveSettings } from "@/lib/agent/proactive/settings";
import { getLearningSettings, updateLearningSettings } from "@/lib/agent/learning/settings";
import { isLearningGloballyEnabled, presetPatch } from "@/lib/agent/learning/policy";

export const dynamic = "force-dynamic";

async function resolveManagerClient(req: Request): Promise<
  | { ok: true; clientId: string }
  | { ok: false; status: number; error: string }
> {
  const auth = await resolveApiAuth(req);
  if (!auth) return { ok: false, status: 401, error: "Unauthorized" };
  const url = new URL(req.url);
  const requested = url.searchParams.get("clientId");
  if (auth.role === "SUPER_ADMIN") {
    const clientId = requested ?? auth.clientId;
    if (!clientId) return { ok: false, status: 400, error: "clientId required" };
    return { ok: true, clientId };
  }
  if (auth.role !== "CLIENT_MANAGER" || !auth.clientId) {
    return { ok: false, status: 403, error: "Only company managers can manage agent settings" };
  }
  if (requested && requested !== auth.clientId) {
    return { ok: false, status: 403, error: "Forbidden" };
  }
  return { ok: true, clientId: auth.clientId };
}

export async function GET(req: Request) {
  const access = await resolveManagerClient(req);
  if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status });
  const settings = await getAgentCompanySettings(access.clientId);
  const proactive = await getProactiveSettings(access.clientId);
  const learning = await getLearningSettings(access.clientId);
  return NextResponse.json({
    settings,
    proactive,
    learning,
    globallyEnabled: isAgentGloballyEnabled(),
    learningGloballyEnabled: isLearningGloballyEnabled(),
    llm: describeAgentLlm(),
  });
}

const patchSchema = z
  .object({
    enabled: z.boolean(),
    autonomyMode: z.enum(["ASSIST", "COPILOT", "AUTOPILOT"]),
    respondToEnquiries: z.boolean(),
    qualifyLeads: z.boolean(),
    createLeads: z.boolean(),
    createDeals: z.boolean(),
    createTasks: z.boolean(),
    scheduleCallbacks: z.boolean(),
    scheduleAppointments: z.boolean(),
    rescheduleAppointments: z.boolean(),
    prepareQuotations: z.boolean(),
    sendQuotations: z.boolean(),
    sendFollowUps: z.boolean(),
    transferSupport: z.boolean(),
    createSupportCases: z.boolean(),
    negotiateDiscounts: z.boolean(),
    quoteAutoSendLimit: z.number().positive().max(100_000_000).nullable(),
    businessHoursPolicy: z.enum(["ALWAYS", "BUSINESS_HOURS_ONLY", "AFTER_HOURS_ACK"]),
    disclosureText: z.string().max(300).nullable(),
    tone: z.enum(["professional", "friendly", "concise"]),
    languagePreference: z.string().max(60).nullable(),
    escalationUserId: z.string().uuid().nullable(),
    maxQuestionsPerMessage: z.number().int().min(1).max(5),
    debounceSeconds: z.number().int().min(0).max(60),
    dailyExecutionLimit: z.number().int().min(1).max(10_000),
    conversationHourlyLimit: z.number().int().min(1).max(100),
    testMode: z.boolean(),
    learningEnabled: z.boolean(),
    suggestReplies: z.boolean(),
    salesAgentEnabled: z.boolean(),
    learning: z
      .object({
        enabled: z.boolean(),
        suggestReplies: z.boolean(),
        config: z.record(z.unknown()).optional(),
        preset: z.enum(["LEARN_FIRST", "ASSIST"]),
      })
      .partial(),
    proactive: z
      .object({
        enabled: z.boolean(),
        shadowMode: z.boolean(),
        customerMessaging: z.boolean(),
        internalActions: z.boolean(),
        config: z.record(z.unknown()).optional(),
      })
      .partial(),
  })
  .partial();

export async function PATCH(req: Request) {
  const access = await resolveManagerClient(req);
  if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status });

  const body = await req.json().catch(() => null);
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid settings" },
      { status: 400 }
    );
  }

  try {
    const { proactive: proactivePatch, learning: learningPatch, ...agentPatch } = parsed.data;
    let nextProactive = proactivePatch;
    if (learningPatch?.preset) {
      const preset = presetPatch(learningPatch.preset);
      agentPatch.enabled = preset.enabled;
      agentPatch.suggestReplies = preset.suggestReplies;
      agentPatch.learningEnabled = preset.learningEnabled;
      if (preset.autonomyMode) agentPatch.autonomyMode = preset.autonomyMode;
      learningPatch.enabled = preset.learningEnabled;
      learningPatch.suggestReplies = preset.suggestReplies;
      nextProactive = { ...(proactivePatch ?? {}), enabled: preset.proactiveEnabled };
    }
    if (learningPatch?.enabled !== undefined) agentPatch.learningEnabled = learningPatch.enabled;
    if (learningPatch?.suggestReplies !== undefined) agentPatch.suggestReplies = learningPatch.suggestReplies;
    const settings = Object.keys(agentPatch).length
      ? await updateAgentCompanySettings(access.clientId, agentPatch)
      : await getAgentCompanySettings(access.clientId);
    const proactive = nextProactive
      ? await updateProactiveSettings(access.clientId, {
          enabled: nextProactive.enabled,
          shadowMode: nextProactive.shadowMode,
          customerMessaging: nextProactive.customerMessaging,
          internalActions: nextProactive.internalActions,
          config: nextProactive.config as Parameters<typeof updateProactiveSettings>[1]["config"],
        })
      : await getProactiveSettings(access.clientId);
    const learning = learningPatch
      ? await updateLearningSettings(access.clientId, {
          enabled: learningPatch.enabled ?? agentPatch.learningEnabled,
          suggestReplies: learningPatch.suggestReplies ?? agentPatch.suggestReplies,
          config: learningPatch.config as Parameters<typeof updateLearningSettings>[1]["config"],
        })
      : await getLearningSettings(access.clientId);
    return NextResponse.json({ settings, proactive, learning });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to save settings";
    const blocked = /Complete these|quotation readiness/i.test(message);
    return NextResponse.json({ error: message }, { status: blocked ? 400 : 500 });
  }
}
