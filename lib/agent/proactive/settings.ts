import { createAdminClient } from "@/lib/supabase/admin";
import {
  DEFAULT_PROACTIVE_CONFIG,
  DEFAULT_CONTACT_WINDOWS,
  type ProactiveConfig,
  type ProactiveContactWindows,
  type ProactiveSettings,
} from "./types";

export function isProactiveGloballyEnabled(): boolean {
  return process.env.SEGMIQ_PROACTIVE_DISABLED !== "true";
}

export function isProactiveCustomerMessagingGloballyEnabled(): boolean {
  if (!isProactiveGloballyEnabled()) return false;
  return process.env.SEGMIQ_PROACTIVE_CUSTOMER_MESSAGING_DISABLED !== "true";
}

function mergeConfig(raw: unknown): ProactiveConfig {
  const src = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  const d = DEFAULT_PROACTIVE_CONFIG;
  const windowsRaw = src.contactWindows as ProactiveContactWindows | undefined;
  return {
    quoteFollowUpEnabled: bool(src.quoteFollowUpEnabled, d.quoteFollowUpEnabled),
    quoteExpiryNotifySalesperson: bool(src.quoteExpiryNotifySalesperson, d.quoteExpiryNotifySalesperson),
    quoteExpiryHoursBefore: num(src.quoteExpiryHoursBefore, d.quoteExpiryHoursBefore, 1, 168),
    quoteExpiryCustomerReminder: bool(src.quoteExpiryCustomerReminder, d.quoteExpiryCustomerReminder),
    quoteAfterMaxAttempts: enumOf(
      src.quoteAfterMaxAttempts,
      ["CREATE_TASK", "NOTIFY", "NO_ACTION"] as const,
      d.quoteAfterMaxAttempts
    ),
    dealInactivityEnabled: bool(src.dealInactivityEnabled, d.dealInactivityEnabled),
    dealInactivityBusinessDays: num(src.dealInactivityBusinessDays, d.dealInactivityBusinessDays, 1, 30),
    dealInactivityAction: enumOf(
      src.dealInactivityAction,
      ["CREATE_TASK", "NOTIFY", "CUSTOMER_MESSAGE", "NO_ACTION"] as const,
      d.dealInactivityAction
    ),
    dealInactivityStages: Array.isArray(src.dealInactivityStages)
      ? (src.dealInactivityStages as string[])
      : d.dealInactivityStages,
    dealNextActionMissingEnabled: bool(src.dealNextActionMissingEnabled, d.dealNextActionMissingEnabled),
    appointmentCustomerReminder: bool(src.appointmentCustomerReminder, d.appointmentCustomerReminder),
    appointmentCustomerReminderHours: num(
      src.appointmentCustomerReminderHours,
      d.appointmentCustomerReminderHours,
      1,
      72
    ),
    appointmentSalespersonReminder: bool(src.appointmentSalespersonReminder, d.appointmentSalespersonReminder),
    appointmentSalespersonReminderMinutes: num(
      src.appointmentSalespersonReminderMinutes,
      d.appointmentSalespersonReminderMinutes,
      5,
      180
    ),
    appointmentMissedCustomerMessage: bool(
      src.appointmentMissedCustomerMessage,
      d.appointmentMissedCustomerMessage
    ),
    appointmentMissedCreateTask: bool(src.appointmentMissedCreateTask, d.appointmentMissedCreateTask),
    responseSlaAlertsEnabled: bool(src.responseSlaAlertsEnabled, d.responseSlaAlertsEnabled),
    responseSlaMinutes: num(src.responseSlaMinutes, d.responseSlaMinutes, 5, 240),
    maxMessagesPerCustomerPerDay: num(src.maxMessagesPerCustomerPerDay, d.maxMessagesPerCustomerPerDay, 1, 10),
    maxMessagesPerConversationPerHour: num(
      src.maxMessagesPerConversationPerHour,
      d.maxMessagesPerConversationPerHour,
      1,
      5
    ),
    companyHourlyLimit: num(src.companyHourlyLimit, d.companyHourlyLimit, 1, 500),
    contactWindows: mergeWindows(windowsRaw),
  };
}

function mergeWindows(raw?: ProactiveContactWindows): ProactiveContactWindows {
  const days: ProactiveContactWindows["days"] = { ...DEFAULT_CONTACT_WINDOWS.days };
  if (!raw?.days) return { days };
  for (const key of Object.keys(raw.days)) {
    const weekday = Number(key);
    if (weekday < 0 || weekday > 6) continue;
    days[weekday] = raw.days[weekday] ?? null;
  }
  return { days };
}

function bool(value: unknown, fallback: boolean): boolean {
  return typeof value === "boolean" ? value : fallback;
}

function num(value: unknown, fallback: number, min: number, max: number): number {
  const n = typeof value === "number" && Number.isFinite(value) ? value : fallback;
  return Math.min(max, Math.max(min, Math.round(n)));
}

function enumOf<T extends string>(value: unknown, allowed: readonly T[], fallback: T): T {
  return allowed.includes(value as T) ? (value as T) : fallback;
}

type SettingsRow = Record<string, unknown>;

function rowToSettings(clientId: string, row: SettingsRow | null): ProactiveSettings {
  return {
    clientId,
    enabled: Boolean(row?.proactive_enabled),
    shadowMode: row?.proactive_shadow_mode == null ? true : Boolean(row.proactive_shadow_mode),
    customerMessaging: Boolean(row?.proactive_customer_messaging),
    internalActions: row?.proactive_internal_actions == null ? true : Boolean(row.proactive_internal_actions),
    circuitOpen: Boolean(row?.proactive_circuit_open),
    circuitOpenedAt: (row?.proactive_circuit_opened_at as string | null) ?? null,
    circuitReason: (row?.proactive_circuit_reason as string | null) ?? null,
    config: mergeConfig(row?.proactive_config),
  };
}

export async function getProactiveSettings(clientId: string): Promise<ProactiveSettings> {
  const supabase = createAdminClient();
  const { data } = await supabase
    .from("agent_company_settings")
    .select(
      "proactive_enabled, proactive_shadow_mode, proactive_customer_messaging, proactive_internal_actions, proactive_circuit_open, proactive_circuit_opened_at, proactive_circuit_reason, proactive_config"
    )
    .eq("client_id", clientId)
    .maybeSingle();
  return rowToSettings(clientId, data as SettingsRow | null);
}

export type ProactiveSettingsPatch = Partial<
  Omit<ProactiveSettings, "clientId" | "config" | "circuitOpen" | "circuitOpenedAt" | "circuitReason">
> & {
  config?: Partial<ProactiveConfig>;
};

export async function updateProactiveSettings(
  clientId: string,
  patch: ProactiveSettingsPatch
): Promise<ProactiveSettings> {
  const current = await getProactiveSettings(clientId);
  const nextConfig = patch.config ? { ...current.config, ...patch.config } : current.config;
  if (patch.config?.contactWindows) {
    nextConfig.contactWindows = mergeWindows(patch.config.contactWindows);
  }
  const supabase = createAdminClient();
  const update: Record<string, unknown> = {
    client_id: clientId,
    updated_at: new Date().toISOString(),
  };
  if (patch.enabled !== undefined) update.proactive_enabled = patch.enabled;
  if (patch.shadowMode !== undefined) update.proactive_shadow_mode = patch.shadowMode;
  if (patch.customerMessaging !== undefined) update.proactive_customer_messaging = patch.customerMessaging;
  if (patch.internalActions !== undefined) update.proactive_internal_actions = patch.internalActions;
  if (patch.config !== undefined) update.proactive_config = nextConfig;
  const { data, error } = await supabase
    .from("agent_company_settings")
    .upsert(update, { onConflict: "client_id" })
    .select(
      "proactive_enabled, proactive_shadow_mode, proactive_customer_messaging, proactive_internal_actions, proactive_circuit_open, proactive_circuit_opened_at, proactive_circuit_reason, proactive_config"
    )
    .single();
  if (error) throw new Error(`Failed to update proactive settings: ${error.message}`);
  return rowToSettings(clientId, data as SettingsRow);
}

export async function setProactiveCircuit(
  clientId: string,
  open: boolean,
  reason?: string
): Promise<void> {
  const supabase = createAdminClient();
  await supabase.from("agent_company_settings").upsert(
    {
      client_id: clientId,
      proactive_circuit_open: open,
      proactive_circuit_opened_at: open ? new Date().toISOString() : null,
      proactive_circuit_reason: open ? reason ?? "Repeated channel or policy failures" : null,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "client_id" }
  );
}
