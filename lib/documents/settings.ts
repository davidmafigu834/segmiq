import { createAdminClient } from "@/lib/supabase/admin";
import { isCommercialFlagEnabled, parseCommercialFlags } from "@/lib/commercial/flags";
import type { DocumentCompanySettingsRow } from "@/lib/documents/types";

export const DEFAULT_DOCUMENT_COMPANY_SETTINGS: Omit<
  DocumentCompanySettingsRow,
  "client_id"
> = {
  enabled: false,
  default_scope_type: "COMPANY",
  default_classification: "GENERAL",
  auto_classify: true,
  auto_create_category: false,
  auto_link_high_confidence: true,
  analyze_automatically: true,
  extract_obligations: true,
  extract_key_terms: true,
  expiry_alerts: true,
  expiry_alert_days: 30,
  suggest_categories_when_uncertain: true,
  min_auto_create_category_confidence: "HIGH",
};

export async function loadDocumentCompanySettings(
  clientId: string
): Promise<DocumentCompanySettingsRow> {
  const supabase = createAdminClient();
  const { data } = await supabase
    .from("document_company_settings")
    .select("*")
    .eq("client_id", clientId)
    .maybeSingle();

  if (data) return data as DocumentCompanySettingsRow;

  return {
    client_id: clientId,
    ...DEFAULT_DOCUMENT_COMPANY_SETTINGS,
  };
}

export async function isDocumentsModuleEnabled(clientId: string): Promise<boolean> {
  const settings = await loadDocumentCompanySettings(clientId);
  return settings.enabled;
}

export type DocumentsModuleAccess = {
  enabled: boolean;
  flagEnabled: boolean;
  settingsEnabled: boolean;
};

export function resolveDocumentsModuleAccess(
  commercialFlagsRaw: unknown,
  settingsEnabled: boolean
): DocumentsModuleAccess {
  const flagEnabled = isCommercialFlagEnabled(commercialFlagsRaw, "documents.enabled");
  return {
    flagEnabled,
    settingsEnabled,
    enabled: flagEnabled && settingsEnabled,
  };
}

export async function getDocumentsModuleAccess(clientId: string): Promise<DocumentsModuleAccess> {
  const supabase = createAdminClient();
  const [{ data: client }, settings] = await Promise.all([
    supabase.from("clients").select("commercial_flags").eq("id", clientId).maybeSingle(),
    loadDocumentCompanySettings(clientId),
  ]);
  return resolveDocumentsModuleAccess(client?.commercial_flags, settings.enabled);
}

export async function setDocumentsModuleEnabled(
  clientId: string,
  enabled: boolean
): Promise<DocumentsModuleAccess> {
  const supabase = createAdminClient();
  const { data: client, error: clientError } = await supabase
    .from("clients")
    .select("commercial_flags")
    .eq("id", clientId)
    .maybeSingle();

  if (clientError || !client) {
    throw new Error("Client not found");
  }

  const flags = parseCommercialFlags(client.commercial_flags);
  const nextFlags = { ...flags, "documents.enabled": enabled };

  const { error: flagsError } = await supabase
    .from("clients")
    .update({ commercial_flags: nextFlags })
    .eq("id", clientId);

  if (flagsError) {
    throw new Error(flagsError.message);
  }

  if (enabled) {
    await ensureDocumentCompanySettings(clientId);
  }

  const { data: existingSettings } = await supabase
    .from("document_company_settings")
    .select("client_id")
    .eq("client_id", clientId)
    .maybeSingle();

  if (existingSettings || enabled) {
    const { error: settingsError } = await supabase
      .from("document_company_settings")
      .update({
        enabled,
        updated_at: new Date().toISOString(),
      })
      .eq("client_id", clientId);

    if (settingsError) {
      throw new Error(settingsError.message);
    }
  }

  return resolveDocumentsModuleAccess(nextFlags, enabled);
}

export async function ensureDocumentCompanySettings(clientId: string): Promise<void> {
  const supabase = createAdminClient();
  await supabase.from("document_company_settings").upsert(
    {
      client_id: clientId,
      ...DEFAULT_DOCUMENT_COMPANY_SETTINGS,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "client_id", ignoreDuplicates: true }
  );
}
