import { createAdminClient } from "@/lib/supabase/admin";
import { asRow } from "@/lib/agent/rows";
import { DEAL_STAGE_LABEL } from "@/lib/sales/deals/display";
import type { SalesActor, SalesContextCard, SalesPageContext } from "./types";

export async function loadSalesContextCard(
  actor: SalesActor,
  page: SalesPageContext
): Promise<SalesContextCard> {
  const empty: SalesContextCard = {
    customerName: null,
    customerId: page.customerId ?? null,
    leadId: page.leadId ?? page.conversationId ?? null,
    projectType: null,
    dealId: page.dealId ?? null,
    dealName: null,
    dealStage: null,
    quotationId: page.quotationId ?? null,
    quotationNumber: null,
    quotationStatus: null,
    conversationId: page.conversationId ?? page.leadId ?? null,
    customerHref: null,
    dealHref: null,
  };

  const supabase = createAdminClient();
  const leadId = page.leadId ?? page.conversationId ?? null;

  if (leadId) {
    const { data } = await supabase
      .from("leads")
      .select("id, name, project_type, assigned_to_id, contact_id, active_deal_id, client_id")
      .eq("id", leadId)
      .eq("client_id", actor.clientId)
      .maybeSingle();
    const lead = asRow<{
      id: string;
      name: string | null;
      project_type: string | null;
      assigned_to_id: string | null;
      contact_id: string | null;
      active_deal_id: string | null;
    }>(data);
    if (lead) {
      if (lead.assigned_to_id && lead.assigned_to_id !== actor.userId && actor.role === "SALESPERSON") {
        return empty;
      }
      empty.leadId = lead.id;
      empty.customerName = lead.name;
      empty.projectType = lead.project_type;
      empty.customerId = lead.contact_id;
      empty.customerHref = `/sales/inbox?conversation=${lead.id}`;
      if (!empty.dealId) empty.dealId = lead.active_deal_id;
    }
  }

  if (empty.dealId) {
    const { data } = await supabase
      .from("deals")
      .select("id, name, stage, owner_id, originating_lead_id")
      .eq("id", empty.dealId)
      .eq("client_id", actor.clientId)
      .maybeSingle();
    const deal = asRow<{
      id: string;
      name: string | null;
      stage: string | null;
      owner_id: string | null;
      originating_lead_id: string | null;
    }>(data);
    if (deal) {
      if (deal.owner_id && deal.owner_id !== actor.userId && actor.role === "SALESPERSON") {
        empty.dealId = null;
      } else {
        empty.dealName = deal.name;
        empty.dealStage = deal.stage ? DEAL_STAGE_LABEL[deal.stage as keyof typeof DEAL_STAGE_LABEL] ?? deal.stage : null;
        empty.dealHref = `/sales/deals/${deal.id}`;
        if (!empty.leadId) empty.leadId = deal.originating_lead_id;
      }
    }
  }

  if (empty.quotationId) {
    const { data } = await supabase
      .from("quotations")
      .select("id, quote_number, status, lead_id, deal_id")
      .eq("id", empty.quotationId)
      .eq("client_id", actor.clientId)
      .maybeSingle();
    const q = asRow<{
      id: string;
      quote_number: string | null;
      status: string | null;
      lead_id: string | null;
      deal_id: string | null;
    }>(data);
    if (q) {
      empty.quotationNumber = q.quote_number;
      empty.quotationStatus = q.status;
      if (!empty.leadId) empty.leadId = q.lead_id;
      if (!empty.dealId) empty.dealId = q.deal_id;
    }
  }

  return empty;
}

export async function companyHasPackages(clientId: string): Promise<boolean> {
  const supabase = createAdminClient();
  const { count } = await supabase
    .from("commercial_packages")
    .select("id", { count: "exact", head: true })
    .eq("client_id", clientId)
    .eq("status", "ACTIVE")
    .eq("can_be_quoted", true);
  return (count ?? 0) > 0;
}

export async function samplePackageName(clientId: string): Promise<string | null> {
  const supabase = createAdminClient();
  const { data } = await supabase
    .from("commercial_packages")
    .select("name")
    .eq("client_id", clientId)
    .eq("status", "ACTIVE")
    .eq("can_be_quoted", true)
    .order("name")
    .limit(1)
    .maybeSingle();
  return (data?.name as string | null) ?? null;
}
