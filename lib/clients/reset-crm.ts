import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Operational CRM tables wiped when a company asks to start over.
 * Account setup is intentionally left in place.
 */
export const COMPANY_CRM_RESET_TABLES = [
  "whatsapp_campaign_recipients",
  "whatsapp_campaigns",
  "whatsapp_external_messages",
  "agent_execution_actions",
  "agent_executions",
  "agent_escalations",
  "agent_conversation_state",
  "agent_customer_memory",
  "ai_response_cache",
  "support_cases",
  "quotation_views",
  "quotation_events",
  "quotation_approval_steps",
  "quotation_approval_requests",
  "win_analysis",
  "lead_intelligence",
  "lead_events",
  "salesperson_saved_items",
  "sales_action_states",
  "sales_daily_focus_log",
  "forecast_snapshots",
  "audience_export_history",
  "audience_segments",
  "retargeting_audience_state",
  "client_intelligence_snapshots",
  "campaign_qualifiers",
  "contact_communication_prefs",
  "whatsapp_messages",
  "message_logs",
  "notifications",
  "inventory_reservations",
  "inventory_transfers",
  "inventory_movements",
  "product_activity_events",
  "commercial_import_jobs",
  "quotations",
  "deals",
  "leads",
] as const;

export const COMPANY_CRM_RESET_PRESERVED = [
  "clients",
  "users",
  "client_profiles",
  "form_schemas",
  "instant_forms",
  "product_catalog",
  "quotation_settings",
  "quotation_packages",
  "products",
  "product_categories",
  "product_variants",
  "product_attribute_defs",
  "units_of_measure",
  "inventory_settings",
  "inventory_locations",
  "inventory_balances",
  "commercial_packages",
  "commercial_package_sections",
  "commercial_package_items",
  "quotation_approval_policies",
  "quote_templates",
  "projects",
  "testimonials",
  "whatsapp_connections",
  "whatsapp_quick_replies",
  "whatsapp_templates",
  "subscriptions",
  "invoices",
  "payments",
  "agent_company_settings",
  "company_brain_settings",
  "sales_goals",
  "sales_execution_settings",
] as const;

async function deleteByClient(
  supabase: SupabaseClient,
  table: string,
  clientId: string
): Promise<{ table: string; deleted: number | null; error?: string }> {
  const { error, count } = await supabase.from(table).delete({ count: "exact" }).eq("client_id", clientId);
  if (error) {
    if (/does not exist|schema cache/i.test(error.message)) {
      return { table, deleted: 0 };
    }
    return { table, deleted: null, error: error.message };
  }
  return { table, deleted: count ?? 0 };
}

/**
 * Deletes leads, customers, deals, quotations, conversations, and related history
 * for one company. Team logins, catalog, quote settings, profile, Facebook,
 * WhatsApp connection, and billing are kept.
 */
export async function resetCompanyCrm(
  supabase: SupabaseClient,
  clientId: string
): Promise<{ ok: true; deleted: Record<string, number> } | { ok: false; error: string }> {
  const { data: client, error: fetchErr } = await supabase
    .from("clients")
    .select("id, name")
    .eq("id", clientId)
    .maybeSingle();
  if (fetchErr) return { ok: false, error: fetchErr.message };
  if (!client) return { ok: false, error: "Client not found" };

  const unlinkLeads = await supabase
    .from("leads")
    .update({ active_deal_id: null })
    .eq("client_id", clientId);
  if (unlinkLeads.error) return { ok: false, error: unlinkLeads.error.message };

  // deals.originating_lead_id is NOT NULL and restricts lead deletes, so deals
  // must be removed before leads. Do not null that column.

  const unlinkQuotes = await supabase
    .from("quotations")
    .update({ parent_quotation_id: null, superseded_by_id: null })
    .eq("client_id", clientId);
  if (unlinkQuotes.error && !/column|schema cache/i.test(unlinkQuotes.error.message)) {
    return { ok: false, error: unlinkQuotes.error.message };
  }

  const deleted: Record<string, number> = {};

  for (const table of COMPANY_CRM_RESET_TABLES) {
    const result = await deleteByClient(supabase, table, clientId);
    if (result.error) return { ok: false, error: `${table}: ${result.error}` };
    deleted[table] = result.deleted ?? 0;
  }

  const { data: contacts } = await supabase.from("contacts").select("id").eq("client_id", clientId);
  const contactIds = (contacts ?? []).map((row) => row.id as string);
  if (contactIds.length) {
    const viewings = await supabase.from("viewings").delete({ count: "exact" }).in("contact_id", contactIds);
    if (viewings.error && !/does not exist|schema cache/i.test(viewings.error.message)) {
      return { ok: false, error: `viewings: ${viewings.error.message}` };
    }
    deleted.viewings = viewings.count ?? 0;
  }

  const contactRows = await deleteByClient(supabase, "contacts", clientId);
  if (contactRows.error) return { ok: false, error: `contacts: ${contactRows.error}` };
  deleted.contacts = contactRows.deleted ?? 0;

  return { ok: true, deleted };
}
