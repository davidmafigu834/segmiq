/**
 * Company Pipeline page aggregator.
 * Tenant-scoped, batched quotes/leads/owners — no per-Deal N+1.
 */

import { createAdminClient } from "@/lib/supabase/admin";
import { canReassignLeads } from "@/lib/auth/permissions";
import { canActAsSalesperson } from "@/lib/auth/sales-capabilities";
import {
  DEAL_ACTIVE_STAGES,
  getDealAttentionState,
  getDealCommercialValue,
  latestQuoteTotal,
} from "@/lib/sales/deals";
import { formatDealCurrency } from "@/lib/sales/format";
import { formatLeadSource } from "@/lib/sales/leads-directory/format";
import { commercialAmount, loadQuoteTotalsByDealId } from "@/lib/sales/get-company-team-page-data";
import {
  COMPANY_PIPELINE_DEAL_CAP,
  averageKnownDealValue,
  buildCompanyPipelineKpis,
  companyPipelineHealth,
  companyPipelineHealthBarPct,
  companyPipelineHealthLabel,
  companyPipelineHealthReason,
  companyPipelineValueLabel,
  countPipelineTabs,
  decisionMakerLabel,
  formatClosedDate,
  formatExpectedDecision,
  formatNextActionView,
  isCompanyPipelineAtRisk,
  isNextActionDueTodayOrOverdue,
  locationFromDealOrLead,
  sumKnownDealValue,
} from "@/lib/sales/company-pipeline-metrics";
import { DEAL_STAGE_LABEL } from "@/lib/sales/deals/display";
import type { DealRow, QuotationRow, UserRole } from "@/types";
import type {
  CompanyPipelineDealDetail,
  CompanyPipelineDealRow,
  CompanyPipelineEligibleLead,
  CompanyPipelineOwnerOption,
  CompanyPipelinePageData,
  CompanyPipelineSourceOption,
} from "@/components/dashboard/company/pipeline/types";

type TeamUser = {
  id: string;
  name: string | null;
  avatar_url: string | null;
  role: string;
  also_sells: boolean | null;
  is_active: boolean | null;
};

type LeadLite = {
  id: string;
  name: string | null;
  phone: string | null;
  email: string | null;
  source: string | null;
  project_type: string | null;
  customer_need: string | null;
  form_data: Record<string, unknown> | null;
  status: string;
  assigned_to_id: string | null;
  active_deal_id: string | null;
};

function startOfLocalMonth(d: Date): Date {
  const x = new Date(d);
  x.setDate(1);
  x.setHours(0, 0, 0, 0);
  return x;
}

function moneyLabel(n: number | null | undefined, currency: string): string {
  if (n == null || !Number.isFinite(n)) return "—";
  return formatDealCurrency(n, { currency });
}

function mapRow(opts: {
  deal: DealRow;
  lead: LeadLite | undefined;
  quoteTotal: number | null;
  owner: TeamUser | undefined;
  actorUserId: string;
  canModifyAnyOwned: boolean;
  isSuperAdmin: boolean;
  now: Date;
}): CompanyPipelineDealRow {
  const { deal, lead, quoteTotal, owner, now } = opts;
  const commercial = getDealCommercialValue(deal, { latestQuoteTotal: quoteTotal });
  const { known, pending } = commercialAmount(deal, quoteTotal);
  const att = getDealAttentionState(deal, now);
  const health = companyPipelineHealth(att);
  const source = formatLeadSource(lead?.source);
  const canModify =
    opts.isSuperAdmin ||
    (opts.canModifyAnyOwned && deal.owner_id === opts.actorUserId);
  const closedAt = deal.won_at || deal.lost_at;

  return {
    id: deal.id,
    dealName: deal.name?.trim() || "Untitled Deal",
    category: deal.service_summary?.trim() || lead?.project_type?.trim() || null,
    customerName: lead?.name?.trim() || "Customer",
    customerLocation: locationFromDealOrLead(deal.location, lead?.form_data),
    customerPhone: lead?.phone?.trim() || null,
    originatingLeadId: deal.originating_lead_id,
    stage: deal.stage,
    stageLabel: DEAL_STAGE_LABEL[deal.stage] ?? deal.stage,
    valueLabel: companyPipelineValueLabel(commercial),
    valueKnown: pending ? null : known,
    valuePending: pending,
    expectedDecisionAt: deal.expected_decision_at,
    expectedDecisionLabel: formatExpectedDecision(deal.expected_decision_at),
    nextAction: formatNextActionView(deal, now),
    ownerId: deal.owner_id,
    ownerName: owner?.name?.trim() || null,
    ownerAvatarUrl: owner?.avatar_url ?? null,
    health,
    healthLabel: companyPipelineHealthLabel(health),
    healthReason: companyPipelineHealthReason(health, att.reason),
    atRisk: isCompanyPipelineAtRisk(att),
    urgency: att.urgency,
    sourceKey: source.key,
    sourceLabel: source.label,
    lostReason: deal.lost_reason,
    wonValue: deal.won_value,
    closedAt,
    closedAtLabel: formatClosedDate(closedAt),
    createdAt: deal.created_at,
    lastActivityAt: deal.last_meaningful_activity_at || deal.updated_at,
    canModify,
  };
}

export async function getCompanyPipelinePageData(opts: {
  clientId: string;
  actor: {
    userId: string;
    role: UserRole;
    clientId?: string | null;
    alsoSells?: boolean | null;
  };
}): Promise<CompanyPipelinePageData> {
  const { clientId, actor } = opts;
  const now = new Date();
  const monthStart = startOfLocalMonth(now);
  const prevMonthStart = startOfLocalMonth(new Date(monthStart.getFullYear(), monthStart.getMonth() - 1, 1));
  const supabase = createAdminClient();
  const alsoSells = canActAsSalesperson(actor);
  const canReassign = canReassignLeads(actor, clientId);
  const isSuperAdmin = actor.role === "SUPER_ADMIN";

  const [clientRes, teamRes, dealsRes, wonThisMonthRes, wonLastMonthRes, eligibleRes] =
    await Promise.all([
      supabase.from("clients").select("id, name").eq("id", clientId).maybeSingle(),
      supabase
        .from("users")
        .select("id, name, avatar_url, role, also_sells, is_active")
        .eq("client_id", clientId)
        .in("role", ["SALESPERSON", "CLIENT_MANAGER"])
        .order("name", { ascending: true }),
      supabase
        .from("deals")
        .select("*")
        .eq("client_id", clientId)
        .order("updated_at", { ascending: false })
        .limit(COMPANY_PIPELINE_DEAL_CAP),
      supabase
        .from("deals")
        .select("id", { count: "exact", head: true })
        .eq("client_id", clientId)
        .eq("stage", "WON")
        .gte("won_at", monthStart.toISOString()),
      supabase
        .from("deals")
        .select("id", { count: "exact", head: true })
        .eq("client_id", clientId)
        .eq("stage", "WON")
        .gte("won_at", prevMonthStart.toISOString())
        .lt("won_at", monthStart.toISOString()),
      alsoSells
        ? supabase
            .from("leads")
            .select("id, name, project_type, status, assigned_to_id, active_deal_id")
            .eq("client_id", clientId)
            .eq("assigned_to_id", actor.userId)
            .eq("status", "QUALIFIED")
            .is("active_deal_id", null)
            .order("updated_at", { ascending: false })
            .limit(40)
        : Promise.resolve({ data: [] as unknown[] }),
    ]);

  const deals = ((dealsRes.data ?? []) as DealRow[]).filter(Boolean);
  const team = (teamRes.data ?? []) as TeamUser[];
  const teamById = new Map(team.map((u) => [u.id, u]));
  const clientName = (clientRes.data?.name as string) ?? "Company";

  const leadIds = [...new Set(deals.map((d) => d.originating_lead_id).filter(Boolean))];
  const dealIds = deals.map((d) => d.id);

  const [leadsRes, quoteTotalByDealId] = await Promise.all([
    leadIds.length
      ? supabase
          .from("leads")
          .select(
            "id, name, phone, email, source, project_type, customer_need, form_data, status, assigned_to_id, active_deal_id"
          )
          .in("id", leadIds)
      : Promise.resolve({ data: [] as unknown[] }),
    loadQuoteTotalsByDealId(dealIds),
  ]);

  const leadById = new Map(((leadsRes.data ?? []) as LeadLite[]).map((l) => [l.id, l]));

  const rows = deals.map((deal) =>
    mapRow({
      deal,
      lead: leadById.get(deal.originating_lead_id),
      quoteTotal: quoteTotalByDealId.get(deal.id) ?? null,
      owner: deal.owner_id ? teamById.get(deal.owner_id) : undefined,
      actorUserId: actor.userId,
      canModifyAnyOwned: alsoSells,
      isSuperAdmin,
      now,
    })
  );

  const active = rows.filter((r) => (DEAL_ACTIVE_STAGES as readonly string[]).includes(r.stage));
  const knownAmounts = active.map((r) => r.valueKnown);
  const { total: pipelineKnown, pendingCount: awaitingEstimate } = sumKnownDealValue(knownAmounts);
  const avg = averageKnownDealValue(knownAmounts.filter((n): n is number => n != null));
  const dealsAtRisk = active.filter((r) => r.atRisk).length;
  const nextActionsDue = deals.filter((d) => isNextActionDueTodayOrOverdue(d, now)).length;
  const currency = "USD";

  const owners: CompanyPipelineOwnerOption[] = team
    .filter((u) => u.is_active !== false)
    .filter((u) => u.role === "SALESPERSON" || Boolean(u.also_sells))
    .map((u) => ({
      id: u.id,
      name: u.name?.trim() || "Teammate",
      avatarUrl: u.avatar_url,
    }));

  const sourceMap = new Map<string, string>();
  for (const row of rows) {
    if (row.sourceKey && row.sourceLabel) sourceMap.set(row.sourceKey, row.sourceLabel);
  }
  const sources: CompanyPipelineSourceOption[] = [...sourceMap.entries()]
    .map(([key, label]) => ({ key, label }))
    .sort((a, b) => a.label.localeCompare(b.label));

  const eligibleLeads: CompanyPipelineEligibleLead[] = (
    (eligibleRes.data ?? []) as Array<{
      id: string;
      name: string | null;
      project_type: string | null;
      active_deal_id: string | null;
    }>
  )
    .filter((l) => !l.active_deal_id)
    .map((l) => ({
      id: l.id,
      name: l.name?.trim() || "Qualified Lead",
      projectType: l.project_type,
    }));

  const kpis = buildCompanyPipelineKpis({
    pipelineKnown,
    awaitingEstimate,
    activeDeals: active.length,
    wonThisMonth: wonThisMonthRes.count ?? 0,
    wonLastMonth: wonLastMonthRes.count ?? 0,
    avgDealValue: avg,
    avgLabel: moneyLabel(avg, currency),
    dealsAtRisk,
    nextActionsDue,
    currencyLabel: (n) => moneyLabel(n, currency),
  });

  return {
    clientId,
    clientName,
    currency,
    actorUserId: actor.userId,
    alsoSells,
    canReassign,
    canCreateDeal: alsoSells && eligibleLeads.length > 0,
    kpis,
    rows,
    tabCounts: countPipelineTabs(rows),
    owners,
    sources,
    eligibleLeads,
    qualifiedLeadsHref: "/client/leads?status=QUALIFIED",
    dealWorkspaceBase: "/client/deals",
  };
}

export async function getCompanyPipelineDealDetail(opts: {
  clientId: string;
  dealId: string;
  actor: {
    userId: string;
    role: UserRole;
    clientId?: string | null;
    alsoSells?: boolean | null;
  };
}): Promise<CompanyPipelineDealDetail | null> {
  const supabase = createAdminClient();
  const { data: deal } = await supabase
    .from("deals")
    .select("*")
    .eq("id", opts.dealId)
    .eq("client_id", opts.clientId)
    .maybeSingle();
  if (!deal) return null;
  const dealRow = deal as DealRow;

  const [{ data: lead }, { data: quotes }, { data: owner }] = await Promise.all([
    supabase
      .from("leads")
      .select(
        "id, name, phone, email, source, project_type, customer_need, form_data, status"
      )
      .eq("id", dealRow.originating_lead_id)
      .maybeSingle(),
    supabase
      .from("quotations")
      .select("id, deal_id, lead_id, total, status, sent_at, created_at, updated_at")
      .or(
        `deal_id.eq.${dealRow.id},and(lead_id.eq.${dealRow.originating_lead_id},deal_id.is.null)`
      ),
    dealRow.owner_id
      ? supabase
          .from("users")
          .select("id, name, avatar_url")
          .eq("id", dealRow.owner_id)
          .maybeSingle()
      : Promise.resolve({ data: null }),
  ]);

  const leadRow = lead as LeadLite | null;
  const quoteRows = (quotes ?? []) as QuotationRow[];
  const commercial = getDealCommercialValue(dealRow, {
    latestQuoteTotal: latestQuoteTotal(quoteRows),
  });
  const now = new Date();
  const att = getDealAttentionState(dealRow, now);
  const health = companyPipelineHealth(att);
  const alsoSells = canActAsSalesperson(opts.actor);
  const canModify =
    opts.actor.role === "SUPER_ADMIN" ||
    (alsoSells && dealRow.owner_id === opts.actor.userId);
  const phone = leadRow?.phone?.trim() || null;
  const digits = phone ? phone.replace(/[^\d+]/g, "") : "";
  const isWa = leadRow?.source === "WHATSAPP_INBOUND";
  const products = [dealRow.service_summary, leadRow?.project_type]
    .map((s) => s?.trim())
    .filter((s, i, arr): s is string => Boolean(s) && arr.indexOf(s) === i);

  return {
    id: dealRow.id,
    dealName: dealRow.name?.trim() || "Untitled Deal",
    stage: dealRow.stage,
    stageLabel: DEAL_STAGE_LABEL[dealRow.stage] ?? dealRow.stage,
    commercial,
    valueLabel: companyPipelineValueLabel(commercial),
    customerName: leadRow?.name?.trim() || "Customer",
    customerLocation: locationFromDealOrLead(dealRow.location, leadRow?.form_data),
    customerPhone: phone,
    whatsappHref: isWa
      ? "/client/inbox"
      : digits
        ? `https://wa.me/${digits.replace(/^\+/, "")}`
        : null,
    telHref: phone ? `tel:${phone}` : null,
    expectedDecisionAt: dealRow.expected_decision_at,
    expectedDecisionLabel: formatExpectedDecision(dealRow.expected_decision_at),
    ownerId: dealRow.owner_id,
    ownerName: (owner as { name?: string | null } | null)?.name?.trim() || null,
    ownerAvatarUrl: (owner as { avatar_url?: string | null } | null)?.avatar_url ?? null,
    nextAction: formatNextActionView(dealRow, now),
    health,
    healthLabel: companyPipelineHealthLabel(health),
    healthReason: companyPipelineHealthReason(health, att.reason),
    healthBarPct: companyPipelineHealthBarPct(health),
    customerNeed: leadRow?.customer_need?.trim() || null,
    decisionMakerName: dealRow.decision_maker_name,
    decisionMakerStatus: dealRow.decision_maker_status,
    decisionMakerLabel: decisionMakerLabel(
      dealRow.decision_maker_name,
      dealRow.decision_maker_status
    ),
    products,
    originatingLeadId: dealRow.originating_lead_id,
    leadSource: leadRow?.source ?? null,
    canModify,
    canReassign: canReassignLeads(opts.actor, opts.clientId),
    viewDealHref: `/client/deals/${dealRow.id}`,
    attention: {
      code: att.code,
      atRisk: att.atRisk,
      needsAttention: att.needsAttention,
      reason: att.reason,
    },
  };
}
