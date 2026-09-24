import type { CompanySalesDashboardData } from "@/components/dashboard/company/types";
import type {
  SalesActivityItem,
  SalesActivityTodayMetric,
  SalesDealAttentionItem,
  SalesEnquiryPriorityItem,
  SalesFunnelStage,
  SalesKpiItem,
  SalesPipelineSnapshotStage,
} from "@/components/dashboard/sales/types";
import type { InboxChatMessage, InboxConversation } from "@/lib/inbox/types";
import { demoToday, harareDateKey } from "@/lib/demo/dates";
import type { DemoDataset } from "@/lib/demo/types";
import { visibleDeals, visibleLeads } from "@/lib/demo/mutations";
import { summariseDemo } from "@/lib/demo/totals";
import { DEAL_STAGE_ACCENT, DEAL_STAGE_LABEL, type DealActiveStage } from "@/lib/sales/deals/display";
import { formatDealValue } from "@/lib/sales/sales-dashboard-display";
import { timeAgo } from "@/lib/sales-priority-lead";
import type { SalesDashboardData } from "@/lib/sales/get-sales-dashboard-data";
import type { SalesDashboardRaw } from "@/lib/sales/sales-dashboard-view";
import type {
  DailySalesPlanPayload,
  SalesActionRecommendation,
} from "@/lib/sales/intelligence/types";
import type { DealRow, LeadRow } from "@/types";

function money(n: number): string {
  return formatDealValue(n);
}

function actorName(dataset: DemoDataset, userId: string | null): string {
  return Object.values(dataset.actors).find((actor) => actor.id === userId)?.name ?? "Team";
}

function scoreBand(score: number | null): "Hot" | "Warm" | "Cold" | null {
  if (score == null) return null;
  if (score >= 75) return "Hot";
  if (score >= 50) return "Warm";
  return "Cold";
}

function openLead(lead: LeadRow): boolean {
  return !["WON", "LOST", "CONVERTED_TO_DEAL", "NOT_QUALIFIED"].includes(lead.status);
}

export function demoFocusQueue(dataset: DemoDataset, userId: string, role: string): SalesActionRecommendation[] {
  const leads = visibleLeads(dataset, userId, role);
  const deals = visibleDeals(dataset, userId, role);
  const queue: SalesActionRecommendation[] = [];

  for (const deal of deals) {
    if (!deal.next_action_at) continue;
    if (Date.parse(deal.next_action_at) > Date.now() + 36 * 3_600_000) continue;
    const lead = leads.find((row) => row.id === deal.originating_lead_id) ?? dataset.leads.find((row) => row.id === deal.originating_lead_id);
    if (!lead) continue;
    const quote = dataset.quotations.find((row) => row.deal_id === deal.id);
    const reasonCode = deal.stage === "NEGOTIATING"
      ? "LATE_STAGE_NEEDS_ACTION"
      : deal.stage === "PROPOSAL_SENT"
        ? "QUOTE_WAITING"
        : "FOLLOWUP_DUE_TODAY";
    queue.push({
      id: `focus-${deal.id}`,
      idempotencyKey: `demo-focus-${deal.id}`,
      actionType: deal.stage === "NEGOTIATING" ? "FOLLOW_UP_NEGOTIATION" : deal.stage === "PROPOSAL_SENT" ? "FOLLOW_UP_QUOTE" : "COMPLETE_FOLLOW_UP",
      origin: "SYSTEM_RECOMMENDED",
      sourceEntityType: "deal",
      sourceEntityId: deal.id,
      attentionScore: lead.score ?? 60,
      title: lead.name ?? deal.name,
      subtitle: deal.service_summary,
      recommendedActionLabel: deal.stage === "NEGOTIATING" ? "Review deal" : "Review conversation",
      reasonCode,
      reason: deal.next_action_label ?? "Needs attention",
      urgencyLabel: "Today",
      dueAt: deal.next_action_at,
      customer: {
        leadId: lead.id,
        name: lead.name ?? "Customer",
        phone: lead.phone,
        score: lead.score,
        scoreBand: scoreBand(lead.score),
        source: "WHATSAPP_INBOUND",
        status: lead.status,
        projectType: lead.project_type,
        dealValue: deal.estimated_value,
      },
      availableActions: ["open_lead"],
      metadata: { dealId: deal.id, quoteNumber: quote?.quote_number ?? null },
    });
  }

  for (const lead of leads.filter(openLead)) {
    if ((lead.score ?? 0) < 80) continue;
    queue.push({
      id: `focus-${lead.id}`,
      idempotencyKey: `demo-focus-${lead.id}`,
      actionType: "CONTACT_NEW_LEAD",
      origin: "SYSTEM_RECOMMENDED",
      sourceEntityType: "lead",
      sourceEntityId: lead.id,
      attentionScore: lead.score ?? 80,
      title: lead.name ?? "New enquiry",
      subtitle: lead.project_type,
      recommendedActionLabel: "Open conversation",
      reasonCode: "HIGH_INTENT_NEW_LEAD",
      reason: lead.timeline === "Today" ? "Asked about availability today" : "Hot enquiry",
      urgencyLabel: "Today",
      dueAt: lead.follow_up_date,
      customer: {
        leadId: lead.id,
        name: lead.name ?? "Customer",
        phone: lead.phone,
        score: lead.score,
        scoreBand: scoreBand(lead.score),
        source: "WHATSAPP_INBOUND",
        status: lead.status,
        projectType: lead.project_type,
        dealValue: lead.deal_value,
      },
      availableActions: ["open_lead"],
      metadata: {},
    });
  }

  return queue
    .sort((a, b) => b.attentionScore - a.attentionScore)
    .slice(0, 7);
}

function legacy(dataset: DemoDataset, userId: string, role: string): SalesDashboardRaw {
  const leads = visibleLeads(dataset, userId, role).filter(openLead);
  const priorityLeads = leads.slice(0, 8).map((lead) => ({
    id: lead.id,
    name: lead.name,
    phone: lead.phone,
    status: lead.status,
    score: lead.score,
    is_stale: lead.is_stale,
    budget: lead.budget,
    project_type: lead.project_type,
    timeline: lead.timeline,
    form_data: lead.form_data,
    created_at: lead.created_at,
    follow_up_date: lead.follow_up_date,
    followUpDue: Boolean(lead.follow_up_date && Date.parse(lead.follow_up_date) <= Date.now()),
    priorityLabel: scoreBand(lead.score) ?? "Warm",
    priorityColor: "#2563EB",
    priorityOrder: 100 - (lead.score ?? 0),
    client_id: lead.client_id,
    source: lead.source,
    aiScore: lead.score,
  }));
  const summary = summariseDemo(dataset);
  const mine = summary.byOwner[userId];
  return {
    assignmentMode: "direct",
    priorityLeads,
    allActiveLeads: priorityLeads,
    mirror: {
      mode: "rules",
      line: "Quotation follow-up is the main gap in this demo book.",
    },
    numbers: {
      totalActive: leads.length,
      callNow: leads.filter((lead) => (lead.score ?? 0) >= 80).length,
      calledToday: 3,
      followUpToday: dataset.followUps.filter((row) => row.ownerKey && dataset.actors[row.ownerKey]?.id === userId && !row.completed).length,
      slipped: 1,
      convertLaterCount: 0,
      wonThisMonth: mine?.wonCount ?? summary.wonCount,
    },
    recentActivity: [],
    recentWins: visibleDeals(dataset, userId, role)
      .filter((deal) => deal.stage === "WON")
      .slice(0, 3)
      .map((deal) => ({
        id: deal.id,
        deal_value: deal.won_value,
        days_to_close: 6,
        created_at: deal.won_at ?? deal.updated_at,
        lead_id: deal.originating_lead_id,
        leads: { name: dataset.leads.find((lead) => lead.id === deal.originating_lead_id)?.name ?? null },
      })),
    insights: {
      overdueFollowUps: 2,
      pipelineValue: mine?.pipeline ?? summary.pipelineValue,
      pipelineValueChangePct: 8,
      conversionRate: 28,
      conversionChangePct: 4,
      avgResponseMinutes: 18,
      wonValueThisMonth: mine?.wonValue ?? summary.wonValue,
      wonChangePct: 12,
      leadSources: [
        { key: "facebook", label: "Facebook", count: 6, changePct: 2 },
        { key: "whatsapp", label: "WhatsApp", count: 5, changePct: 1 },
        { key: "referral", label: "Referral", count: 3, changePct: null },
      ],
      performanceTarget: 8000,
      performanceSeries: [
        { label: "W1", value: Math.round((mine?.wonValue ?? summary.wonValue) * 0.2) },
        { label: "W2", value: Math.round((mine?.wonValue ?? summary.wonValue) * 0.35) },
        { label: "W3", value: Math.round((mine?.wonValue ?? summary.wonValue) * 0.55) },
        { label: "Now", value: mine?.wonValue ?? summary.wonValue },
      ],
    },
  };
}

function pipelineStages(deals: DealRow[]): SalesPipelineSnapshotStage[] {
  const stages: DealActiveStage[] = ["QUALIFIED", "SCOPING", "PROPOSAL_SENT", "NEGOTIATING"];
  return stages.map((stage) => {
    const rows = deals.filter((deal) => deal.stage === stage);
    const known = rows.reduce((sum, deal) => sum + (Number(deal.estimated_value) || 0), 0);
    return {
      id: stage,
      label: DEAL_STAGE_LABEL[stage],
      color: DEAL_STAGE_ACCENT[stage],
      dealCount: rows.length,
      valueLabel: money(known),
      knownValue: known,
      awaitingEstimate: 0,
      href: "/sales/pipeline",
    };
  });
}

export function buildDemoSalesDashboard(dataset: DemoDataset, userId: string, role = "SALESPERSON"): SalesDashboardData {
  const deals = visibleDeals(dataset, userId, role);
  const leads = visibleLeads(dataset, userId, role);
  const active = deals.filter((deal) => ["QUALIFIED", "SCOPING", "PROPOSAL_SENT", "NEGOTIATING"].includes(deal.stage));
  const summary = summariseDemo(dataset);
  const mine = summary.byOwner[userId];
  const pipeline = mine?.pipeline ?? active.reduce((sum, deal) => sum + (Number(deal.estimated_value) || 0), 0);
  const queue = demoFocusQueue(dataset, userId, role);
  const focusCount = queue.length;
  const plan: DailySalesPlanPayload = {
    generatedAt: dataset.generatedAt,
    planDate: harareDateKey(demoToday()),
    timezone: dataset.timezone,
    schedule: {
      timezone: dataset.timezone,
      planDate: harareDateKey(demoToday()),
      weekdayLabel: "Today",
      dateLabel: "Today",
      isWorkingDay: true,
      withinHours: true,
      beforeStart: false,
      afterEnd: false,
      workStartLabel: "08:00",
      workEndLabel: "17:00",
      workingDaysLabel: "Mon–Sat",
      minutesLeftInWorkday: 240,
      hoursLeftLabel: "4h left",
      summary: "Demo day",
    },
    focus: {
      mode: "MOVE",
      title: "What should I focus on today?",
      body: `${focusCount} opportunities need attention. Potential open value: ${money(pipeline)}.`,
      priorityActionCount: focusCount,
    },
    coverage: {
      available: true,
      remainingGoalValue: Math.max(0, 8000 - (mine?.wonValue ?? 0)),
      activePipelineValue: pipeline,
      coverageRatio: 1.4,
      coverageLabel: "Covered",
      interpretation: "Open quotations are the main movement opportunity.",
    },
    progress: {
      priorityCompleted: 1,
      priorityTotal: Math.max(focusCount, 1),
      commitments: [],
      planComplete: false,
    },
    nextBestAction: queue[0] ?? null,
    queue,
    newEnquiries: queue.filter((item) => item.actionType === "CONTACT_NEW_LEAD"),
    whatNeedsAttention: queue.slice(0, 4).map((item) => ({
      id: item.id,
      text: `${item.title} — ${item.reason}`,
      href: item.customer?.leadId ? `/sales/inbox?lead=${item.customer.leadId}` : "/sales/pipeline",
    })),
    goal: {
      hasGoal: true,
      targetValue: 8000,
      achievedValue: mine?.wonValue ?? summary.wonValue,
      remainingValue: Math.max(0, 8000 - (mine?.wonValue ?? 0)),
      currency: "USD",
      workingDaysLeft: 6,
      daysLeftLabel: "6 working days left",
      dailyFocus: null,
    },
    settingsConfigured: true,
    capabilities: { hasFocusMode: true, hasCommitments: false },
  };

  const kpis: SalesKpiItem[] = [
    { id: "new-enquiries", label: "New enquiries", value: String(leads.filter((lead) => openLead(lead) && Date.parse(lead.created_at) > Date.now() - 2 * 86_400_000).length), supporting: "Last 2 days", icon: "enquiries", href: "/sales/leads" },
    { id: "followups", label: "Follow-ups due", value: String(queue.filter((item) => item.reasonCode === "FOLLOWUP_DUE_TODAY" || item.reasonCode === "QUOTE_WAITING").length), supporting: "Today", icon: "followups", href: "/sales/followups" },
    { id: "active-deals", label: "Active deals", value: String(active.length), supporting: "In your pipeline", icon: "deals", href: "/sales/pipeline" },
    { id: "pipeline", label: "Quotation value", value: money(pipeline), supporting: "Open pipeline", icon: "pipeline", href: "/sales/pipeline" },
    { id: "won", label: "Won this month", value: money(mine?.wonValue ?? 0), supporting: `${mine?.wonCount ?? 0} deals`, icon: "won", href: "/sales/won-lost" },
  ];

  const funnel: SalesFunnelStage[] = [
    { id: "enquiries", label: "Enquiries", count: leads.filter(openLead).length, icon: "enquiries" },
    { id: "qualified", label: "Qualified", count: active.filter((deal) => deal.stage === "QUALIFIED" || deal.stage === "SCOPING").length, icon: "qualified" },
    { id: "proposal", label: "Quotation sent", count: active.filter((deal) => deal.stage === "PROPOSAL_SENT").length, icon: "proposal" },
    { id: "won", label: "Won", count: mine?.wonCount ?? 0, icon: "won" },
  ];

  const activityToday: SalesActivityTodayMetric[] = [
    { id: "calls", label: "Calls", completed: 2, target: 6, status: "in_progress" },
    { id: "follow", label: "Follow-ups", completed: 1, target: focusCount, status: "in_progress" },
    { id: "quotes", label: "Quotes", completed: 1, target: 2, status: "in_progress" },
  ];

  const recentActivity: SalesActivityItem[] = dataset.activities
    .filter((item) => item.actorKey === "tinashe" || role !== "SALESPERSON" || dataset.actors[item.actorKey]?.id === userId)
    .slice(0, 8)
    .map((item) => ({
      id: item.id,
      kind: item.kind,
      title: item.title,
      detail: item.detail,
      timeLabel: timeAgo(item.at),
      href: item.dealId ? `/sales/deals/${item.dealId}` : item.leadId ? `/sales/inbox?lead=${item.leadId}` : undefined,
    }));

  const priorityDeals: SalesDealAttentionItem[] = active.slice(0, 5).map((deal) => {
    const lead = dataset.leads.find((row) => row.id === deal.originating_lead_id);
    return {
      id: deal.id,
      dealId: deal.id,
      name: deal.name,
      customerName: lead?.name ?? "Customer",
      stage: deal.stage,
      stageLabel: DEAL_STAGE_LABEL[deal.stage] ?? deal.stage,
      valueLabel: money(Number(deal.estimated_value) || 0),
      valueBasisLabel: "Quotation",
      nextActionLabel: deal.next_action_label ?? "Review",
      nextActionWhen: deal.next_action_at ? timeAgo(deal.next_action_at) : null,
      noNextAction: !deal.next_action_at,
      attentionReason: deal.next_action_label ?? "Open opportunity",
      reasonCode: deal.stage === "PROPOSAL_SENT" ? "QUOTE_WAITING" : "FOLLOWUP_DUE_TODAY",
      atRisk: Boolean(deal.next_action_at && Date.parse(deal.next_action_at) < Date.now()),
      urgency: lead?.score ?? 50,
      href: `/sales/deals/${deal.id}`,
    };
  });

  const priorityEnquiries: SalesEnquiryPriorityItem[] = leads.filter(openLead).slice(0, 5).map((lead) => ({
    id: lead.id,
    leadId: lead.id,
    name: lead.name ?? "Customer",
    projectType: lead.project_type,
    source: lead.source,
    intent: scoreBand(lead.score),
    receivedLabel: timeAgo(lead.created_at),
    reason: lead.customer_need ?? "New enquiry",
    phone: lead.phone,
    availableActions: ["open_lead"],
    href: `/sales/inbox?lead=${lead.id}`,
  }));

  return {
    legacy: legacy(dataset, userId, role),
    commercial: {
      newEnquiriesToday: leads.filter((lead) => Date.parse(lead.created_at) > Date.now() - 20 * 3_600_000).length,
      newEnquiriesYesterday: 2,
      activeDeals: active.length,
      pipelineValueKnown: pipeline,
      pipelineAwaitingEstimate: 0,
      dealsWonThisMonth: mine?.wonCount ?? 0,
      dealsWonLastMonth: 1,
      wonValueThisMonth: mine?.wonValue ?? 0,
      followUpsDueToday: queue.length,
      followUpsOverdue: 2,
      avgResponseMinutes: 18,
    },
    kpis,
    plan,
    planError: false,
    focus: plan.focus,
    coverage: plan.coverage,
    goal: plan.goal,
    priorityEnquiries,
    priorityDeals,
    funnel,
    activityToday,
    pipelineSnapshot: pipelineStages(active),
    recentActivity,
    planSummary: {
      state: "active",
      headline: `${focusCount} opportunities need attention`,
      supporting: `Potential open value: ${money(pipeline)}`,
      ctaLabel: "Open pipeline",
      ctaHref: "/sales/pipeline",
      remainingPriority: focusCount,
      prospectRemaining: null,
    },
    hasAnyDeals: active.length > 0,
    hasAnyLeads: leads.length > 0,
    clientId: dataset.clientId,
    realEstate: null,
  };
}

export function buildDemoCompanyDashboard(dataset: DemoDataset): CompanySalesDashboardData {
  const summary = summariseDemo(dataset);
  const sales = Object.values(dataset.actors).filter((actor) => actor.role === "SALESPERSON");
  const active = dataset.deals.filter((deal) => ["QUALIFIED", "SCOPING", "PROPOSAL_SENT", "NEGOTIATING"].includes(deal.stage));
  const dueFollowUps = dataset.followUps.filter((row) => !row.completed && Date.parse(row.dueAt) <= Date.now() + 3_600_000);
  const team = sales.map((actor) => {
    const stats = summary.byOwner[actor.id];
    return {
      id: actor.id,
      name: actor.name,
      initials: actor.name.split(" ").map((part) => part[0]).join("").slice(0, 2),
      avatarUrl: null,
      roleLabel: "Sales",
      activeDeals: active.filter((deal) => deal.owner_id === actor.id).length,
      pipelineValueKnown: stats?.pipeline ?? 0,
      pipelineValueLabel: money(stats?.pipeline ?? 0),
      pipelineAwaitingEstimate: 0,
      dealsWon: stats?.wonCount ?? 0,
      wonValue: stats?.wonValue ?? 0,
      followUpsDue: dataset.followUps.filter((row) => dataset.actors[row.ownerKey]?.id === actor.id && !row.completed).length,
      hasGoal: true,
      goalProgressPct: Math.min(100, Math.round(((stats?.wonValue ?? 0) / 8000) * 100)),
      href: `/client/team/${actor.id}`,
    };
  });

  const kpis: SalesKpiItem[] = [
    { id: "pipeline", label: "Open pipeline", value: money(summary.pipelineValue), supporting: `${summary.activeDeals} active deals`, icon: "pipeline", href: "/client/leads/pipeline" },
    { id: "quotes", label: "Quotes awaiting response", value: String(summary.awaitingQuotes), supporting: money(summary.awaitingValue), icon: "deals", href: "/client/quotations" },
    { id: "followups", label: "Customers needing follow-up", value: String(dueFollowUps.length), supporting: "Due today", icon: "followups", href: "/client/leads" },
    { id: "won", label: "Won this month", value: money(summary.wonValue), supporting: `${summary.wonCount} deals`, icon: "won", href: "/client/reports" },
  ];

  return {
    clientId: dataset.clientId,
    clientName: dataset.organisationName,
    alsoSells: false,
    businessType: "trades",
    generatedAt: dataset.generatedAt,
    kpis,
    focusAreas: [
      { id: "quotes", severity: "high", count: summary.awaitingQuotes, label: "Quotations awaiting a response", supporting: money(summary.awaitingValue), href: "/client/quotations", ctaLabel: "Review quotes" },
      { id: "follow", severity: "high", count: dueFollowUps.length, label: "Follow-ups due", supporting: "Including Tendai Moyo and Westgate Logistics", href: "/client/leads/pipeline", ctaLabel: "Review" },
      { id: "hot", severity: "critical", count: dataset.leads.filter((lead) => (lead.score ?? 0) >= 85 && openLead(lead)).length, label: "Hot enquiries", supporting: "Brian Ncube asked about availability today", href: "/client/leads", ctaLabel: "Open" },
    ],
    focusAreasViewAllHref: "/client/leads/pipeline",
    teamCalendar: dueFollowUps.slice(0, 6).map((row) => {
      const lead = dataset.leads.find((item) => item.id === row.leadId);
      return {
        id: row.id,
        kind: "follow_up" as const,
        title: row.label,
        customerName: lead?.name ?? null,
        ownerName: actorName(dataset, dataset.actors[row.ownerKey]?.id ?? null),
        ownerId: dataset.actors[row.ownerKey]?.id ?? null,
        startAt: row.dueAt,
        dayKey: harareDateKey(new Date(row.dueAt)),
        dayLabel: "Today",
        timeLabel: "Today",
        overdue: Date.parse(row.dueAt) < Date.now() - 3_600_000,
        href: row.dealId ? `/client/deals/${row.dealId}` : "/client/leads",
      };
    }),
    teamCalendarOverdueCount: dueFollowUps.filter((row) => Date.parse(row.dueAt) < Date.now() - 3_600_000).length,
    team,
    teamTotal: team.length,
    teamViewAllHref: "/client/team",
    dailyTeamReport: {
      dateLabel: "Today",
      rows: team.map((member) => ({
        id: member.id,
        name: member.name,
        initials: member.initials,
        avatarUrl: null,
        roleLabel: "Sales",
        newLeads: dataset.leads.filter((lead) => lead.assigned_to_id === member.id && Date.parse(lead.created_at) > Date.now() - 86_400_000).length,
        qualified: active.filter((deal) => deal.owner_id === member.id && deal.stage === "QUALIFIED").length,
        contacted: 2,
        quotesPrepared: dataset.quotations.filter((quote) => quote.prepared_by_id === member.id).length,
        quotesSent: dataset.quotations.filter((quote) => quote.prepared_by_id === member.id && quote.status === "sent").length,
        dealsWon: member.dealsWon,
        followUpsDue: member.followUpsDue,
        href: `/client/team/${member.id}`,
      })),
      totals: {
        newLeads: dataset.leads.filter((lead) => Date.parse(lead.created_at) > Date.now() - 86_400_000).length,
        qualified: active.filter((deal) => deal.stage === "QUALIFIED").length,
        contacted: 6,
        quotesPrepared: dataset.quotations.length,
        quotesSent: summary.awaitingQuotes,
        dealsWon: summary.wonCount,
        followUpsDue: dueFollowUps.length,
        unassignedLeads: 0,
      },
      viewReportsHref: "/client/reports/weekly",
    },
    funnel: [
      { id: "enquiries", label: "Enquiries", count: summary.openLeads + summary.activeDeals, icon: "enquiries" },
      { id: "qualified", label: "Qualified", count: active.filter((deal) => deal.stage === "QUALIFIED" || deal.stage === "SCOPING").length, icon: "qualified" },
      { id: "proposal", label: "Quotation sent", count: active.filter((deal) => deal.stage === "PROPOSAL_SENT").length, icon: "proposal" },
      { id: "deals", label: "Negotiation", count: active.filter((deal) => deal.stage === "NEGOTIATING").length, icon: "deals" },
      { id: "won", label: "Won", count: summary.wonCount, icon: "won" },
    ],
    conversionRate: 31,
    conversionDefinition: "Won deals divided by qualified opportunities this month",
    sources: [
      { id: "facebook", label: "Facebook", count: 14, pct: 26, brand: "facebook" },
      { id: "whatsapp", label: "WhatsApp", count: 12, pct: 22, brand: "whatsapp" },
      { id: "referral", label: "Referral", count: 9, pct: 17, brand: "referral" },
      { id: "website", label: "Website", count: 8, pct: 15, brand: "website" },
      { id: "walkin", label: "Walk-in", count: 6, pct: 11, brand: "walkin" },
      { id: "other", label: "Phone", count: 5, pct: 9, brand: "other" },
    ],
    sourcesEmpty: false,
    pipelineSnapshot: pipelineStages(active).map((stage) => ({ ...stage, href: "/client/leads/pipeline" })),
    hasActiveDeals: active.length > 0,
    atRiskDeals: active
      .filter((deal) => deal.next_action_at && Date.parse(deal.next_action_at) <= Date.now())
      .slice(0, 5)
      .map((deal) => ({
        id: deal.id,
        dealId: deal.id,
        name: dataset.leads.find((lead) => lead.id === deal.originating_lead_id)?.name ?? deal.name,
        valueLabel: money(Number(deal.estimated_value) || 0),
        knownValue: Number(deal.estimated_value) || 0,
        reason: deal.next_action_label ?? "Follow-up due",
        reasonCode: "FOLLOWUP_DUE_TODAY" as const,
        ownerName: actorName(dataset, deal.owner_id),
        ownerId: deal.owner_id,
        stageLabel: DEAL_STAGE_LABEL[deal.stage] ?? deal.stage,
        urgency: 80,
        href: `/client/deals/${deal.id}`,
      })),
    atRiskTotal: dueFollowUps.length,
    atRiskViewAllHref: "/client/leads/pipeline",
    revenueTrend: [
      { monthKey: "m-2", label: "Earlier", value: Math.round(summary.wonValue * 0.7) },
      { monthKey: "m-1", label: "Last month", value: 4640 },
      { monthKey: "m", label: "This month", value: summary.wonValue },
    ],
    revenueTotal: summary.wonValue,
    revenueTotalLabel: money(summary.wonValue),
    hasRevenueHistory: true,
    recentActivity: dataset.activities.slice(0, 8).map((item) => ({
      id: item.id,
      kind: item.kind,
      title: item.title,
      detail: item.detail,
      timeLabel: timeAgo(item.at),
      href: item.dealId ? `/client/deals/${item.dealId}` : undefined,
      actorName: dataset.actors[item.actorKey]?.name ?? null,
    })),
    emptyState: { noTeam: false, noLeads: false, noDeals: false, isNewCompany: false },
    metrics: {
      newEnquiries30d: dataset.leads.filter((lead) => Date.parse(lead.created_at) > Date.now() - 30 * 86_400_000).length,
      qualifiedLeads30d: dataset.leads.filter((lead) => lead.status === "QUALIFIED" || lead.status === "CONVERTED_TO_DEAL").length,
      activeDeals: summary.activeDeals,
      pipelineValueKnown: summary.pipelineValue,
      pipelineAwaitingEstimate: 0,
      dealsWonThisMonth: summary.wonCount,
      wonValueThisMonth: summary.wonValue,
      overdueFollowUps: dueFollowUps.filter((row) => Date.parse(row.dueAt) < Date.now() - 3_600_000).length,
      dealsAtRisk: dueFollowUps.length,
      hotAwaitingContact: dataset.leads.filter((lead) => (lead.score ?? 0) >= 85 && openLead(lead)).length,
      noNextAction: active.filter((deal) => !deal.next_action_at).length,
      unassignedLeads: 0,
      avgResponseMinutes: 18,
    },
  };
}

export function buildDemoInbox(dataset: DemoDataset, userId: string, role: string): InboxConversation[] {
  const leads = visibleLeads(dataset, userId, role).filter((lead) => dataset.messages.some((message) => message.leadId === lead.id));
  return leads.map((lead) => {
    const thread = dataset.messages.filter((message) => message.leadId === lead.id).sort((a, b) => Date.parse(a.at) - Date.parse(b.at));
    const last = thread[thread.length - 1];
    const deal = dataset.deals.find((row) => row.id === lead.active_deal_id);
    const quote = dataset.quotations.find((row) => row.lead_id === lead.id);
    const owner = Object.values(dataset.actors).find((actor) => actor.id === lead.assigned_to_id);
    const score = lead.score ?? 0;
    return {
      id: lead.id,
      contactId: lead.contact_id,
      name: lead.name,
      whatsappProfileName: lead.name,
      whatsappProfilePictureUrl: null,
      phone: lead.phone,
      location: dataset.contacts.find((contact) => contact.id === lead.contact_id)?.location ?? null,
      source: lead.source,
      status: lead.status,
      stageLabel: deal ? (DEAL_STAGE_LABEL[deal.stage] ?? deal.stage) : "Enquiry",
      projectType: lead.project_type,
      leadBudget: lead.budget,
      leadTimeline: lead.timeline,
      assignedToId: lead.assigned_to_id,
      assignee: owner ? { id: owner.id, name: owner.name } : null,
      score,
      scoreLabel: score >= 75 ? "Hot" : score >= 50 ? "Warm" : "Cold",
      lastMessage: last?.text ?? "",
      lastMessageAt: last?.at ?? lead.created_at,
      lastMessageType: "text",
      unread: last?.direction === "customer" ? 1 : 0,
      tags: [],
      leadSummary: lead.customer_need,
      breakdown: { urgency: 20, budget: 15, location: 10, productInterest: 20, engagement: 15 },
      followUpDate: lead.follow_up_date,
      createdAt: lead.created_at,
      company: typeof lead.form_data.company === "string" ? lead.form_data.company : null,
      dealValue: deal?.estimated_value ?? lead.deal_value,
      dealCurrency: "USD",
      sourceLabel: String(lead.source),
      lastMessageDirection: last?.direction === "customer" ? "inbound" : "outbound",
      awaitingReplyMinutes: last?.direction === "rep" ? Math.round((Date.now() - Date.parse(last.at)) / 60000) : null,
      latestQuoteNumber: quote?.quote_number ?? null,
      latestQuoteStatus: quote?.status ?? null,
      latestQuoteTotal: quote?.total ?? null,
      latestQuoteViewedAt: quote?.viewed_at ?? null,
      conversationType: "SALES",
      conversationQueue: "SALES",
      collaboratorIds: [],
      supportCase: null,
      conversationStatus: "OPEN",
      resolvedAt: null,
      firstContactAt: thread[0]?.at ?? lead.created_at,
      firstResponseSeconds: 600,
      messageCount: thread.length,
      activeDealId: deal?.id ?? null,
      dealName: deal?.name ?? null,
      dealStage: deal?.stage ?? null,
      dealNextActionAt: deal?.next_action_at ?? null,
      dealNextActionLabel: deal?.next_action_label ?? null,
      agentStatus: "HUMAN_HANDLING",
      agentHumanNeededReason: null,
    };
  });
}

export function buildDemoMessages(dataset: DemoDataset, leadId: string): InboxChatMessage[] {
  return dataset.messages
    .filter((message) => message.leadId === leadId)
    .sort((a, b) => Date.parse(a.at) - Date.parse(b.at))
    .map((message) => ({
      id: message.id,
      direction: message.direction === "customer" ? "customer" : "rep",
      text: message.text,
      createdAt: message.at,
      kind: message.kind,
      status: "delivered" as const,
      actorName: message.actorKey ? dataset.actors[message.actorKey]?.name : undefined,
      systemTitle: message.kind === "system" ? "Quotation sent" : undefined,
    }));
}

export function demoNotificationsFor(dataset: DemoDataset, userId: string) {
  const actor = Object.values(dataset.actors).find((row) => row.id === userId);
  if (!actor) return [];
  return dataset.notifications
    .filter((row) => row.userKey === actor.key)
    .map((row) => ({
      id: row.id,
      type: row.type,
      message: row.message,
      read: row.read,
      lead_id: row.leadId,
      client_id: dataset.clientId,
      quotation_id: row.quotationId,
      weekly_report_id: null,
      created_at: row.at,
    }));
}
