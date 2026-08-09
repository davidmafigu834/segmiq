import {
  addDays,
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
import type {
  SalesTaskItem,
  SalesTaskPriority,
  SalesTaskStatusDisplay,
  SalesTaskType,
} from "./types";

export function isTaskOverdue(dueAt: string | Date, now = new Date()): boolean {
  const due = typeof dueAt === "string" ? new Date(dueAt) : dueAt;
  if (!Number.isFinite(due.getTime())) return false;
  return due < now;
}

export function isTaskDueToday(dueAt: string | Date, now = new Date()): boolean {
  const due = typeof dueAt === "string" ? new Date(dueAt) : dueAt;
  if (!Number.isFinite(due.getTime())) return false;
  return isSameDay(due, now) && due >= startOfDay(now);
}

export function isTaskDueThisWeek(dueAt: string | Date, now = new Date()): boolean {
  const due = typeof dueAt === "string" ? new Date(dueAt) : dueAt;
  if (!Number.isFinite(due.getTime())) return false;
  const weekStart = startOfWeek(now, { weekStartsOn: 1 });
  const weekEnd = endOfWeek(now, { weekStartsOn: 1 });
  return due >= weekStart && due <= weekEnd;
}

export function formatTaskDueDate(dueAt: string | Date, now = new Date()): string {
  const due = typeof dueAt === "string" ? new Date(dueAt) : dueAt;
  if (!Number.isFinite(due.getTime())) return "—";
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
  task: Pick<SalesTaskItem, "dueAt" | "completed" | "status">,
  now = new Date()
): "danger" | "warning" | "muted" | "secondary" {
  if (task.completed) return "muted";
  const due = new Date(task.dueAt);
  if (isTaskOverdue(due, now) || task.status === "overdue") return "danger";
  if (isSameDay(due, now)) return "warning";
  if (isTomorrow(due)) return "warning";
  return "secondary";
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

export function sortTasksByUrgency(tasks: SalesTaskItem[], now = new Date()): SalesTaskItem[] {
  const priorityRank: Record<SalesTaskPriority, number> = {
    high: 0,
    medium: 1,
    low: 2,
  };
  return [...tasks].sort((a, b) => {
    if (a.completed !== b.completed) return a.completed ? 1 : -1;
    const aOver = !a.completed && isTaskOverdue(a.dueAt, now);
    const bOver = !b.completed && isTaskOverdue(b.dueAt, now);
    if (aOver !== bOver) return aOver ? -1 : 1;
    const dueDiff = new Date(a.dueAt).getTime() - new Date(b.dueAt).getTime();
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
  const prevEnd = addDays(start, -1);
  return {
    start: startOfWeek(prevEnd, { weekStartsOn: 1 }),
    end: endOfDay(prevEnd),
  };
}

export function matchesDueFilter(
  dueAt: string,
  filter: string,
  now = new Date()
): boolean {
  const due = new Date(dueAt);
  if (!Number.isFinite(due.getTime())) return false;
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
      const end = endOfDay(addDays(now, 7));
      return due >= startOfDay(now) && due <= end;
    }
    case "this_month":
      return due >= startOfMonth(now) && due <= endOfMonth(now);
    default:
      return true;
  }
}
