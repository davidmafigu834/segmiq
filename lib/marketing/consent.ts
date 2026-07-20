import { createAdminClient } from "@/lib/supabase/admin";
import type { ConsentStatus } from "./types";

export type CommunicationPrefsRow = {
  contact_id: string;
  client_id: string;
  whatsapp_marketing: ConsentStatus;
  service_updates: ConsentStatus;
  consent_source: string | null;
  consent_date: string | null;
  consent_wording_version: string | null;
  consent_evidence: Record<string, unknown> | null;
  opt_out_at: string | null;
  opt_out_reason: string | null;
  suppressed: boolean;
};

const OPT_OUT_KEYWORDS = new Set([
  "stop",
  "unsubscribe",
  "opt out",
  "opt-out",
  "optout",
  "cancel",
  "remove me",
]);

export function isOptOutMessage(body: string): boolean {
  const normalized = body.trim().toLowerCase();
  if (OPT_OUT_KEYWORDS.has(normalized)) return true;
  return normalized.startsWith("stop ") || normalized === "stop all";
}

export function canSendMarketing(consent: ConsentStatus, suppressed: boolean): boolean {
  if (suppressed) return false;
  return consent === "opted_in";
}

export async function getContactPrefs(
  contactId: string
): Promise<CommunicationPrefsRow | null> {
  const supabase = createAdminClient();
  const { data } = await supabase
    .from("contact_communication_prefs")
    .select("*")
    .eq("contact_id", contactId)
    .maybeSingle();
  return (data as CommunicationPrefsRow | null) ?? null;
}

export async function getContactPrefsBatch(
  contactIds: string[]
): Promise<Map<string, CommunicationPrefsRow>> {
  if (contactIds.length === 0) return new Map();

  const supabase = createAdminClient();
  const { data } = await supabase
    .from("contact_communication_prefs")
    .select("*")
    .in("contact_id", contactIds);

  const map = new Map<string, CommunicationPrefsRow>();
  for (const row of (data ?? []) as CommunicationPrefsRow[]) {
    map.set(row.contact_id, row);
  }
  return map;
}

export async function upsertContactPrefs(
  contactId: string,
  clientId: string,
  patch: Partial<{
    whatsapp_marketing: ConsentStatus;
    service_updates: ConsentStatus;
    consent_source: string | null;
    consent_date: string | null;
    consent_wording_version: string | null;
    consent_evidence: Record<string, unknown> | null;
    opt_out_at: string | null;
    opt_out_reason: string | null;
    suppressed: boolean;
  }>
): Promise<CommunicationPrefsRow | null> {
  const supabase = createAdminClient();
  const now = new Date().toISOString();

  const { data, error } = await supabase
    .from("contact_communication_prefs")
    .upsert(
      {
        contact_id: contactId,
        client_id: clientId,
        updated_at: now,
        ...patch,
      },
      { onConflict: "contact_id" }
    )
    .select("*")
    .single();

  if (error) {
    console.error("[consent] upsert failed", error);
    return null;
  }
  return data as CommunicationPrefsRow;
}

export async function recordWhatsAppOptOut(opts: {
  contactId: string;
  clientId: string;
  reason: string;
}): Promise<void> {
  await upsertContactPrefs(opts.contactId, opts.clientId, {
    whatsapp_marketing: "opted_out",
    opt_out_at: new Date().toISOString(),
    opt_out_reason: opts.reason,
  });
}

export function defaultConsentForContact(): {
  whatsapp_marketing: ConsentStatus;
  service_updates: ConsentStatus;
  suppressed: boolean;
} {
  return {
    whatsapp_marketing: "unknown",
    service_updates: "opted_in",
    suppressed: false,
  };
}
