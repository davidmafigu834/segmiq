import { createAdminClient } from "@/lib/supabase/admin";
import { createDealFromLead } from "@/lib/sales/deals/create-deal";
import { updateDealStage } from "@/lib/sales/deals/close-deal";
import { logStatusChanged } from "@/lib/lead-events";
import { locationFromDealOrLead } from "@/lib/sales/company-pipeline-metrics";
import { formatLeadSource } from "@/lib/sales/leads-directory/format";
import {
  emptySolarAssessment,
  parseSolarAssessment,
  solarAssessmentCompletionError,
  solarLoadSummary,
  solarOutcomeLabel,
  type SolarAssessmentData,
} from "@/lib/work-projects/field-rules";
import { planWonProjectHandoff, rejectCrossTenant } from "./handoff";
import { SOLAR_SALES_STAGE_LABEL } from "./labels";
import { solarSalesReport, solarQuestionStages, type SolarSalesQuestion } from "./reporting";
import { getSolarSalesStage, quoteAccepted, quoteLayer, visitCompleted } from "./derive";
import {
  assessmentOutcomeLine,
  essentialLoadLine,
  quotationDisplayStatus,
  resolveSolarActiveDeal,
  selectRelevantQuotation,
  solarAssessmentInProgress,
  solarAssessmentSectionsDone,
  solarInsight,
  solarMissingFacts,
  solarOpportunityAction,
  solarPanelProgress,
  solarPowerLines,
  solarRoofLine,
  SOLAR_ASSESSMENT_SECTION_TOTAL,
} from "./opportunity";
import { solarPrimaryAction, transitionSolarSalesStage } from "./transitions";
import { workProjectStatusLabel } from "@/lib/work-projects/constants";
import {
  isSalesWorkflowPreset,
  type SalesCommercialIntent,
  type SalesWorkflowPreset,
  type SolarQuoteFact,
  type SolarSalesFacts,
  type SolarSalesStage,
  type SolarVisitFact,
} from "./types";

export type SolarActor = {
  userId: string;
  role: string;
  clientId: string;
  name?: string | null;
};

export type SolarPipelineCard = {
  leadId: string;
  dealId: string | null;
  contactId: string | null;
  stage: SolarSalesStage;
  stageLabel: string;
  customerName: string;
  service: string | null;
  location: string | null;
  sourceKey: string | null;
  sourceLabel: string | null;
  ownerId: string | null;
  ownerName: string | null;
  updatedAt: string;
  createdAt: string;
  value: number | null;
  currency: string;
  nextAction: string;
  quoteAccepted: boolean;
  visit: {
    id: string;
    status: string;
    scheduledStartAt: string | null;
    assigneeName: string | null;
  } | null;
  assessment: {
    completedAt: string | null;
    outcome: string | null;
    loads: string | null;
  } | null;
  quote: {
    id: string;
    number: string | null;
    total: number | null;
    currency: string;
    status: string;
    sentAt: string | null;
    viewed: boolean;
  } | null;
};

type LeadRow = {
  id: string;
  client_id: string;
  name: string | null;
  phone: string | null;
  status: string;
  source: string | null;
  project_type: string | null;
  form_data: Record<string, unknown> | null;
  assigned_to_id: string | null;
  contact_id: string | null;
  created_at: string;
  updated_at: string;
  active_deal_id?: string | null;
  budget?: string | null;
  timeline?: string | null;
  buying_timeframe?: string | null;
  customer_need?: string | null;
  follow_up_date?: string | null;
};

type DealLite = {
  id: string;
  client_id: string;
  originating_lead_id: string;
  contact_id: string | null;
  owner_id: string | null;
  stage: string;
  name: string | null;
  service_summary: string | null;
  location: string | null;
  estimated_value: number | null;
  won_value: number | null;
  sales_commercial_intent: string | null;
  updated_at: string;
  currency?: string | null;
  next_action_at?: string | null;
};

function fail(status: number, error: string) {
  return { ok: false as const, status, error };
}

function manager(actor: SolarActor) {
  return actor.role === "CLIENT_MANAGER" || actor.role === "SUPER_ADMIN";
}

export async function readSalesWorkflowPreset(clientId: string): Promise<SalesWorkflowPreset> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("clients")
    .select("sales_workflow_preset")
    .eq("id", clientId)
    .maybeSingle();
  if (error || !data) return "GENERAL_TRADES";
  const value = (data as { sales_workflow_preset?: string | null }).sales_workflow_preset;
  return isSalesWorkflowPreset(value) ? value : "GENERAL_TRADES";
}

export async function setSalesWorkflowPreset(actor: SolarActor, preset: SalesWorkflowPreset) {
  if (!manager(actor)) return fail(403, "Only a manager can change the sales workflow.");
  if (!isSalesWorkflowPreset(preset)) return fail(400, "Choose General Trades or Solar Installation.");
  const supabase = createAdminClient();
  const { error } = await supabase
    .from("clients")
    .update({ sales_workflow_preset: preset })
    .eq("id", actor.clientId);
  if (error) return fail(500, "Could not save the sales workflow.");
  return { ok: true as const, preset };
}

async function actorName(actor: SolarActor) {
  if (actor.name) return actor.name;
  const supabase = createAdminClient();
  const { data } = await supabase.from("users").select("name").eq("id", actor.userId).maybeSingle();
  return (data?.name as string | null) ?? "Team member";
}

async function loadLead(actor: SolarActor, leadId: string): Promise<LeadRow | null> {
  const supabase = createAdminClient();
  const { data } = await supabase
    .from("leads")
    .select("id, client_id, name, phone, status, source, project_type, form_data, assigned_to_id, contact_id, created_at, updated_at, active_deal_id, budget, timeline, buying_timeframe, customer_need, follow_up_date")
    .eq("id", leadId)
    .eq("client_id", actor.clientId)
    .maybeSingle();
  const row = data as LeadRow | null;
  if (!row || rejectCrossTenant(actor.clientId, row.client_id)) return null;
  return row;
}

function canTouchLead(actor: SolarActor, lead: LeadRow, deal: DealLite | null) {
  if (manager(actor)) return true;
  if (lead.assigned_to_id === actor.userId) return true;
  if (deal?.owner_id === actor.userId) return true;
  return false;
}

async function loadLeadDeals(clientId: string, leadId: string): Promise<DealLite[]> {
  const supabase = createAdminClient();
  const { data } = await supabase
    .from("deals")
    .select("id, client_id, originating_lead_id, contact_id, owner_id, stage, name, service_summary, location, estimated_value, won_value, sales_commercial_intent, updated_at, next_action_at")
    .eq("client_id", clientId)
    .eq("originating_lead_id", leadId)
    .order("updated_at", { ascending: false });
  return ((data ?? []) as DealLite[]).filter((row) => !rejectCrossTenant(clientId, row.client_id));
}

function intentOf(value: string | null | undefined): SalesCommercialIntent | null {
  return value === "SITE_VISIT_REQUIRED" || value === "NEGOTIATING" ? value : null;
}

type QuoteRow = {
  id: string;
  lead_id: string | null;
  deal_id: string | null;
  client_id?: string;
  quote_number: string | null;
  status: string;
  approval_status: string | null;
  sent_at: string | null;
  total: number | null;
  currency: string | null;
  viewed_at: string | null;
  view_count: number | null;
  accepted_at?: string | null;
  created_at?: string | null;
};

function quoteFact(row: QuoteRow): SolarQuoteFact {
  return {
    id: row.id,
    status: row.status,
    approvalStatus: row.approval_status,
    sentAt: row.sent_at,
    number: row.quote_number,
    total: row.total,
    currency: row.currency,
    viewedAt: row.viewed_at,
    viewCount: row.view_count,
    acceptedAt: row.accepted_at ?? null,
    createdAt: row.created_at ?? null,
  };
}

function factsFrom(input: {
  preset: SalesWorkflowPreset;
  lead: LeadRow | null;
  deal: DealLite | null;
  visits: SolarVisitFact[];
  quotes: SolarQuoteFact[];
}): SolarSalesFacts {
  return {
    preset: input.preset,
    leadStatus: input.lead?.status ?? null,
    dealStage: input.deal?.stage ?? null,
    salesCommercialIntent: intentOf(input.deal?.sales_commercial_intent),
    visits: input.visits,
    quotes: input.quotes,
  };
}

export async function loadSolarSalesBoard(
  actor: SolarActor,
  filters?: {
    ownerId?: string | null;
    stage?: string | null;
    source?: string | null;
    from?: string | null;
    to?: string | null;
    valueMin?: number | null;
    valueMax?: number | null;
    mine?: boolean;
  }
) {
  const preset = await readSalesWorkflowPreset(actor.clientId);
  if (preset !== "SOLAR_INSTALLATION") {
    return {
      ok: true as const,
      data: {
        preset,
        cards: [] as SolarPipelineCard[],
        report: solarSalesReport([]),
        staff: [] as Array<{ id: string; name: string | null }>,
      },
    };
  }
  const supabase = createAdminClient();
  const [{ data: leads }, { data: deals }, { data: visits }, { data: quotes }, { data: users }] = await Promise.all([
    supabase
      .from("leads")
      .select("id, client_id, name, phone, status, source, project_type, form_data, assigned_to_id, contact_id, created_at, updated_at, active_deal_id")
      .eq("client_id", actor.clientId)
      .in("status", ["NEW", "CONTACTED", "QUALIFIED", "CONVERTED_TO_DEAL"])
      .order("updated_at", { ascending: false })
      .limit(500),
    supabase
      .from("deals")
      .select("id, client_id, originating_lead_id, contact_id, owner_id, stage, name, service_summary, location, estimated_value, won_value, sales_commercial_intent, updated_at")
      .eq("client_id", actor.clientId)
      .order("updated_at", { ascending: false })
      .limit(500),
    supabase
      .from("sales_site_visits")
      .select("id, client_id, lead_id, deal_id, status, scheduled_start_at, assigned_to_id, site_city, updated_at")
      .eq("client_id", actor.clientId)
      .order("updated_at", { ascending: false })
      .limit(500),
    supabase
      .from("quotations")
      .select("id, client_id, lead_id, deal_id, quote_number, status, approval_status, sent_at, total, currency, viewed_at, view_count, created_at")
      .eq("client_id", actor.clientId)
      .order("created_at", { ascending: false })
      .limit(500),
    supabase.from("users").select("id, name").eq("client_id", actor.clientId).eq("is_active", true),
  ]);

  const visitRows = (visits ?? []) as Array<{
    id: string;
    client_id: string;
    lead_id: string | null;
    deal_id: string | null;
    status: string;
    scheduled_start_at: string | null;
    assigned_to_id: string | null;
    site_city: string | null;
  }>;
  const visitIds = visitRows.map((row) => row.id);
  const { data: assessments } = visitIds.length
    ? await supabase
        .from("sales_site_visit_assessments")
        .select("visit_id, status, data, completed_at")
        .eq("client_id", actor.clientId)
        .in("visit_id", visitIds)
    : { data: [] };
  const assessmentByVisit = new Map(
    ((assessments ?? []) as Array<{ visit_id: string; status: string; data: unknown; completed_at: string | null }>).map((row) => [row.visit_id, row])
  );
  const names = new Map(((users ?? []) as Array<{ id: string; name: string | null }>).map((user) => [user.id, user.name]));
  const leadRows = (leads ?? []) as LeadRow[];
  const dealRows = ((deals ?? []) as DealLite[]).filter((row) => !rejectCrossTenant(actor.clientId, row.client_id));
  const dealsByLead = new Map<string, DealLite[]>();
  for (const deal of dealRows) {
    const list = dealsByLead.get(deal.originating_lead_id) ?? [];
    list.push(deal);
    dealsByLead.set(deal.originating_lead_id, list);
  }
  const quoteRows = ((quotes ?? []) as QuoteRow[]).map((row) => ({ ...quoteFact(row), lead_id: row.lead_id, deal_id: row.deal_id }));

  const cards: SolarPipelineCard[] = [];
  for (const lead of leadRows) {
    if (rejectCrossTenant(actor.clientId, lead.client_id)) continue;
    const related = dealsByLead.get(lead.id) ?? [];
    const deal = resolveSolarActiveDeal(related, lead.active_deal_id ?? null);
    if (filters?.mine && !manager(actor) && lead.assigned_to_id !== actor.userId && deal?.owner_id !== actor.userId) continue;
    if (!filters?.mine && !manager(actor) && lead.assigned_to_id !== actor.userId && deal?.owner_id !== actor.userId) continue;
    const leadVisits = visitRows.filter((row) => row.lead_id === lead.id || (deal && row.deal_id === deal.id));
    const visitFacts: SolarVisitFact[] = leadVisits.map((row) => ({
      id: row.id,
      status: row.status,
      scheduledStartAt: row.scheduled_start_at,
      assessmentStatus: (assessmentByVisit.get(row.id)?.status as "DRAFT" | "COMPLETED" | undefined) ?? null,
      completedAt: assessmentByVisit.get(row.id)?.completed_at ?? null,
    }));
    const leadQuotes = quoteRows.filter((row) => row.lead_id === lead.id || (deal && row.deal_id === deal.id));
    const stage = getSolarSalesStage(factsFrom({ preset, lead, deal, visits: visitFacts, quotes: leadQuotes }));
    if (!stage) continue;
    const completedVisit = leadVisits.find(
      (row) => row.status === "COMPLETED" && assessmentByVisit.get(row.id)?.status === "COMPLETED"
    );
    const latestVisit = completedVisit ?? leadVisits.find((row) => row.status !== "CANCELLED") ?? null;
    const assessment = latestVisit ? assessmentByVisit.get(latestVisit.id) : undefined;
    const parsed = assessment ? parseSolarAssessment(assessment.data) : null;
    const quote = leadQuotes.find((row) => row.status !== "superseded") ?? null;
    const source = formatLeadSource(lead.source);
    const value = quote?.total ?? (deal?.stage === "WON" ? deal.won_value : deal?.estimated_value) ?? null;
    cards.push({
      leadId: lead.id,
      dealId: deal?.id ?? null,
      contactId: deal?.contact_id ?? lead.contact_id,
      stage,
      stageLabel: SOLAR_SALES_STAGE_LABEL[stage],
      customerName: lead.name?.trim() || "Customer",
      service: lead.project_type || deal?.service_summary || null,
      location: locationFromDealOrLead(deal?.location, lead.form_data) || latestVisit?.site_city || null,
      sourceKey: source.key,
      sourceLabel: source.label,
      ownerId: deal?.owner_id ?? lead.assigned_to_id,
      ownerName: names.get(deal?.owner_id ?? lead.assigned_to_id ?? "") ?? null,
      updatedAt: deal?.updated_at ?? lead.updated_at,
      createdAt: lead.created_at,
      value: value == null ? null : Number(value),
      currency: quote?.currency || "USD",
      nextAction: solarPrimaryAction(factsFrom({ preset, lead, deal, visits: visitFacts, quotes: leadQuotes })),
      quoteAccepted: quoteAccepted(leadQuotes),
      visit: latestVisit
        ? {
            id: latestVisit.id,
            status: latestVisit.status,
            scheduledStartAt: latestVisit.scheduled_start_at,
            assigneeName: names.get(latestVisit.assigned_to_id ?? "") ?? null,
          }
        : null,
      assessment:
        assessment?.status === "COMPLETED" && parsed?.ok
          ? {
              completedAt: assessment.completed_at,
              outcome: solarOutcomeLabel(parsed.data.outcome),
              loads: solarLoadSummary(parsed.data),
            }
          : null,
      quote: quote
        ? {
            id: quote.id || "",
            number: quote.number ?? null,
            total: quote.total ?? null,
            currency: quote.currency || "USD",
            status: quote.status,
            sentAt: quote.sentAt ?? null,
            viewed: Boolean(quote.viewedAt) || (quote.viewCount ?? 0) > 0 || quote.status === "viewed",
          }
        : null,
    });
  }

  const filtered = cards.filter((card) => {
    if (filters?.ownerId && card.ownerId !== filters.ownerId) return false;
    if (filters?.stage && card.stage !== filters.stage) return false;
    if (filters?.source && card.sourceKey !== filters.source) return false;
    if (filters?.from && Date.parse(card.createdAt) < Date.parse(filters.from)) return false;
    if (filters?.to && Date.parse(card.createdAt) > Date.parse(filters.to)) return false;
    if (filters?.valueMin != null && (card.value ?? 0) < filters.valueMin) return false;
    if (filters?.valueMax != null && (card.value ?? 0) > filters.valueMax) return false;
    return true;
  });

  const report = solarSalesReport(
    filtered.map((card) => ({
      stage: card.stage,
      visitCompleted: Boolean(card.assessment?.completedAt),
      quotePrepared: quoteLayer(card.quote ? [{ status: card.quote.status, sentAt: card.quote.sentAt }] : []) !== "NONE",
      quoteSent: Boolean(card.quote?.sentAt) || ["sent", "viewed", "accepted", "rejected", "expired"].includes(card.quote?.status ?? ""),
    }))
  );

  return {
    ok: true as const,
    data: {
      preset,
      cards: filtered,
      report,
      staff: ((users ?? []) as Array<{ id: string; name: string | null }>).map((user) => ({ id: user.id, name: user.name })),
    },
  };
}

const VISIT_STATUS_LABEL: Record<string, string> = {
  SCHEDULED: "Scheduled",
  ON_SITE: "On site",
  RESCHEDULED: "Rescheduled",
  COMPLETED: "Completed",
  CANCELLED: "Cancelled",
  NO_ACCESS: "No access",
};

export async function solarLeadSnapshot(actor: SolarActor, leadId: string) {
  const loaded = await bundle(actor, leadId);
  if (!loaded.ok) {
    if (loaded.status === 403 || loaded.status === 404) return { ok: true as const, data: null };
    return loaded;
  }
  if (loaded.data.preset !== "SOLAR_INSTALLATION") return { ok: true as const, data: null };
  const stage = getSolarSalesStage(loaded.data.facts);
  if (!stage) return { ok: true as const, data: null };

  const { lead, deal, deals, visitRows, assessmentByVisit, facts } = loaded.data;
  const relevantQuote = selectRelevantQuotation(loaded.data.quoteRows.map(quoteFact));
  const openVisit =
    visitRows.find((row) => row.status === "SCHEDULED" || row.status === "ON_SITE" || row.status === "RESCHEDULED") ?? null;
  const completedVisit =
    visitRows.find((row) => row.status === "COMPLETED" && assessmentByVisit.get(row.id)?.status === "COMPLETED") ?? null;
  const focusVisit = completedVisit ?? openVisit ?? visitRows.find((row) => row.status !== "CANCELLED") ?? null;
  const assessmentRow = focusVisit ? assessmentByVisit.get(focusVisit.id) : undefined;
  const parsed = assessmentRow ? parseSolarAssessment(assessmentRow.data) : null;
  const assessmentData = parsed?.ok ? parsed.data : null;
  const inProgress = assessmentRow?.status === "DRAFT" && assessmentData ? solarAssessmentInProgress(assessmentData) : false;
  const assessmentComplete = assessmentRow?.status === "COMPLETED" && Boolean(assessmentData);

  const supabase = createAdminClient();
  const contactId = deal?.contact_id ?? lead.contact_id;
  const assigneeIds = [focusVisit?.assigned_to_id, deal?.owner_id, lead.assigned_to_id].filter((id): id is string => Boolean(id));
  const [{ data: projectRows }, { data: completedProjects }, { data: assets }, { data: people }] = await Promise.all([
    deal
      ? supabase
          .from("work_projects")
          .select("id, project_number, status")
          .eq("client_id", actor.clientId)
          .eq("deal_id", deal.id)
          .order("created_at", { ascending: false })
          .limit(1)
      : Promise.resolve({ data: [] }),
    contactId
      ? supabase
          .from("work_projects")
          .select("id")
          .eq("client_id", actor.clientId)
          .eq("contact_id", contactId)
          .eq("status", "COMPLETED")
          .limit(1)
      : Promise.resolve({ data: [] }),
    contactId
      ? supabase
          .from("customer_installed_assets")
          .select("id, name, asset_type, quantity, installed_at, status, work_project_id")
          .eq("client_id", actor.clientId)
          .eq("contact_id", contactId)
          .eq("status", "ACTIVE")
          .limit(24)
      : Promise.resolve({ data: [] }),
    assigneeIds.length
      ? supabase.from("users").select("id, name").eq("client_id", actor.clientId).in("id", assigneeIds)
      : Promise.resolve({ data: [] }),
  ]);

  const names = new Map(((people ?? []) as Array<{ id: string; name: string | null }>).map((person) => [person.id, person.name]));
  const project = ((projectRows ?? []) as Array<{ id: string; project_number: string; status: string }>)[0] ?? null;
  const action = solarOpportunityAction(facts, { assessmentInProgress: inProgress, projectId: project?.id ?? null });
  const quoteStatus = relevantQuote ? quotationDisplayStatus(relevantQuote) : null;
  const location =
    (assessmentComplete ? assessmentData?.site.address : null) ||
    deal?.location ||
    locationFromDealOrLead(null, lead.form_data) ||
    null;
  const activeAssets = ((assets ?? []) as Array<{
    name: string;
    asset_type: string;
    quantity: number;
    installed_at: string | null;
    work_project_id: string | null;
  }>).filter((asset) => asset.name);
  const system = activeAssets.find((asset) => asset.asset_type === "SYSTEM") ?? null;
  const parts = activeAssets.filter((asset) => asset.asset_type !== "SYSTEM");
  const installedAt = system?.installed_at ?? parts.find((part) => part.installed_at)?.installed_at ?? null;
  const openDeals = deals.filter((row) => row.stage !== "WON" && row.stage !== "LOST");
  const source = formatLeadSource(lead.source);
  const visitId = openVisit?.id ?? completedVisit?.id ?? focusVisit?.id ?? null;

  return {
    ok: true as const,
    data: {
      stage,
      stageLabel: SOLAR_SALES_STAGE_LABEL[stage],
      nextAction: action.label,
      nextActionKind: action.kind,
      insight: solarInsight({ stage, quoteStatus, projectId: project?.id ?? null }),
      progress: solarPanelProgress(stage),
      handoff: stage === "WON" && Boolean(project),
      customer: {
        name: lead.name?.trim() || "Customer",
        phone: lead.phone,
        sourceLabel: source.label,
        ownerName: names.get(deal?.owner_id ?? lead.assigned_to_id ?? "") ?? null,
        kind: activeAssets.length > 0 || (completedProjects ?? []).length > 0 ? ("existing" as const) : ("new" as const),
      },
      dealId: deal?.id ?? null,
      dealName: deal?.name ?? null,
      wonValue: deal?.stage === "WON" ? deal.won_value : null,
      currency: relevantQuote?.currency || "USD",
      opportunities: openDeals.map((row) => ({
        id: row.id,
        name: row.name?.trim() || "Opportunity",
      })),
      requirement: {
        service:
          (assessmentComplete ? assessmentData?.site.propertyType : null) ||
          lead.project_type ||
          deal?.service_summary ||
          lead.customer_need ||
          null,
        location,
        loads: assessmentComplete && assessmentData ? essentialLoadLine(assessmentData) : null,
        timeline: lead.buying_timeframe || lead.timeline || null,
        budget: lead.budget || null,
      },
      missing: solarMissingFacts({
        stage,
        location,
        budget: lead.budget ?? null,
        timeline: lead.buying_timeframe || lead.timeline || null,
        assessment: assessmentData,
        assessmentComplete,
      }),
      visit: focusVisit
        ? {
            id: focusVisit.id,
            status: focusVisit.status,
            statusLabel: VISIT_STATUS_LABEL[focusVisit.status] ?? focusVisit.status,
            scheduledAt: focusVisit.scheduled_start_at,
            assigneeName: names.get(focusVisit.assigned_to_id ?? "") ?? null,
            site: focusVisit.site_address?.trim() || focusVisit.site_city?.trim() || null,
          }
        : null,
      assessment: {
        status: assessmentComplete ? ("COMPLETED" as const) : assessmentRow?.status === "DRAFT" ? ("DRAFT" as const) : ("NONE" as const),
        inProgress,
        sectionsDone: assessmentData ? solarAssessmentSectionsDone(assessmentData) : 0,
        sectionsTotal: SOLAR_ASSESSMENT_SECTION_TOTAL,
        completedAt: assessmentComplete ? assessmentRow?.completed_at ?? null : null,
        outcome: assessmentComplete && assessmentData ? assessmentOutcomeLine(assessmentData) : null,
        power: assessmentComplete && assessmentData ? solarPowerLines(assessmentData) : [],
        loads: assessmentComplete && assessmentData ? essentialLoadLine(assessmentData) : null,
        roof: assessmentComplete && assessmentData ? solarRoofLine(assessmentData) : null,
        visitId: focusVisit?.id ?? null,
      },
      quotation: relevantQuote?.id
        ? {
            id: relevantQuote.id,
            number: relevantQuote.number ?? null,
            status: relevantQuote.status,
            statusLabel: quoteStatus,
            total: relevantQuote.total ?? null,
            currency: relevantQuote.currency || "USD",
            sentAt: relevantQuote.sentAt ?? null,
            viewedAt: relevantQuote.viewedAt ?? null,
            acceptedAt: relevantQuote.acceptedAt ?? null,
          }
        : null,
      project: project
        ? {
            id: project.id,
            number: project.project_number,
            status: project.status,
            statusLabel: workProjectStatusLabel(project.status),
          }
        : null,
      installedSystem: activeAssets.length
        ? {
            headline: system?.name ?? "Installed system",
            lines: parts.map((part) => {
              const quantity = Number(part.quantity);
              return quantity > 1 ? `${quantity} × ${part.name}` : part.name;
            }),
            installedLabel:
              installedAt && !Number.isNaN(new Date(installedAt).getTime())
                ? String(new Date(installedAt).getFullYear())
                : null,
            projectId: system?.work_project_id ?? parts.find((part) => part.work_project_id)?.work_project_id ?? null,
          }
        : null,
      // One reminder. A deal uses next_action_at; a lead without a deal uses follow_up_date.
      // Scheduling this does not change the solar stage. See solarFollowUpWrite().
      reminderAt: deal?.next_action_at || lead.follow_up_date || null,
      quoteAccepted: quoteAccepted(facts.quotes),
      visitId,
      projectId: project?.id ?? null,
      proposalNotes: assessmentComplete && assessmentData
        ? [assessmentOutcomeLine(assessmentData), essentialLoadLine(assessmentData), solarRoofLine(assessmentData), solarPowerLines(assessmentData).join(", "), assessmentData.site.address]
            .filter((line): line is string => Boolean(line && line.trim()))
            .join("\n")
        : null,
    },
  };
}

export async function focusSolarOpportunity(actor: SolarActor, leadId: string, dealId: string) {
  const loaded = await bundle(actor, leadId);
  if (!loaded.ok) return loaded;
  if (loaded.data.preset !== "SOLAR_INSTALLATION") return fail(409, "This company uses the general trades sales workflow.");
  const deal = loaded.data.deals.find((row) => row.id === dealId);
  if (!deal || deal.originating_lead_id !== leadId || rejectCrossTenant(actor.clientId, deal.client_id)) {
    return fail(404, "That opportunity is not on this lead.");
  }
  if (deal.stage === "WON" || deal.stage === "LOST") return fail(409, "Choose an open opportunity.");
  const supabase = createAdminClient();
  const { error } = await supabase
    .from("leads")
    .update({ active_deal_id: dealId, updated_at: new Date().toISOString() })
    .eq("id", leadId)
    .eq("client_id", actor.clientId);
  if (error) return fail(500, "Could not switch opportunity.");
  return { ok: true as const, dealId };
}

export async function answerSolarSalesQuestion(actor: SolarActor, question: SolarSalesQuestion) {
  const board = await loadSolarSalesBoard(actor, { mine: !manager(actor) });
  const stages = new Set(solarQuestionStages(question));
  const cards = board.data.cards.filter((card) => stages.has(card.stage));
  return { ok: true as const, data: { preset: board.data.preset, cards, report: board.data.report } };
}

type VisitBundleRow = {
  id: string;
  status: string;
  scheduled_start_at: string | null;
  assigned_to_id: string | null;
  site_address: string | null;
  site_city: string | null;
};

type AssessmentBundleRow = {
  visit_id: string;
  status: string;
  completed_at: string | null;
  data: unknown;
};

async function bundle(actor: SolarActor, leadId: string) {
  const preset = await readSalesWorkflowPreset(actor.clientId);
  const lead = await loadLead(actor, leadId);
  if (!lead) return fail(404, "Lead not found.");
  const deals = await loadLeadDeals(actor.clientId, leadId);
  const deal = resolveSolarActiveDeal(deals, lead.active_deal_id ?? null);
  if (!canTouchLead(actor, lead, deal)) return fail(403, "You cannot update this lead.");
  const supabase = createAdminClient();
  const [{ data: visits }, { data: quotes }] = await Promise.all([
    supabase
      .from("sales_site_visits")
      .select("id, status, scheduled_start_at, assigned_to_id, site_address, site_city")
      .eq("client_id", actor.clientId)
      .or(`lead_id.eq.${leadId}${deal ? `,deal_id.eq.${deal.id}` : ""}`),
    supabase
      .from("quotations")
      .select("id, status, approval_status, sent_at, quote_number, total, currency, viewed_at, view_count, accepted_at, created_at")
      .eq("client_id", actor.clientId)
      .or(`lead_id.eq.${leadId}${deal ? `,deal_id.eq.${deal.id}` : ""}`),
  ]);
  const visitRows = (visits ?? []) as VisitBundleRow[];
  const visitIds = visitRows.map((row) => row.id);
  const { data: assessments } = visitIds.length
    ? await supabase
        .from("sales_site_visit_assessments")
        .select("visit_id, status, completed_at, data")
        .eq("client_id", actor.clientId)
        .in("visit_id", visitIds)
    : { data: [] };
  const assessmentByVisit = new Map(
    ((assessments ?? []) as AssessmentBundleRow[]).map((row) => [row.visit_id, row])
  );
  const visitFacts: SolarVisitFact[] = visitRows.map((row) => ({
    id: row.id,
    status: row.status,
    scheduledStartAt: row.scheduled_start_at,
    assessmentStatus: (assessmentByVisit.get(row.id)?.status as "DRAFT" | "COMPLETED" | undefined) ?? null,
    completedAt: assessmentByVisit.get(row.id)?.completed_at ?? null,
  }));
  const quoteRows = (quotes ?? []) as QuoteRow[];
  const quoteFacts = quoteRows.map(quoteFact);
  return {
    ok: true as const,
    data: {
      preset,
      lead,
      deal,
      deals,
      visitRows,
      assessmentByVisit,
      quoteRows,
      facts: factsFrom({ preset, lead, deal, visits: visitFacts, quotes: quoteFacts }),
    },
  };
}

export async function applySolarSalesTransition(actor: SolarActor, leadId: string, target: SolarSalesStage) {
  const loaded = await bundle(actor, leadId);
  if (!loaded.ok) return loaded;
  const decision = transitionSolarSalesStage(loaded.data.facts, target);
  if (!decision.allowed) {
    return {
      ok: false as const,
      status: 409,
      error: decision.message,
      action: decision.action,
      message: decision.message,
      dealId: loaded.data.deal?.id ?? null,
      persisted: false,
      createsWorkProject: false,
    };
  }
  if (!decision.persisted) {
    return {
      ok: true as const,
      action: decision.action,
      message: decision.message,
      dealId: loaded.data.deal?.id ?? null,
      persisted: false,
      createsWorkProject: false,
    };
  }

  const supabase = createAdminClient();
  const now = new Date().toISOString();
  if (decision.action === "update_lead") {
    const next = target === "CONTACTED" ? "CONTACTED" : "QUALIFIED";
    const { data: updated } = await supabase
      .from("leads")
      .update({ status: next, updated_at: now, ...(next === "QUALIFIED" ? { qualified_at: now } : {}) })
      .eq("id", leadId)
      .eq("client_id", actor.clientId)
      .eq("status", loaded.data.lead.status)
      .select("id")
      .maybeSingle();
    if (!updated) return fail(409, "The lead changed before this update.");
    await logStatusChanged({
      leadId,
      clientId: actor.clientId,
      actor: { id: actor.userId, name: await actorName(actor), role: actor.role },
      fromStatus: loaded.data.lead.status,
      toStatus: next,
    });
  }

  if (decision.action === "require_visit") {
    const created = await createDealFromLead({
      leadId,
      actorId: actor.userId,
      name: loaded.data.lead.name?.trim() || loaded.data.lead.project_type || "Solar opportunity",
      serviceSummary: loaded.data.lead.project_type,
      stage: "QUALIFIED",
      location: locationFromDealOrLead(loaded.data.deal?.location, loaded.data.lead.form_data),
      force: true,
    });
    if (!created.ok) return fail(created.status, created.error);
    if (rejectCrossTenant(actor.clientId, created.deal.client_id)) return fail(403, "That opportunity belongs to another company.");
    await supabase
      .from("deals")
      .update({ sales_commercial_intent: "SITE_VISIT_REQUIRED", updated_at: now, last_meaningful_activity_at: now })
      .eq("id", created.deal.id)
      .eq("client_id", actor.clientId);
    return {
      ok: true as const,
      action: decision.action,
      message: decision.message,
      dealId: created.deal.id,
      persisted: true,
      createsWorkProject: false,
      promptSchedule: true,
    };
  }

  if (decision.action === "negotiate" && loaded.data.deal) {
    const moved = await updateDealStage({ dealId: loaded.data.deal.id, actorId: actor.userId, stage: "NEGOTIATING" });
    if (!moved.ok) return fail(moved.status, moved.error);
    await supabase
      .from("deals")
      .update({ sales_commercial_intent: "NEGOTIATING", updated_at: now })
      .eq("id", loaded.data.deal.id)
      .eq("client_id", actor.clientId);
  }

  return {
    ok: true as const,
    action: decision.action,
    message: decision.message,
    dealId: loaded.data.deal?.id ?? null,
    persisted: true,
    createsWorkProject: false,
  };
}

export async function scheduleSalesSiteVisit(
  actor: SolarActor,
  input: {
    leadId: string;
    startAt: string;
    durationMinutes: number;
    assignedToId: string;
    siteAddress?: string | null;
    siteCity?: string | null;
    instructions?: string | null;
    notifyCustomer?: boolean;
  }
) {
  const loaded = await bundle(actor, input.leadId);
  if (!loaded.ok) return loaded;
  const stage = getSolarSalesStage(loaded.data.facts);
  if (stage !== "SITE_VISIT_REQUIRED" && stage !== "QUALIFIED") {
    return fail(409, "Schedule a site visit from Site Visit Required.");
  }
  if (!loaded.data.deal) return fail(409, "Create the opportunity before scheduling the visit.");
  const start = new Date(input.startAt);
  if (Number.isNaN(start.getTime())) return fail(400, "Choose a date and time.");
  const minutes = Math.min(Math.max(Math.round(input.durationMinutes || 60), 15), 480);
  const end = new Date(start.getTime() + minutes * 60_000);
  const supabase = createAdminClient();
  const { data: assignee } = await supabase
    .from("users")
    .select("id")
    .eq("id", input.assignedToId)
    .eq("client_id", actor.clientId)
    .maybeSingle();
  if (!assignee) return fail(400, "Assign someone from this company.");
  const { data, error } = await supabase
    .from("sales_site_visits")
    .insert({
      client_id: actor.clientId,
      lead_id: input.leadId,
      deal_id: loaded.data.deal.id,
      contact_id: loaded.data.deal.contact_id ?? loaded.data.lead.contact_id,
      status: "SCHEDULED",
      scheduled_start_at: start.toISOString(),
      scheduled_end_at: end.toISOString(),
      site_address: input.siteAddress?.trim() || loaded.data.deal.location || null,
      site_city: input.siteCity?.trim() || null,
      assigned_to_id: input.assignedToId,
      instructions: input.instructions?.trim() || null,
      notify_customer: Boolean(input.notifyCustomer),
      created_by: actor.userId,
    })
    .select("id")
    .single();
  if (error || !data) return fail(500, "Could not schedule the site visit.");
  await supabase.from("sales_site_visit_assessments").insert({
    client_id: actor.clientId,
    visit_id: data.id,
    schema_version: 1,
    status: "DRAFT",
    data: {
      ...emptySolarAssessment(),
      site: {
        ...emptySolarAssessment().site,
        address: input.siteAddress?.trim() || loaded.data.deal.location || null,
      },
    },
  });
  return { ok: true as const, visitId: data.id as string, workProjectCreated: false };
}

export async function loadSalesSiteVisit(actor: SolarActor, visitId: string) {
  const supabase = createAdminClient();
  const { data: visit } = await supabase
    .from("sales_site_visits")
    .select("*")
    .eq("id", visitId)
    .eq("client_id", actor.clientId)
    .maybeSingle();
  if (!visit) return fail(404, "Site visit not found.");
  if (rejectCrossTenant(actor.clientId, visit.client_id as string)) return fail(404, "Site visit not found.");
  const { data: assessment } = await supabase
    .from("sales_site_visit_assessments")
    .select("*")
    .eq("visit_id", visitId)
    .eq("client_id", actor.clientId)
    .maybeSingle();
  const parsed = parseSolarAssessment(assessment?.data ?? {});
  const canEdit =
    (manager(actor) || visit.assigned_to_id === actor.userId || visit.created_by === actor.userId) &&
    assessment?.status !== "COMPLETED" &&
    visit.status !== "CANCELLED";
  return {
    ok: true as const,
    data: {
      visit,
      assessment: parsed.ok ? parsed.data : emptySolarAssessment(),
      completed: assessment?.status === "COMPLETED",
      canEdit,
    },
  };
}

async function writeAssessment(actor: SolarActor, visitId: string, raw: unknown, complete: boolean) {
  const loaded = await loadSalesSiteVisit(actor, visitId);
  if (!loaded.ok) return loaded;
  if (!loaded.data.canEdit && !(complete && loaded.data.completed)) return fail(403, "You cannot edit this assessment.");
  if (loaded.data.completed) return { ok: true as const, status: "COMPLETED" as const };
  const parsed = parseSolarAssessment(raw);
  if (!parsed.ok) return fail(400, parsed.error);
  const visit = loaded.data.visit as { site_address?: string | null; deal_id?: string | null; client_id: string };
  if (complete) {
    const error = solarAssessmentCompletionError(parsed.data, visit.site_address ?? null);
    if (error) return fail(400, error);
  }
  const supabase = createAdminClient();
  const now = new Date().toISOString();
  const summary = [solarOutcomeLabel(parsed.data.outcome), solarLoadSummary(parsed.data)].filter(Boolean).join(". ");
  const { error } = await supabase
    .from("sales_site_visit_assessments")
    .update({
      data: parsed.data,
      status: complete ? "COMPLETED" : "DRAFT",
      summary: summary || null,
      completed_at: complete ? now : null,
      completed_by: complete ? actor.userId : null,
      updated_at: now,
    })
    .eq("visit_id", visitId)
    .eq("client_id", actor.clientId);
  if (error) return fail(500, "Could not save the assessment.");
  if (complete) {
    await supabase
      .from("sales_site_visits")
      .update({
        status: "COMPLETED",
        actual_end_at: now,
        outcome_summary: summary || null,
        updated_at: now,
      })
      .eq("id", visitId)
      .eq("client_id", actor.clientId);
    const address = parsed.data.site.address;
    if (address && visit.deal_id) {
      await supabase
        .from("deals")
        .update({ location: address })
        .eq("id", visit.deal_id)
        .eq("client_id", actor.clientId)
        .is("location", null);
    }
  }
  return { ok: true as const, status: complete ? ("COMPLETED" as const) : ("DRAFT" as const) };
}

export function saveSalesAssessment(actor: SolarActor, visitId: string, raw: unknown) {
  return writeAssessment(actor, visitId, raw, false);
}

export function completeSalesAssessment(actor: SolarActor, visitId: string, raw: unknown) {
  return writeAssessment(actor, visitId, raw, true);
}

export async function addSalesAssessmentPhoto(
  actor: SolarActor,
  visitId: string,
  photo: { documentId: string; category: string; note?: string | null }
) {
  const loaded = await loadSalesSiteVisit(actor, visitId);
  if (!loaded.ok) return loaded;
  if (!loaded.data.canEdit) return fail(403, "This assessment is already complete.");
  const next: SolarAssessmentData = {
    ...loaded.data.assessment,
    photos: [...loaded.data.assessment.photos, { documentId: photo.documentId, category: photo.category, note: photo.note ?? null }],
  };
  return saveSalesAssessment(actor, visitId, next);
}

export async function reconcileSolarQuoteSent(clientId: string, quotationId: string) {
  const preset = await readSalesWorkflowPreset(clientId);
  if (preset !== "SOLAR_INSTALLATION") return;
  const supabase = createAdminClient();
  const { data: quote } = await supabase
    .from("quotations")
    .select("id, client_id, deal_id, status, sent_at")
    .eq("id", quotationId)
    .eq("client_id", clientId)
    .maybeSingle();
  if (!quote?.deal_id || !quote.sent_at) return;
  const { data: deal } = await supabase
    .from("deals")
    .select("id, stage, sales_commercial_intent, originating_lead_id")
    .eq("id", quote.deal_id)
    .eq("client_id", clientId)
    .maybeSingle();
  if (!deal || deal.stage === "WON" || deal.stage === "LOST" || deal.stage === "NEGOTIATING") return;
  if (deal.stage === "QUALIFIED" || deal.stage === "SCOPING") {
    await supabase
      .from("deals")
      .update({
        stage: "PROPOSAL_SENT",
        sales_commercial_intent: deal.sales_commercial_intent === "SITE_VISIT_REQUIRED" ? null : deal.sales_commercial_intent,
        updated_at: new Date().toISOString(),
      })
      .eq("id", deal.id)
      .eq("client_id", clientId);
  }
}

export async function attachSalesAssessmentToProject(clientId: string, projectId: string, dealId: string) {
  const plan = planWonProjectHandoff({ dealStage: "WON", assessmentStatus: "COMPLETED" });
  if (!plan.linkAssessment) return { linked: false };
  const supabase = createAdminClient();
  const { data: visit } = await supabase
    .from("sales_site_visits")
    .select("id, status")
    .eq("client_id", clientId)
    .eq("deal_id", dealId)
    .eq("status", "COMPLETED")
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!visit) return { linked: false };
  const { data: assessment } = await supabase
    .from("sales_site_visit_assessments")
    .select("id, status, data, completed_at")
    .eq("client_id", clientId)
    .eq("visit_id", visit.id)
    .eq("status", "COMPLETED")
    .maybeSingle();
  if (!assessment || !visitCompleted([{ status: "COMPLETED", assessmentStatus: "COMPLETED" }])) return { linked: false };
  const { error } = await supabase
    .from("work_projects")
    .update({
      sales_site_visit_id: visit.id,
      inherited_sales_assessment_id: assessment.id,
      inherited_sales_assessment_completed_at: assessment.completed_at,
      inherited_sales_assessment_snapshot: assessment.data,
    })
    .eq("id", projectId)
    .eq("client_id", clientId);
  if (error) return { linked: false };
  await supabase.from("work_project_events").insert({
    client_id: clientId,
    project_id: projectId,
    event_type: "NOTE_ADDED",
    title: "Pre-sale site assessment linked",
    description: "The completed sales assessment is available on this project. A second assessment is not required.",
  });
  return { linked: true, visitId: visit.id as string, assessmentId: assessment.id as string };
}

export async function salesAssessmentForDeal(clientId: string, dealId: string) {
  const supabase = createAdminClient();
  const { data: visit, error } = await supabase
    .from("sales_site_visits")
    .select("id, status, site_address, site_city")
    .eq("client_id", clientId)
    .eq("deal_id", dealId)
    .eq("status", "COMPLETED")
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error || !visit) return null;
  const { data: assessment } = await supabase
    .from("sales_site_visit_assessments")
    .select("id, status, completed_at, summary")
    .eq("client_id", clientId)
    .eq("visit_id", visit.id)
    .eq("status", "COMPLETED")
    .maybeSingle();
  if (!assessment) return null;
  return {
    visitId: visit.id as string,
    assessmentId: assessment.id as string,
    completedAt: assessment.completed_at as string | null,
    summary: assessment.summary as string | null,
    site: [visit.site_address, visit.site_city].filter(Boolean).join(", ") || null,
  };
}
