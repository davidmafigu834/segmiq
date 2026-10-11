"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  Calendar,
  CalendarClock,
  CheckSquare,
  ChevronDown,
  ClipboardList,
  Clock,
  FileText,
  Filter,
  Lightbulb,
  MessageCircle,
  MoreHorizontal,
  Phone,
  Plus,
  X,
} from "lucide-react";
import { SiWhatsapp } from "react-icons/si";
import { addDays, format } from "date-fns";
import { PremiumSheet } from "@/components/sales/PremiumSheet";
import {
  Button,
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
  Checkbox,
  DataTableActionsCell,
  DataTableBody,
  DataTableCheckboxCell,
  DataTableEl,
  DataTableFooter,
  DataTableHead,
  DataTablePagination,
  DataTableRow,
  DataTableScroll,
  DataTableTd,
  DataTableTh,
  DataTableWorkspace,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  EmptyState,
  ErrorState,
  IconButton,
  MenuSelect,
  SalesDonutChart,
  SegmentedControl,
  Skeleton,
  useSalesToast,
} from "@/components/sales/ui";
import { ReportKpiCard } from "@/components/sales/reports/ReportKpiCard";
import { AddTaskSheet } from "@/components/sales/tasks/AddTaskSheet";
import { TaskDetailDrawer, type TaskActionBody } from "@/components/sales/tasks/TaskDetailDrawer";
import { formatTrend } from "@/lib/sales/sales-dashboard-display";
import { customerDraft, stageCopilotDraft } from "@/lib/sales-copilot/draft";
import {
  dueDateTone,
  formatScheduleWhen,
  formatTaskPriority,
  matchesDueFilter,
  scheduleLine,
} from "@/lib/sales/tasks/format";
import type {
  SalesTaskDueFilter,
  SalesTaskItem,
  SalesTaskQuickFilter,
  SalesTaskStatusFilter,
  SalesTaskView,
  SalesTasksPayload,
} from "@/lib/sales/tasks/types";
import { cn } from "@/lib/ui/cn";
import { toDateKey } from "@/lib/sales/calendar/format";

const PAGE_SIZE_OPTIONS = [10, 20, 50] as const;

function TypeIcon({ type, size = 16 }: { type: SalesTaskItem["type"]; size?: number }) {
  if (type === "whatsapp") return <SiWhatsapp size={size} color="#25D366" aria-hidden />;
  if (type === "call") return <Phone size={size} strokeWidth={1.8} className="text-sales-teal" />;
  if (type === "quote_review")
    return <FileText size={size} strokeWidth={1.8} className="text-sales-warning-fg" />;
  return <CalendarClock size={size} strokeWidth={1.8} className="text-sales-success" />;
}

function typeTint(type: SalesTaskItem["type"]) {
  if (type === "whatsapp") return "bg-sales-success-soft";
  if (type === "call") return "bg-sales-teal-soft";
  if (type === "quote_review") return "bg-sales-warning-soft";
  return "bg-sales-success-soft";
}

function priorityDot(priority: SalesTaskItem["priority"]) {
  if (priority === "high") return "bg-sales-danger";
  if (priority === "medium") return "bg-sales-warning";
  return "bg-sales-success";
}

type CopilotQueue = "all" | "needs_review" | "todo" | "waiting" | "contact_later";

type TaskCardTone = "review" | "todo" | "waiting" | "later" | "failed" | "done";

const SCOPE_OPTIONS: { value: SalesTaskView; label: string; countKey: "mine" | "assigned" | "created" | "all" }[] = [
  { value: "mine", label: "My tasks", countKey: "mine" },
  { value: "assigned", label: "Assigned to me", countKey: "assigned" },
  { value: "created", label: "Created by me", countKey: "created" },
  { value: "all", label: "All tasks", countKey: "all" },
];

const QUEUE_FILTERS: { value: CopilotQueue; label: string; full: string; tone: string }[] = [
  { value: "all", label: "All", full: "All", tone: "all" },
  { value: "needs_review", label: "Review", full: "Needs review", tone: "review" },
  { value: "todo", label: "To do", full: "To do", tone: "todo" },
  { value: "waiting", label: "Waiting", full: "Waiting", tone: "waiting" },
  { value: "contact_later", label: "Later", full: "Contact later", tone: "later" },
];

function matchesCopilotQueue(task: SalesTaskItem, queue: CopilotQueue): boolean {
  if (queue === "needs_review") return task.copilot?.listState === "needs_review";
  if (queue === "todo") return task.copilot?.listState === "todo";
  if (queue === "waiting") return task.copilot?.listState === "waiting";
  if (queue === "contact_later") {
    return task.copilot?.actionType === "contact_later" || task.copilot?.actionType === "customer_checkin";
  }
  return true;
}

function matchesScopedTask(
  task: SalesTaskItem,
  opts: {
    statusFilter: SalesTaskStatusFilter;
    dueFilter: SalesTaskDueFilter;
    quickFilters: SalesTaskQuickFilter[];
    view: SalesTaskView;
  }
): boolean {
  if (opts.statusFilter === "pending" && task.status !== "pending") return false;
  if (opts.statusFilter === "overdue" && task.status !== "overdue") return false;
  if (opts.statusFilter === "completed" && !task.completed) return false;
  if (opts.statusFilter === "all" && task.completed) {
    if (opts.view === "mine" || opts.view === "assigned") return false;
  }
  if (opts.dueFilter !== "all" && !task.completed && !matchesDueFilter(task.deadlineAt, opts.dueFilter)) {
    return false;
  }
  for (const q of opts.quickFilters) {
    if (q === "high_priority" && task.priority !== "high") return false;
    if (q === "overdue" && task.status !== "overdue") return false;
    if (q === "due_today" && !matchesDueFilter(task.deadlineAt, "today")) return false;
    if (q === "follow_ups" && task.type !== "follow_up" && task.type !== "whatsapp") return false;
    if (q === "calls" && task.type !== "call") return false;
    if (q === "quote_reviews" && task.type !== "quote_review") return false;
  }
  return true;
}

function taskCardStatus(task: SalesTaskItem): { label: string; tone: TaskCardTone } {
  if (task.completed) return { label: "Completed", tone: "done" };
  if (task.copilot?.executionStatus === "failed") return { label: "Failed", tone: "failed" };
  const action = task.copilot?.actionType;
  const contactLater = action === "contact_later" || action === "customer_checkin";
  if (task.copilot?.listState === "needs_review") return { label: "Needs review", tone: "review" };
  if (task.copilot?.listState === "waiting") return { label: "Waiting", tone: "waiting" };
  if (contactLater && task.copilot?.listState !== "todo") return { label: "Contact later", tone: "later" };
  return { label: "To do", tone: "todo" };
}

function taskKindIcon(task: SalesTaskItem) {
  const action = task.copilot?.actionType ?? "";
  const title = `${task.title} ${task.typeLabel}`.toLowerCase();
  const iconProps = { size: 18, strokeWidth: 1.8, "aria-hidden": true as const };
  if (action === "appointment" || /\b(meeting|viewing|visit)\b/.test(title)) {
    return <Calendar {...iconProps} />;
  }
  if (
    action === "quotation_draft" ||
    action === "quotation_missing" ||
    action === "quotation_choice" ||
    action === "send_quotation" ||
    action === "listing_shortlist" ||
    task.type === "quote_review"
  ) {
    return <FileText {...iconProps} />;
  }
  if (action === "customer_checkin" || action === "answer_question" || action === "contact_later" || task.type === "whatsapp") {
    return <MessageCircle {...iconProps} />;
  }
  if (action === "open_commitment" || /\b(team review|internal review)\b/.test(title)) {
    return <ClipboardList {...iconProps} />;
  }
  if (task.type === "call" || /\b(call|callback|phone)\b/.test(title)) {
    return <Phone {...iconProps} />;
  }
  if (action === "create_reminder" || action === "update_reminder" || task.type === "follow_up") {
    return <Clock {...iconProps} />;
  }
  return <CalendarClock {...iconProps} />;
}

function cardDateText(task: SalesTaskItem, timeZone: string): string {
  const line = scheduleLine(task.schedule, timeZone);
  if (line.startsWith("Suggested time:")) return `Suggested:${line.slice("Suggested time:".length)}`;
  return line;
}

function customerInitial(name: string): string {
  const trimmed = name.trim();
  return trimmed ? trimmed.charAt(0).toUpperCase() : "?";
}

function parseView(raw: string | null): SalesTaskView {
  if (raw === "assigned" || raw === "created" || raw === "all" || raw === "mine") return raw;
  return "mine";
}

export function SalesTasksClient() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { toast } = useSalesToast();

  const view = parseView(searchParams.get("view"));
  const [statusFilter, setStatusFilter] = useState<SalesTaskStatusFilter>(
    (searchParams.get("status") as SalesTaskStatusFilter) || "all"
  );
  const [dueFilter, setDueFilter] = useState<SalesTaskDueFilter>(
    (searchParams.get("due") as SalesTaskDueFilter) || "all"
  );
  const [copilotQueue, setCopilotQueue] = useState<CopilotQueue>("all");
  const [quickFilters, setQuickFilters] = useState<SalesTaskQuickFilter[]>([]);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [data, setData] = useState<SalesTasksPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [detail, setDetail] = useState<SalesTaskItem | null>(null);
  const [selecting, setSelecting] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const [tipDismissed, setTipDismissed] = useState(false);
  const [rescheduleTask, setRescheduleTask] = useState<SalesTaskItem | null>(null);
  const [rescheduleDate, setRescheduleDate] = useState(toDateKey(addDays(new Date(), 1)));

  const setView = (next: SalesTaskView) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set("view", next);
    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
    setPage(1);
  };

  const load = useCallback(async () => {
    setLoading(true);
    setError(false);
    try {
      const res = await fetch(`/api/sales/tasks?view=${view}`);
      if (!res.ok) throw new Error("Failed");
      const json = (await res.json()) as SalesTasksPayload;
      setData(json);
    } catch {
      setError(true);
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [view]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    const onChange = () => {
      void load();
    };
    window.addEventListener("segmiq:sales-work-changed", onChange);
    return () => window.removeEventListener("segmiq:sales-work-changed", onChange);
  }, [load]);

  useEffect(() => {
    setPage(1);
  }, [statusFilter, dueFilter, quickFilters, view]);

  const scopedTasks = useMemo(() => {
    if (!data) return [];
    return data.tasks.filter((task) =>
      matchesScopedTask(task, { statusFilter, dueFilter, quickFilters, view })
    );
  }, [data, statusFilter, dueFilter, quickFilters, view]);

  const filteredTasks = useMemo(
    () => scopedTasks.filter((task) => matchesCopilotQueue(task, copilotQueue)),
    [scopedTasks, copilotQueue]
  );

  const queueCounts = useMemo(() => {
    const counts: Record<CopilotQueue, number> = {
      all: scopedTasks.length,
      needs_review: 0,
      todo: 0,
      waiting: 0,
      contact_later: 0,
    };
    for (const task of scopedTasks) {
      if (matchesCopilotQueue(task, "needs_review")) counts.needs_review += 1;
      if (matchesCopilotQueue(task, "todo")) counts.todo += 1;
      if (matchesCopilotQueue(task, "waiting")) counts.waiting += 1;
      if (matchesCopilotQueue(task, "contact_later")) counts.contact_later += 1;
    }
    return counts;
  }, [scopedTasks]);

  const pageCount = Math.max(1, Math.ceil(filteredTasks.length / pageSize));
  const pageSafe = Math.min(page, pageCount);
  const pageRows = filteredTasks.slice((pageSafe - 1) * pageSize, pageSafe * pageSize);
  const showingFrom = filteredTasks.length === 0 ? 0 : (pageSafe - 1) * pageSize + 1;
  const showingTo = Math.min(pageSafe * pageSize, filteredTasks.length);

  const activeFilterCount =
    (statusFilter !== "all" ? 1 : 0) +
    (dueFilter !== "all" ? 1 : 0) +
    quickFilters.length;

  const clearFilters = () => {
    setStatusFilter("all");
    setDueFilter("all");
    setQuickFilters([]);
  };

  const toggleQuick = (key: SalesTaskQuickFilter) => {
    setQuickFilters((prev) =>
      prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]
    );
  };

  function canSelect(task: SalesTaskItem) {
    if (task.completed) return false;
    if (!task.copilot) return true;
    return task.copilot.primaryAction === "complete" && task.copilot.executionStatus !== "failed";
  }

  async function runCopilot(task: SalesTaskItem, body: TaskActionBody) {
    if (!task.copilot) return;
    setBusyId(task.id);
    setActionError(null);
    try {
      const res = await fetch(`/api/sales/copilot/work-items/${task.copilot.workItemId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        const message = json.error ?? "Could not update this task";
        setActionError(message);
        toast({ title: message, tone: "error" });
        return;
      }
      toast({
        title: body.action === "dismiss" ? "Dismissed" : body.action === "snooze" ? "Snoozed" : body.action === "complete" ? "Completed" : "Saved",
        tone: "success",
      });
      setDetail(null);
      await load();
    } finally {
      setBusyId(null);
    }
  }

  function openDraft(task: SalesTaskItem) {
    if (!task.copilot) return;
    const text = customerDraft({
      actionType: task.copilot.actionType,
      explanation: task.copilot.explanation,
      payload: task.copilot.payload,
    });
    stageCopilotDraft(task.leadId, text);
    window.location.assign(task.whatsappHref ?? task.leadHref);
  }

  function onPrimary(task: SalesTaskItem) {
    const action = task.copilot?.primaryAction;
    if (!task.copilot || action === "review" || action === "missing" || action === "choose" || action === "details" || action === "complete") {
      setActionError(null);
      setDetail(task);
      return;
    }
    if (action === "quote" && task.copilot.linkedQuotationId) {
      window.location.assign(`/sales/quotes/${task.copilot.linkedQuotationId}`);
      return;
    }
    if (action === "draft") {
      openDraft(task);
      return;
    }
    if (action === "retry") void runCopilot(task, { action: "retry" });
  }

  async function completeTask(task: SalesTaskItem) {
    if (task.completed) return;
    if (task.copilot) {
      if (task.copilot.primaryAction === "complete" && task.copilot.reviewStatus === "approved") {
        await runCopilot(task, { action: "complete" });
        return;
      }
      setDetail(task);
      return;
    }
    const prev = data;
    setData((d) => {
      if (!d) return d;
      return {
        ...d,
        tasks: d.tasks.filter((t) => t.id !== task.id),
        kpis: {
          ...d.kpis,
          overdue: Math.max(0, d.kpis.overdue - (task.status === "overdue" ? 1 : 0)),
          dueToday: Math.max(
            0,
            d.kpis.dueToday - (matchesDueFilter(task.deadlineAt, "today") ? 1 : 0)
          ),
          thisWeek: Math.max(
            0,
            d.kpis.thisWeek - (matchesDueFilter(task.deadlineAt, "this_week") ? 1 : 0)
          ),
          completedThisWeek: d.kpis.completedThisWeek + 1,
        },
        counts: {
          ...d.counts,
          mine: Math.max(0, d.counts.mine - 1),
          all: Math.max(0, d.counts.all - 1),
        },
      };
    });
    setDetail(null);
    try {
      const res = await fetch(`/api/leads/${task.leadId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ follow_up_date: null }),
      });
      if (!res.ok) throw new Error("fail");
      toast({
        tone: "success",
        title: "Task completed",
        description: `"${task.title}" was marked complete.`,
      });
      void load();
    } catch {
      setData(prev);
      toast({
        tone: "error",
        title: "Couldn't update task",
        description: "Try again.",
      });
    }
  }

  async function saveReschedule() {
    if (!rescheduleTask || !rescheduleDate) return;
    try {
      const res = await fetch(`/api/leads/${rescheduleTask.leadId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ follow_up_date: rescheduleDate }),
      });
      if (!res.ok) throw new Error("fail");
      toast({
        tone: "success",
        title: "Task rescheduled",
        description: `Due date updated to ${format(new Date(`${rescheduleDate}T12:00:00`), "d MMM")}.`,
      });
      setRescheduleTask(null);
      setDetail(null);
      void load();
    } catch {
      toast({
        tone: "error",
        title: "Couldn't update task",
        description: "Try again.",
      });
    }
  }

  const completedTrend = data
    ? formatTrend(data.kpis.completedThisWeek, data.kpis.completedPrevWeek)
    : null;

  return (
    <div className="sales-tasks-root w-full min-w-0 max-w-none space-y-3 overflow-x-hidden px-3 pb-4 text-left min-[390px]:px-4 layout:space-y-4 layout:overflow-visible layout:px-6">
      <div className="sales-tasks-mobile layout:hidden">
        <div className="sales-tasks-heading">
          <h1>Tasks</h1>
          {data ? (
            <span className="sales-tasks-count" aria-label={`${filteredTasks.length} ${filteredTasks.length === 1 ? "task" : "tasks"}`}>
              {filteredTasks.length}
            </span>
          ) : null}
          <div className="sales-tasks-heading-actions">
            <button
              type="button"
              className="sales-tasks-icon-btn"
              aria-label={activeFilterCount > 0 ? `Filters, ${activeFilterCount} active` : "Filters"}
              onClick={() => setFiltersOpen((open) => !open)}
            >
              <Filter size={18} strokeWidth={1.8} />
              {activeFilterCount > 0 ? <span className="sales-tasks-filter-count" /> : null}
            </button>
            <button type="button" className="sales-tasks-add" onClick={() => setAddOpen(true)}>
              <Plus size={16} strokeWidth={1.8} />
              Add
            </button>
          </div>
        </div>
        <div className="sales-tasks-scopes" role="radiogroup" aria-label="Task ownership">
          {SCOPE_OPTIONS.map((option) => (
            <button
              key={option.value}
              type="button"
              role="radio"
              aria-checked={view === option.value}
              className={cn("sales-task-scope", view === option.value && "is-selected")}
              onClick={() => setView(option.value)}
            >
              <span>{option.label}</span>
              <span className="sales-task-scope-count">{data?.counts[option.countKey] ?? 0}</span>
            </button>
          ))}
        </div>
      </div>
      <div className="hidden h-10 w-full min-w-0 items-center justify-start gap-3 layout:flex">
        <div className="min-w-0 flex-1 overflow-x-auto">
          <SegmentedControl
            aria-label="Task ownership"
            value={view}
            onChange={setView}
            options={[
              { value: "mine", label: "My tasks", badge: data?.counts.mine ?? 0 },
              { value: "assigned", label: "Assigned to me", badge: data?.counts.assigned ?? 0 },
              { value: "created", label: "Created by me", badge: data?.counts.created ?? 0 },
              { value: "all", label: "All tasks", badge: data?.counts.all ?? 0 },
            ]}
          />
        </div>

        <div className="flex h-10 shrink-0 items-center gap-2">
          <div className="hidden items-center gap-2 layout:flex">
            <MenuSelect
              aria-label="Sales Copilot queue"
              value={copilotQueue}
              onChange={setCopilotQueue}
              options={[
                { value: "all", label: "All work" },
                { value: "needs_review", label: "Needs review" },
                { value: "todo", label: "To do" },
                { value: "waiting", label: "Waiting" },
                { value: "contact_later", label: "Contact later" },
              ]}
            />
            <MenuSelect
              value={statusFilter}
              onChange={setStatusFilter}
              options={[
                { value: "all", label: "All statuses" },
                { value: "pending", label: "Pending" },
                { value: "overdue", label: "Overdue" },
                { value: "completed", label: "Completed" },
              ]}
            />
            <MenuSelect
              aria-label="Due date filter"
              value={dueFilter}
              onChange={setDueFilter}
              options={[
                { value: "all", label: "Due date" },
                { value: "overdue", label: "Overdue" },
                { value: "today", label: "Today" },
                { value: "tomorrow", label: "Tomorrow" },
                { value: "this_week", label: "This week" },
                { value: "next_7", label: "Next 7 days" },
                { value: "this_month", label: "This month" },
              ]}
            />
          </div>
          <div className="relative shrink-0">
            <Button
              variant="secondary"
              size="md"
              className="h-10 whitespace-nowrap rounded-[10px]"
              leftIcon={<Filter size={16} strokeWidth={1.8} />}
              onClick={() => setFiltersOpen((v) => !v)}
            >
              Filters{activeFilterCount > 0 ? ` ${activeFilterCount}` : ""}
            </Button>
            {filtersOpen ? (
              <>
                <div className="hidden layout:block">
                  <button
                    type="button"
                    className="fixed inset-0 z-20"
                    aria-label="Close filters"
                    onClick={() => setFiltersOpen(false)}
                  />
                  <div className="absolute right-0 z-30 mt-1.5 w-[280px] overflow-hidden rounded-[12px] border border-sales-border bg-sales-surface shadow-[0_8px_24px_rgba(16,24,40,0.10)]">
                    <div className="border-b border-sales-border-subtle px-3.5 py-3">
                      <p className="text-[13px] font-semibold text-sales-text-primary">Filters</p>
                      <p className="mt-0.5 text-[12px] text-sales-text-secondary">
                        Refine by priority and task type
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-1.5 p-3.5">
                      {(
                        [
                          ["high_priority", "High priority"],
                          ["overdue", "Overdue"],
                          ["due_today", "Due today"],
                          ["follow_ups", "Follow-ups"],
                          ["calls", "Calls"],
                          ["quote_reviews", "Proposals"],
                        ] as const
                      ).map(([key, label]) => (
                        <button
                          key={key}
                          type="button"
                          onClick={() => toggleQuick(key)}
                          className={cn(
                            "rounded-sales-md border px-2.5 py-1.5 text-[12px] font-medium transition-colors",
                            quickFilters.includes(key)
                              ? "border-sales-brand-border bg-sales-brand-soft text-sales-text-primary"
                              : "border-sales-border text-sales-text-secondary hover:bg-sales-surface-hover"
                          )}
                        >
                          {label}
                        </button>
                      ))}
                    </div>
                    {activeFilterCount > 0 ? (
                      <div className="border-t border-sales-border-subtle px-3.5 py-2.5">
                        <button
                          type="button"
                          className="text-[12px] font-medium text-sales-brand-fg hover:underline"
                          onClick={clearFilters}
                        >
                          Clear filters
                        </button>
                      </div>
                    ) : null}
                  </div>
                </div>
                <div className="layout:hidden">
                  <PremiumSheet
                    title="Filters"
                    description="Status, due date, and quick filters"
                    onClose={() => setFiltersOpen(false)}
                    footer={
                      activeFilterCount > 0 ? (
                        <Button variant="secondary" size="md" className="w-full" onClick={clearFilters}>
                          Clear filters
                        </Button>
                      ) : undefined
                    }
                  >
                    <div className="space-y-4">
                      <div>
                        <p className="mb-1.5 text-[11px] font-medium text-sales-text-muted">Sales Copilot</p>
                        <MenuSelect
                          aria-label="Sales Copilot queue"
                          value={copilotQueue}
                          onChange={setCopilotQueue}
                          options={[
                            { value: "all", label: "All work" },
                            { value: "needs_review", label: "Needs review" },
                            { value: "todo", label: "To do" },
                            { value: "waiting", label: "Waiting" },
                            { value: "contact_later", label: "Contact later" },
                          ]}
                        />
                      </div>
                      <div>
                        <p className="mb-1.5 text-[11px] font-medium text-sales-text-muted">Status</p>
                        <MenuSelect
                          aria-label="Status filter"
                          value={statusFilter}
                          onChange={setStatusFilter}
                          options={[
                            { value: "all", label: "All statuses" },
                            { value: "pending", label: "Pending" },
                            { value: "overdue", label: "Overdue" },
                            { value: "completed", label: "Completed" },
                          ]}
                        />
                      </div>
                      <div>
                        <p className="mb-1.5 text-[11px] font-medium text-sales-text-muted">Due date</p>
                        <MenuSelect
                          aria-label="Due date filter"
                          value={dueFilter}
                          onChange={setDueFilter}
                          options={[
                            { value: "all", label: "Due date" },
                            { value: "overdue", label: "Overdue" },
                            { value: "today", label: "Today" },
                            { value: "tomorrow", label: "Tomorrow" },
                            { value: "this_week", label: "This week" },
                            { value: "next_7", label: "Next 7 days" },
                            { value: "this_month", label: "This month" },
                          ]}
                        />
                      </div>
                      <div>
                        <p className="mb-1.5 text-[11px] font-medium text-sales-text-muted">Quick filters</p>
                        <div className="flex flex-wrap gap-1.5">
                          {(
                            [
                              ["high_priority", "High priority"],
                              ["overdue", "Overdue"],
                              ["due_today", "Due today"],
                              ["follow_ups", "Follow-ups"],
                              ["calls", "Calls"],
                              ["quote_reviews", "Proposals"],
                            ] as const
                          ).map(([key, label]) => (
                            <button
                              key={key}
                              type="button"
                              onClick={() => toggleQuick(key)}
                              className={cn(
                                "rounded-sales-md border px-2.5 py-1.5 text-[12px] font-medium transition-colors",
                                quickFilters.includes(key)
                                  ? "border-sales-brand-border bg-sales-brand-soft text-sales-text-primary"
                                  : "border-sales-border text-sales-text-secondary hover:bg-sales-surface-hover"
                              )}
                            >
                              {label}
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>
                  </PremiumSheet>
                </div>
              </>
            ) : null}
          </div>
          <Button
            variant="primary"
            size="md"
            className="h-10 shrink-0 whitespace-nowrap rounded-[10px]"
            leftIcon={<Plus size={16} strokeWidth={1.8} />}
            onClick={() => setAddOpen(true)}
          >
            <span className="hidden sm:inline">Add task</span>
            <span className="sm:hidden">Add</span>
          </Button>
          <IconButton
            aria-label="More actions"
            size="md"
            className="hidden h-10 w-10 shrink-0 rounded-[10px] layout:inline-flex"
          >
            <MoreHorizontal strokeWidth={1.8} />
          </IconButton>
        </div>
      </div>

      {error ? (
        <Card>
          <CardContent className="py-8">
            <ErrorState
              title="Unable to load tasks"
              description="We couldn't retrieve your tasks right now."
              onRetry={() => void load()}
              retryLoading={loading}
              size="compact"
            />
          </CardContent>
        </Card>
      ) : null}

      {loading && !data ? <TasksSkeleton /> : null}

      {data ? (
        <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_320px]">
          <div className="min-w-0 space-y-4">
            <div className="hidden space-y-3 layout:block">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                <ReportKpiCard
                  label="Due today"
                  value={String(data.kpis.dueToday)}
                  supporting={
                    data.kpis.dueToday === 0 ? "Nothing due today" : undefined
                  }
                  trend={
                    data.kpis.dueTodayHighPriority > 0
                      ? {
                          direction: "alert",
                          label: `${data.kpis.dueTodayHighPriority} high priority`,
                        }
                      : null
                  }
                />
                <ReportKpiCard
                  label="This week"
                  value={String(data.kpis.thisWeek)}
                  trend={
                    data.kpis.thisWeekOverdue > 0
                      ? {
                          direction: "alert",
                          label: `${data.kpis.thisWeekOverdue} overdue`,
                        }
                      : null
                  }
                />
                <ReportKpiCard
                  label="Completed"
                  value={String(data.kpis.completedThisWeek)}
                  tip="Tasks completed by clearing the follow-up date."
                  trend={
                    completedTrend && completedTrend.direction !== "none"
                      ? {
                          direction: completedTrend.direction,
                          label: `${completedTrend.label} vs last week`,
                        }
                      : null
                  }
                />
              </div>
              <div className="border-t border-sales-border-subtle pt-3">
                <ReportKpiCard
                  variant="secondary"
                  label="Overdue"
                  value={String(data.kpis.overdue)}
                  supporting={data.kpis.overdue === 0 ? "You're up to date" : undefined}
                  trend={
                    data.kpis.overdue > 0
                      ? { direction: "alert", label: "Needs attention" }
                      : null
                  }
                />
              </div>
            </div>

            {data.meta.copilotUnavailable ? (
              <p className="text-[13px] leading-5 text-sales-text-secondary">
                Sales Copilot could not load. Manual follow-ups are still listed.
              </p>
            ) : null}
            <div className="layout:hidden">
              <div className="sales-task-filters-wrap">
                <div className="sales-task-filters">
                  <div className="sales-task-filters-group" role="radiogroup" aria-label="Task status">
                    {QUEUE_FILTERS.map((filter) => (
                      <button
                        key={filter.value}
                        type="button"
                        role="radio"
                        aria-checked={copilotQueue === filter.value}
                        aria-label={`${filter.full}, ${queueCounts[filter.value]}`}
                        data-tone={filter.tone}
                        className={cn("sales-task-filter", copilotQueue === filter.value && "is-selected")}
                        onClick={() => {
                          setCopilotQueue(filter.value);
                          setPage(1);
                        }}
                      >
                        {filter.label}
                        <span className="sales-task-filter-count">{queueCounts[filter.value]}</span>
                      </button>
                    ))}
                  </div>
                  <button
                    type="button"
                    className="sales-task-filter"
                    onClick={() => {
                      setSelecting((on) => !on);
                      setSelectedIds([]);
                    }}
                  >
                    {selecting ? "Done" : "Select"}
                  </button>
                </div>
              </div>
              {selecting && selectedIds.length > 0 ? (
                <button
                  type="button"
                  className="sales-task-complete"
                  onClick={() => {
                    const chosen = filteredTasks.filter((task) => selectedIds.includes(task.id) && canSelect(task));
                    setSelectedIds([]);
                    setSelecting(false);
                    for (const task of chosen) void completeTask(task);
                  }}
                >
                  Complete selected ({selectedIds.length})
                </button>
              ) : null}
              <div className="sales-task-list">
                {pageRows.length === 0 ? (
                  <div className="sales-task-empty">
                    <TaskEmpty
                      view={view}
                      filtered={activeFilterCount > 0 || copilotQueue !== "all"}
                      onAdd={() => setAddOpen(true)}
                      onClear={() => {
                        clearFilters();
                        setCopilotQueue("all");
                      }}
                    />
                  </div>
                ) : (
                  pageRows.map((task) => (
                    <MobileTaskCard
                      key={task.id}
                      task={task}
                      timeZone={data.meta.timezone}
                      selecting={selecting}
                      selected={selectedIds.includes(task.id)}
                      selectable={canSelect(task)}
                      busy={busyId === task.id}
                      onSelect={(on) =>
                        setSelectedIds((current) =>
                          on ? [...current, task.id] : current.filter((id) => id !== task.id)
                        )
                      }
                      onOpen={() => {
                        setActionError(null);
                        setDetail(task);
                      }}
                      onPrimary={() => onPrimary(task)}
                    />
                  ))
                )}
              </div>
              {pageCount > 1 ? (
                <div className="sales-task-pager">
                  <button type="button" disabled={pageSafe <= 1} onClick={() => setPage(pageSafe - 1)}>
                    Previous
                  </button>
                  <span>
                    {pageSafe} / {pageCount}
                  </span>
                  <button type="button" disabled={pageSafe >= pageCount} onClick={() => setPage(pageSafe + 1)}>
                    Next
                  </button>
                </div>
              ) : null}
            </div>

            <DataTableWorkspace className="hidden w-full layout:block">
              <DataTableScroll className="hidden w-full layout:block">
                <DataTableEl className="min-w-[760px] table-fixed">
                  <colgroup>
                    <col className="w-11" />
                    <col />
                    <col className="w-[22%]" />
                    <col className="w-[16.5rem]" />
                  </colgroup>
                  <DataTableHead>
                    <tr>
                      <DataTableTh compact className="w-11">
                        <span className="sr-only">Complete</span>
                      </DataTableTh>
                      <DataTableTh compact>Task</DataTableTh>
                      <DataTableTh compact className="w-[22%]">
                        <span className="inline-flex items-center gap-1 normal-case tracking-normal">
                          Due / Status
                          <ChevronDown size={12} strokeWidth={1.8} aria-hidden />
                        </span>
                      </DataTableTh>
                      <DataTableTh compact align="right" className="w-[16.5rem]">
                        Actions
                      </DataTableTh>
                    </tr>
                  </DataTableHead>
                  <DataTableBody>
                    {pageRows.length === 0 ? (
                      <DataTableRow className="!h-auto hover:bg-transparent">
                        <DataTableTd colSpan={4} className="!py-10">
                          <TaskEmpty
                            view={view}
                            filtered={activeFilterCount > 0}
                            onAdd={() => setAddOpen(true)}
                            onClear={clearFilters}
                          />
                        </DataTableTd>
                      </DataTableRow>
                    ) : (
                      pageRows.map((task) => (
                        <TaskTableRow
                          key={task.id}
                          task={task}
                          timeZone={data.meta.timezone}
                          busy={busyId === task.id}
                          onOpen={() => setDetail(task)}
                          onPrimary={() => onPrimary(task)}
                          onComplete={() => void completeTask(task)}
                          onReschedule={() => {
                            setRescheduleDate(toDateKey(addDays(new Date(), 1)));
                            setRescheduleTask(task);
                          }}
                        />
                      ))
                    )}
                  </DataTableBody>
                </DataTableEl>
              </DataTableScroll>

              {pageCount > 1 ? (
              <DataTableFooter>
                <DataTablePagination
                  page={pageSafe}
                  pageCount={pageCount}
                  onPageChange={setPage}
                  summary={
                    <span className="tabular-nums text-sales-text-secondary">
                      Showing {showingFrom} to {showingTo} of {filteredTasks.length} tasks
                    </span>
                  }
                  pageSizeControl={
                    <MenuSelect
                      aria-label="Rows per page"
                      size="sm"
                      align="right"
                      value={String(pageSize) as "10" | "20" | "50"}
                      onChange={(v) => {
                        setPageSize(Number(v));
                        setPage(1);
                      }}
                      options={PAGE_SIZE_OPTIONS.map((n) => ({
                        value: String(n) as "10" | "20" | "50",
                        label: `${n} per page`,
                      }))}
                    />
                  }
                />
              </DataTableFooter>
              ) : null}
            </DataTableWorkspace>
          </div>

          <aside className="hidden space-y-4 xl:sticky xl:top-4 xl:block xl:self-start">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-[14px]">Task overview</CardTitle>
              </CardHeader>
              <CardContent>
                {data.overview.total === 0 ? (
                  <p className="py-6 text-center text-[13px] text-sales-text-muted">
                    No tasks yet
                    <span className="mt-1 block text-[12px]">
                      Your task breakdown will appear here.
                    </span>
                  </p>
                ) : (
                  <div className="flex items-center gap-3">
                    <div className="h-[120px] w-[120px] shrink-0">
                      <SalesDonutChart
                        centerLabel="Total tasks"
                        showLegend={false}
                        data={[
                          {
                            name: "Pending",
                            value: data.overview.pending,
                            color: "#F59E0B",
                          },
                          {
                            name: "Overdue",
                            value: data.overview.overdue,
                            color: "#EF4444",
                          },
                          {
                            name: "Completed",
                            value: data.overview.completedThisWeek,
                            color: "#16A34A",
                          },
                        ]}
                      />
                    </div>
                    <ul className="min-w-0 flex-1 space-y-2 text-[12px]">
                      <LegendRow color="#F59E0B" label="Pending" value={data.overview.pending} />
                      <LegendRow color="#EF4444" label="Overdue" value={data.overview.overdue} />
                      <LegendRow
                        color="#16A34A"
                        label="Completed"
                        value={data.overview.completedThisWeek}
                      />
                    </ul>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-[14px]">Upcoming tasks</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {data.upcoming.length === 0 ? (
                  <p className="py-4 text-center text-[13px] text-sales-text-muted">
                    No upcoming tasks
                  </p>
                ) : (
                  data.upcoming.map((task) => {
                    const tone = dueDateTone(task);
                    return (
                      <button
                        key={task.id}
                        type="button"
                        onClick={() => setDetail(task)}
                        className="flex w-full items-start gap-2.5 rounded-sales-md px-1 py-1.5 text-left hover:bg-sales-surface-hover"
                      >
                        <span
                          className={cn(
                            "mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-sales-md",
                            typeTint(task.type)
                          )}
                        >
                          <TypeIcon type={task.type} size={14} />
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-[13px] font-semibold text-sales-text-primary">
                            {task.title}
                          </span>
                          <span className="block truncate text-[11px] text-sales-text-muted">
                            {task.relatedName}
                          </span>
                        </span>
                        <span
                          className={cn(
                            "shrink-0 text-[11px] tabular-nums",
                            tone === "danger"
                              ? "text-sales-danger"
                              : tone === "warning"
                                ? "text-sales-warning-fg"
                                : "text-sales-text-muted"
                          )}
                        >
                          {scheduleLine(task.schedule, data.meta.timezone)}
                        </span>
                      </button>
                    );
                  })
                )}
              </CardContent>
              <CardFooter>
                <Link
                  href="/sales/calendar"
                  className="text-[12px] font-medium text-sales-brand-fg hover:underline"
                >
                  View calendar →
                </Link>
              </CardFooter>
            </Card>

            {!tipDismissed ? (
              <aside className="rounded-sales-xl border border-sales-brand-border bg-[var(--sales-brand-soft-solid,#EEF4D8)] p-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-start gap-2">
                    <Lightbulb
                      size={16}
                      strokeWidth={1.8}
                      className="mt-0.5 shrink-0 text-sales-brand-fg"
                    />
                    <div>
                      <p className="text-[11px] font-medium text-sales-text-muted">
                        Productivity tip
                      </p>
                      <p className="mt-1 text-[13px] font-semibold text-sales-text-primary">
                        {data.tip.title}
                      </p>
                      <p className="mt-1 text-[12px] text-sales-text-secondary">{data.tip.body}</p>
                    </div>
                  </div>
                  <button
                    type="button"
                    aria-label="Dismiss tip"
                    className="rounded-sales-sm p-1 text-sales-text-muted hover:text-sales-text-primary"
                    onClick={() => setTipDismissed(true)}
                  >
                    <X size={14} strokeWidth={1.8} />
                  </button>
                </div>
              </aside>
            ) : null}

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-[14px]">Filters quick access</CardTitle>
              </CardHeader>
              <CardContent className="flex flex-wrap gap-1.5">
                {(
                  [
                    ["high_priority", "High priority"],
                    ["overdue", "Overdue"],
                    ["due_today", "Due today"],
                    ["follow_ups", "Follow-ups"],
                    ["calls", "Calls"],
                    ["quote_reviews", "Proposals"],
                  ] as const
                ).map(([key, label]) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => toggleQuick(key)}
                    className={cn(
                      "rounded-sales-md border px-2.5 py-1 text-[11px] font-medium",
                      quickFilters.includes(key)
                        ? "border-sales-brand-border bg-sales-brand-soft text-sales-text-primary"
                        : "border-sales-border text-sales-text-secondary hover:bg-sales-surface-hover"
                    )}
                  >
                    {label}
                  </button>
                ))}
                <span
                  title="Site visit tasks aren’t available in SegmiQ yet"
                  className="cursor-not-allowed rounded-sales-md border border-dashed border-sales-border px-2.5 py-1 text-[11px] font-medium text-sales-text-muted"
                >
                  Site visits
                </span>
              </CardContent>
            </Card>
          </aside>
        </div>
      ) : null}

      {addOpen ? (
        <AddTaskSheet
          leads={data?.assignableLeads ?? []}
          onClose={() => setAddOpen(false)}
          onCreated={() => void load()}
        />
      ) : null}

      {detail ? (
        <TaskDetailDrawer
          task={detail}
          timeZone={data?.meta.timezone ?? "Africa/Harare"}
          busy={busyId === detail.id}
          error={actionError}
          onClose={() => {
            setActionError(null);
            setDetail(null);
          }}
          onComplete={(t) => void completeTask(t)}
          onReschedule={(t) => {
            setDetail(null);
            setRescheduleDate(toDateKey(addDays(new Date(), 1)));
            setRescheduleTask(t);
          }}
          onAct={(t, body) => void runCopilot(t, body)}
          onDraft={(t) => openDraft(t)}
        />
      ) : null}

      {rescheduleTask ? (
        <div className="fixed inset-0 z-[90] flex items-center justify-center p-4">
          <button
            type="button"
            className="absolute inset-0 bg-[var(--sales-neutral-900)]/35"
            aria-label="Close"
            onClick={() => setRescheduleTask(null)}
          />
          <div className="relative z-10 w-full max-w-sm rounded-sales-xl border border-sales-border bg-sales-surface p-5 shadow-sales-modal">
            <h3 className="text-[16px] font-semibold text-sales-text-primary">Reschedule</h3>
            <p className="mt-1 text-[13px] text-sales-text-secondary">{rescheduleTask.title}</p>
            <input
              type="date"
              className="mt-4 h-10 w-full rounded-sales-md border border-sales-border px-3 text-[13px]"
              value={rescheduleDate}
              onChange={(e) => setRescheduleDate(e.target.value)}
            />
            <div className="mt-4 flex justify-end gap-2">
              <Button variant="secondary" size="sm" onClick={() => setRescheduleTask(null)}>
                Cancel
              </Button>
              <Button variant="primary" size="sm" onClick={() => void saveReschedule()}>
                Save
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function LegendRow({ color, label, value }: { color: string; label: string; value: number }) {
  return (
    <li className="flex items-center justify-between gap-2">
      <span className="inline-flex items-center gap-2 text-sales-text-secondary">
        <span className="h-2 w-2 rounded-full" style={{ background: color }} />
        {label}
      </span>
      <span className="tabular-nums font-medium text-sales-text-primary">{value}</span>
    </li>
  );
}

function TaskEmpty({
  view,
  filtered,
  onAdd,
  onClear,
}: {
  view: SalesTaskView;
  filtered: boolean;
  onAdd: () => void;
  onClear: () => void;
}) {
  if (filtered) {
    return (
      <EmptyState
        title="No tasks match these filters"
        description="Try clearing one or more filters."
        size="compact"
        action={
          <Button variant="secondary" size="sm" onClick={onClear}>
            Clear filters
          </Button>
        }
      />
    );
  }
  if (view === "assigned") {
    return (
      <EmptyState
        title="No tasks assigned to you"
        description="Tasks scheduled by teammates or managers will appear here when creator data is available."
        size="compact"
      />
    );
  }
  if (view === "created") {
    return (
      <EmptyState
        title="You haven't created any tasks yet"
        description="Schedule a follow-up to see it here."
        size="compact"
        action={
          <Button variant="primary" size="sm" leftIcon={<Plus size={14} />} onClick={onAdd}>
            Add task
          </Button>
        }
      />
    );
  }
  return (
    <EmptyState
      icon={<CheckSquare size={22} strokeWidth={1.8} />}
      title="No tasks yet"
      description="Create a task to organise follow-ups, calls and sales activities."
      size="compact"
      action={
        <Button variant="primary" size="sm" leftIcon={<Plus size={14} />} onClick={onAdd}>
          Add task
        </Button>
      }
    />
  );
}

function TaskTableRow({
  task,
  timeZone,
  busy,
  onOpen,
  onPrimary,
  onComplete,
  onReschedule,
}: {
  task: SalesTaskItem;
  timeZone: string;
  busy: boolean;
  onOpen: () => void;
  onPrimary: () => void;
  onComplete: () => void;
  onReschedule: () => void;
}) {
  const router = useRouter();
  const tone = dueDateTone(task);
  const dueClass =
    tone === "danger"
      ? "text-sales-danger"
      : tone === "warning"
        ? "text-sales-warning-fg"
        : "text-sales-text-secondary";

  return (
    <DataTableRow
      className={cn("group !h-auto", task.completed && "opacity-60")}
      hoverable
    >
      <DataTableCheckboxCell compact className="align-top !py-3">
        <div className="pt-1">
          <Checkbox
            checked={task.completed}
            onCheckedChange={() => {
              if (task.copilot && task.copilot.primaryAction !== "complete") {
                onOpen();
                return;
              }
              if (!task.completed) onComplete();
            }}
            aria-label={
              task.copilot?.listState === "needs_review"
                ? `Review ${task.title}`
                : `Mark ${task.title} complete`
            }
            disabled={task.completed}
          />
        </div>
      </DataTableCheckboxCell>
      <DataTableTd compact className="align-top !py-3">
        <div className="flex min-w-0 items-start gap-3">
          <button
            type="button"
            onClick={onOpen}
            className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full"
            aria-label={`Open ${task.title}`}
          >
            <span
              className={cn(
                "flex h-9 w-9 items-center justify-center rounded-full",
                typeTint(task.type)
              )}
            >
              <TypeIcon type={task.type} />
            </span>
          </button>
          <div className="min-w-0 flex-1">
            <button
              type="button"
              onClick={onOpen}
              className="block w-full text-left text-[13px] font-semibold leading-snug text-sales-text-primary hover:text-sales-brand-fg"
            >
              {task.title}
            </button>
            {task.copilot?.explanation || task.notes ? (
              <p className="mt-1 line-clamp-2 text-[12px] leading-5 text-sales-text-secondary">
                {task.copilot?.explanation || task.notes}
              </p>
            ) : null}
            <div className="mt-1.5 flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
              <span className="inline-flex h-5 items-center rounded-sales-sm bg-[var(--sales-neutral-100)] px-2 text-[11px] font-medium text-sales-text-secondary">
                {task.copilot?.executionStatus === "failed" ? "Failed" : task.typeLabel}
              </span>
              <Link
                href={task.leadHref}
                className="min-w-0 truncate text-[12px] font-medium text-sales-text-secondary hover:text-sales-brand-fg"
                title={task.relatedName}
              >
                {task.relatedName || "—"}
              </Link>
            </div>
          </div>
        </div>
      </DataTableTd>
      <DataTableTd compact className="align-top !py-3">
        <div className="flex flex-col items-start gap-1.5">
          <span className={cn("text-[13px] font-medium tabular-nums leading-snug", dueClass)}>
            {scheduleLine(task.schedule, timeZone)}
          </span>
          <span className="inline-flex items-center gap-1.5 text-[12px] font-medium text-sales-text-primary">
            <span className={cn("h-2 w-2 shrink-0 rounded-full", priorityDot(task.priority))} />
            {formatTaskPriority(task.priority)}
          </span>
        </div>
      </DataTableTd>
      <DataTableActionsCell className="!w-auto min-w-[15rem] align-top !py-3">
        <div className="flex flex-wrap items-center justify-end gap-2" onClick={(e) => e.stopPropagation()}>
          {!task.completed ? (
            <button
              type="button"
              disabled={busy}
              onClick={onPrimary}
              className="inline-flex h-9 shrink-0 items-center rounded-[10px] bg-sales-brand px-3 text-[13px] font-semibold text-sales-brand-text disabled:opacity-50"
            >
              {busy ? "Working…" : task.copilot?.actionLabel ?? "View details"}
            </button>
          ) : null}
          <Link
            href={task.whatsappHref ?? task.leadHref}
            className="inline-flex h-9 shrink-0 items-center text-[13px] font-semibold text-sales-text-primary"
          >
            View chat
          </Link>
          <DropdownMenu align="end">
            <DropdownMenuTrigger
              aria-label={`Open ${task.title} actions`}
              className="rounded-[8px] p-1.5 text-sales-text-muted hover:bg-sales-surface-hover hover:text-sales-text-primary"
            >
              <MoreHorizontal size={16} strokeWidth={1.8} />
            </DropdownMenuTrigger>
            <DropdownMenuContent className="w-48">
              <DropdownMenuItem onSelect={onOpen}>Open task</DropdownMenuItem>
              {!task.completed ? (
                task.copilot?.primaryAction === "complete" ? (
                  <DropdownMenuItem onSelect={onComplete}>Complete</DropdownMenuItem>
                ) : task.copilot ? (
                  <DropdownMenuItem onSelect={onOpen}>Review</DropdownMenuItem>
                ) : (
                  <>
                    <DropdownMenuItem onSelect={onComplete}>Mark complete</DropdownMenuItem>
                    <DropdownMenuItem onSelect={onReschedule}>Reschedule</DropdownMenuItem>
                  </>
                )
              ) : null}
              <DropdownMenuItem onSelect={() => router.push(task.leadHref)}>
                Open related lead
              </DropdownMenuItem>
              {task.whatsappHref ? (
                <DropdownMenuItem onSelect={() => window.open(task.whatsappHref!, "_blank")}>
                  Message on WhatsApp
                </DropdownMenuItem>
              ) : null}
              {task.phone ? (
                <DropdownMenuItem
                  onSelect={() => {
                    window.location.href = `tel:${task.phone}`;
                  }}
                >
                  Call
                </DropdownMenuItem>
              ) : null}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </DataTableActionsCell>
    </DataTableRow>
  );
}

function MobileTaskCard({
  task,
  timeZone,
  selecting,
  selected,
  selectable,
  busy,
  onSelect,
  onOpen,
  onPrimary,
}: {
  task: SalesTaskItem;
  timeZone: string;
  selecting: boolean;
  selected: boolean;
  selectable: boolean;
  busy: boolean;
  onSelect: (on: boolean) => void;
  onOpen: () => void;
  onPrimary: () => void;
}) {
  const status = taskCardStatus(task);
  const explanation = (task.copilot?.explanation || task.notes || "").trim();
  const dateText = cardDateText(task, timeZone);
  const noDate = task.schedule.kind === "none" || !task.schedule.at;
  const showDate = !(noDate && /no date/i.test(explanation));
  const realOverdue =
    (task.schedule.kind === "due" || task.schedule.kind === "check_in") && task.schedule.overdue;
  const showPassed = task.schedule.passedSuggestion && !/passed|new time/i.test(explanation);
  const showExpected =
    task.schedule.kind === "check_in" &&
    Boolean(task.schedule.expectedReplyAt) &&
    !/expected reply/i.test(explanation);
  return (
    <article className={cn("sales-task-card", status.tone === "review" && "sales-task-card--review")}>
      <div className="sales-task-card-main">
        {selecting && selectable ? (
          <Checkbox
            checked={selected}
            onCheckedChange={(value) => onSelect(value === true)}
            aria-label={`Select ${task.title}`}
            className="mt-1"
          />
        ) : null}
        <div className={cn("sales-task-icon", `sales-task-icon--${status.tone}`)} aria-hidden>
          {taskKindIcon(task)}
        </div>
        <div className="sales-task-body">
          <button type="button" className="sales-task-title-btn" onClick={onOpen}>
            <span className="sales-task-title">{task.title}</span>
          </button>
          <div className="sales-task-customer">
            <span className="sales-task-avatar" aria-hidden>
              {customerInitial(task.relatedName)}
            </span>
            <span className="sales-task-name" title={task.relatedName}>
              {task.relatedName}
              {task.relatedSecondary ? <span className="sales-task-name-meta"> · {task.relatedSecondary}</span> : null}
            </span>
            <span className={cn("sales-task-badge", `sales-task-badge--${status.tone}`)}>{status.label}</span>
          </div>
          {showDate ? (
            <p className={cn("sales-task-date", realOverdue && "is-overdue")}>
              <Clock size={14} strokeWidth={1.8} aria-hidden />
              <span>{dateText}</span>
            </p>
          ) : null}
          {showExpected && task.schedule.expectedReplyAt ? (
            <p className="sales-task-date">
              <Clock size={14} strokeWidth={1.8} aria-hidden />
              <span>Expected reply: {formatScheduleWhen(task.schedule.expectedReplyAt, timeZone)}</span>
            </p>
          ) : null}
          {showPassed ? <p className="sales-task-note">This proposed time has passed. Choose a new time.</p> : null}
        </div>
      </div>
      {explanation ? <p className="sales-task-explain">{explanation}</p> : null}
      {task.copilot?.executionError ? <p className="sales-task-error">{task.copilot.executionError}</p> : null}
      <div className="sales-task-footer">
        <button type="button" className="sales-task-primary" disabled={busy} onClick={onPrimary}>
          {busy ? "Working…" : task.copilot?.actionLabel ?? "View details"}
        </button>
        {task.whatsappHref ? (
          <Link href={task.whatsappHref} className="sales-task-chat">
            <MessageCircle size={16} strokeWidth={1.8} aria-hidden />
            View chat
          </Link>
        ) : null}
      </div>
    </article>
  );
}

function TasksSkeleton() {
  return (
    <div className="space-y-3">
      <Skeleton className="h-10 w-full max-w-xl rounded-sales-md" />
      <div className="space-y-3 layout:hidden">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-28 w-full rounded-sales-md" />
        ))}
      </div>
      <div className="hidden gap-4 layout:grid xl:grid-cols-[minmax(0,1fr)_320px]">
        <Skeleton className="h-[420px] rounded-sales-xl" />
        <Skeleton className="h-[220px] rounded-sales-xl" />
      </div>
    </div>
  );
}
