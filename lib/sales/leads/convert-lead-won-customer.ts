/**
 * Field-close flow: convert an existing lead into a won deal + customer record.
 * Used when a rep closed on-site and syncs when back online.
 */

import { createAdminClient } from "@/lib/supabase/admin";
import { logStatusChanged } from "@/lib/lead-events";
import { saveCallLog } from "@/lib/call-log-save";
import { notifyDealWon } from "@/lib/notifications";
import { getManagerPrefs } from "@/lib/notification-prefs";
import { createDealFromLead } from "@/lib/sales/deals/create-deal";
import { closeDealWon } from "@/lib/sales/deals/close-deal";
import { suggestDealName } from "@/lib/sales/deals/create-deal-form";
import { locationFromFormData } from "@/lib/sales/leads-directory/format";
import type { DealRow, LeadRow } from "@/types";

export type ConvertLeadWonCustomerInput = {
  leadId: string;
  actorId: string;
  actor: { id: string; name: string; role: string };
  wonValue: number;
  wonAt?: string | null;
  dealName?: string | null;
  customerType?: "company" | "individual" | null;
  location?: string | null;
  primaryContactName?: string | null;
  industry?: string | null;
  notes?: string | null;
};

export type ConvertLeadWonCustomerResult =
  | { ok: true; deal: DealRow; lead: LeadRow; contactId: string | null }
  | { ok: false; error: string; code: string; status: number };

export async function convertLeadToWonCustomer(
  input: ConvertLeadWonCustomerInput
): Promise<ConvertLeadWonCustomerResult> {
  const supabase = createAdminClient();

  const { data: leadRow, error: leadErr } = await supabase
    .from("leads")
    .select("*")
    .eq("id", input.leadId)
    .maybeSingle();

  if (leadErr || !leadRow) {
    return { ok: false, error: "Lead not found.", code: "LEAD_NOT_FOUND", status: 404 };
  }

  const lead = leadRow as LeadRow;

  if (lead.status === "WON" || lead.status === "LOST") {
    return {
      ok: false,
      error: "This lead is already closed on a legacy status.",
      code: "LEAD_LEGACY_CLOSED",
      status: 409,
    };
  }

  const { data: wonDeal } = await supabase
    .from("deals")
    .select("id, stage")
    .eq("originating_lead_id", input.leadId)
    .eq("stage", "WON")
    .maybeSingle();

  if (wonDeal) {
    return {
      ok: false,
      error: "A won deal is already recorded for this lead.",
      code: "ALREADY_WON",
      status: 409,
    };
  }

  const previousStatus = lead.status as string;

  if (previousStatus === "NOT_QUALIFIED") {
    const { error: reopenErr } = await supabase
      .from("leads")
      .update({
        status: "QUALIFIED",
        not_qualified_reason: null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", input.leadId);

    if (reopenErr) {
      return { ok: false, error: "Could not reopen this lead.", code: "REOPEN_FAILED", status: 500 };
    }

    await logStatusChanged({
      leadId: input.leadId,
      clientId: lead.client_id as string,
      actor: input.actor,
      fromStatus: previousStatus,
      toStatus: "QUALIFIED",
    });
  }

  const dealName =
    input.dealName?.trim() ||
    suggestDealName(lead) ||
    lead.name?.trim() ||
    "Field close";

  let deal: DealRow;

  const { data: activeDeal } = await supabase
    .from("deals")
    .select("*")
    .eq("originating_lead_id", input.leadId)
    .not("stage", "in", '("WON","LOST")')
    .maybeSingle();

  if (activeDeal) {
    deal = activeDeal as DealRow;
  } else {
    const created = await createDealFromLead({
      leadId: input.leadId,
      actorId: input.actorId,
      name: dealName,
      serviceSummary: lead.project_type ?? null,
      customerNeed: lead.customer_need ?? null,
      location: input.location ?? locationFromFormData(lead.form_data) ?? null,
      salesEstimate: input.wonValue,
      estimatedValue: input.wonValue,
      force: true,
    });

    if (!created.ok) {
      return {
        ok: false,
        error: created.error,
        code: created.code,
        status: created.status,
      };
    }
    deal = created.deal;
  }

  const closed = await closeDealWon({
    dealId: deal.id,
    actorId: input.actorId,
    wonValue: input.wonValue,
    wonAt: input.wonAt ?? null,
    notes: input.notes?.trim() || null,
  });

  if (!closed.ok) {
    return { ok: false, error: closed.error, code: "CLOSE_WON_FAILED", status: closed.status };
  }

  deal = closed.deal;

  const contactId = (lead.contact_id as string | null) ?? deal.contact_id ?? null;

  if (contactId) {
    const contactPatch: Record<string, unknown> = {
      lifecycle: "customer",
      updated_at: new Date().toISOString(),
    };
    if (input.customerType) contactPatch.customer_type = input.customerType;
    if (input.location?.trim()) contactPatch.location = input.location.trim();
    if (input.primaryContactName?.trim()) {
      contactPatch.primary_contact_name = input.primaryContactName.trim();
    }
    if (input.industry?.trim()) contactPatch.industry = input.industry.trim();
    if (input.customerType === "individual" && lead.name?.trim()) {
      contactPatch.name = lead.name.trim();
    }

    await supabase.from("contacts").update(contactPatch).eq("id", contactId);
  }

  try {
    await saveCallLog({
      leadId: input.leadId,
      actorUserId: input.actorId,
      actor: input.actor,
      reachOutcome: "reached",
      result: "won",
      dealValue: input.wonValue,
      notes:
        input.notes?.trim() ||
        "Recorded as won customer after field close.",
      channel: "call",
    });
  } catch (e) {
    console.error("[convertLeadToWonCustomer] call log", e);
  }

  const { data: refreshedLead } = await supabase
    .from("leads")
    .select("*")
    .eq("id", input.leadId)
    .single();

  const { data: actorRow } = await supabase
    .from("users")
    .select("id, name, email, phone")
    .eq("id", input.actorId)
    .maybeSingle();

  const { data: managers } = await supabase
    .from("users")
    .select("id, name, email, phone, notification_prefs")
    .eq("client_id", lead.client_id as string)
    .eq("role", "CLIENT_MANAGER")
    .eq("is_active", true);

  const { data: clientRow } = await supabase
    .from("clients")
    .select("name, twilio_whatsapp_override")
    .eq("id", lead.client_id as string)
    .maybeSingle();

  const spLite = {
    id: input.actorId,
    name: (actorRow?.name as string) || input.actor.name,
    phone: (actorRow?.phone as string | null) ?? null,
    email: (actorRow?.email as string | null) ?? null,
  };

  for (const mgr of managers ?? []) {
    void notifyDealWon(
      (refreshedLead ?? lead) as LeadRow,
      spLite,
      {
        id: mgr.id as string,
        name: mgr.name as string,
        phone: (mgr.phone as string | null) ?? null,
        email: (mgr.email as string | null) ?? null,
      },
      (clientRow?.twilio_whatsapp_override as string | null) ?? null,
      (clientRow?.name as string) ?? "Client",
      getManagerPrefs((mgr as { notification_prefs?: unknown }).notification_prefs)
    );
  }

  return {
    ok: true,
    deal,
    lead: (refreshedLead ?? lead) as LeadRow,
    contactId,
  };
}
