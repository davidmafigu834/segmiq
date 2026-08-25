import { quotationAutomationBlockers } from "@/lib/company-brain/readiness";
import { loadCompanyBrainSnapshot } from "@/lib/company-brain/store";
import { invalidateBrainCache } from "@/lib/company-brain/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import type { AgentCompanySettings } from "./types";

/**
 * Global kill switch. Set SEGMIQ_AGENT_DISABLED=true to stop all agent
 * executions across every tenant without touching company settings.
 */
export function isAgentGloballyEnabled(): boolean {
  if (process.env.SEGMIQ_AGENT_DISABLED === "true") return false;
  return Boolean(
    process.env.ANTHROPIC_API_KEY?.trim() ||
      process.env.GEMINI_API_KEY?.trim() ||
      process.env.GROQ_API_KEY?.trim()
  );
}

export const AGENT_SETTINGS_DEFAULTS: Omit<AgentCompanySettings, "clientId"> = {
  enabled: false,
  autonomyMode: "COPILOT",
  respondToEnquiries: true,
  qualifyLeads: true,
  createLeads: true,
  createDeals: true,
  createTasks: true,
  scheduleCallbacks: true,
  scheduleAppointments: true,
  rescheduleAppointments: true,
  prepareQuotations: true,
  sendQuotations: false,
  sendFollowUps: true,
  transferSupport: true,
  createSupportCases: true,
  negotiateDiscounts: false,
  quoteAutoSendLimit: null,
  businessHoursPolicy: "ALWAYS",
  disclosureText: null,
  tone: "professional",
  languagePreference: null,
  escalationUserId: null,
  maxQuestionsPerMessage: 2,
  debounceSeconds: 6,
  dailyExecutionLimit: 300,
  conversationHourlyLimit: 12,
  testMode: false,
};

type SettingsRow = Record<string, unknown>;

function rowToSettings(clientId: string, row: SettingsRow | null): AgentCompanySettings {
  const d = AGENT_SETTINGS_DEFAULTS;
  if (!row) return { clientId, ...d };
  const bool = (key: string, fallback: boolean) =>
    typeof row[key] === "boolean" ? (row[key] as boolean) : fallback;
  const num = (key: string, fallback: number) =>
    typeof row[key] === "number" && Number.isFinite(row[key] as number)
      ? (row[key] as number)
      : fallback;
  return {
    clientId,
    enabled: bool("enabled", d.enabled),
    autonomyMode: (row.autonomy_mode as AgentCompanySettings["autonomyMode"]) ?? d.autonomyMode,
    respondToEnquiries: bool("respond_to_enquiries", d.respondToEnquiries),
    qualifyLeads: bool("qualify_leads", d.qualifyLeads),
    createLeads: bool("create_leads", d.createLeads),
    createDeals: bool("create_deals", d.createDeals),
    createTasks: bool("create_tasks", d.createTasks),
    scheduleCallbacks: bool("schedule_callbacks", d.scheduleCallbacks),
    scheduleAppointments: bool("schedule_appointments", d.scheduleAppointments),
    rescheduleAppointments: bool("reschedule_appointments", d.rescheduleAppointments),
    prepareQuotations: bool("prepare_quotations", d.prepareQuotations),
    sendQuotations: bool("send_quotations", d.sendQuotations),
    sendFollowUps: bool("send_follow_ups", d.sendFollowUps),
    transferSupport: bool("transfer_support", d.transferSupport),
    createSupportCases: bool("create_support_cases", d.createSupportCases),
    negotiateDiscounts: bool("negotiate_discounts", d.negotiateDiscounts),
    quoteAutoSendLimit:
      row.quote_auto_send_limit == null ? null : Number(row.quote_auto_send_limit),
    businessHoursPolicy:
      (row.business_hours_policy as AgentCompanySettings["businessHoursPolicy"]) ??
      d.businessHoursPolicy,
    disclosureText: (row.disclosure_text as string | null) ?? null,
    tone: (row.tone as AgentCompanySettings["tone"]) ?? d.tone,
    languagePreference: (row.language_preference as string | null) ?? null,
    escalationUserId: (row.escalation_user_id as string | null) ?? null,
    maxQuestionsPerMessage: num("max_questions_per_message", d.maxQuestionsPerMessage),
    debounceSeconds: num("debounce_seconds", d.debounceSeconds),
    dailyExecutionLimit: num("daily_execution_limit", d.dailyExecutionLimit),
    conversationHourlyLimit: num("conversation_hourly_limit", d.conversationHourlyLimit),
    testMode: bool("test_mode", d.testMode),
  };
}

export async function getAgentCompanySettings(clientId: string): Promise<AgentCompanySettings> {
  const supabase = createAdminClient();
  const { data } = await supabase
    .from("agent_company_settings")
    .select("*")
    .eq("client_id", clientId)
    .maybeSingle();
  return rowToSettings(clientId, data as SettingsRow | null);
}

export type AgentSettingsPatch = Partial<Omit<AgentCompanySettings, "clientId">>;

const PATCH_COLUMN_MAP: Record<keyof AgentSettingsPatch, string> = {
  enabled: "enabled",
  autonomyMode: "autonomy_mode",
  respondToEnquiries: "respond_to_enquiries",
  qualifyLeads: "qualify_leads",
  createLeads: "create_leads",
  createDeals: "create_deals",
  createTasks: "create_tasks",
  scheduleCallbacks: "schedule_callbacks",
  scheduleAppointments: "schedule_appointments",
  rescheduleAppointments: "reschedule_appointments",
  prepareQuotations: "prepare_quotations",
  sendQuotations: "send_quotations",
  sendFollowUps: "send_follow_ups",
  transferSupport: "transfer_support",
  createSupportCases: "create_support_cases",
  negotiateDiscounts: "negotiate_discounts",
  quoteAutoSendLimit: "quote_auto_send_limit",
  businessHoursPolicy: "business_hours_policy",
  disclosureText: "disclosure_text",
  tone: "tone",
  languagePreference: "language_preference",
  escalationUserId: "escalation_user_id",
  maxQuestionsPerMessage: "max_questions_per_message",
  debounceSeconds: "debounce_seconds",
  dailyExecutionLimit: "daily_execution_limit",
  conversationHourlyLimit: "conversation_hourly_limit",
  testMode: "test_mode",
};

export async function updateAgentCompanySettings(
  clientId: string,
  patch: AgentSettingsPatch
): Promise<AgentCompanySettings> {
  if (patch.sendQuotations === true) {
    const current = await getAgentCompanySettings(clientId);
    if (!current.sendQuotations) {
      try {
        const snapshot = await loadCompanyBrainSnapshot(clientId);
        const missing = quotationAutomationBlockers(snapshot);
        if (missing.length) {
          throw new Error(
            `Complete these ${missing.length} item${missing.length === 1 ? "" : "s"} before enabling autonomous quotation sending: ${missing.join(", ")}.`
          );
        }
      } catch (err) {
        if (err instanceof Error && err.message.startsWith("Complete these")) throw err;
        throw new Error(
          "Company Brain quotation readiness could not be verified. Complete quotation setup before enabling autonomous sending."
        );
      }
    }
  }
  const supabase = createAdminClient();
  const update: Record<string, unknown> = { client_id: clientId, updated_at: new Date().toISOString() };
  for (const [key, column] of Object.entries(PATCH_COLUMN_MAP) as Array<
    [keyof AgentSettingsPatch, string]
  >) {
    if (patch[key] !== undefined) update[column] = patch[key];
  }
  const { data, error } = await supabase
    .from("agent_company_settings")
    .upsert(update, { onConflict: "client_id" })
    .select("*")
    .single();
  if (error) throw new Error(`Failed to update agent settings: ${error.message}`);
  invalidateBrainCache(clientId);
  return rowToSettings(clientId, data as SettingsRow);
}
