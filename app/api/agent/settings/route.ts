import { NextResponse } from "next/server";
import { z } from "zod";
import { resolveApiAuth } from "@/lib/auth/resolveApiAuth";
import {
  getAgentCompanySettings,
  updateAgentCompanySettings,
  isAgentGloballyEnabled,
} from "@/lib/agent/settings";

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
  return NextResponse.json({ settings, globallyEnabled: isAgentGloballyEnabled() });
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

  const settings = await updateAgentCompanySettings(access.clientId, parsed.data);
  return NextResponse.json({ settings });
}
