import { createAdminClient } from "@/lib/supabase/admin";
import { fetchLatestScheduledCallbacksByLeadId } from "@/lib/convert-later-picks";
import { resolveFollowUpDateTime } from "@/lib/call-log-constants";
import { leadCardDisplayName } from "@/lib/leads/whatsapp-lead-display";
import {
  getTaskTypeLabel,
  inferTaskType,
  isTaskDueThisWeek,
  isTaskDueToday,
  isTaskOverdue,
  previousWeekBounds,
  priorityFromLead,
  sortTasksByUrgency,
  titleForTask,
  weekBounds,
} from "./format";
import type {
  SalesTaskItem,
  SalesTaskView,
  SalesTasksPayload,
} from "./types";

type LeadRow = {
  id: string;
  name: string | null;
  phone: string | null;
  source: string | null;
  status: string | null;
  follow_up_date: string | null;
  assigned_to_id: string | null;
  score: number | null;
  manual_priority?: string | null;
  project_type?: string | null;
  form_data?: Record<string, unknown> | null;
  clients?: { name?: string | null } | null;
};

type EventRow = {
  lead_id: string;
  event_type: string;
  actor_id: string | null;
  actor_name: string | null;
  event_data: Record<string, unknown> | null;
  created_at: string;
};

function isWhatsAppSource(source: string | null): boolean {
  return (source ?? "").toUpperCase().includes("WHATSAPP");
}

function leadHref(lead: LeadRow): string {
  return isWhatsAppSource(lead.source)
    ? `/sales/inbox?lead=${lead.id}`
    : `/sales/call-now?lead=${lead.id}`;
}

function buildOpenTask(
  lead: LeadRow,
  callbackAt: string | undefined,
  createdById: string | null,
  createdByName: string | null,
  now: Date
): SalesTaskItem | null {
  const due = resolveFollowUpDateTime(lead.follow_up_date, callbackAt);
  if (!due) return null;
  const type = inferTaskType({
    hasTimedCallback: Boolean(callbackAt),
    status: lead.status,
    source: lead.source,
  });
  const relatedName = leadCardDisplayName({
    name: lead.name,
    phone: lead.phone,
    source: lead.source,
    form_data: lead.form_data,
  });
  const overdue = isTaskOverdue(due, now);
  const priority = priorityFromLead({
    manualPriority: lead.manual_priority,
    score: lead.score,
  });
  const clientName = lead.clients?.name?.trim() || null;

  return {
    id: `followup-${lead.id}`,
    leadId: lead.id,
    title: titleForTask(type, relatedName),
    type,
    typeLabel: getTaskTypeLabel(type),
    relatedName,
    relatedSecondary: clientName || lead.project_type?.trim() || null,
    phone: lead.phone,
    source: lead.source,
    dueAt: due.toISOString(),
    priority,
    status: overdue ? "overdue" : "pending",
    completed: false,
    completedAt: null,
    createdById,
    createdByName,
    assignedToId: lead.assigned_to_id ?? "",
    isWhatsAppCapable: isWhatsAppSource(lead.source),
    leadHref: leadHref(lead),
    whatsappHref: isWhatsAppSource(lead.source)
      ? `/sales/inbox?lead=${lead.id}`
      : null,
    score: lead.score,
    notes: null,
  };
}

function buildCompletedTask(
  event: EventRow,
  lead: LeadRow | undefined
): SalesTaskItem | null {
  if (!lead) return null;
  const relatedName = leadCardDisplayName({
    name: lead.name,
    phone: lead.phone,
    source: lead.source,
    form_data: lead.form_data,
  });
  const type = inferTaskType({
    hasTimedCallback: false,
    status: lead.status,
    source: lead.source,
  });
  const completedAt = event.created_at;
  return {
    id: `completed-${event.lead_id}-${event.created_at}`,
    leadId: event.lead_id,
    title: titleForTask(type, relatedName),
    type,
    typeLabel: getTaskTypeLabel(type),
    relatedName,
    relatedSecondary: lead.clients?.name?.trim() || lead.project_type?.trim() || null,
    phone: lead.phone,
    source: lead.source,
    dueAt: completedAt,
    priority: priorityFromLead({
      manualPriority: lead.manual_priority,
      score: lead.score,
    }),
    status: "completed",
    completed: true,
    completedAt,
    createdById: event.actor_id,
    createdByName: event.actor_name,
    assignedToId: lead.assigned_to_id ?? "",
    isWhatsAppCapable: isWhatsAppSource(lead.source),
    leadHref: leadHref(lead),
    whatsappHref: isWhatsAppSource(lead.source)
      ? `/sales/inbox?lead=${lead.id}`
      : null,
    score: lead.score,
    notes: null,
  };
}

function filterByView(
  tasks: SalesTaskItem[],
  view: SalesTaskView,
  userId: string
): SalesTaskItem[] {
  switch (view) {
    case "assigned":
      // Assigned by someone else (creator known and not me), still assigned to me.
      return tasks.filter(
        (t) =>
          !t.completed &&
          t.assignedToId === userId &&
          t.createdById != null &&
          t.createdById !== userId
      );
    case "created":
      return tasks.filter((t) => t.createdById === userId);
    case "all":
      return tasks.filter(
        (t) =>
          t.assignedToId === userId || t.createdById === userId
      );
    case "mine":
    default:
      // Open tasks the salesperson should act on (assigned + not completed).
      return tasks.filter((t) => !t.completed && t.assignedToId === userId);
  }
}

function buildTip(
  open: SalesTaskItem[],
  now: Date
): SalesTasksPayload["tip"] {
  const highToday = open.filter(
    (t) => t.priority === "high" && isTaskDueToday(t.dueAt, now)
  ).length;
  const overdue = open.filter((t) => t.status === "overdue").length;
  if (highToday > 0) {
    return {
      kind: "high_priority_today",
      title: "Focus on high-priority tasks",
      body: `You have ${highToday} high-priority task${highToday === 1 ? "" : "s"} due today. Complete them early to stay on track.`,
    };
  }
  if (overdue > 0) {
    return {
      kind: "overdue",
      title: "Clear your overdue tasks",
      body: `You have ${overdue} overdue task${overdue === 1 ? "" : "s"} that need attention.`,
    };
  }
  return {
    kind: "on_track",
    title: "You're on track",
    body: "No urgent tasks need attention right now.",
  };
}

export async function fetchSalespersonTasks(opts: {
  userId: string;
  view?: SalesTaskView;
}): Promise<SalesTasksPayload> {
  const supabase = createAdminClient();
  const now = new Date();
  const view = opts.view ?? "mine";
  const { start: weekStart, end: weekEnd } = weekBounds(now);
  const prev = previousWeekBounds(now);

  const { data: openLeadsRaw, error: openErr } = await supabase
    .from("leads")
    .select(
      "id, name, phone, source, status, follow_up_date, assigned_to_id, score, manual_priority, project_type, form_data, clients ( name )"
    )
    .eq("assigned_to_id", opts.userId)
    .not("follow_up_date", "is", null)
    .order("follow_up_date", { ascending: true });

  if (openErr) {
    console.error("[sales-tasks] open leads", openErr);
    throw new Error("Failed to load tasks");
  }

  const openLeads = (openLeadsRaw ?? []) as LeadRow[];
  const openIds = openLeads.map((l) => l.id);
  const callbacks = await fetchLatestScheduledCallbacksByLeadId(supabase, openIds);

  // Latest FOLLOW_UP_SET actor per lead (created-by signal)
  const creatorByLead = new Map<string, { id: string | null; name: string | null }>();
  if (openIds.length > 0) {
    const { data: setEvents } = await supabase
      .from("lead_events")
      .select("lead_id, actor_id, actor_name, created_at, event_type, event_data")
      .in("lead_id", openIds)
      .eq("event_type", "FOLLOW_UP_SET")
      .order("created_at", { ascending: false })
      .limit(500);

    for (const ev of (setEvents ?? []) as EventRow[]) {
      if (creatorByLead.has(ev.lead_id)) continue;
      const data = ev.event_data ?? {};
      // Skip completion-style events if any
      if (data.completed === true || data.follow_up_date == null) continue;
      creatorByLead.set(ev.lead_id, {
        id: ev.actor_id,
        name: ev.actor_name,
      });
    }
  }

  const openTasks: SalesTaskItem[] = [];
  for (const lead of openLeads) {
    const creator = creatorByLead.get(lead.id);
    const task = buildOpenTask(
      lead,
      callbacks[lead.id],
      creator?.id ?? null,
      creator?.name ?? null,
      now
    );
    if (task) openTasks.push(task);
  }

  // Completed this week / previous week via FOLLOW_UP_SET with completed flag
  const { data: completedEventsRaw } = await supabase
    .from("lead_events")
    .select("lead_id, actor_id, actor_name, event_type, event_data, created_at")
    .eq("event_type", "FOLLOW_UP_SET")
    .eq("actor_id", opts.userId)
    .gte("created_at", prev.start.toISOString())
    .order("created_at", { ascending: false })
    .limit(300);

  const completedEvents = ((completedEventsRaw ?? []) as EventRow[]).filter((ev) => {
    const data = ev.event_data ?? {};
    return data.completed === true || data.follow_up_date == null;
  });

  const completedLeadIds = Array.from(new Set(completedEvents.map((e) => e.lead_id)));
  const completedLeadMap = new Map<string, LeadRow>();
  if (completedLeadIds.length > 0) {
    const { data: completedLeads } = await supabase
      .from("leads")
      .select(
        "id, name, phone, source, status, follow_up_date, assigned_to_id, score, manual_priority, project_type, form_data, clients ( name )"
      )
      .in("id", completedLeadIds)
      .eq("assigned_to_id", opts.userId);
    for (const l of (completedLeads ?? []) as LeadRow[]) {
      completedLeadMap.set(l.id, l);
    }
  }

  const completedTasks: SalesTaskItem[] = [];
  for (const ev of completedEvents) {
    const task = buildCompletedTask(ev, completedLeadMap.get(ev.lead_id));
    if (task) completedTasks.push(task);
  }

  const completedThisWeek = completedTasks.filter((t) => {
    if (!t.completedAt) return false;
    const at = new Date(t.completedAt);
    return at >= weekStart && at <= weekEnd;
  });
  const completedPrevWeek = completedTasks.filter((t) => {
    if (!t.completedAt) return false;
    const at = new Date(t.completedAt);
    return at >= prev.start && at <= prev.end;
  });

  const allForCounts = sortTasksByUrgency([...openTasks, ...completedThisWeek], now);

  const counts = {
    mine: openTasks.filter((t) => t.assignedToId === opts.userId).length,
    assigned: openTasks.filter(
      (t) =>
        t.assignedToId === opts.userId &&
        t.createdById != null &&
        t.createdById !== opts.userId
    ).length,
    created: allForCounts.filter((t) => t.createdById === opts.userId).length,
    all: openTasks.length + completedThisWeek.length,
  };

  const scopedOpen = filterByView(openTasks, view, opts.userId).filter((t) => !t.completed);
  // For created/all views include completed this week when relevant
  const scoped =
    view === "created" || view === "all"
      ? sortTasksByUrgency(
          [
            ...filterByView(openTasks, view, opts.userId),
            ...filterByView(completedThisWeek, view, opts.userId),
          ],
          now
        )
      : sortTasksByUrgency(scopedOpen, now);

  const dueToday = scopedOpen.filter((t) => isTaskDueToday(t.dueAt, now));
  const thisWeek = scopedOpen.filter((t) => isTaskDueThisWeek(t.dueAt, now));
  const overdue = scopedOpen.filter((t) => t.status === "overdue");

  const upcoming = sortTasksByUrgency(
    scopedOpen.filter((t) => t.status !== "overdue"),
    now
  ).slice(0, 4);

  // Assignable leads: assigned to me (for Add task)
  const { data: assignableRaw } = await supabase
    .from("leads")
    .select("id, name, phone, source, status, follow_up_date")
    .eq("assigned_to_id", opts.userId)
    .in("status", ["NEW", "CONTACTED", "NEGOTIATING", "PROPOSAL_SENT"])
    .order("updated_at", { ascending: false })
    .limit(80);

  const assignableLeads = ((assignableRaw ?? []) as Array<{
    id: string;
    name: string | null;
    phone: string | null;
    source: string | null;
    status: string | null;
    follow_up_date: string | null;
  }>).map((l) => ({
    id: l.id,
    name: leadCardDisplayName({
      name: l.name,
      phone: l.phone,
      source: l.source,
      form_data: null,
    }),
    phone: l.phone,
    source: l.source,
    status: l.status,
    followUpDate: l.follow_up_date,
  }));

  return {
    meta: {
      view,
      generatedAt: now.toISOString(),
      currentUserId: opts.userId,
    },
    counts,
    kpis: {
      dueToday: dueToday.length,
      dueTodayHighPriority: dueToday.filter((t) => t.priority === "high").length,
      thisWeek: thisWeek.length,
      thisWeekOverdue: overdue.filter((t) => isTaskDueThisWeek(t.dueAt, now)).length,
      completedThisWeek: completedThisWeek.length,
      completedPrevWeek: completedPrevWeek.length,
      overdue: overdue.length,
    },
    overview: {
      pending: scopedOpen.filter((t) => t.status === "pending").length,
      overdue: overdue.length,
      completedThisWeek: completedThisWeek.length,
      total: scopedOpen.length + completedThisWeek.length,
    },
    tasks: scoped,
    upcoming,
    tip: buildTip(scopedOpen, now),
    assignableLeads,
    capabilities: {
      hasStandaloneTasks: false,
      hasTaskPriorities: false,
      hasTaskStatuses: false,
      hasTaskAssignees: false,
      hasCreatedBy: true,
      completionClearsFollowUp: true,
      notes:
        "Tasks are lead follow-ups (leads.follow_up_date + call_logs.callback_at). Priority is derived from lead score/manual_priority. Completing a task clears the follow-up date.",
    },
  };
}
