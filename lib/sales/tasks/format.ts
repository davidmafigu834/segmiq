import {
  addDays as addDateDays,
  endOfDay,
  endOfMonth,
  endOfWeek,
  format,
  isSameDay,
  isTomorrow,
  isYesterday,
  startOfDay,
  startOfMonth,
  startOfWeek,
} from "date-fns";
import { addDays, localYmd, ymdKey } from "@/lib/sales-copilot/dates";
import type {
  SalesTaskItem,
  SalesTaskPriority,
  SalesTaskStatusDisplay,
  SalesTaskType,
  TaskSchedule,
} from "./types";

function asDate(dueAt: string | Date | null | undefined): Date | null {
  if (dueAt == null || dueAt === "") return null;
  const due = typeof dueAt === "string" ? new Date(dueAt) : dueAt;
  return Number.isFinite(due.getTime()) ? due : null;
}

export function isTaskOverdue(dueAt: string | Date | null | undefined, now = new Date()): boolean {
  const due = asDate(dueAt);
  if (!due) return false;
  return due < now;
}

export function isTaskDueToday(dueAt: string | Date | null | undefined, now = new Date()): boolean {
  const due = asDate(dueAt);
  if (!due) return false;
  return isSameDay(due, now) && due >= startOfDay(now);
}

export function isTaskDueThisWeek(dueAt: string | Date | null | undefined, now = new Date()): boolean {
  const due = asDate(dueAt);
  if (!due) return false;
  const weekStart = startOfWeek(now, { weekStartsOn: 1 });
  const weekEnd = endOfWeek(now, { weekStartsOn: 1 });
  return due >= weekStart && due <= weekEnd;
}

export function formatTaskDueDate(dueAt: string | Date | null | undefined, now = new Date()): string {
  const due = asDate(dueAt);
  if (!due) return "No date set";
  const time = format(due, "h:mm a");
  if (isSameDay(due, now)) return `Today, ${time}`;
  if (isTomorrow(due)) return `Tomorrow, ${time}`;
  if (isYesterday(due)) return `Yesterday, ${time}`;
  if (due.getFullYear() === now.getFullYear()) {
    return `${format(due, "EEE, d MMM")}, ${time}`;
  }
  return `${format(due, "d MMM yyyy")}, ${time}`;
}

export function dueDateTone(
  task: Pick<SalesTaskItem, "dueAt" | "completed" | "status" | "schedule">,
  now = new Date()
): "danger" | "warning" | "muted" | "secondary" {
  if (task.completed) return "muted";
  if (task.schedule?.overdue || task.status === "overdue") return "danger";
  if (task.schedule?.passedSuggestion) return "warning";
  if (!task.schedule?.at && !task.dueAt) return "muted";
  const due = asDate(task.schedule?.at ?? task.dueAt);
  if (!due) return "muted";
  if (task.schedule?.kind === "suggested") return "secondary";
  if (isSameDay(due, now) || isTomorrow(due)) return "warning";
  return "secondary";
}

function tidyClock(value: string): string {
  return value.replace(/[\u202f\u00a0]/g, " ");
}

/** Relative date in the company timezone. Does not use the server's local calendar. */
export function formatScheduleWhen(iso: string, timeZone: string, now = new Date()): string {
  const due = new Date(iso);
  if (!Number.isFinite(due.getTime())) return "No date set";
  const dueDay = ymdKey(localYmd(due, timeZone));
  const today = localYmd(now, timeZone);
  const time = tidyClock(
    new Intl.DateTimeFormat("en-US", { timeZone, hour: "numeric", minute: "2-digit" }).format(due)
  );
  if (dueDay === ymdKey(today)) return `Today, ${time}`;
  if (dueDay === ymdKey(addDays(today, 1))) return `Tomorrow, ${time}`;
  if (dueDay === ymdKey(addDays(today, -1))) return `Yesterday, ${time}`;
  const date = tidyClock(
    new Intl.DateTimeFormat("en-GB", {
      timeZone,
      weekday: "short",
      day: "numeric",
      month: "short",
    }).format(due)
  );
  return `${date}, ${time}`;
}

export function scheduleLine(schedule: TaskSchedule, timeZone: string, now = new Date()): string {
  if (schedule.kind === "none" || !schedule.at) return "No date set";
  return `${schedule.label}: ${formatScheduleWhen(schedule.at, timeZone, now)}`;
}

export function manualTaskSchedule(dueAt: string, completed: boolean, now = new Date()): TaskSchedule {
  const overdue = !completed && isTaskOverdue(dueAt, now);
  return {
    kind: "due",
    label: overdue ? "Overdue" : "Due",
    at: dueAt,
    overdue,
    passedSuggestion: false,
    expectedReplyAt: null,
  };
}

export function formatTaskPriority(priority: SalesTaskPriority): string {
  if (priority === "high") return "High";
  if (priority === "medium") return "Medium";
  return "Low";
}

export function formatTaskStatus(status: SalesTaskStatusDisplay): string {
  if (status === "overdue") return "Overdue";
  if (status === "completed") return "Completed";
  return "Pending";
}

export function getTaskTypeLabel(type: SalesTaskType): string {
  switch (type) {
    case "call":
      return "Call";
    case "quote_review":
      return "Proposal";
    case "whatsapp":
      return "WhatsApp";
    default:
      return "Follow-up";
  }
}

export function priorityFromLead(opts: {
  manualPriority?: string | null;
  score?: number | null;
}): SalesTaskPriority {
  const mp = (opts.manualPriority ?? "").toLowerCase();
  if (mp === "hot") return "high";
  if (mp === "warm") return "medium";
  if (mp === "cold") return "low";
  const score = opts.score ?? null;
  if (score != null) {
    if (score >= 70) return "high";
    if (score >= 40) return "medium";
    return "low";
  }
  return "medium";
}

export function inferTaskType(opts: {
  hasTimedCallback: boolean;
  status?: string | null;
  source?: string | null;
}): SalesTaskType {
  if (opts.hasTimedCallback) return "call";
  if (opts.status === "PROPOSAL_SENT") return "quote_review";
  const source = (opts.source ?? "").toUpperCase();
  if (source.includes("WHATSAPP")) return "whatsapp";
  return "follow_up";
}

export function titleForTask(type: SalesTaskType, relatedName: string): string {
  const name = relatedName.trim() || "lead";
  switch (type) {
    case "call":
      return `Call back ${name}`;
    case "quote_review":
      return `Follow up on proposal · ${name}`;
    case "whatsapp":
      return `WhatsApp follow-up · ${name}`;
    default:
      return `Follow up with ${name}`;
  }
}

export function sortTasksByUrgency(tasks: SalesTaskItem[]): SalesTaskItem[] {
  const priorityRank: Record<SalesTaskPriority, number> = {
    high: 0,
    medium: 1,
    low: 2,
  };
  const rank = (task: SalesTaskItem) => {
    if (task.completed) return 5;
    if (task.schedule?.overdue) return 0;
    if (task.copilot?.executionStatus === "failed" || task.copilot?.listState === "needs_review") return 1;
    if (task.schedule?.kind === "due" || task.schedule?.kind === "check_in") return 2;
    if (task.schedule?.kind === "suggested") return 3;
    return 4;
  };
  const time = (task: SalesTaskItem) => {
    const at = task.deadlineAt ?? task.schedule?.at ?? null;
    const parsed = at ? new Date(at).getTime() : Number.NaN;
    return Number.isFinite(parsed) ? parsed : Number.POSITIVE_INFINITY;
  };
  return [...tasks].sort((a, b) => {
    const rankDiff = rank(a) - rank(b);
    if (rankDiff !== 0) return rankDiff;
    const dueDiff = time(a) - time(b);
    if (dueDiff !== 0) return dueDiff;
    return priorityRank[a.priority] - priorityRank[b.priority];
  });
}

export function weekBounds(now = new Date()) {
  return {
    start: startOfWeek(now, { weekStartsOn: 1 }),
    end: endOfWeek(now, { weekStartsOn: 1 }),
  };
}

export function previousWeekBounds(now = new Date()) {
  const { start } = weekBounds(now);
  const prevEnd = addDateDays(start, -1);
  return {
    start: startOfWeek(prevEnd, { weekStartsOn: 1 }),
    end: endOfDay(prevEnd),
  };
}

export function matchesDueFilter(
  dueAt: string | null | undefined,
  filter: string,
  now = new Date()
): boolean {
  const due = asDate(dueAt);
  if (!due) return false;
  switch (filter) {
    case "overdue":
      return isTaskOverdue(due, now);
    case "today":
      return isSameDay(due, now);
    case "tomorrow":
      return isTomorrow(due);
    case "this_week":
      return isTaskDueThisWeek(due, now);
    case "next_7": {
      const end = endOfDay(addDateDays(now, 7));
      return due >= startOfDay(now) && due <= end;
    }
    case "this_month":
      return due >= startOfMonth(now) && due <= endOfMonth(now);
    default:
      return true;
  }
}
