import type { SalesTurnResult } from "@/lib/agent/sales/types";
import { presentCopilotWork } from "@/lib/sales-copilot/present";
import type { CopilotWorkView } from "@/lib/sales-copilot/types";
import {
  buildWorkspaceBriefing,
  greetingPartInTimeZone,
  rankNextActions,
} from "@/lib/sales/dashboard/daily-workspace";
import type { DailyWorkspacePayload } from "@/lib/sales/dashboard/load-daily-workspace";
import { labelForDemoStage } from "@/lib/demo/stage-labels";
import type { DemoDataset, DemoFollowUp } from "@/lib/demo/types";
import { visibleDeals, visibleLeads } from "@/lib/demo/mutations";
import { adaptDealToCalendarEvent, adaptLeadsToCalendarEvents } from "@/lib/sales/calendar/adapters";
import type { CalendarDealOption, CalendarEvent, CalendarLeadRow } from "@/lib/sales/calendar/types";
import type { SalesGoalsPayload } from "@/lib/sales/goals/types";
import type { ClosedDealRow, WonLostPayload, WonLostPeriodId } from "@/lib/sales/outcomes/types";
import {
  resolveSalesReportRange,
  sourceBucket,
  type SalesReportPeriodId,
  type SalesReportSourceFilter,
  type SalesReportsPayload,
} from "@/lib/sales/sales-reports-data";
import type { SalesTaskItem, SalesTaskType, SalesTasksPayload, SalesTaskView } from "@/lib/sales/tasks/types";
import type { PriorityLead } from "@/lib/sales-priority-lead";
import type { DealRow, LeadRow } from "@/types";

const OPEN = new Set(["QUALIFIED", "SCOPING", "PROPOSAL_SENT", "NEGOTIATING"]);

function currencyOf(dataset: DemoDataset): string {
  return dataset.quotations[0]?.currency || dataset.products[0]?.currency || "USD";
}

function leadFor(dataset: DemoDataset, leadId: string | null): LeadRow | undefined {
  if (!leadId) return undefined;
  return dataset.leads.find((row) => row.id === leadId);
}

function taskType(label: string): { type: SalesTaskType; typeLabel: string } {
  const text = label.toLowerCase();
  if (text.includes("call")) return { type: "call", typeLabel: "Call" };
  if (text.includes("quote") || text.includes("proposal")) return { type: "quote_review", typeLabel: "Quote review" };
  if (text.includes("whatsapp") || text.includes("message")) return { type: "whatsapp", typeLabel: "WhatsApp" };
  return { type: "follow_up", typeLabel: "Follow-up" };
}

function taskFromFollowUp(dataset: DemoDataset, row: DemoFollowUp): SalesTaskItem | null {
  const lead = leadFor(dataset, row.leadId);
  if (!lead) return null;
  const owner = dataset.actors[row.ownerKey];
  const overdue = !row.completed && Date.parse(row.dueAt) < Date.now();
  const kind = taskType(row.label);
  const hasThread = dataset.messages.some((message) => message.leadId === lead.id);
  return {
    id: row.id,
    leadId: lead.id,
    title: row.label,
    type: kind.type,
    typeLabel: kind.typeLabel,
    relatedName: lead.name ?? "Customer",
    relatedSecondary: lead.project_type,
    phone: lead.phone,
    source: lead.source,
    dueAt: row.dueAt,
    deadlineAt: row.dueAt,
    schedule: {
      kind: "due",
      label: row.completed ? "Due" : overdue ? "Overdue" : "Due",
      at: row.dueAt,
      overdue,
      passedSuggestion: false,
      expectedReplyAt: null,
    },
    priority: overdue || (lead.score ?? 0) >= 75 ? "high" : "medium",
    status: row.completed ? "completed" : overdue ? "overdue" : "pending",
    completed: row.completed,
    completedAt: row.completed ? row.dueAt : null,
    createdById: owner?.id ?? null,
    createdByName: owner?.name ?? null,
    assignedToId: owner?.id ?? "",
    isWhatsAppCapable: hasThread,
    leadHref: `/sales/leads`,
    whatsappHref: hasThread ? `/sales/inbox?conversation=${lead.id}` : null,
    score: lead.score,
    notes: "Fictional demonstration follow-up. Completing it does not message a customer.",
    copilot: demoTaskCopilot(dataset, lead.id, row.label, row.dueAt),
  };
}

function demoTaskCopilot(dataset: DemoDataset, leadId: string, label: string, dueAt: string | null): SalesTaskItem["copilot"] {
  const conversation = buildDemoCopilotConversation(dataset, leadId);
  const quoteItem = conversation.items.find((row) => row.actionType === "quotation_draft");
  const replyItem = conversation.items.find((row) => row.actionType === "answer_question");
  const picked = /quote|proposal/i.test(label) && quoteItem ? quoteItem : replyItem ?? quoteItem;
  const item: CopilotWorkView = picked ?? {
    id: `demo-copilot:${leadId}:reminder`,
    leadId,
    actionType: "create_reminder",
    queue: "needs_review",
    title: label,
    explanation: "Simulated Sales Copilot. Saving this follow-up does not message the customer.",
    reviewStatus: "pending",
    executionStatus: "none",
    fulfilmentStatus: "open",
    waitingActor: "salesperson",
    proposedAt: dueAt,
    hourSuggested: false,
    currentDueAt: dueAt,
    priority: "medium",
    missing: [],
    evidence: [],
    linkedQuotationId: null,
    linkedFollowUp: true,
    executionError: null,
    payload: {},
    semanticKey: `demo:reminder:${leadId}`,
    contextRevision: "demo",
    primaryLabel: "Save reminder",
    snoozeUntil: null,
  };
  const presented = presentCopilotWork({
    actionType: item.actionType,
    title: item.title,
    explanation: item.explanation,
    queue: item.queue,
    reviewStatus: item.reviewStatus,
    executionStatus: item.executionStatus,
    fulfilmentStatus: item.fulfilmentStatus,
    waitingActor: item.waitingActor,
    proposedAt: item.proposedAt,
    currentDueAt: item.currentDueAt,
    linkedFollowUp: item.linkedFollowUp,
    missing: item.missing,
    payload: item.payload,
    semanticKey: item.semanticKey,
    executionError: item.executionError,
    linkedQuotationId: item.linkedQuotationId,
  });
  return {
    workItemId: item.id,
    queue: item.queue,
    actionType: item.actionType,
    explanation: item.explanation,
    reviewStatus: item.reviewStatus,
    executionStatus: item.executionStatus,
    fulfilmentStatus: item.fulfilmentStatus,
    listState: presented.listState,
    waitingActor: item.waitingActor,
    hourSuggested: item.hourSuggested,
    currentDueAt: item.currentDueAt,
    proposedAt: item.proposedAt,
    linkedQuotationId: item.linkedQuotationId,
    linkedFollowUp: item.linkedFollowUp,
    missing: item.missing,
    evidenceMessageIds: item.evidence.map((row) => row.id),
    evidence: item.evidence.map((row) => ({ id: row.id, at: row.at, speaker: row.speaker, text: row.text })),
    payload: item.payload,
    executionError: null,
    primaryLabel: item.primaryLabel,
    actionLabel: presented.actionLabel,
    primaryAction: presented.primaryAction,
  };
}

export function buildDemoTasks(dataset: DemoDataset, userId: string, role: string, view: SalesTaskView = "mine"): SalesTasksPayload {
  const owned = dataset.followUps.filter((row) => {
    if (role === "CLIENT_MANAGER" || role === "SUPER_ADMIN") return true;
    return dataset.actors[row.ownerKey]?.id === userId;
  });
  const tasks = owned
    .map((row) => taskFromFollowUp(dataset, row))
    .filter((row): row is SalesTaskItem => Boolean(row))
    .sort((a, b) => Date.parse(a.dueAt ?? "") - Date.parse(b.dueAt ?? ""));
  const pending = tasks.filter((row) => !row.completed);
  const overdue = pending.filter((row) => row.schedule.overdue);
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const end = start.getTime() + 86_400_000;
  const dueToday = pending.filter((row) => {
    const at = Date.parse(row.dueAt ?? "");
    return at >= start.getTime() && at < end;
  });
  const weekEnd = start.getTime() + 7 * 86_400_000;
  const thisWeek = pending.filter((row) => Date.parse(row.dueAt ?? "") < weekEnd);
  return {
    meta: {
      view,
      generatedAt: dataset.generatedAt,
      currentUserId: userId,
      timezone: dataset.timezone,
      copilotUnavailable: false,
    },
    counts: { mine: tasks.length, assigned: tasks.length, created: tasks.length, all: tasks.length },
    kpis: {
      dueToday: dueToday.length,
      dueTodayHighPriority: dueToday.filter((row) => row.priority === "high").length,
      thisWeek: thisWeek.length,
      thisWeekOverdue: overdue.length,
      completedThisWeek: tasks.filter((row) => row.completed).length,
      completedPrevWeek: 0,
      overdue: overdue.length,
    },
    overview: {
      pending: pending.length,
      overdue: overdue.length,
      completedThisWeek: tasks.filter((row) => row.completed).length,
      total: tasks.length,
    },
    tasks,
    upcoming: pending.slice(0, 8),
    tip: overdue.length
      ? {
          kind: "overdue",
          title: `${overdue.length} follow-up${overdue.length === 1 ? "" : "s"} can still close`,
          body: "Open the WhatsApp Sales Hub and continue the fictional conversation. Nothing is sent to a real number.",
        }
      : {
          kind: "on_track",
          title: "Follow-ups are ready",
          body: "These are fictional tasks from the demonstration book.",
        },
    assignableLeads: visibleLeads(dataset, userId, role).slice(0, 12).map((lead) => ({
      id: lead.id,
      name: lead.name ?? "Customer",
      phone: lead.phone,
      source: lead.source,
      status: lead.status,
      followUpDate: lead.follow_up_date,
    })),
    capabilities: {
      hasStandaloneTasks: false,
      hasTaskPriorities: false,
      hasTaskStatuses: false,
      hasTaskAssignees: false,
      hasCreatedBy: true,
      completionClearsFollowUp: true,
      notes: "Demonstration tasks only. They do not create live reminders or send WhatsApp messages.",
    },
  };
}

function closedRow(dataset: DemoDataset, deal: DealRow): ClosedDealRow {
  const lead = leadFor(dataset, deal.originating_lead_id);
  const source = sourceBucket(lead?.source);
  const closeDate = (deal.stage === "WON" ? deal.won_at : deal.lost_at) || deal.updated_at;
  return {
    id: deal.id,
    name: lead?.name ?? deal.name,
    phone: lead?.phone ?? null,
    email: lead?.email ?? null,
    projectType: lead?.project_type ?? deal.service_summary,
    status: deal.stage === "LOST" ? "LOST" : "WON",
    dealValue: deal.stage === "WON" ? Number(deal.won_value) || 0 : Number(deal.estimated_value) || 0,
    closeDate,
    source: lead?.source ?? null,
    sourceKey: source.key,
    sourceLabel: source.label,
    reason: deal.stage === "LOST" ? deal.lost_reason : null,
    note: "Fictional demonstration outcome.",
    contactId: deal.contact_id,
    clientId: dataset.clientId,
    createdAt: deal.created_at,
  };
}

export function buildDemoWonLost(
  dataset: DemoDataset,
  userId: string,
  role: string,
  period: WonLostPeriodId = "this_month"
): WonLostPayload {
  const deals = visibleDeals(dataset, userId, role).filter((deal) => deal.stage === "WON" || deal.stage === "LOST");
  const rows = deals.map((deal) => closedRow(dataset, deal));
  const won = rows.filter((row) => row.status === "WON");
  const lost = rows.filter((row) => row.status === "LOST");
  const wonValue = won.reduce((sum, row) => sum + (row.dealValue ?? 0), 0);
  const lostValue = lost.reduce((sum, row) => sum + (row.dealValue ?? 0), 0);
  const closed = won.length + lost.length;
  const reasonCounts = new Map<string, number>();
  for (const row of lost) {
    const reason = row.reason?.trim() || "No reason recorded";
    reasonCounts.set(reason, (reasonCounts.get(reason) ?? 0) + 1);
  }
  const now = new Date();
  return {
    currency: currencyOf(dataset),
    meta: {
      period,
      periodLabel: "Demonstration book",
      source: "all",
      outcome: "all",
      from: new Date(now.getFullYear(), now.getMonth(), 1).toISOString(),
      to: now.toISOString(),
      vsLabel: "Fictional outcomes",
      granularity: "monthly",
      closeDateField: "updated_at",
      hasWonReasons: false,
      wonReasonsNote: "Won reasons are not collected in this demonstration.",
    },
    kpis: {
      wonDeals: { value: won.length, trend: null },
      lostDeals: { value: lost.length, trend: null },
      winRate: { value: closed ? Math.round((won.length / closed) * 100) : null, trend: null },
      revenueWon: { value: wonValue, recordedCount: won.length, trend: null },
      lostValue: { value: lostValue, recordedCount: lost.length, lostCount: lost.length, trend: null },
    },
    deals: rows,
    trend: [{ label: "Now", periodStart: now.toISOString(), won: won.length, lost: lost.length }],
    lostReasons: {
      rows: [...reasonCounts.entries()].map(([reason, count]) => ({
        reason,
        count,
        pct: lost.length ? Math.round((count / lost.length) * 100) : 0,
      })),
      withReason: lost.filter((row) => row.reason).length,
      totalLost: lost.length,
    },
    wonReasons: { rows: [], withReason: 0, totalWon: won.length, available: false },
    totals: { closedAllTime: closed },
  };
}

export function buildDemoReports(
  dataset: DemoDataset,
  userId: string,
  role: string,
  period: SalesReportPeriodId = "last_30",
  source: SalesReportSourceFilter = "all"
): SalesReportsPayload {
  const range = resolveSalesReportRange(period);
  const leads = visibleLeads(dataset, userId, role).filter((lead) => source === "all" || sourceBucket(lead.source).key === source);
  const deals = visibleDeals(dataset, userId, role);
  const open = deals.filter((deal) => OPEN.has(deal.stage));
  const won = deals.filter((deal) => deal.stage === "WON");
  const pipelineValue = open.reduce((sum, deal) => sum + (Number(deal.estimated_value) || 0), 0);
  const wonValue = won.reduce((sum, deal) => sum + (Number(deal.won_value) || 0), 0);
  const closed = deals.filter((deal) => deal.stage === "WON" || deal.stage === "LOST").length;
  const conversion = closed ? Math.round((won.length / closed) * 100) : null;
  const counts = new Map<string, number>();
  for (const lead of leads) {
    const key = sourceBucket(lead.source).key;
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  const sourceTotal = leads.length;
  const keys = ["whatsapp", "facebook", "referral", "website", "manual", "other"] as const;
  const leadSources = keys
    .map((key) => ({
      key,
      label: sourceBucket(key).label,
      count: counts.get(key) ?? 0,
      pct: sourceTotal ? Math.round(((counts.get(key) ?? 0) / sourceTotal) * 100) : 0,
    }))
    .filter((row) => row.count > 0);
  const stages = [
    { id: "NEW", label: "New", color: "#2563EB", dealStage: "QUALIFIED" },
    { id: "CONTACTED", label: "Contacted", color: "#16A34A", dealStage: "SCOPING" },
    { id: "NEGOTIATING", label: "Negotiating", color: "#F59E0B", dealStage: "NEGOTIATING" },
    { id: "PROPOSAL_SENT", label: "Proposal sent", color: "#0F766E", dealStage: "PROPOSAL_SENT" },
  ] as const;
  const funnel = [
    ...stages.map((stage) => ({
      id: stage.id,
      label: stage.label,
      color: stage.color,
      count: open.filter((deal) => deal.stage === stage.dealStage).length,
      rateOfPrevious: null as number | null,
    })),
    { id: "WON" as const, label: "Won" as const, color: "#16A34A" as const, count: won.length, rateOfPrevious: null },
  ];
  const messages = dataset.messages.filter((message) => leads.some((lead) => lead.id === message.leadId));
  const quotesSent = dataset.quotations.filter((quote) => String(quote.status).toUpperCase() !== "DRAFT").length;
  const activity = [
    { key: "calls", label: "Calls logged", count: dataset.activities.filter((row) => row.kind === "call").length },
    { key: "whatsapp", label: "WhatsApp replies", count: messages.length },
    { key: "quotes", label: "Quotes sent", count: quotesSent },
    { key: "site_visits", label: "Site visits", count: 0 },
    { key: "followups", label: "Follow-ups scheduled", count: dataset.followUps.length },
  ];
  const activityMax = Math.max(...activity.map((row) => row.count), 1);
  const top = [...open].sort((a, b) => (Number(b.estimated_value) || 0) - (Number(a.estimated_value) || 0)).slice(0, 6);
  const target = wonValue + pipelineValue;
  return {
    meta: {
      period,
      periodLabel: range.label,
      from: range.from.toISOString(),
      to: range.to.toISOString(),
      source,
      granularity: "monthly",
      currency: currencyOf(dataset),
      generatedAt: dataset.generatedAt,
    },
    insight: open.length
      ? `${open.length} open deals are still available to close. Potential open value is ${pipelineValue.toLocaleString("en-US")} ${currencyOf(dataset)}.`
      : "The demonstration book has no open deals.",
    kpis: {
      leadsCreated: { value: leads.length, previous: 0, trend: { direction: "new", label: "Demonstration", changePct: null } },
      dealsWon: { value: won.length, previous: 0, trend: { direction: "new", label: "Demonstration", changePct: null }, wonValue },
      pipelineValue: {
        value: pipelineValue,
        label: "Current pipeline value",
        pointInTime: true,
        trend: { direction: "none", label: "—", changePct: null },
      },
      conversionRate: {
        value: conversion,
        previous: null,
        supporting: conversion == null ? "No closed deals yet" : "Won / closed",
        closedCount: closed,
        trend: { direction: "none", label: "—", changePct: null },
      },
      avgResponseMinutes: { value: null, previous: null, supporting: "Not measured in this demonstration" },
      followUpsCompleted: {
        value: dataset.followUps.filter((row) => row.completed).length,
        overdue: dataset.followUps.filter((row) => !row.completed && Date.parse(row.dueAt) < Date.now()).length,
        supporting: "Fictional follow-ups",
      },
    },
    goal: {
      hasTarget: target > 0,
      target: target || null,
      achieved: wonValue,
      remaining: pipelineValue,
      progressPct: target ? Math.round((wonValue / target) * 100) : 0,
      series: [
        { label: "Start", value: 0 },
        { label: "Now", value: wonValue },
      ],
    },
    performanceSeries: [{ label: "Now", leadsCreated: leads.length, dealsWon: won.length, revenue: wonValue }],
    leadSources: { total: sourceTotal, items: leadSources },
    funnel,
    activity: activity.map((row) => ({ ...row, relative: Math.round((row.count / activityMax) * 100) })),
    dealPauses: {
      total: open.length,
      items: [
        {
          key: "overdue" as const,
          label: "Overdue follow-up",
          count: dataset.followUps.filter((row) => !row.completed && Date.parse(row.dueAt) < Date.now()).length,
        },
        {
          key: "awaiting" as const,
          label: "Awaiting follow-up",
          count: dataset.followUps.filter((row) => !row.completed && Date.parse(row.dueAt) >= Date.now()).length,
        },
        {
          key: "proposal" as const,
          label: "Waiting on proposal feedback",
          count: open.filter((deal) => deal.stage === "PROPOSAL_SENT" || deal.stage === "NEGOTIATING").length,
        },
      ]
        .filter((row) => row.count > 0)
        .map((row) => ({ ...row, pct: open.length ? Math.round((row.count / Math.max(open.length, 1)) * 100) : 0 })),
    },
    followUpPerformance: {
      dueToday: dataset.followUps.filter((row) => !row.completed).length,
      completedThisWeek: dataset.followUps.filter((row) => row.completed).length,
      overdue: dataset.followUps.filter((row) => !row.completed && Date.parse(row.dueAt) < Date.now()).length,
      bestTime: null,
      bestTimeAvailable: false,
    },
    topOpportunities: top.map((deal) => {
      const lead = leadFor(dataset, deal.originating_lead_id);
      return {
        id: lead?.id ?? deal.id,
        name: lead?.name ?? deal.name,
        project: lead?.project_type ?? deal.service_summary ?? "—",
        status: labelForDemoStage(dataset.industry, deal.stage),
        value: Number(deal.estimated_value) || 0,
        score: lead?.score ?? null,
        lastActivity: deal.updated_at,
        href: `/sales/deals/${deal.id}`,
      };
    }),
    pipelineByStage: stages.map((stage) => {
      const stageDeals = open.filter((deal) => deal.stage === stage.dealStage);
      return {
        id: stage.id,
        label: stage.label,
        color: stage.color,
        count: stageDeals.length,
        value: stageDeals.reduce((sum, deal) => sum + (Number(deal.estimated_value) || 0), 0),
      };
    }),
    sourcesDetail: leadSources.map((row) => ({
      key: row.key,
      label: row.label,
      leadsCreated: row.count,
      dealsWon: 0,
      wonValue: 0,
      conversionRate: null as number | null,
    })),
    forecast: { available: false as const, message: "Forecasting stays off in this demonstration. The open deals above are the book still available to close." },
    currency: currencyOf(dataset),
  };
}

export function buildDemoGoals(dataset: DemoDataset, userId: string, role: string): SalesGoalsPayload {
  const deals = visibleDeals(dataset, userId, role);
  const won = deals.filter((deal) => deal.stage === "WON");
  const open = deals.filter((deal) => OPEN.has(deal.stage));
  const achieved = won.reduce((sum, deal) => sum + (Number(deal.won_value) || 0), 0);
  const pipeline = open.reduce((sum, deal) => sum + (Number(deal.estimated_value) || 0), 0);
  const target = Math.max(achieved + pipeline, achieved, 1);
  const progressPct = Math.round((achieved / target) * 100);
  const now = new Date();
  const periodKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  const periodStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10);
  const periodEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().slice(0, 10);
  const milestones = [25, 50, 75, 100].map((pct) => ({
    pct: pct as 25 | 50 | 75 | 100,
    amount: Math.round((target * pct) / 100),
    status: (progressPct >= pct ? "achieved" : progressPct >= pct - 25 ? "in_progress" : "pending") as "achieved" | "in_progress" | "pending",
    crossedAt: progressPct >= pct ? dataset.generatedAt : null,
  }));
  return {
    currency: currencyOf(dataset),
    periodKey,
    periodLabel: "This month",
    periodStart,
    periodEnd,
    lifecycle: "active",
    goal: {
      id: "demo-goal",
      goalType: "REVENUE_WON",
      goalTypeLabel: "Revenue won",
      periodType: "MONTHLY",
      periodTypeLabel: "Monthly",
      target,
      status: "ACTIVE",
      periodStart,
      periodEnd,
      editable: false,
    },
    progress: {
      achieved,
      remaining: Math.max(target - achieved, 0),
      shortfall: Math.max(target - achieved, 0),
      aboveTarget: Math.max(achieved - target, 0),
      progressPct,
      ringPct: Math.min(progressPct, 100),
      dealsWon: won.length,
    },
    series: [
      { dateKey: periodStart, label: "Start", cumulative: 0, dayRevenue: 0, dealsWon: 0 },
      { dateKey: now.toISOString().slice(0, 10), label: "Now", cumulative: achieved, dayRevenue: achieved, dealsWon: won.length },
    ],
    sources: [{ key: "whatsapp", label: "WhatsApp", value: achieved, pct: achieved ? 100 : 0, dealsWon: won.length }],
    comparison: {
      thisMonth: achieved,
      lastMonth: 0,
      trend: { direction: achieved ? "new" : "none", label: "Demonstration" },
      weeks: [{ week: 1, label: "Now", thisMonth: achieved, lastMonth: 0 }],
    },
    milestones,
    recentDeals: won.slice(0, 5).map((deal) => {
      const lead = leadFor(dataset, deal.originating_lead_id);
      return {
        id: deal.id,
        leadId: deal.originating_lead_id,
        wonAt: deal.won_at || deal.updated_at,
        amount: Number(deal.won_value) || 0,
        sourceKey: "whatsapp",
        sourceLabel: "WhatsApp",
        customerName: lead?.name ?? deal.name,
        project: lead?.project_type ?? null,
      };
    }),
    recommendations: [
      {
        id: "close-open",
        text: `${open.length} open deals are still short of this month's demonstration target. Continue them in WhatsApp Sales Hub.`,
        href: "/sales/inbox",
      },
    ],
    periodOptions: [{ value: periodKey, label: "This month", hasGoal: true }],
    currentPerformance: { revenueWon: achieved, dealsWon: won.length, pipelineValue: pipeline },
    workingDaysLeft: null,
    daysLeftLabel: "Demonstration month",
    schedule: null,
    dailyFocus: {
      yesterdayMissed: false,
      yesterdayLabel: null,
      missedStreak: 0,
      headline: "Close the open quotations",
      supporting: "The target is the fictional won value plus the open pipeline. No live goal is stored.",
    },
  };
}

export function buildDemoCalendar(dataset: DemoDataset, userId: string, role: string): {
  events: CalendarEvent[];
  scheduleableLeads: PriorityLead[];
  scheduleableDeals: CalendarDealOption[];
} {
  const leads = visibleLeads(dataset, userId, role);
  const deals = visibleDeals(dataset, userId, role).filter((deal) => OPEN.has(deal.stage));
  const phoneByLead = new Map(leads.map((lead) => [lead.id, lead.phone]));
  const scheduleableDeals: CalendarDealOption[] = deals.map((deal) => ({
    id: deal.id,
    name: leadFor(dataset, deal.originating_lead_id)?.name ?? deal.name,
    originatingLeadId: deal.originating_lead_id ?? deal.id,
    phone: phoneByLead.get(deal.originating_lead_id ?? "") ?? null,
    nextActionAt: deal.next_action_at,
    nextActionLabel: deal.next_action_label,
    stage: labelForDemoStage(dataset.industry, deal.stage),
  }));
  const calendarLeads: CalendarLeadRow[] = leads
    .filter((lead) => lead.follow_up_date)
    .map((lead) => ({
      id: lead.id,
      name: lead.name,
      phone: lead.phone,
      location: null,
      follow_up_date: lead.follow_up_date,
      status: lead.status,
      source: lead.source,
      project_type: lead.project_type,
      form_data: (lead.form_data as Record<string, unknown> | null) ?? null,
      score: lead.score,
    }));
  const leadEvents = adaptLeadsToCalendarEvents(calendarLeads, {});
  const dealLeadIds = new Set(scheduleableDeals.filter((deal) => deal.nextActionAt).map((deal) => deal.originatingLeadId));
  const events = [
    ...leadEvents.filter((event) => !dealLeadIds.has(event.leadId)),
    ...scheduleableDeals.map((deal) => adaptDealToCalendarEvent(deal)).filter((event): event is CalendarEvent => Boolean(event)),
  ].sort((a, b) => Date.parse(a.startAt) - Date.parse(b.startAt));
  const scheduleableLeads: PriorityLead[] = leads.map((lead) => ({
    id: lead.id,
    name: lead.name,
    phone: lead.phone,
    email: lead.email ?? null,
    status: lead.status ?? "NEW",
    score: lead.score ?? null,
    is_stale: lead.is_stale ?? null,
    budget: lead.budget ?? null,
    project_type: lead.project_type,
    timeline: lead.timeline ?? null,
    form_data: lead.form_data,
    created_at: lead.created_at,
    follow_up_date: lead.follow_up_date,
    followUpDue: false,
    priorityLabel: "",
    priorityColor: "",
    priorityOrder: 0,
    client_id: lead.client_id,
    source: lead.source,
  }));
  return { events, scheduleableLeads, scheduleableDeals };
}

export function buildDemoCommandBootstrap(dataset: DemoDataset, userId: string, role: string) {
  const open = visibleDeals(dataset, userId, role).filter((deal) => OPEN.has(deal.stage));
  const focus = [...open].sort((a, b) => (Number(b.estimated_value) || 0) - (Number(a.estimated_value) || 0))[0];
  const lead = focus ? leadFor(dataset, focus.originating_lead_id) : undefined;
  const quote = focus ? dataset.quotations.find((row) => row.deal_id === focus.id) : undefined;
  return {
    flags: { enabled: true, commandCenter: true, salesHubCommand: false },
    hasPackages: false,
    samplePackageName: null,
    context: focus
      ? {
          customerName: lead?.name ?? focus.name,
          customerId: focus.contact_id,
          leadId: focus.originating_lead_id,
          projectType: lead?.project_type ?? null,
          dealId: focus.id,
          dealName: focus.name,
          dealStage: labelForDemoStage(dataset.industry, focus.stage),
          quotationId: quote?.id ?? null,
          quotationNumber: quote?.quote_number ?? null,
          quotationStatus: quote?.status ?? null,
          conversationId: focus.originating_lead_id,
          customerHref: "/sales/leads",
          dealHref: `/sales/deals/${focus.id}`,
        }
      : null,
    recent: dataset.quotations.slice(0, 5).map((quoteRow) => ({
      quotationId: quoteRow.id,
      quoteNumber: quoteRow.quote_number ?? "Quote",
      customerName: quoteRow.customer_name,
      status: quoteRow.status,
      summary: "Fictional quotation",
      createdAt: quoteRow.created_at,
      href: `/sales/quotes/${quoteRow.id}`,
    })),
  };
}

export function buildDemoCommandReply(dataset: DemoDataset, userId: string, role: string, message: string): SalesTurnResult {
  const open = visibleDeals(dataset, userId, role).filter((deal) => OPEN.has(deal.stage));
  const lines = open.slice(0, 5).map((deal) => {
    const lead = leadFor(dataset, deal.originating_lead_id);
    const value = Number(deal.estimated_value) || 0;
    return `${lead?.name ?? deal.name} — ${labelForDemoStage(dataset.industry, deal.stage)}${value ? `, ${value.toLocaleString("en-US")} ${currencyOf(dataset)}` : ""}. ${deal.next_action_label ?? "Needs a follow-up."}`;
  });
  const reply = [
    "Simulated demonstration. No message has been sent and no live workspace was changed.",
    message.trim() ? `You asked: ${message.trim()}` : "",
    lines.length ? `Deals still open to close:\n${lines.join("\n")}` : "There are no open deals in this view.",
  ]
    .filter(Boolean)
    .join("\n\n");
  const bootstrap = buildDemoCommandBootstrap(dataset, userId, role);
  return {
    reply,
    blocks: [],
    sessionId: "demo-command",
    executionId: null,
    phase: null,
    status: "COMPLETED",
    context: bootstrap.context,
    recent: bootstrap.recent,
  };
}

export function buildDemoCopilotConversation(dataset: DemoDataset, leadId: string): {
  feature: "Sales Copilot";
  analysis: { status: string; summary: string | null; updatedAt: string | null; error: string | null };
  items: CopilotWorkView[];
} {
  const lead = leadFor(dataset, leadId);
  const messages = dataset.messages.filter((message) => message.leadId === leadId);
  const customer = [...messages].reverse().find((message) => message.direction === "customer");
  const quote = dataset.quotations.find((row) => row.lead_id === leadId);
  const items: CopilotWorkView[] = [];
  if (customer) {
    items.push({
      id: `demo-copilot:${leadId}:reply`,
      leadId,
      actionType: "answer_question",
      queue: "todo",
      title: "Draft a reply",
      explanation: "Simulated Sales Copilot. The draft stays in this conversation and is not sent.",
      reviewStatus: "pending",
      executionStatus: "none",
      fulfilmentStatus: "open",
      waitingActor: "salesperson",
      proposedAt: null,
      hourSuggested: false,
      currentDueAt: null,
      priority: "high",
      missing: [],
      evidence: [{ id: customer.id, at: customer.at, speaker: "customer", text: customer.text }],
      linkedQuotationId: null,
      linkedFollowUp: false,
      executionError: null,
      payload: { question: customer.text },
      semanticKey: `demo:reply:${leadId}`,
      contextRevision: "demo",
      primaryLabel: "Draft reply",
      snoozeUntil: null,
    });
  }
  if (quote) {
    items.push({
      id: `demo-copilot:${leadId}:quote`,
      leadId,
      actionType: "quotation_draft",
      queue: "needs_review",
      title: "Review quotation draft",
      explanation: `Simulated suggestion to review ${quote.quote_number ?? "the quotation"} before the next follow-up. Opening it does not send it.`,
      reviewStatus: "pending",
      executionStatus: "succeeded",
      fulfilmentStatus: "open",
      waitingActor: "salesperson",
      proposedAt: null,
      hourSuggested: false,
      currentDueAt: null,
      priority: "medium",
      missing: [],
      evidence: customer ? [{ id: customer.id, at: customer.at, speaker: "customer", text: customer.text }] : [],
      linkedQuotationId: quote.id,
      linkedFollowUp: false,
      executionError: null,
      payload: {},
      semanticKey: `demo:quote:${leadId}`,
      contextRevision: "demo",
      primaryLabel: "Review draft",
      snoozeUntil: null,
    });
  }
  const name = lead?.name ?? "This customer";
  return {
    feature: "Sales Copilot",
    analysis: {
      status: "ready",
      summary: customer
        ? `Simulated read. ${name} is waiting on a reply. Nothing here is a live customer, and no message has been sent.`
        : "Simulated Sales Copilot. This conversation has no customer message yet.",
      updatedAt: dataset.generatedAt,
      error: null,
    },
    items,
  };
}

export function buildDemoDailyWorkspace(
  dataset: DemoDataset,
  userId: string,
  role: string,
  now = new Date()
): DailyWorkspacePayload {
  const tasks = buildDemoTasks(dataset, userId, role);
  const timeZone = dataset.timezone || "Africa/Harare";
  const summary = buildWorkspaceBriefing(tasks.tasks, now, timeZone);
  const leads = visibleLeads(dataset, userId, role);
  const names = new Map(leads.map((lead) => [lead.id, lead.name ?? "Customer"]));
  const updates = dataset.messages
    .filter((message) => message.direction === "customer" && names.has(message.leadId))
    .sort((a, b) => Date.parse(b.at) - Date.parse(a.at))
    .slice(0, 3)
    .map((message) => {
      const detail = message.text.replace(/\s+/g, " ").trim().slice(0, 80);
      return {
        id: message.id,
        at: message.at,
        kind: "reply" as const,
        leadId: message.leadId,
        leadName: names.get(message.leadId) ?? "Customer",
        href: `/sales/inbox?conversation=${message.leadId}`,
        linkLabel: "View chat",
        detail,
        summary: detail,
      };
    });
  return {
    greetingPart: greetingPartInTimeZone(now, timeZone),
    timezone: timeZone,
    briefing: summary.briefing,
    openCount: summary.openCount,
    actions: rankNextActions(tasks.tasks, now, timeZone, 3),
    viewAllHref: "/sales/tasks",
    copilotUnavailable: false,
    updates: {
      heading: "Recent updates",
      timeframe: "Demonstration",
      items: updates,
      unavailable: false,
    },
    visitId: "00000000-0000-4000-8000-000000000001",
    generatedAt: now.toISOString(),
  };
}

export function buildDemoSocialThreads(dataset: DemoDataset, userId: string, role: string) {
  const leads = visibleLeads(dataset, userId, role);
  return leads
    .map((lead) => {
      const messages = dataset.messages.filter((message) => message.leadId === lead.id);
      if (!messages.length) return null;
      const latest = messages[messages.length - 1]!;
      return {
        leadId: lead.id,
        name: lead.name ?? "Customer",
        project: lead.project_type,
        preview: latest.text,
        at: latest.at,
        messages: messages.map((message) => ({
          id: message.id,
          direction: message.direction,
          text: message.text,
          at: message.at,
        })),
      };
    })
    .filter((row): row is NonNullable<typeof row> => Boolean(row));
}
