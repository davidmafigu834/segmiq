import type { DealTimelineItem } from "@/lib/sales/deals/timeline";
import type { QuotationWorkspacePayload } from "@/lib/quotations/workspace-data";
import {
  getDealCommercialValue,
  getDealCompleteness,
  getDealNextActionState,
  latestQuoteTotal,
} from "@/lib/sales/deals";
import type { DealRow, LeadRow, QuotationRow } from "@/types";
import type { DemoDataset } from "@/lib/demo/types";

export function demoTimeline(dataset: DemoDataset, deal: DealRow): DealTimelineItem[] {
  return dataset.activities
    .filter((row) => row.dealId === deal.id || row.leadId === deal.originating_lead_id)
    .sort((a, b) => Date.parse(b.at) - Date.parse(a.at))
    .map((row) => ({
      id: row.id,
      at: row.at,
      label: row.title,
      detail: row.detail,
      eventType: row.kind.toUpperCase(),
      source: row.kind === "quote" ? "quote" : row.kind === "lead" ? "lead" : "deal",
    }));
}

export function demoQuotesForDeal(dataset: DemoDataset, deal: DealRow): QuotationRow[] {
  return dataset.quotations
    .filter((quote) => quote.deal_id === deal.id || quote.lead_id === deal.originating_lead_id)
    .sort((a, b) => Date.parse(b.updated_at) - Date.parse(a.updated_at));
}

export function demoDealPayload(dataset: DemoDataset, deal: DealRow) {
  const lead = dataset.leads.find((row) => row.id === deal.originating_lead_id) ?? null;
  const quotes = demoQuotesForDeal(dataset, deal);
  const quoteTotal = latestQuoteTotal(quotes);
  return {
    deal,
    lead: lead as LeadRow | null,
    quotes,
    commercial: getDealCommercialValue(deal, { latestQuoteTotal: quoteTotal }),
    completeness: getDealCompleteness(deal, { latestQuoteTotal: quoteTotal }),
    nextAction: getDealNextActionState(deal),
    timeline: demoTimeline(dataset, deal),
  };
}

export function demoQuotationWorkspace(
  dataset: DemoDataset,
  quotationId: string
): QuotationWorkspacePayload | null {
  const quote = dataset.quotations.find((row) => row.id === quotationId);
  if (!quote) return null;
  const items = dataset.lineItems.filter((row) => row.quotation_id === quote.id);
  const lead = dataset.leads.find((row) => row.id === quote.lead_id);
  const deal = quote.deal_id ? dataset.deals.find((row) => row.id === quote.deal_id) : null;
  const owner = Object.values(dataset.actors).find((actor) => actor.id === quote.prepared_by_id);
  return {
    quotation: { ...quote, items },
    customer: {
      name: lead?.name ?? quote.customer_name ?? "Customer",
      phone: lead?.phone ?? quote.customer_phone,
      email: lead?.email ?? null,
      hasWhatsApp: false,
      leadId: quote.lead_id,
      contactId: lead?.contact_id ?? null,
    },
    deal: deal
      ? {
          id: deal.id,
          title: deal.name,
          stage: deal.stage,
          value: deal.estimated_value,
          ownerId: deal.owner_id,
        }
      : null,
    companyName: dataset.organisationName,
    owner: { id: owner?.id ?? quote.prepared_by_id, name: owner?.name ?? quote.prepared_by_name ?? "Salesperson" },
    settings: null,
    policies: [],
    versions: [
      {
        id: quote.id,
        revision_number: quote.revision_number ?? 1,
        status: quote.status,
        total: quote.total ?? 0,
        currency: quote.currency ?? "USD",
        created_at: quote.created_at,
        prepared_by_name: quote.prepared_by_name,
        revision_note: null,
        sent_at: quote.sent_at,
      },
    ],
    events: [],
    permissions: {
      canEdit: quote.status === "draft",
      canSend: false,
      canApprove: false,
      canDecideApproval: false,
      canSeeMargin: false,
      canSeeCost: false,
      canSeeMarginPercent: false,
      canSeeMarginHealth: false,
      canDeleteDraft: false,
      canCustomItems: false,
      canEditCatalogPrice: false,
      canApplyDiscount: false,
      canCreatePackage: false,
      canCreateTemplate: false,
      canCopySecureLink: false,
      canRevokeSecureLink: false,
      awaitingApproverLabel: null,
    },
    marginVisibility: "none",
    commercialFlags: { productPickerV2: false },
  };
}
