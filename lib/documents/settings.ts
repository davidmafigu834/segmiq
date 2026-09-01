import { createAdminClient } from "@/lib/supabase/admin";
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
