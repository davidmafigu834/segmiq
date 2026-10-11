import { localYmd, ymdKey } from "@/lib/sales-copilot/dates";
import { formatScheduleWhen, scheduleLine } from "@/lib/sales/tasks/format";
import type { SalesTaskItem } from "@/lib/sales/tasks/types";

export type WorkspaceActionKind = "review" | "quote" | "draft" | "retry" | "task";

export type WorkspacePrimary = {
  label: string;
  kind: WorkspaceActionKind;
};

export type WorkspaceDateLine = {
  text: string;
  tone: "overdue" | "attention" | "neutral";
};

function instant(value: string | null | undefined): Date | null {
  if (!value) return null;
  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? date : null;
}

function dayKey(value: Date, timeZone: string): string {
  return ymdKey(localYmd(value, timeZone));
}

export function greetingPartInTimeZone(now: Date, timeZone: string): "morning" | "afternoon" | "evening" {
  let hour = Number(
    new Intl.DateTimeFormat("en-GB", { timeZone, hour: "2-digit", hourCycle: "h23" }).format(now)
  );
  if (hour === 24) hour = 0;
  if (!Number.isFinite(hour) || hour < 12) return "morning";
  if (hour < 17) return "afternoon";
  return "evening";
}

export function dedupeFollowUps(tasks: SalesTaskItem[]): SalesTaskItem[] {
  const covered = new Set(
    tasks
      .filter(
        (task) =>
          task.copilot?.linkedFollowUp &&
          task.copilot.reviewStatus === "approved" &&
          task.copilot.executionStatus === "succeeded" &&
          task.copilot.fulfilmentStatus === "open"
      )
      .map((task) => task.leadId)
  );
  if (covered.size === 0) return tasks;
  return tasks.filter((task) => !(task.id.startsWith("followup-") && covered.has(task.leadId)));
}

function openTasks(tasks: SalesTaskItem[]): SalesTaskItem[] {
  return dedupeFollowUps(tasks).filter((task) => {
    if (task.completed) return false;
    if (task.copilot?.fulfilmentStatus && task.copilot.fulfilmentStatus !== "open") return false;
    if (task.copilot?.reviewStatus === "dismissed" || task.copilot?.reviewStatus === "stale") return false;
    return true;
  });
}

function realDeadline(task: SalesTaskItem): Date | null {
  if (task.schedule.kind !== "due" && task.schedule.kind !== "check_in") return null;
  return instant(task.schedule.at ?? task.deadlineAt);
}

export function isDueOnLocalDay(task: SalesTaskItem, now: Date, timeZone: string): boolean {
  const due = realDeadline(task);
  if (!due) return false;
  return dayKey(due, timeZone) === dayKey(now, timeZone);
}

export function isOverdueBeforeLocalDay(task: SalesTaskItem, now: Date, timeZone: string): boolean {
  const due = realDeadline(task);
  if (!due) return false;
  return dayKey(due, timeZone) < dayKey(now, timeZone);
}

function needsReview(task: SalesTaskItem): boolean {
  return task.copilot?.listState === "needs_review";
}

function awaitingConfirmation(task: SalesTaskItem): boolean {
  return task.copilot?.payload.awaitingCustomerConfirmation === true;
}

export function briefingCopy(counts: { overdue: number; dueToday: number; needsReview: number }): string {
  const parts: string[] = [];
  if (counts.overdue === 1) parts.push("1 follow-up is overdue.");
  else if (counts.overdue > 1) parts.push(`${counts.overdue} follow-ups are overdue.`);
  if (counts.dueToday === 1) parts.push("1 follow-up is due today.");
  else if (counts.dueToday > 1) parts.push(`${counts.dueToday} follow-ups due today.`);
  if (counts.needsReview === 1) parts.push("1 item needs your review.");
  else if (counts.needsReview > 1) parts.push(`${counts.needsReview} items need your review.`);
  if (parts.length === 0) {
    return "No follow-ups are due today, and nothing is waiting on your review.";
  }
  return parts.join(" ");
}

function blocksPromisedStep(task: SalesTaskItem): boolean {
  const type = task.copilot?.actionType;
  return (
    type === "quotation_draft" ||
    type === "send_quotation" ||
    type === "quotation_missing" ||
    type === "quotation_choice" ||
    type === "create_reminder" ||
    type === "update_reminder" ||
    type === "appointment" ||
    type === "contact_later" ||
    type === "customer_checkin"
  );
}

function actionable(task: SalesTaskItem, now: Date, timeZone: string): boolean {
  if (task.copilot?.executionStatus === "failed") return true;
  if (needsReview(task)) return true;
  if (task.schedule.passedSuggestion) return true;
  if (isDueOnLocalDay(task, now, timeZone) || isOverdueBeforeLocalDay(task, now, timeZone)) return true;
  if (realDeadline(task)) return true;
  if (task.copilot?.listState === "waiting") return false;
  return Boolean(task.copilot) || Boolean(realDeadline(task));
}

function rankBand(task: SalesTaskItem, now: Date, timeZone: string): number {
  const due = realDeadline(task);
  const failed = task.copilot?.executionStatus === "failed";
  if (isOverdueBeforeLocalDay(task, now, timeZone)) return 0;
  if (isDueOnLocalDay(task, now, timeZone) && due && due.getTime() <= now.getTime()) return 1;
  if (isDueOnLocalDay(task, now, timeZone)) return 2;
  if (failed) return 3;
  if (task.schedule.passedSuggestion) return 4;
  if (needsReview(task) && blocksPromisedStep(task)) return 5;
  if (due && due.getTime() >= now.getTime() && due.getTime() - now.getTime() <= 48 * 60 * 60 * 1000) return 6;
  if (needsReview(task)) return 7;
  if (due) return 8;
  return 9;
}

export function rankNextActions(tasks: SalesTaskItem[], now: Date, timeZone: string, limit = 3): SalesTaskItem[] {
  const ranked = openTasks(tasks)
    .filter((task) => actionable(task, now, timeZone))
    .sort((a, b) => {
      const band = rankBand(a, now, timeZone) - rankBand(b, now, timeZone);
      if (band !== 0) return band;
      const aTime = realDeadline(a)?.getTime() ?? instant(a.schedule.at)?.getTime() ?? Number.POSITIVE_INFINITY;
      const bTime = realDeadline(b)?.getTime() ?? instant(b.schedule.at)?.getTime() ?? Number.POSITIVE_INFINITY;
      if (aTime !== bTime) return aTime - bTime;
      return a.title.localeCompare(b.title);
    });
  return ranked.slice(0, limit);
}

export function buildWorkspaceBriefing(tasks: SalesTaskItem[], now: Date, timeZone: string): {
  briefing: string;
  openCount: number;
  overdue: number;
  dueToday: number;
  needsReview: number;
} {
  const open = openTasks(tasks);
  const overdue = open.filter((task) => isOverdueBeforeLocalDay(task, now, timeZone)).length;
  const dueToday = open.filter((task) => isDueOnLocalDay(task, now, timeZone)).length;
  const review = open.filter((task) => needsReview(task)).length;
  return {
    briefing: briefingCopy({ overdue, dueToday, needsReview: review }),
    openCount: open.length,
    overdue,
    dueToday,
    needsReview: review,
  };
}

export function workspacePrimary(task: SalesTaskItem): WorkspacePrimary {
  const copilot = task.copilot;
  if (!copilot) return { label: "View task", kind: "task" };
  if (copilot.executionStatus === "failed") return { label: "Retry", kind: "retry" };
  if (copilot.primaryAction === "quote" && copilot.linkedQuotationId) {
    return { label: "Review draft", kind: "quote" };
  }
  if (
    copilot.primaryAction === "draft" ||
    ((copilot.actionType === "contact_later" || copilot.actionType === "customer_checkin") &&
      copilot.reviewStatus === "approved" &&
      copilot.executionStatus === "succeeded")
  ) {
    return {
      label: copilot.actionType === "answer_question" ? "Draft reply" : "Draft check-in",
      kind: "draft",
    };
  }
  return { label: copilot.actionLabel || "View task", kind: "review" };
}

export function workspaceExplanation(task: SalesTaskItem, now: Date, timeZone: string): string {
  const saved = task.copilot?.explanation?.trim() || task.notes?.trim();
  if (saved) return saved;
  if (isDueOnLocalDay(task, now, timeZone)) return "This follow-up is due today.";
  if (isOverdueBeforeLocalDay(task, now, timeZone)) return "This follow-up is overdue.";
  return "This follow-up is still open.";
}

export function workspaceDateLine(task: SalesTaskItem, timeZone: string, now = new Date()): WorkspaceDateLine {
  const awaiting = awaitingConfirmation(task);
  const proposed = task.schedule.kind === "suggested" || task.schedule.passedSuggestion;
  if (task.copilot?.executionStatus === "failed" && task.copilot.executionError) {
    return { text: task.copilot.executionError, tone: "attention" };
  }
  if (awaiting && (proposed || task.copilot?.reviewStatus !== "approved")) {
    const when = task.schedule.at ? formatScheduleWhen(task.schedule.at, timeZone, now) : null;
    return {
      text: when ? `Awaiting customer confirmation · Suggested: ${when}` : "Awaiting customer confirmation",
      tone: "attention",
    };
  }
  if (awaiting) {
    const overdue = (task.schedule.kind === "due" || task.schedule.kind === "check_in") && task.schedule.overdue;
    return {
      text: `Awaiting customer confirmation · ${scheduleLine(task.schedule, timeZone, now)}`,
      tone: overdue ? "overdue" : "attention",
    };
  }
  if (task.schedule.passedSuggestion && task.schedule.at) {
    return {
      text: `Suggested time has passed: ${formatScheduleWhen(task.schedule.at, timeZone, now)}`,
      tone: "attention",
    };
  }
  if (task.schedule.kind === "none" && task.schedule.expectedReplyAt) {
    return {
      text: `Expected reply: ${formatScheduleWhen(task.schedule.expectedReplyAt, timeZone, now)}`,
      tone: "neutral",
    };
  }
  if (task.schedule.kind === "none") return { text: "No date set", tone: "neutral" };
  const overdue = task.schedule.kind === "due" || task.schedule.kind === "check_in" ? task.schedule.overdue : false;
  return {
    text: scheduleLine(task.schedule, timeZone, now),
    tone: overdue ? "overdue" : task.schedule.kind === "suggested" ? "attention" : "neutral",
  };
}
