import type {
  CompanyTeamMemberOverview,
  CompanyTeamMemberTableRow,
  CompanyTeamPageData,
} from "@/components/dashboard/company/team/types";
import { formatDealCurrency } from "@/lib/sales/format";
import {
  companyTeamAttentionLabel,
  companyTeamAvgGoalProgress,
  companyTeamComposition,
  companyTeamGoalCoverage,
  companyTeamInitials,
  companyTeamRoleColumn,
  companyTeamRoleGroup,
  companyTeamTitleLabel,
  companyTeamWinRate,
  deriveCompanyTeamAttention,
} from "@/lib/sales/company-team-metrics";
import type {
  CompanyCalendarEvent,
  CompanyCalendarEventKind,
  CompanyCalendarPageData,
} from "@/lib/sales/company-calendar/types";
import type { DemoActor, DemoDataset, DemoFollowUp } from "@/lib/demo/types";

const OPEN = new Set(["QUALIFIED", "SCOPING", "PROPOSAL_SENT", "NEGOTIATING"]);
const CLOSED_LEAD = new Set(["WON", "LOST", "NOT_QUALIFIED", "CONVERTED_TO_DEAL"]);

function money(amount: number, currency: string): string {
  return formatDealCurrency(amount, { currency });
}

function currencyOf(dataset: DemoDataset): string {
  return dataset.quotations[0]?.currency || dataset.products[0]?.currency || "USD";
}

function dateKey(value: Date, timeZone: string): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(value);
}

function actorStats(dataset: DemoDataset, actor: DemoActor, now: number) {
  const deals = dataset.deals.filter((deal) => deal.owner_id === actor.id);
  const active = deals.filter((deal) => OPEN.has(deal.stage));
  const won = deals.filter((deal) => deal.stage === "WON");
  const lost = deals.filter((deal) => deal.stage === "LOST");
  const pipeline = active.reduce((sum, deal) => sum + (Number(deal.estimated_value) || 0), 0);
  const wonValue = won.reduce((sum, deal) => sum + (Number(deal.won_value) || 0), 0);
  const followUps = dataset.followUps.filter((row) => dataset.actors[row.ownerKey]?.id === actor.id);
  const overdueFollowUps = followUps.filter((row) => !row.completed && Date.parse(row.dueAt) < now).length;
  const followUpsDue = followUps.filter((row) => !row.completed).length;
  const hotAwaitingContact = dataset.leads.filter(
    (lead) =>
      lead.assigned_to_id === actor.id &&
      (lead.score ?? 0) >= 70 &&
      !CLOSED_LEAD.has(String(lead.status))
  ).length;
  const awaitingEstimate = active.filter((deal) => deal.value_status === "PENDING_ESTIMATE").length;
  return {
    deals,
    active,
    won,
    lost,
    pipeline,
    wonValue,
    followUps,
    overdueFollowUps,
    followUpsDue,
    hotAwaitingContact,
    awaitingEstimate,
  };
}

function memberRow(dataset: DemoDataset, actor: DemoActor, now: Date): CompanyTeamMemberTableRow {
  const currency = currencyOf(dataset);
  const stats = actorStats(dataset, actor, now.getTime());
  const attention = deriveCompanyTeamAttention({
    overdueFollowUps: stats.overdueFollowUps,
    dealsAtRisk: stats.overdueFollowUps > 0 ? Math.min(stats.active.length, stats.overdueFollowUps) : 0,
    hotAwaitingContact: stats.hotAwaitingContact,
    noNextAction: 0,
    hasGoal: false,
    goalProgressPct: null,
    dayOfMonth: now.getDate(),
    daysInMonth: new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate(),
  });
  return {
    id: actor.id,
    name: actor.name,
    initials: companyTeamInitials(actor.name),
    avatarUrl: null,
    email: actor.email,
    phone: actor.phone,
    lastSeenAt: null,
    availabilityOverride: null,
    presence: "offline",
    roleColumn: companyTeamRoleColumn(actor.role, false),
    titleLabel: companyTeamTitleLabel(actor.role, false),
    roleGroup: companyTeamRoleGroup(actor.role),
    isActive: true,
    alsoSells: false,
    activeDeals: stats.active.length,
    pipelineValueKnown: stats.pipeline,
    pipelineValueLabel: money(stats.pipeline, currency),
    pipelineAwaitingEstimate: stats.awaitingEstimate,
    dealsWon: stats.won.length,
    wonValue: stats.wonValue,
    followUpsDue: stats.followUpsDue,
    overdueFollowUps: stats.overdueFollowUps,
    hasGoal: false,
    goalId: null,
    goalTarget: null,
    goalCurrency: currency,
    goalProgressPct: null,
    attention: attention.attention,
    attentionLabel: companyTeamAttentionLabel(attention.attention),
    supportReason: attention.reason,
    dealsAtRisk: stats.overdueFollowUps > 0 ? Math.min(stats.active.length, 1) : 0,
    hotAwaitingContact: stats.hotAwaitingContact,
  };
}

export function buildDemoCompanyTeam(dataset: DemoDataset, now = new Date()): CompanyTeamPageData {
  const currency = currencyOf(dataset);
  const members = Object.values(dataset.actors).map((actor) => memberRow(dataset, actor, now));
  const composition = companyTeamComposition(members);
  const open = dataset.deals.filter((deal) => OPEN.has(deal.stage));
  const pipeline = open.reduce((sum, deal) => sum + (Number(deal.estimated_value) || 0), 0);
  const won = dataset.deals.filter((deal) => deal.stage === "WON");
  const wonValue = won.reduce((sum, deal) => sum + (Number(deal.won_value) || 0), 0);
  return {
    clientId: dataset.clientId,
    clientName: dataset.organisationName,
    businessType: "trades",
    alsoSells: false,
    canManageTeam: false,
    canReassignLeads: false,
    canSetGoals: false,
    generatedAt: dataset.generatedAt,
    currency,
    kpis: [
      {
        id: "pipeline",
        label: "Open pipeline",
        value: money(pipeline, currency),
        supporting: `${open.length} active deals`,
        icon: "pipeline",
        href: "/client/leads/pipeline",
      },
      {
        id: "won",
        label: "Won",
        value: money(wonValue, currency),
        supporting: `${won.length} deals`,
        icon: "won",
        href: "/client/reports",
      },
      {
        id: "team",
        label: "Salespeople",
        value: String(members.filter((member) => member.roleGroup === "salesperson").length),
        supporting: "Fictional team",
        icon: "customers",
        href: "/client/team",
      },
    ],
    members,
    composition: composition.slices,
    compositionTotal: composition.total,
    goalCoverage: {
      teamAvgPct: companyTeamAvgGoalProgress(members),
      buckets: companyTeamGoalCoverage(members),
    },
    needingSupport: members
      .filter((member) => member.attention !== "on_track")
      .map((member) => ({
        id: member.id,
        name: member.name,
        initials: member.initials,
        avatarUrl: null,
        reason: member.supportReason ?? member.attentionLabel,
        attention: member.attention,
        attentionLabel: member.attentionLabel,
        goalProgressPct: null,
      })),
    emptyState: { noTeam: members.length === 0 },
  };
}

export function buildDemoTeamMember(dataset: DemoDataset, memberId: string, now = new Date()): CompanyTeamMemberOverview | null {
  const actor = Object.values(dataset.actors).find((row) => row.id === memberId);
  if (!actor) return null;
  const row = memberRow(dataset, actor, now);
  const stats = actorStats(dataset, actor, now.getTime());
  const currency = currencyOf(dataset);
  const winRate = companyTeamWinRate(stats.won.length, stats.lost.length);
  return {
    id: actor.id,
    name: actor.name,
    initials: row.initials,
    avatarUrl: null,
    email: actor.email,
    phone: actor.phone,
    titleLabel: row.titleLabel,
    roleColumn: row.roleColumn,
    isActive: true,
    accountStatusLabel: "Active",
    alsoSells: false,
    attention: row.attention,
    attentionLabel: row.attentionLabel,
    hasGoal: false,
    goalId: null,
    goalTarget: null,
    goalAchieved: stats.wonValue,
    goalCurrency: currency,
    goalProgressPct: null,
    goalTargetLabel: null,
    goalAchievedLabel: money(stats.wonValue, currency),
    activeDeals: stats.active.length,
    pipelineValueKnown: stats.pipeline,
    pipelineValueLabel: money(stats.pipeline, currency),
    dealsWon: stats.won.length,
    overdueFollowUps: stats.overdueFollowUps,
    avgResponseMinutes: null,
    avgResponseLabel: "Not measured in this demonstration",
    winRate,
    winRateLabel: winRate == null ? "No closed deals" : `${winRate}%`,
    closedDealsCount: stats.won.length + stats.lost.length,
    performanceTrend: [],
    hasPerformanceHistory: false,
    needsAttention:
      stats.overdueFollowUps > 0
        ? [
            {
              id: `${actor.id}:overdue`,
              label: `${stats.overdueFollowUps} overdue follow-up${stats.overdueFollowUps === 1 ? "" : "s"}`,
              href: "/client/leads/pipeline",
              severity: "high",
            },
          ]
        : [],
    recentActivity: dataset.activities
      .filter((activity) => activity.actorKey === actor.key)
      .slice(0, 5)
      .map((activity) => ({
        id: activity.id,
        kind: activity.kind === "note" ? "other" : activity.kind,
        title: activity.title,
        detail: activity.detail ?? "Fictional demonstration",
        timeLabel: "Demonstration",
        actorName: actor.name,
      })),
  };
}

function eventKind(label: string): CompanyCalendarEventKind {
  const text = label.toLowerCase();
  if (text.includes("call")) return "call";
  if (text.includes("quote") || text.includes("proposal")) return "quote_review";
  if (text.includes("whatsapp") || text.includes("message")) return "whatsapp";
  return "follow_up";
}

function calendarEvent(dataset: DemoDataset, row: DemoFollowUp, now: number): CompanyCalendarEvent | null {
  const lead = dataset.leads.find((item) => item.id === row.leadId);
  if (!lead) return null;
  const owner = dataset.actors[row.ownerKey];
  const overdue = !row.completed && Date.parse(row.dueAt) < now;
  return {
    id: row.id,
    sourceType: "lead_follow_up",
    sourceId: row.id,
    kind: eventKind(row.label),
    title: row.label,
    startAt: row.dueAt,
    endAt: null,
    allDay: false,
    status: row.completed ? "completed" : overdue ? "overdue" : "scheduled",
    sourceStatus: lead.status,
    ownerId: owner?.id ?? null,
    ownerName: owner?.name ?? null,
    ownerAvatarUrl: null,
    ownerRoleLabel: owner ? companyTeamRoleColumn(owner.role, false) : null,
    relationType: "lead",
    relatedId: lead.id,
    relatedLabel: lead.name ?? "Customer",
    relatedSecondary: lead.project_type,
    relatedHref: lead.id ? `/client/leads?lead=${lead.id}` : "/client/leads",
    leadId: lead.id,
    dealId: row.dealId,
    customerId: null,
    phone: lead.phone,
    location: null,
    description: "Fictional follow-up. Saving a change does not create a live reminder.",
    attentionReason: overdue ? "Overdue in the demonstration" : null,
    canEdit: false,
    canComplete: false,
  };
}

export function buildDemoCompanyCalendar(dataset: DemoDataset, now = new Date()): CompanyCalendarPageData {
  const events = dataset.followUps
    .map((row) => calendarEvent(dataset, row, now.getTime()))
    .filter((row): row is CompanyCalendarEvent => Boolean(row));
  const today = dateKey(now, dataset.timezone);
  const owners = Object.values(dataset.actors)
    .filter((actor) => actor.role === "SALESPERSON")
    .map((actor) => ({
      id: actor.id,
      name: actor.name,
      avatarUrl: null,
      roleLabel: "Salesperson",
    }));
  const count = (status: CompanyCalendarEvent["status"]) => events.filter((event) => event.status === status).length;
  const metrics = {
    upcomingActivities: count("scheduled"),
    overdueFollowUps: count("overdue"),
    todayActivities: events.filter((event) => dateKey(new Date(event.startAt), dataset.timezone) === today).length,
    completedWeek: count("completed"),
    atRiskActivities: count("overdue"),
    responseTimeMinutes: null,
    responseTimeMinutesPrevious: null,
  };
  return {
    clientId: dataset.clientId,
    clientName: dataset.organisationName,
    timezone: dataset.timezone,
    rangeStartKey: "2020-01-01",
    rangeEndKey: "2035-01-01",
    events,
    owners,
    scheduleableLeads: [],
    leadOwners: {},
    summary: {
      all: metrics,
      byOwner: {},
      definition: {
        upcoming: "Follow-ups still ahead in the demonstration.",
        overdue: "Follow-ups whose demonstration date has passed.",
        today: "Follow-ups due today in the demonstration.",
        completed: "Follow-ups already marked done in the demonstration.",
        response: "Response time is not measured in this demonstration.",
        atRisk: "Overdue follow-ups in the demonstration.",
      },
    },
  };
}
