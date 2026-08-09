"use client";

import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  CalendarClock,
  CalendarDays,
  CheckSquare,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  CircleAlert,
  CircleCheck,
  FileText,
  Filter,
  Lightbulb,
  MoreHorizontal,
  Phone,
  Plus,
  X,
} from "lucide-react";
import { SiWhatsapp } from "react-icons/si";
import { addDays, format } from "date-fns";
import { PremiumSheet } from "@/components/sales/PremiumSheet";
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
  Checkbox,
  EmptyState,
  IconButton,
  MenuSelect,
  SalesDonutChart,
  SegmentedControl,
  Skeleton,
  useSalesToast,
} from "@/components/sales/ui";
import { ReportKpiCard } from "@/components/sales/reports/ReportKpiCard";
import { AddTaskSheet } from "@/components/sales/tasks/AddTaskSheet";
import { TaskDetailDrawer } from "@/components/sales/tasks/TaskDetailDrawer";
import { formatTrend } from "@/lib/sales/sales-dashboard-display";
import {
  dueDateTone,
  formatTaskDueDate,
  formatTaskPriority,
  formatTaskStatus,
  matchesDueFilter,
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
  if (type === "call") return <Phone size={size} strokeWidth={1.8} className="text-[#14B8A6]" />;
  if (type === "quote_review")
    return <FileText size={size} strokeWidth={1.8} className="text-sales-warning" />;
  return <CalendarClock size={size} strokeWidth={1.8} className="text-sales-success" />;
}

function typeTint(type: SalesTaskItem["type"]) {
  if (type === "whatsapp") return "bg-sales-success-soft";
  if (type === "call") return "bg-[#F0FDFA]";
  if (type === "quote_review") return "bg-[#FFFAEB]";
  return "bg-sales-success-soft";
}

function statusTone(status: SalesTaskItem["status"]) {
  if (status === "overdue") return "danger" as const;
  if (status === "completed") return "success" as const;
  return "warning" as const;
}

function priorityDot(priority: SalesTaskItem["priority"]) {
  if (priority === "high") return "bg-sales-danger";
  if (priority === "medium") return "bg-sales-warning";
  return "bg-sales-success";
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
  const [quickFilters, setQuickFilters] = useState<SalesTaskQuickFilter[]>([]);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [data, setData] = useState<SalesTasksPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [detail, setDetail] = useState<SalesTaskItem | null>(null);
  const [menuId, setMenuId] = useState<string | null>(null);
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
    setPage(1);
  }, [statusFilter, dueFilter, quickFilters, view]);

  const filteredTasks = useMemo(() => {
    if (!data) return [];
    return data.tasks.filter((task) => {
      if (statusFilter === "pending" && task.status !== "pending") return false;
      if (statusFilter === "overdue" && task.status !== "overdue") return false;
      if (statusFilter === "completed" && !task.completed) return false;
      if (statusFilter === "all" && task.completed) {
        // hide completed from default open-focused lists for mine/assigned
        if (view === "mine" || view === "assigned") return false;
      }
      if (dueFilter !== "all" && !task.completed && !matchesDueFilter(task.dueAt, dueFilter)) {
        return false;
      }
      for (const q of quickFilters) {
        if (q === "high_priority" && task.priority !== "high") return false;
        if (q === "overdue" && task.status !== "overdue") return false;
        if (q === "due_today" && !matchesDueFilter(task.dueAt, "today")) return false;
        if (q === "follow_ups" && task.type !== "follow_up" && task.type !== "whatsapp")
          return false;
        if (q === "calls" && task.type !== "call") return false;
        if (q === "quote_reviews" && task.type !== "quote_review") return false;
      }
      return true;
    });
  }, [data, statusFilter, dueFilter, quickFilters, view]);

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

  async function completeTask(task: SalesTaskItem) {
    if (task.completed) return;
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
            d.kpis.dueToday - (matchesDueFilter(task.dueAt, "today") ? 1 : 0)
          ),
          thisWeek: Math.max(
            0,
            d.kpis.thisWeek - (matchesDueFilter(task.dueAt, "this_week") ? 1 : 0)
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
    <div className="w-full space-y-4">
      <div className="flex h-10 min-w-0 items-center gap-3">
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
          <div className="hidden items-center gap-2 md:flex">
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
                <div className="hidden md:block">
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
                            "rounded-full border px-2.5 py-1.5 text-[12px] font-medium transition-colors",
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
                <div className="md:hidden">
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
                                "rounded-full border px-2.5 py-1.5 text-[12px] font-medium transition-colors",
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
            className="hidden h-10 w-10 shrink-0 rounded-[10px] md:inline-flex"
          >
            <MoreHorizontal strokeWidth={1.8} />
          </IconButton>
        </div>
      </div>

      {error ? (
        <Card>
          <CardContent className="py-8">
            <EmptyState
              title="Couldn't load your tasks"
              description="Refresh to try again."
              size="compact"
              action={
                <Button variant="secondary" size="sm" onClick={() => void load()}>
                  Retry
                </Button>
              }
            />
          </CardContent>
        </Card>
      ) : null}

      {loading && !data ? <TasksSkeleton /> : null}

      {data ? (
        <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_320px]">
          <div className="min-w-0 space-y-4">
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
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
                icon={CalendarClock}
                iconTint="bg-[#FFFAEB] text-[#B54708]"
              />
              <ReportKpiCard
                label="This week"
                value={String(data.kpis.thisWeek)}
                supporting={
                  data.kpis.thisWeekOverdue > 0 ? undefined : undefined
                }
                trend={
                  data.kpis.thisWeekOverdue > 0
                    ? {
                        direction: "alert",
                        label: `${data.kpis.thisWeekOverdue} overdue`,
                      }
                    : null
                }
                icon={CalendarDays}
                iconTint="bg-[#F4F3FF] text-[#6941C6]"
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
                icon={CircleCheck}
                iconTint="bg-sales-success-soft text-[var(--success-fg,#027A48)]"
              />
              <ReportKpiCard
                label="Overdue"
                value={String(data.kpis.overdue)}
                supporting={data.kpis.overdue === 0 ? "You're up to date" : undefined}
                trend={
                  data.kpis.overdue > 0
                    ? { direction: "alert", label: "Needs attention" }
                    : null
                }
                icon={CircleAlert}
                iconTint="bg-sales-danger-soft text-[var(--danger-fg,#B42318)]"
              />
            </div>

            <Card className="overflow-hidden border-sales-border shadow-sales-card">
              <div className="hidden md:block">
                <table className="w-full table-fixed border-collapse text-left">
                  <colgroup>
                    <col className="w-11" />
                    <col />
                    <col className="w-[28%]" />
                    <col className="w-11" />
                  </colgroup>
                  <thead className="border-b border-sales-border-subtle bg-[#FAFBFC]">
                    <tr className="text-[12px] font-medium text-sales-text-muted">
                      <th className="px-3 py-3" scope="col">
                        <span className="sr-only">Complete</span>
                      </th>
                      <th className="px-2 py-3" scope="col">
                        Task
                      </th>
                      <th className="px-2 py-3" scope="col">
                        <span className="inline-flex items-center gap-1">
                          Due / Status
                          <ChevronDown size={12} strokeWidth={1.8} aria-hidden />
                        </span>
                      </th>
                      <th className="px-2 py-3" scope="col">
                        <span className="sr-only">Actions</span>
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-sales-border-subtle">
                    {pageRows.length === 0 ? (
                      <tr>
                        <td colSpan={4} className="px-4 py-10">
                          <TaskEmpty
                            view={view}
                            filtered={activeFilterCount > 0}
                            onAdd={() => setAddOpen(true)}
                            onClear={clearFilters}
                          />
                        </td>
                      </tr>
                    ) : (
                      pageRows.map((task) => (
                        <TaskTableRow
                          key={task.id}
                          task={task}
                          menuOpen={menuId === task.id}
                          onToggleMenu={() =>
                            setMenuId((id) => (id === task.id ? null : task.id))
                          }
                          onOpen={() => setDetail(task)}
                          onComplete={() => void completeTask(task)}
                          onReschedule={() => {
                            setRescheduleDate(toDateKey(addDays(new Date(), 1)));
                            setRescheduleTask(task);
                            setMenuId(null);
                          }}
                        />
                      ))
                    )}
                  </tbody>
                </table>
              </div>

              <div className="space-y-2 p-3 md:hidden">
                {pageRows.length === 0 ? (
                  <TaskEmpty
                    view={view}
                    filtered={activeFilterCount > 0}
                    onAdd={() => setAddOpen(true)}
                    onClear={clearFilters}
                  />
                ) : (
                  pageRows.map((task) => (
                    <MobileTaskCard
                      key={task.id}
                      task={task}
                      onOpen={() => setDetail(task)}
                      onComplete={() => void completeTask(task)}
                    />
                  ))
                )}
              </div>

              <div className="flex flex-col gap-3 border-t border-sales-border-subtle px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-[12px] text-sales-text-secondary tabular-nums">
                  Showing {showingFrom} to {showingTo} of {filteredTasks.length} tasks
                </p>
                <div className="flex items-center gap-1.5">
                  <IconButton
                    aria-label="Previous page"
                    size="sm"
                    disabled={pageSafe <= 1}
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                  >
                    <ChevronLeft strokeWidth={1.8} />
                  </IconButton>
                  {Array.from({ length: Math.min(pageCount, 5) }).map((_, i) => {
                    const n = i + 1;
                    const active = n === pageSafe;
                    return (
                      <button
                        key={n}
                        type="button"
                        onClick={() => setPage(n)}
                        className={cn(
                          "inline-flex h-8 min-w-8 items-center justify-center rounded-[8px] text-[12px] font-semibold tabular-nums",
                          active
                            ? "bg-sales-brand text-sales-brand-text"
                            : "text-sales-text-secondary hover:bg-sales-surface-hover"
                        )}
                      >
                        {n}
                      </button>
                    );
                  })}
                  <IconButton
                    aria-label="Next page"
                    size="sm"
                    disabled={pageSafe >= pageCount}
                    onClick={() => setPage((p) => Math.min(pageCount, p + 1))}
                  >
                    <ChevronRight strokeWidth={1.8} />
                  </IconButton>
                  <MenuSelect
                    aria-label="Rows per page"
                    size="sm"
                    align="right"
                    className="ml-1"
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
                </div>
              </div>
            </Card>
          </div>

          <aside className="space-y-4 xl:sticky xl:top-4 xl:self-start">
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
                                ? "text-[#B54708]"
                                : "text-sales-text-muted"
                          )}
                        >
                          {formatTaskDueDate(task.dueAt)}
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
              <aside className="rounded-sales-xl border border-sales-brand-border bg-[var(--sales-brand-soft-solid,#F3FCE3)] p-4">
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
                      "rounded-full border px-2.5 py-1 text-[11px] font-medium",
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
                  className="cursor-not-allowed rounded-full border border-dashed border-sales-border px-2.5 py-1 text-[11px] font-medium text-sales-text-muted"
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
          onClose={() => setDetail(null)}
          onComplete={(t) => void completeTask(t)}
          onReschedule={(t) => {
            setRescheduleDate(toDateKey(addDays(new Date(), 1)));
            setRescheduleTask(t);
          }}
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
  menuOpen,
  onToggleMenu,
  onOpen,
  onComplete,
  onReschedule,
}: {
  task: SalesTaskItem;
  menuOpen: boolean;
  onToggleMenu: () => void;
  onOpen: () => void;
  onComplete: () => void;
  onReschedule: () => void;
}) {
  const tone = dueDateTone(task);
  const dueClass =
    tone === "danger"
      ? "text-sales-danger"
      : tone === "warning"
        ? "text-[#B54708]"
        : "text-sales-text-secondary";

  return (
    <tr
      className={cn(
        "group transition-colors hover:bg-sales-surface-hover",
        task.completed && "opacity-60"
      )}
    >
      <td className="px-3 py-3 align-top">
        <div className="pt-1">
          <Checkbox
            checked={task.completed}
            onCheckedChange={() => {
              if (!task.completed) onComplete();
            }}
            aria-label={`Mark ${task.title} complete`}
            disabled={task.completed}
          />
        </div>
      </td>
      <td className="px-2 py-3 align-top">
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
              className="block w-full truncate text-left text-[13px] font-semibold leading-snug text-sales-text-primary hover:text-sales-brand-fg"
            >
              {task.title}
            </button>
            <div className="mt-1.5 flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
              <span className="inline-flex h-5 items-center rounded-full bg-[var(--sales-neutral-100)] px-2 text-[11px] font-medium text-sales-text-secondary">
                {task.typeLabel}
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
      </td>
      <td className="px-2 py-3 align-top">
        <div className="flex flex-col items-start gap-1.5">
          <span className={cn("text-[13px] font-medium tabular-nums leading-snug", dueClass)}>
            {formatTaskDueDate(task.dueAt)}
          </span>
          <span className="inline-flex items-center gap-1.5 text-[12px] font-medium text-sales-text-primary">
            <span className={cn("h-2 w-2 shrink-0 rounded-full", priorityDot(task.priority))} />
            {formatTaskPriority(task.priority)}
          </span>
          <Badge tone={statusTone(task.status)} appearance="soft">
            {formatTaskStatus(task.status)}
          </Badge>
        </div>
      </td>
      <td className="px-2 py-3 align-top">
        <div className="relative flex justify-end">
          <button
            type="button"
            className="rounded-[8px] p-1.5 text-sales-text-muted opacity-70 transition-opacity hover:bg-sales-surface-hover hover:text-sales-text-primary group-hover:opacity-100"
            aria-label={`Open ${task.title} actions`}
            onClick={(e) => {
              e.stopPropagation();
              onToggleMenu();
            }}
          >
            <MoreHorizontal size={16} strokeWidth={1.8} />
          </button>
          {menuOpen ? (
            <div className="absolute right-0 top-8 z-30 w-48 overflow-hidden rounded-[12px] border border-sales-border bg-sales-surface py-1.5 shadow-[0_8px_24px_rgba(16,24,40,0.10)]">
              <MenuItem onClick={onOpen}>Open task</MenuItem>
              {!task.completed ? (
                <>
                  <MenuItem onClick={onComplete}>Mark complete</MenuItem>
                  <MenuItem onClick={onReschedule}>Reschedule</MenuItem>
                </>
              ) : null}
              <MenuItem href={task.leadHref}>Open related lead</MenuItem>
              {task.whatsappHref ? (
                <MenuItem href={task.whatsappHref}>Message on WhatsApp</MenuItem>
              ) : null}
              {task.phone ? <MenuItem href={`tel:${task.phone}`}>Call</MenuItem> : null}
            </div>
          ) : null}
        </div>
      </td>
    </tr>
  );
}

function MenuItem({
  children,
  onClick,
  href,
}: {
  children: ReactNode;
  onClick?: () => void;
  href?: string;
}) {
  const className =
    "block w-full px-3 py-2 text-left text-[13px] text-sales-text-primary hover:bg-sales-surface-hover";
  if (href) {
    return (
      <Link href={href} className={className}>
        {children}
      </Link>
    );
  }
  return (
    <button type="button" className={className} onClick={onClick}>
      {children}
    </button>
  );
}

function MobileTaskCard({
  task,
  onOpen,
  onComplete,
}: {
  task: SalesTaskItem;
  onOpen: () => void;
  onComplete: () => void;
}) {
  const tone = dueDateTone(task);
  return (
    <article className="rounded-sales-lg border border-sales-border bg-sales-surface p-3">
      <div className="flex items-start gap-3">
        <Checkbox
          checked={task.completed}
          onCheckedChange={() => {
            if (!task.completed) onComplete();
          }}
          aria-label={`Mark ${task.title} complete`}
        />
        <button type="button" className="min-w-0 flex-1 text-left" onClick={onOpen}>
          <p className="text-[14px] font-semibold text-sales-text-primary">{task.title}</p>
          <span className="mt-1 inline-flex h-5 items-center rounded-full bg-[var(--sales-neutral-100)] px-2 text-[11px] font-medium text-sales-text-secondary">
            {task.typeLabel}
          </span>
        </button>
      </div>
      <dl className="mt-3 grid grid-cols-2 gap-2 text-[12px]">
        <div>
          <dt className="text-sales-text-muted">Related</dt>
          <dd className="font-medium text-sales-text-primary">{task.relatedName}</dd>
        </div>
        <div>
          <dt className="text-sales-text-muted">Due</dt>
          <dd
            className={cn(
              "font-medium tabular-nums",
              tone === "danger"
                ? "text-sales-danger"
                : tone === "warning"
                  ? "text-[#B54708]"
                  : "text-sales-text-primary"
            )}
          >
            {formatTaskDueDate(task.dueAt)}
          </dd>
        </div>
      </dl>
      <div className="mt-3 flex items-center justify-between gap-2">
        <span className="inline-flex items-center gap-1.5 text-[12px]">
          <span className={cn("h-1.5 w-1.5 rounded-full", priorityDot(task.priority))} />
          {formatTaskPriority(task.priority)}
        </span>
        <Badge tone={statusTone(task.status)} appearance="soft">
          {formatTaskStatus(task.status)}
        </Badge>
      </div>
      <div className="mt-3 flex gap-2">
        {task.whatsappHref ? (
          <Link
            href={task.whatsappHref}
            className="inline-flex h-11 flex-1 items-center justify-center gap-1.5 rounded-sales-md border border-sales-border text-[13px] font-medium"
          >
            <SiWhatsapp size={14} /> WhatsApp
          </Link>
        ) : null}
        {task.phone ? (
          <a
            href={`tel:${task.phone}`}
            className="inline-flex h-11 flex-1 items-center justify-center gap-1.5 rounded-sales-md border border-sales-border text-[13px] font-medium"
          >
            <Phone size={14} /> Call
          </a>
        ) : null}
      </div>
    </article>
  );
}

function TasksSkeleton() {
  return (
    <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_320px]">
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-[110px] rounded-sales-xl" />
          ))}
        </div>
        <Skeleton className="h-[420px] rounded-sales-xl" />
      </div>
      <div className="space-y-4">
        <Skeleton className="h-[220px] rounded-sales-xl" />
        <Skeleton className="h-[200px] rounded-sales-xl" />
        <Skeleton className="h-[120px] rounded-sales-xl" />
      </div>
    </div>
  );
}
