import { createAdminClient } from "@/lib/supabase/admin";
import { now } from "@/lib/clock";
import { getDealAttentionState } from "@/lib/sales/deals/attention";
import { DEAL_ACTIVE_STAGES, formatDealStage } from "@/lib/sales/deals/display";
import { getDealCommercialValue } from "@/lib/sales/deals/commercial-value";
import { formatDealValue } from "@/lib/sales/sales-dashboard-display";
import { SCORE_HOT_MIN } from "@/lib/inbox/scoring";
import { asRows } from "@/lib/agent/rows";
import { listJobs } from "@/lib/agent/proactive/jobs";
import type { DealRow } from "@/types";
import { conversationHref, managerHref } from "./hrefs";
import { attentionReply } from "./copy";
import type { AttentionItem, AttentionSnapshot, ManagerActor, ManagerSeverity } from "./types";

export { attentionReply };

type LeadLite = {
  id: string;
  name: string | null;
  assigned_to_id: string | null;
  follow_up_date: string | null;
  score: number | null;
  status: string | null;
  active_deal_id: string | null;
};

function money(n: number | null | undefined): string | null {
  if (n == null || !Number.isFinite(n) || n <= 0) return null;
  return formatDealValue(n);
}

function minutesAgo(iso: string | null, at: Date): number | null {
  if (!iso) return null;
  const t = Date.parse(iso);
  if (!Number.isFinite(t)) return null;
  return Math.max(0, Math.round((at.getTime() - t) / 60_000));
}

function waitingLabel(minutes: number | null): string | null {
  if (minutes == null) return null;
  if (minutes < 60) return `${minutes} min`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m ? `${h}h ${m}m` : `${h}h`;
}

function rank(severity: ManagerSeverity, boost: number): number {
  const base = severity === "URGENT" ? 400 : severity === "HIGH" ? 300 : severity === "NORMAL" ? 200 : 100;
  return base + boost;
}

export async function getManagerAttention(actor: ManagerActor): Promise<AttentionSnapshot> {
  const at = now();
  const supabase = createAdminClient();
  const clientId = actor.clientId;
  const startToday = new Date(at);
  startToday.setHours(0, 0, 0, 0);
  const endToday = new Date(startToday);
  endToday.setDate(endToday.getDate() + 1);
  const todayDate = startToday.toISOString().slice(0, 10);

  const [
    quotesRes,
    dealsRes,
    leadsRes,
    statesRes,
    supportRes,
    usersRes,
    callbacksRes,
    jobsFailed,
    jobsHuman,
    learningRes,
  ] = await Promise.all([
    supabase
      .from("quotations")
      .select("id, quote_number, total, approval_status, status, lead_id, deal_id, prepared_by_id, approval_requested_at, customer_name, updated_at")
      .eq("client_id", clientId)
      .or("approval_status.eq.pending,status.eq.pending_approval")
      .limit(40),
    supabase
      .from("deals")
      .select(
        "id, name, stage, owner_id, originating_lead_id, estimated_value, customer_budget, won_value, value_status, next_action_at, next_action_label, expected_decision_at, last_meaningful_activity_at, updated_at"
      )
      .eq("client_id", clientId)
      .in("stage", [...DEAL_ACTIVE_STAGES])
      .limit(400),
    supabase
      .from("leads")
      .select("id, name, assigned_to_id, follow_up_date, score, status, active_deal_id")
      .eq("client_id", clientId)
      .limit(800),
    supabase
      .from("agent_conversation_state")
      .select(
        "lead_id, status, human_needed_reason, last_customer_message_at, last_human_message_at, last_agent_message_at, human_takeover"
      )
      .eq("client_id", clientId)
      .limit(400),
    supabase
      .from("support_cases")
      .select("id, lead_id, status, reason, reason_category, created_at")
      .eq("client_id", clientId)
      .neq("status", "RESOLVED")
      .limit(50),
    supabase.from("users").select("id, name").eq("client_id", clientId),
    supabase
      .from("call_logs")
      .select("id, lead_id, callback_at, user_id")
      .gte("callback_at", startToday.toISOString())
      .lt("callback_at", endToday.toISOString())
      .not("callback_at", "is", null)
      .limit(80),
    listJobs({
      clientId,
      statuses: ["FAILED", "EXPIRED"],
      limit: 20,
    }),
    listJobs({
      clientId,
      statuses: ["WAITING_FOR_HUMAN"],
      limit: 20,
    }),
    supabase
      .from("agent_learning_candidates")
      .select("id, title, risk_level, comparison_state, conversation_count, salesperson_count, category")
      .eq("client_id", clientId)
      .in("status", ["DETECTED", "REVIEWING"])
      .or("comparison_state.eq.CONFLICTS,risk_level.eq.VERY_HIGH,risk_level.eq.HIGH,type.eq.CORRECTION")
      .order("last_observed_at", { ascending: false })
      .limit(8),
  ]);

  const nameByUser = new Map(
    asRows<{ id: string; name: string | null }>(usersRes.data).map((u) => [u.id, u.name ?? "Unassigned"])
  );
  const leads = asRows<LeadLite>(leadsRes.data);
  const leadById = new Map(leads.map((l) => [l.id, l]));

  const items: AttentionItem[] = [];

  for (const q of asRows<{
    id: string;
    quote_number: string | null;
    total: number | null;
    lead_id: string;
    prepared_by_id: string | null;
    approval_requested_at: string | null;
    customer_name: string | null;
  }>(quotesRes.data)) {
    const waitMin = minutesAgo(q.approval_requested_at, at) ?? 0;
    const sev: ManagerSeverity = (q.total ?? 0) >= 5000 || waitMin >= 360 ? "HIGH" : "NORMAL";
    items.push({
      id: `quote-approval:${q.id}`,
      type: "QUOTE_APPROVAL",
      severity: sev,
      entityType: "QUOTATION",
      entityId: q.id,
      title: `Quotation ${q.quote_number || "draft"} needs approval`,
      reason: waitMin
        ? `Waiting ${waitingLabel(waitMin)} for manager approval`
        : "Pending manager approval",
      ownerName: q.prepared_by_id ? nameByUser.get(q.prepared_by_id) ?? null : null,
      ownerId: q.prepared_by_id,
      valueLabel: money(q.total),
      waitingLabel: waitingLabel(waitMin),
      href: managerHref("QUOTATION", q.id),
      recommendedActions: ["Review oldest first", "Approve", "Request changes"],
      rank: rank(sev, Math.min(waitMin, 500) + Math.round((q.total ?? 0) / 1000)),
    });
  }

  type StateRow = {
    lead_id: string;
    status: string;
    human_needed_reason: string | null;
    last_customer_message_at: string | null;
    last_human_message_at: string | null;
    last_agent_message_at: string | null;
    human_takeover: boolean;
  };
  const waitingCustomers: AttentionItem[] = [];
  const humanNeeded: AttentionItem[] = [];
  for (const s of asRows<StateRow>(statesRes.data)) {
    const lead = leadById.get(s.lead_id);
    if (s.status === "HUMAN_NEEDED") {
      humanNeeded.push({
        id: `human:${s.lead_id}`,
        type: "AGENT_HUMAN_NEEDED",
        severity: "HIGH",
        entityType: "CONVERSATION",
        entityId: s.lead_id,
        title: `${lead?.name || "Customer"} needs a human`,
        reason: s.human_needed_reason || "SegmiQ Agent handed this conversation to a person",
        ownerName: lead?.assigned_to_id ? nameByUser.get(lead.assigned_to_id) ?? null : null,
        ownerId: lead?.assigned_to_id ?? null,
        valueLabel: null,
        waitingLabel: waitingLabel(minutesAgo(s.last_customer_message_at, at)),
        href: conversationHref(s.lead_id),
        recommendedActions: ["Open conversation"],
        rank: rank("HIGH", minutesAgo(s.last_customer_message_at, at) ?? 0),
      });
    }
    const cust = Date.parse(s.last_customer_message_at ?? "") || 0;
    const human = Date.parse(s.last_human_message_at ?? "") || 0;
    const agent = Date.parse(s.last_agent_message_at ?? "") || 0;
    const waiting = cust > 0 && cust > human && cust > agent && s.status !== "PAUSED";
    if (waiting) {
      const mins = minutesAgo(s.last_customer_message_at, at) ?? 0;
      if (mins >= 10) {
        const hot = (lead?.score ?? 0) >= SCORE_HOT_MIN;
        const sev: ManagerSeverity = mins >= 45 || hot ? "HIGH" : "NORMAL";
        waitingCustomers.push({
          id: `wait:${s.lead_id}`,
          type: "CUSTOMER_WAITING",
          severity: sev,
          entityType: "CONVERSATION",
          entityId: s.lead_id,
          title: `${lead?.name || "Customer"} is waiting for a reply`,
          reason: `Last customer message ${waitingLabel(mins)} ago`,
          ownerName: lead?.assigned_to_id ? nameByUser.get(lead.assigned_to_id) ?? null : null,
          ownerId: lead?.assigned_to_id ?? null,
          valueLabel: null,
          waitingLabel: waitingLabel(mins),
          href: conversationHref(s.lead_id),
          recommendedActions: ["Open conversation", "Reassign"],
          rank: rank(sev, mins + (hot ? 40 : 0)),
        });
      }
    }
  }
  items.push(...humanNeeded, ...waitingCustomers);

  const deals = asRows<DealRow>(dealsRes.data);
  for (const deal of deals) {
    const attention = getDealAttentionState(deal, at);
    if (!attention.needsAttention) continue;
    const value = getDealCommercialValue(deal);
    const amount = value.kind === "amount" ? value.amount : value.kind === "range" ? (value.min + value.max) / 2 : 0;
    const noNext = attention.code === "NO_NEXT_ACTION";
    const sev: ManagerSeverity = amount >= 10000 ? "HIGH" : "NORMAL";
    items.push({
      id: `deal:${deal.id}`,
      type: noNext ? "DEAL_NO_NEXT_ACTION" : "DEAL_AT_RISK",
      severity: sev,
      entityType: "DEAL",
      entityId: deal.id,
      title: deal.name || "Deal",
      reason: `${formatDealStage(deal.stage)} · ${attention.reason}`,
      ownerName: deal.owner_id ? nameByUser.get(deal.owner_id) ?? null : null,
      ownerId: deal.owner_id,
      valueLabel: money(amount),
      waitingLabel: attention.badge,
      href: managerHref("DEAL", deal.id),
      recommendedActions: ["Create follow-up", "Open Deal"],
      rank: rank(sev, attention.urgency + Math.round(amount / 2000)),
    });
  }

  for (const lead of leads) {
    if (!lead.follow_up_date) continue;
    if (lead.follow_up_date >= todayDate) continue;
    items.push({
      id: `overdue:${lead.id}`,
      type: "OVERDUE_FOLLOW_UP",
      severity: "NORMAL",
      entityType: "TASK",
      entityId: lead.id,
      title: `Overdue follow-up · ${lead.name || "Customer"}`,
      reason: `Follow-up was due ${lead.follow_up_date}`,
      ownerName: lead.assigned_to_id ? nameByUser.get(lead.assigned_to_id) ?? null : null,
      ownerId: lead.assigned_to_id,
      valueLabel: null,
      waitingLabel: "Overdue",
      href: conversationHref(lead.id),
      recommendedActions: ["Open conversation"],
      rank: rank("NORMAL", 20),
    });
  }

  const appointmentsToday = asRows<{ id: string; lead_id: string; callback_at: string; user_id: string | null }>(
    callbacksRes.data
  );
  for (const appt of appointmentsToday.slice(0, 8)) {
    const lead = leadById.get(appt.lead_id);
    items.push({
      id: `appt:${appt.id}`,
      type: "APPOINTMENT_TODAY",
      severity: "LOW",
      entityType: "APPOINTMENT",
      entityId: appt.lead_id,
      title: `Appointment today · ${lead?.name || "Customer"}`,
      reason: new Date(appt.callback_at).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" }),
      ownerName: appt.user_id ? nameByUser.get(appt.user_id) ?? null : null,
      ownerId: appt.user_id,
      valueLabel: null,
      waitingLabel: null,
      href: conversationHref(appt.lead_id),
      recommendedActions: ["Open calendar"],
      rank: rank("LOW", 5),
    });
  }

  for (const row of asRows<{
    id: string;
    lead_id: string | null;
    status: string;
    reason: string | null;
    reason_category: string | null;
  }>(supportRes.data)) {
    const high = row.reason_category === "TECHNICAL" || row.reason_category === "CUSTOMER_SERVICE";
    const sev: ManagerSeverity = high ? "HIGH" : "NORMAL";
    const lead = row.lead_id ? leadById.get(row.lead_id) : null;
    items.push({
      id: `support:${row.id}`,
      type: "SUPPORT_OPEN",
      severity: sev,
      entityType: "SUPPORT_CASE",
      entityId: row.lead_id || row.id,
      title: `Support · ${lead?.name || "Customer"}`,
      reason: row.reason || `Case is ${row.status}`,
      ownerName: null,
      ownerId: null,
      valueLabel: null,
      waitingLabel: row.reason_category,
      href: managerHref("SUPPORT_CASE", row.lead_id || row.id),
      recommendedActions: ["Open conversation"],
      rank: rank(sev, high ? 80 : 10),
    });
  }

  const failedToday = jobsFailed.filter((j) => {
    const t = Date.parse(j.executedAt || j.evaluatedAt || j.createdAt);
    return Number.isFinite(t) && t >= startToday.getTime();
  });
  for (const job of failedToday.slice(0, 5)) {
    items.push({
      id: `proactive-fail:${job.id}`,
      type: "PROACTIVE_FAILED",
      severity: "HIGH",
      entityType: "PROACTIVE_ACTION",
      entityId: job.id,
      title: "Proactive action failed",
      reason: job.failureReason || job.reasonCode || job.status,
      ownerName: null,
      ownerId: null,
      valueLabel: null,
      waitingLabel: null,
      href: managerHref("PROACTIVE_ACTION", job.id),
      recommendedActions: ["Open Agent activity"],
      rank: rank("HIGH", 30),
    });
  }
  for (const job of jobsHuman.slice(0, 5)) {
    items.push({
      id: `proactive-human:${job.id}`,
      type: "PROACTIVE_WAITING_HUMAN",
      severity: "NORMAL",
      entityType: "PROACTIVE_ACTION",
      entityId: job.id,
      title: "Proactive action waiting for a person",
      reason: job.decisionSummary || job.triggerType,
      ownerName: null,
      ownerId: null,
      valueLabel: null,
      waitingLabel: null,
      href: managerHref("PROACTIVE_ACTION", job.id),
      recommendedActions: ["Open Agent activity"],
      rank: rank("NORMAL", 15),
    });
  }

  for (const c of asRows<{
    id: string;
    title: string;
    risk_level: string;
    comparison_state: string;
    conversation_count: number;
    salesperson_count: number;
    category: string;
  }>(learningRes.data)) {
    const conflict = c.comparison_state === "CONFLICTS";
    items.push({
      id: `learn-${c.id}`,
      type: conflict ? "LEARNING_CONFLICT" : "LEARNING_REVIEW",
      severity: conflict || c.risk_level === "VERY_HIGH" ? "HIGH" : "NORMAL",
      entityType: "LEARNING_CANDIDATE",
      entityId: c.id,
      title: conflict ? `Learning conflict: ${c.title}` : `Learning needs review: ${c.title}`,
      reason: `${c.conversation_count} conversations · ${c.salesperson_count} salespeople`,
      ownerName: null,
      ownerId: null,
      valueLabel: c.category,
      waitingLabel: null,
      href: managerHref("LEARNING_CANDIDATE", c.id),
      recommendedActions: ["Open Learning Center"],
      rank: rank(conflict || c.risk_level === "VERY_HIGH" ? "HIGH" : "NORMAL", 20),
    });
  }

  items.sort((a, b) => b.rank - a.rank);
  const top = items.slice(0, 40);

  const count = (type: string) => top.filter((i) => i.type === type).length;
  const brief = {
    customersWaiting: waitingCustomers.length,
    quoteApprovals: count("QUOTE_APPROVAL") || asRows(quotesRes.data).length,
    dealsNoNextAction: top.filter((i) => i.type === "DEAL_NO_NEXT_ACTION").length,
    overdueFollowUps: top.filter((i) => i.type === "OVERDUE_FOLLOW_UP").length,
    appointmentsToday: appointmentsToday.length,
    humanNeeded: humanNeeded.length,
    failedProactive: failedToday.length,
    supportOpen: asRows(supportRes.data).length,
  };

  const allGroups: AttentionSnapshot["groups"] = [
    { type: "QUOTE_APPROVAL", label: "Quotations awaiting approval", count: brief.quoteApprovals, severity: "HIGH" },
    { type: "CUSTOMER_WAITING", label: "Customers waiting", count: brief.customersWaiting, severity: "HIGH" },
    { type: "DEAL_NO_NEXT_ACTION", label: "Deals with no next action", count: brief.dealsNoNextAction, severity: "NORMAL" },
    { type: "OVERDUE_FOLLOW_UP", label: "Overdue follow-ups", count: brief.overdueFollowUps, severity: "NORMAL" },
    { type: "APPOINTMENT_TODAY", label: "Appointments today", count: brief.appointmentsToday, severity: "LOW" },
    { type: "AGENT_HUMAN_NEEDED", label: "Agent handoffs", count: brief.humanNeeded, severity: "HIGH" },
    { type: "PROACTIVE_FAILED", label: "Failed proactive actions", count: brief.failedProactive, severity: "HIGH" },
    { type: "SUPPORT_OPEN", label: "Open support", count: brief.supportOpen, severity: "NORMAL" },
    {
      type: "LEARNING_REVIEW",
      label: "Learning needs review",
      count: top.filter((i) => i.type === "LEARNING_REVIEW" || i.type === "LEARNING_CONFLICT").length,
      severity: "NORMAL",
    },
  ];
  const groups = allGroups.filter((g) => g.count > 0);

  return {
    asOf: at.toISOString(),
    items: top,
    groups,
    brief,
    sources: {
      deals: deals.length,
      leads: leads.length,
      quotations: asRows(quotesRes.data).length,
      team: nameByUser.size,
    },
  };
}
