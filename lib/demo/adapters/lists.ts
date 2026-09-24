import type {
  CompanyCustomerDetail,
  CompanyCustomerProfileData,
  CompanyCustomerRow,
  CompanyCustomersPageData,
} from "@/components/dashboard/company/customers/types";
import type { CompanyLeadRow, CompanyLeadsPageData } from "@/components/dashboard/company/leads/types";
import type { CompanyPipelinePageData } from "@/components/dashboard/company/pipeline/types";
import type { CompanyQuotationRow, CompanyQuotationsPageData } from "@/components/dashboard/company/quotations/types";
import type { LeadDirectoryRow, LeadsDirectoryPayload } from "@/lib/sales/leads-directory/types";
import { formatLeadSource } from "@/lib/sales/leads-directory/format";
import { leadScoreBand, leadScoreLabel } from "@/lib/sales/format";
import {
  buildCompanyPipelineKpis,
  companyPipelineHealth,
  companyPipelineHealthLabel,
  companyPipelineHealthReason,
  companyPipelineValueLabel,
  countPipelineTabs,
  formatClosedDate,
  formatExpectedDecision,
  formatNextActionView,
  isCompanyPipelineAtRisk,
} from "@/lib/sales/company-pipeline-metrics";
import { getDealAttentionState, getDealCommercialValue } from "@/lib/sales/deals";
import { DEAL_STAGE_LABEL } from "@/lib/sales/deals/display";
import { formatDealValue } from "@/lib/sales/sales-dashboard-display";
import type { QuotesPayload } from "@/lib/sales/quotes/types";
import type { DemoDataset } from "@/lib/demo/types";
import { visibleLeads } from "@/lib/demo/mutations";
import { summariseDemo } from "@/lib/demo/totals";
import type { UserRole } from "@/types";

function owners(dataset: DemoDataset) {
  return Object.values(dataset.actors)
    .filter((actor) => actor.role === "SALESPERSON")
    .map((actor) => ({ id: actor.id, name: actor.name, avatarUrl: null }));
}

export function buildDemoCompanyPipeline(dataset: DemoDataset, actorUserId: string, role: UserRole): CompanyPipelinePageData {
  const summary = summariseDemo(dataset);
  const rows = dataset.deals.map((deal) => {
    const lead = dataset.leads.find((row) => row.id === deal.originating_lead_id);
    const owner = Object.values(dataset.actors).find((row) => row.id === deal.owner_id);
    const commercial = getDealCommercialValue(deal, { latestQuoteTotal: deal.estimated_value });
    const attention = getDealAttentionState(deal, new Date());
    const health = companyPipelineHealth(attention);
    const source = formatLeadSource(lead?.source);
    const closedAt = deal.won_at || deal.lost_at;
    return {
      id: deal.id,
      contactId: deal.contact_id,
      dealName: deal.name,
      category: deal.service_summary,
      customerName: lead?.name ?? "Customer",
      customerLocation: deal.location,
      customerPhone: lead?.phone ?? null,
      originatingLeadId: deal.originating_lead_id,
      stage: deal.stage,
      stageLabel: DEAL_STAGE_LABEL[deal.stage] ?? deal.stage,
      valueLabel: companyPipelineValueLabel(commercial),
      valueKnown: deal.estimated_value,
      valuePending: false,
      expectedDecisionAt: deal.expected_decision_at,
      expectedDecisionLabel: formatExpectedDecision(deal.expected_decision_at),
      nextAction: formatNextActionView(deal, new Date()),
      ownerId: deal.owner_id,
      ownerName: owner?.name ?? null,
      ownerAvatarUrl: null,
      health,
      healthLabel: companyPipelineHealthLabel(health),
      healthReason: companyPipelineHealthReason(health, attention.reason),
      atRisk: isCompanyPipelineAtRisk(attention),
      urgency: attention.urgency,
      sourceKey: source.key,
      sourceLabel: source.label,
      lostReason: deal.lost_reason,
      wonValue: deal.won_value,
      closedAt,
      closedAtLabel: formatClosedDate(closedAt),
      createdAt: deal.created_at,
      lastActivityAt: deal.last_meaningful_activity_at || deal.updated_at,
      canModify: role !== "SALESPERSON" || deal.owner_id === actorUserId,
    };
  });

  return {
    clientId: dataset.clientId,
    clientName: dataset.organisationName,
    currency: "USD",
    actorUserId,
    alsoSells: false,
    canReassign: role === "CLIENT_MANAGER" || role === "SUPER_ADMIN",
    canCreateDeal: role === "CLIENT_MANAGER" || role === "SUPER_ADMIN",
    kpis: buildCompanyPipelineKpis({
      pipelineKnown: summary.pipelineValue,
      awaitingEstimate: 0,
      activeDeals: summary.activeDeals,
      wonThisMonth: summary.wonCount,
      wonLastMonth: 3,
      avgDealValue: summary.activeDeals ? Math.round(summary.pipelineValue / summary.activeDeals) : null,
      avgLabel: formatDealValue(summary.activeDeals ? Math.round(summary.pipelineValue / summary.activeDeals) : 0),
      dealsAtRisk: rows.filter((row) => row.atRisk).length,
      nextActionsDue: rows.filter((row) => row.nextAction.isOverdue || row.nextAction.urgency === "today").length,
      currencyLabel: (n) => formatDealValue(n),
    }),
    rows,
    tabCounts: countPipelineTabs(rows),
    owners: owners(dataset),
    sources: [
      { key: "facebook", label: "Facebook" },
      { key: "whatsapp", label: "WhatsApp" },
      { key: "referral", label: "Referral" },
      { key: "website", label: "Website" },
      { key: "manual", label: "Walk-in" },
    ],
    eligibleLeads: dataset.leads
      .filter((lead) => lead.status === "QUALIFIED" || lead.status === "NEW" || lead.status === "CONTACTED")
      .slice(0, 8)
      .map((lead) => ({ id: lead.id, name: lead.name ?? "Lead", projectType: lead.project_type })),
    qualifiedLeadsHref: "/client/leads?status=QUALIFIED",
    dealWorkspaceBase: "/client/deals",
  };
}

export function buildDemoCompanyQuotations(dataset: DemoDataset, role: UserRole): CompanyQuotationsPageData {
  const rows: CompanyQuotationRow[] = dataset.quotations.map((quote) => {
    const deal = dataset.deals.find((row) => row.id === quote.deal_id);
    const owner = owners(dataset).find((row) => row.id === quote.prepared_by_id) ?? null;
    return {
      id: quote.id,
      clientId: quote.client_id,
      leadId: quote.lead_id,
      contactId: deal?.contact_id ?? null,
      dealId: quote.deal_id ?? null,
      quoteNumber: quote.quote_number,
      revisionNumber: quote.revision_number,
      title: quote.customer_name ?? quote.quote_number ?? "Quotation",
      customerName: quote.customer_name ?? "Customer",
      customerPhone: quote.customer_phone,
      customerEmail: quote.customer_email,
      dealName: deal?.name ?? null,
      dealStage: deal?.stage ?? null,
      dealValue: deal?.estimated_value ?? null,
      amount: quote.total,
      currency: quote.currency,
      status: quote.status,
      effectiveStatus: quote.status,
      owner: owner ? { id: owner.id, name: owner.name, avatarUrl: null } : null,
      preparedByName: quote.prepared_by_name,
      quoteDate: quote.created_at,
      validUntil: quote.valid_until,
      sentAt: quote.sent_at,
      viewedAt: quote.viewed_at,
      lastViewedAt: quote.viewed_at,
      viewCount: quote.viewed_at ? 1 : 0,
      createdAt: quote.created_at,
      updatedAt: quote.updated_at,
      publicToken: null,
      approvalStatus: "not_required",
      approvalNote: null,
      approvalReasons: [],
      approvalRequestedAt: null,
      approvedAt: null,
      approvedByName: null,
      discountPercent: null,
      discountExceedsAuthority: false,
      maxDiscountPercent: null,
      minMarginPercent: null,
      marginPercent: null,
      marginHealth: "unknown",
      costTotal: null,
      standardValue: quote.total,
      subtotal: quote.subtotal,
      taxAmount: quote.tax_amount,
      otherAmount: quote.other_amount,
      customerResponseType: null,
      customerResponseCategory: null,
      customerResponseMessage: null,
      acceptedTotal: null,
      declinedReason: null,
      parentQuotationId: null,
      previousVersion: null,
      selectedOptionLabel: null,
    };
  });
  const sent = rows.filter((row) => row.status === "sent" || row.status === "viewed").length;
  return {
    clientId: dataset.clientId,
    clientName: dataset.organisationName,
    currency: "USD",
    currencies: ["USD"],
    viewedTrackingEnabled: true,
    rows,
    counts: {
      all: rows.length,
      needs_attention: sent,
      pending_approval: 0,
      sent,
      accepted: rows.filter((row) => row.status === "accepted").length,
      declined: 0,
      expired: 0,
    },
    attention: {
      pendingApproval: 0,
      pendingApprovalValue: 0,
      needsAttention: sent,
      awaitingCustomer: sent,
      acceptedValue: 0,
      expiringSoon: 0,
    },
    totalValue: rows.reduce((sum, row) => sum + row.amount, 0),
    owners: owners(dataset),
    customers: rows.map((row) => ({ id: row.leadId, label: row.customerName })),
    deals: rows.filter((row) => row.dealId).map((row) => ({ id: row.dealId as string, label: row.dealName ?? row.quoteNumber ?? "Deal" })),
    hasTemplates: false,
    permissions: {
      alsoSells: false,
      canApprove: role === "CLIENT_MANAGER" || role === "SUPER_ADMIN",
      canSeeMargin: false,
      canSeeCost: false,
      canSeeMarginPercent: false,
      canManageSettings: role === "CLIENT_MANAGER" || role === "SUPER_ADMIN",
    },
    createCandidates: dataset.leads.slice(0, 8).map((lead) => ({
      id: lead.id,
      name: lead.name,
      phone: lead.phone,
      projectType: lead.project_type,
      clientId: dataset.clientId,
      status: lead.status,
    })),
  };
}

export function buildDemoCompanyLeads(dataset: DemoDataset, actorUserId: string, role: UserRole): CompanyLeadsPageData {
  const rows: CompanyLeadRow[] = dataset.leads.map((lead) => {
    const owner = Object.values(dataset.actors).find((actor) => actor.id === lead.assigned_to_id);
    const source = formatLeadSource(lead.source);
    const intent = leadScoreBand(lead.score);
    return {
      id: lead.id,
      identity: lead.name ?? "Lead",
      enquiryContext: lead.project_type,
      location: dataset.contacts.find((contact) => contact.id === lead.contact_id)?.location ?? null,
      sourceKey: source.key,
      sourceLabel: source.label,
      sourceRaw: lead.source,
      phone: lead.phone,
      email: lead.email,
      lifecycle: lead.status,
      lifecycleLabel: lead.status.replace(/_/g, " "),
      leadScore: lead.score,
      intent,
      intentLabel: leadScoreLabel(lead.score),
      ownerId: lead.assigned_to_id,
      ownerName: owner?.name ?? null,
      ownerAvatarUrl: null,
      createdAt: lead.created_at,
      createdLabel: "Recent",
      firstContactAt: lead.created_at,
      lastActivityAt: lead.updated_at,
      followUpAt: lead.follow_up_date,
      nextAction: {
        hasNextAction: Boolean(lead.follow_up_date),
        isOverdue: Boolean(lead.follow_up_date && Date.parse(lead.follow_up_date) < Date.now()),
        label: lead.follow_up_date ? "Follow up" : null,
        at: lead.follow_up_date,
        whenLabel: lead.follow_up_date ? "Scheduled" : null,
        urgency: lead.follow_up_date ? "today" : null,
        completable: true,
      },
      hasDeal: Boolean(lead.active_deal_id),
      activeDealId: lead.active_deal_id ?? null,
      contactId: lead.contact_id,
      customerWaiting: (lead.score ?? 0) >= 85,
      canModify: role !== "CLIENT_MANAGER",
    };
  });
  return {
    clientId: dataset.clientId,
    clientName: dataset.organisationName,
    businessType: "trades",
    actorUserId,
    alsoSells: false,
    canReassign: role === "CLIENT_MANAGER" || role === "SUPER_ADMIN",
    canAddLead: false,
    kpis: [
      { id: "enquiries", label: "Open leads", value: String(rows.filter((row) => !["WON", "LOST", "CONVERTED_TO_DEAL"].includes(row.lifecycle)).length), supporting: "Active enquiries", icon: "enquiries" },
      { id: "hot", label: "Hot", value: String(rows.filter((row) => row.intent === "hot").length), supporting: "Score 75+", icon: "conversion" },
    ],
    rows,
    tabCounts: {
      all: rows.length,
      new: rows.filter((row) => row.lifecycle === "NEW").length,
      hot: rows.filter((row) => row.intent === "hot").length,
      contacted: rows.filter((row) => row.lifecycle === "CONTACTED").length,
      qualified: rows.filter((row) => row.lifecycle === "QUALIFIED").length,
      not_qualified: 0,
    },
    owners: owners(dataset),
    sources: [
      { key: "facebook", label: "Facebook" },
      { key: "whatsapp", label: "WhatsApp" },
      { key: "referral", label: "Referral" },
      { key: "website", label: "Website" },
      { key: "manual", label: "Walk-in / phone" },
    ],
  };
}

export function buildDemoCustomers(dataset: DemoDataset): CompanyCustomersPageData {
  const rows: CompanyCustomerRow[] = dataset.contacts.map((contact) => {
    const related = dataset.deals.filter((deal) => deal.contact_id === contact.id);
    const active = related.filter((deal) => ["QUALIFIED", "SCOPING", "PROPOSAL_SENT", "NEGOTIATING"].includes(deal.stage));
    const won = related.filter((deal) => deal.stage === "WON");
    const owner = Object.values(dataset.actors).find((actor) => actor.id === contact.relationship_owner_id);
    const type = contact.customer_type === "company" ? "company" : "individual";
    return {
      id: contact.id,
      name: contact.name ?? "Customer",
      customerType: type,
      customerTypeLabel: type === "company" ? "Fleet" : "Motorist",
      industry: contact.industry,
      primaryContactName: contact.primary_contact_name,
      phone: contact.phone,
      email: contact.email,
      location: contact.location,
      source: contact.source,
      ownerId: contact.relationship_owner_id,
      ownerName: owner?.name ?? null,
      ownerAvatarUrl: null,
      customerSince: contact.created_at,
      customerSinceLabel: "This quarter",
      lastInteractionAt: contact.updated_at,
      lastInteractionLabel: "Recent",
      lastInteractionChannel: "WhatsApp",
      totalDeals: related.length,
      activeDeals: active.length,
      activePipelineKnown: active.reduce((sum, deal) => sum + (Number(deal.estimated_value) || 0), 0),
      activePipelineUnknownCount: 0,
      wonDeals: won.length,
      wonValueKnown: won.reduce((sum, deal) => sum + (Number(deal.won_value) || 0), 0),
      wonValueUnknownCount: 0,
      customerValueLabel: formatDealValue(won.reduce((sum, deal) => sum + (Number(deal.won_value) || 0), 0) || active.reduce((sum, deal) => sum + (Number(deal.estimated_value) || 0), 0)),
    };
  });
  return {
    clientId: dataset.clientId,
    clientName: dataset.organisationName,
    currency: "USD",
    canAddCustomer: false,
    kpis: [
      { id: "customers", label: "Customers", value: String(rows.length), supporting: "Demo book", icon: "customers" },
      { id: "companies", label: "Fleet clients", value: String(rows.filter((row) => row.customerType === "company").length), supporting: "Companies", icon: "companies" },
      { id: "individuals", label: "Motorists", value: String(rows.filter((row) => row.customerType === "individual").length), supporting: "Individuals", icon: "individuals" },
    ],
    rows,
    tabCounts: {
      all: rows.length,
      companies: rows.filter((row) => row.customerType === "company").length,
      individuals: rows.filter((row) => row.customerType === "individual").length,
      recent: Math.min(rows.length, 12),
    },
    owners: owners(dataset),
  };
}

export function buildDemoLeadsDirectory(dataset: DemoDataset, userId: string): LeadsDirectoryPayload {
  const leads = visibleLeads(dataset, userId, "SALESPERSON");
  const rows: LeadDirectoryRow[] = leads.map((lead) => {
    const source = formatLeadSource(lead.source);
    const contact = dataset.contacts.find((row) => row.id === lead.contact_id);
    return {
      id: lead.id,
      clientId: dataset.clientId,
      name: lead.name,
      phone: lead.phone,
      email: lead.email,
      projectType: lead.project_type,
      company: typeof lead.form_data.company === "string" ? lead.form_data.company : null,
      location: contact?.location ?? null,
      contextLine: lead.customer_need ?? lead.project_type,
      source: lead.source,
      sourceKey: source.key,
      sourceLabel: source.label,
      status: lead.status,
      score: lead.score,
      scoreBand: leadScoreBand(lead.score),
      scoreLabel: leadScoreLabel(lead.score),
      lastContactAt: lead.updated_at,
      followUpDate: lead.follow_up_date,
      createdAt: lead.created_at,
      updatedAt: lead.updated_at,
      isStale: Boolean(lead.is_stale),
      neverContacted: lead.status === "NEW",
      followUpOverdue: Boolean(lead.follow_up_date && Date.parse(lead.follow_up_date) < Date.now()),
      budget: lead.budget,
      formData: lead.form_data,
    };
  });
  return {
    meta: {
      period: "all",
      periodLabel: "All activity",
      source: "all",
      stage: "all",
      intent: "all",
      attention: "none",
      from: null,
      to: null,
      dateField: "created_at",
      conversionFormula: "Won / qualified",
      allTimeCount: rows.length,
      page: 1,
      pageSize: 50,
      totalFiltered: rows.length,
    },
    kpis: {
      total: { value: rows.length, trend: null },
      newInPeriod: { value: rows.filter((row) => row.status === "NEW").length, label: "New" },
      hot: { value: rows.filter((row) => row.scoreBand === "hot").length },
      won: { value: rows.filter((row) => row.status === "WON").length, trend: null },
      conversionRate: { value: null, trend: null, formula: "Won / qualified" },
    },
    leads: rows,
    bySource: { slices: [], total: rows.length },
    byStage: { slices: [], total: rows.length },
    hotLeads: rows.filter((row) => row.scoreBand === "hot").slice(0, 5),
  };
}

export function buildDemoQuotes(dataset: DemoDataset, userId: string): QuotesPayload {
  const mine = dataset.quotations.filter((quote) => quote.prepared_by_id === userId);
  const quotes = mine.map((quote) => {
    const lead = dataset.leads.find((row) => row.id === quote.lead_id);
    const source = formatLeadSource(lead?.source);
    return {
      id: quote.id,
      leadId: quote.lead_id,
      clientId: dataset.clientId,
      quoteNumber: quote.quote_number,
      revisionNumber: quote.revision_number,
      status: quote.status,
      effectiveStatus: quote.status,
      customerName: quote.customer_name,
      customerPhone: quote.customer_phone,
      customerEmail: quote.customer_email,
      customerSecondary: typeof lead?.form_data.vehicle === "string" ? lead.form_data.vehicle : null,
      projectType: lead?.project_type ?? null,
      total: quote.total,
      currency: quote.currency,
      sentAt: quote.sent_at,
      validUntil: quote.valid_until,
      viewedAt: quote.viewed_at,
      acceptedAt: quote.accepted_at,
      respondedAt: quote.responded_at,
      createdAt: quote.created_at,
      updatedAt: quote.updated_at,
      publicToken: null,
      preparedByName: quote.prepared_by_name,
      source: lead?.source ?? null,
      sourceKey: source.key,
      sourceLabel: source.label,
      needsFollowUp: quote.status === "sent",
      expiresSoon: false,
      isExpired: false,
    };
  });
  return {
    currency: "USD",
    meta: {
      period: "this_year",
      periodLabel: "All activity",
      source: "all",
      status: "all",
      from: "",
      to: "",
      dateField: "created_at",
      conversionFormula: "Accepted / sent",
      hasTemplates: false,
      allTimeCount: quotes.length,
    },
    kpis: {
      total: { value: quotes.length, trend: null },
      drafts: { value: quotes.filter((row) => row.status === "draft").length, pctOfTotal: null },
      pending: { value: quotes.filter((row) => row.status === "sent" || row.status === "viewed").length, pctOfTotal: null },
      expiringSoon: { value: 0 },
      accepted: { value: 0, trend: null },
      declined: { value: 0, trend: null },
      conversionRate: { value: null, trend: null, formula: "Accepted / sent" },
    },
    quotes,
    performance: { slices: [], total: quotes.length, emptyReason: quotes.length ? "none" : "no_data" },
    activity: [],
    createCandidates: visibleLeads(dataset, userId, "SALESPERSON").slice(0, 8).map((lead) => ({
      id: lead.id,
      name: lead.name,
      phone: lead.phone,
      projectType: lead.project_type,
      clientId: dataset.clientId,
      status: lead.status,
    })),
  };
}

function relativeLabel(iso: string | null, now = new Date()): string {
  if (!iso) return "No recent activity";
  const days = Math.round((now.getTime() - Date.parse(iso)) / 86_400_000);
  if (days <= 0) return "Today";
  if (days === 1) return "Yesterday";
  return `${days} days ago`;
}

export function buildDemoCustomerProfile(
  dataset: DemoDataset,
  customerId: string
): CompanyCustomerProfileData | null {
  const contact = dataset.contacts.find((row) => row.id === customerId);
  if (!contact) return null;
  const lead = dataset.leads.find((row) => row.contact_id === contact.id);
  const deals = dataset.deals.filter((row) => row.contact_id === contact.id);
  const owner = Object.values(dataset.actors).find((actor) => actor.id === (lead?.assigned_to_id ?? deals[0]?.owner_id));
  const active = deals.filter((row) => row.stage !== "WON" && row.stage !== "LOST");
  const won = deals.filter((row) => row.stage === "WON");
  const pipeline = active.reduce((sum, row) => sum + (row.estimated_value ?? 0), 0);
  const wonValue = won.reduce((sum, row) => sum + (row.won_value ?? 0), 0);
  const last =
    deals
      .map((row) => row.last_meaningful_activity_at)
      .filter((value): value is string => Boolean(value))
      .sort()
      .at(-1) ?? contact.updated_at;
  const vehicle = typeof lead?.form_data?.vehicle === "string" ? lead.form_data.vehicle : null;
  const customer: CompanyCustomerDetail = {
    id: contact.id,
    name: contact.name ?? "Customer",
    customerType: contact.customer_type === "company" ? "company" : "individual",
    customerTypeLabel: contact.customer_type === "company" ? "Company" : "Individual",
    industry: contact.industry,
    primaryContactName: contact.primary_contact_name,
    phone: contact.phone,
    email: contact.email,
    location: contact.location,
    source: lead?.source ?? null,
    ownerId: owner?.id ?? null,
    ownerName: owner?.name ?? null,
    ownerAvatarUrl: null,
    customerSince: contact.created_at,
    customerSinceLabel: relativeLabel(contact.created_at),
    lastInteractionAt: last,
    lastInteractionLabel: relativeLabel(last),
    lastInteractionChannel: lead?.source === "WHATSAPP_INBOUND" ? "WhatsApp" : "Sales Hub",
    totalDeals: deals.length,
    activeDeals: active.length,
    activePipelineKnown: pipeline,
    activePipelineUnknownCount: 0,
    wonDeals: won.length,
    wonValueKnown: wonValue,
    wonValueUnknownCount: 0,
    customerValueLabel: pipeline
      ? `$${pipeline.toLocaleString("en-US")}`
      : wonValue
        ? `$${wonValue.toLocaleString("en-US")}`
        : "Not recorded",
    telHref: null,
    mailtoHref: null,
    whatsappHref: null,
    canCall: false,
    canWhatsApp: false,
    canEmail: false,
    recentActivity: dataset.activities
      .filter((row) => row.leadId === lead?.id || deals.some((deal) => deal.id === row.dealId))
      .sort((a, b) => Date.parse(b.at) - Date.parse(a.at))
      .slice(0, 12)
      .map((row) => ({
        id: row.id,
        kind: row.kind === "quote" ? "quote" : row.kind === "whatsapp" ? "whatsapp" : row.kind === "call" ? "call" : "deal",
        title: row.title,
        detail: row.detail,
        createdAt: row.at,
        timeLabel: relativeLabel(row.at),
      })),
    viewDetailsHref: lead ? `/sales/inbox?lead=${lead.id}` : `/client/contacts/${contact.id}`,
    viewDealsHref: deals[0] ? `/client/deals/${deals[0].id}` : "/client/leads/pipeline",
  };
  return {
    customer,
    notes: vehicle
      ? `Vehicle: ${vehicle}. Demonstration customer history for the Rossi Tyres workspace.`
      : contact.notes,
    deals: deals.map((deal) => ({
      id: deal.id,
      name: deal.name,
      stage: deal.stage,
      stageLabel: DEAL_STAGE_LABEL[deal.stage] ?? deal.stage,
      valueLabel: getDealCommercialValue(deal, {
        latestQuoteTotal: dataset.quotations.find((quote) => quote.deal_id === deal.id)?.total ?? null,
      }).display,
      ownerName: Object.values(dataset.actors).find((actor) => actor.id === deal.owner_id)?.name ?? null,
      lastActivityLabel: relativeLabel(deal.last_meaningful_activity_at),
      href: `/client/deals/${deal.id}`,
    })),
  };
}
