"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { addDays } from "date-fns";
import {
  Calendar,
  CalendarClock,
  ChevronRight,
  ClipboardList,
  Clock,
  FileText,
  MessageCircle,
  Phone,
} from "lucide-react";
import { TaskDetailDrawer, type TaskActionBody } from "@/components/sales/tasks/TaskDetailDrawer";
import { Button } from "@/components/sales/ui";
import { useSalesToast } from "@/components/sales/ui/Toast";
import { customerDraft, stageCopilotDraft } from "@/lib/sales-copilot/draft";
import type { DailyWorkspacePayload, } from "@/lib/sales/dashboard/load-daily-workspace";
import type { RecentUpdate } from "@/lib/sales/dashboard/recent-updates";
import { notifySalesWorkChanged, SALES_WORK_CHANGED_EVENT } from "@/lib/sales/dashboard/refresh";
import {
  workspaceCardStatus,
  workspaceDateLine,
  workspaceExplanation,
  workspacePrimary,
} from "@/lib/sales/dashboard/daily-workspace";
import { formatScheduleWhen, scheduleLine } from "@/lib/sales/tasks/format";
import type { SalesTaskItem } from "@/lib/sales/tasks/types";
import { toDateKey } from "@/lib/sales/calendar/format";

const VISIT_KEY = "segmiq:dashboard-visit";

function taskKindIcon(task: SalesTaskItem) {
  const action = task.copilot?.actionType ?? "";
  const title = `${task.title} ${task.typeLabel}`.toLowerCase();
  const iconProps = { size: 18, strokeWidth: 1.8, "aria-hidden": true as const };
  if (action === "appointment" || /\b(meeting|viewing|visit)\b/.test(title)) return <Calendar {...iconProps} />;
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
  if (action === "open_commitment" || /\b(team review|internal review)\b/.test(title)) return <ClipboardList {...iconProps} />;
  if (task.type === "call" || /\b(call|callback|phone)\b/.test(title)) return <Phone {...iconProps} />;
  if (action === "create_reminder" || action === "update_reminder" || task.type === "follow_up") return <Clock {...iconProps} />;
  return <CalendarClock {...iconProps} />;
}

function WorkspaceCard({
  task,
  featured,
  timeZone,
  generatedAt,
  busy,
  disabled,
  onPrimary,
}: {
  task: SalesTaskItem;
  featured: boolean;
  timeZone: string;
  generatedAt: string;
  busy: boolean;
  disabled: boolean;
  onPrimary: (task: SalesTaskItem, button: HTMLButtonElement) => void;
}) {
  const status = workspaceCardStatus(task);
  const primary = workspacePrimary(task);
  const now = new Date(generatedAt);
  const dateLine = workspaceDateLine(task, timeZone, now);
  const explanation = workspaceExplanation(task, now, timeZone);
  const executionError = task.copilot?.executionError;
  const dateText =
    executionError && dateLine.text === executionError
      ? task.schedule.at
        ? scheduleLine(task.schedule, timeZone, now)
        : "No date set"
      : dateLine.text;
  const realOverdue = (task.schedule.kind === "due" || task.schedule.kind === "check_in") && task.schedule.overdue;
  const showException = status.tone === "review" || status.tone === "failed" || realOverdue;
  const dateClass = [
    "sales-copilot-date",
    realOverdue || status.tone === "failed" ? "is-overdue" : "",
    status.tone === "review" && !realOverdue ? "is-review" : "",
  ]
    .filter(Boolean)
    .join(" ");
  return (
    <article className={featured ? "sales-copilot-card sales-copilot-card--featured" : "sales-copilot-card"}>
      <div className="sales-copilot-card-body">
        <h2 className="sales-copilot-customer-line">{task.relatedName || "Customer"}</h2>
        <p className="sales-copilot-action-title">{task.title}</p>
        <p className={dateClass}>
          {showException ? taskKindIcon(task) : null}
          <span>{dateText}</span>
          {status.tone === "review" || status.tone === "failed" ? <span>{status.label}</span> : null}
        </p>
      </div>
      {explanation ? <p className="sales-copilot-explanation">{explanation}</p> : null}
      {executionError ? <p className="sales-copilot-error">{executionError}</p> : null}
      <div className="sales-copilot-actions">
        <button
          type="button"
          className={featured ? "sales-copilot-primary" : "sales-copilot-secondary-action"}
          disabled={disabled}
          onClick={(event) => onPrimary(task, event.currentTarget)}
        >
          {busy ? "Working…" : primary.label}
        </button>
        {task.whatsappHref ? (
          <Link href={task.whatsappHref} className="sales-copilot-chat">
            <MessageCircle size={16} strokeWidth={1.8} aria-hidden />
            View chat
          </Link>
        ) : null}
      </div>
    </article>
  );
}

function UpdateRow({ item, timeZone }: { item: RecentUpdate; timeZone: string }) {
  const when = formatScheduleWhen(item.at, timeZone);
  return (
    <li>
      <Link
        href={item.href}
        className="sales-copilot-update"
        aria-label={`${item.leadName}. ${item.detail}. ${when}. ${item.linkLabel}`}
      >
        <span className="sales-copilot-update-copy">
          <span className="sales-copilot-update-name">{item.leadName}</span>
          <span className="sales-copilot-update-detail">
            {item.detail}
            {" · "}
            <time dateTime={item.at}>{when}</time>
          </span>
        </span>
        <ChevronRight size={16} strokeWidth={1.8} aria-hidden />
      </Link>
    </li>
  );
}

function visitStorageKey(userHint: string): string {
  return `${VISIT_KEY}:${userHint}`;
}

export function SalesCopilotDailyWorkspace({ firstName }: { firstName: string }) {
  const router = useRouter();
  const { toast } = useSalesToast();
  const headingId = useId();
  const [data, setData] = useState<DailyWorkspacePayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [detail, setDetail] = useState<SalesTaskItem | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [rescheduleTask, setRescheduleTask] = useState<SalesTaskItem | null>(null);
  const [rescheduleDate, setRescheduleDate] = useState(toDateKey(addDays(new Date(), 1)));
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const dataRef = useRef<DailyWorkspacePayload | null>(null);
  const toastRef = useRef(toast);
  const name = firstName.trim() || "there";
  dataRef.current = data;
  toastRef.current = toast;

  const load = useCallback(async () => {
    setError(null);
    const stored = window.sessionStorage.getItem(visitStorageKey(name));
    const params = stored ? `?visitId=${encodeURIComponent(stored)}` : "";
    try {
      const res = await fetch(`/api/sales/dashboard/workspace${params}`, { cache: "no-store" });
      const json = (await res.json().catch(() => ({}))) as DailyWorkspacePayload & { error?: string };
      if (!res.ok) {
        const message = json.error || "Your sales today could not be loaded.";
        if (dataRef.current) toastRef.current({ title: message, tone: "error" });
        else setError(message);
        return;
      }
      setData(json);
      setError(null);
      if (json.visitId) window.sessionStorage.setItem(visitStorageKey(name), json.visitId);
    } catch {
      const message = "Your sales today could not be loaded.";
      if (dataRef.current) toastRef.current({ title: message, tone: "error" });
      else setError(message);
    } finally {
      setLoading(false);
    }
  }, [name]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    const onChange = () => {
      void load();
    };
    window.addEventListener(SALES_WORK_CHANGED_EVENT, onChange);
    return () => window.removeEventListener(SALES_WORK_CHANGED_EVENT, onChange);
  }, [load]);

  function rememberTrigger(node: HTMLButtonElement | null) {
    triggerRef.current = node;
  }

  function closeDetail() {
    setDetail(null);
    setActionError(null);
    triggerRef.current?.focus();
  }

  async function runCopilot(task: SalesTaskItem, body: TaskActionBody) {
    if (!task.copilot || busyId) return;
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
        const message = json.error ?? "That action was not completed.";
        setActionError(message);
        toast({ title: message, tone: "error" });
        return;
      }
      toast({
        title: body.action === "dismiss" ? "Dismissed" : body.action === "snooze" ? "Snoozed" : body.action === "complete" ? "Completed" : "Saved",
        tone: "success",
      });
      setDetail(null);
      notifySalesWorkChanged();
      router.refresh();
      await load();
    } finally {
      setBusyId(null);
    }
  }

  function openDraft(task: SalesTaskItem) {
    const text = customerDraft({
      actionType: task.copilot?.actionType ?? "contact_later",
      explanation: task.copilot?.explanation ?? task.notes ?? "",
      payload: task.copilot?.payload ?? {},
    });
    stageCopilotDraft(task.leadId, text);
    window.location.assign(task.whatsappHref ?? task.leadHref);
  }

  function onPrimary(task: SalesTaskItem, button: HTMLButtonElement) {
    rememberTrigger(button);
    const action = workspacePrimary(task);
    if (action.kind === "quote" && task.copilot?.linkedQuotationId) {
      window.location.assign(`/sales/quotes/${task.copilot.linkedQuotationId}`);
      return;
    }
    if (action.kind === "draft") {
      openDraft(task);
      return;
    }
    if (action.kind === "retry") {
      void runCopilot(task, { action: "retry" });
      return;
    }
    setActionError(null);
    setDetail(task);
  }

  async function completeManual(task: SalesTaskItem) {
    if (task.copilot) {
      setDetail(task);
      return;
    }
    setBusyId(task.id);
    try {
      const res = await fetch(`/api/leads/${task.leadId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ follow_up_date: null }),
      });
      if (!res.ok) throw new Error("fail");
      toast({ tone: "success", title: "Task completed" });
      setDetail(null);
      notifySalesWorkChanged();
      router.refresh();
      await load();
    } catch {
      toast({ tone: "error", title: "Couldn't update task", description: "Try again." });
    } finally {
      setBusyId(null);
    }
  }

  async function saveReschedule() {
    if (!rescheduleTask || !rescheduleDate || busyId) return;
    setBusyId(rescheduleTask.id);
    try {
      const res = await fetch(`/api/leads/${rescheduleTask.leadId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ follow_up_date: rescheduleDate }),
      });
      if (!res.ok) throw new Error("fail");
      toast({ tone: "success", title: "Task rescheduled" });
      setRescheduleTask(null);
      notifySalesWorkChanged();
      router.refresh();
      await load();
    } catch {
      toast({ tone: "error", title: "Couldn't update task", description: "Try again." });
    } finally {
      setBusyId(null);
    }
  }

  const greeting = data ? `Good ${data.greetingPart}, ${name}` : name;

  return (
    <section className="sales-copilot-daily" aria-labelledby={headingId}>
      <p className="sales-copilot-greeting">{loading ? "Loading your sales today" : greeting}</p>
      <h1 id={headingId} className="sales-copilot-title">
        Your sales today
      </h1>

      {loading ? (
        <div className="sales-copilot-skeleton" aria-hidden>
          <div className="shimmer h-4 w-4/5 rounded" />
          <div className="shimmer mt-3 h-16 w-full rounded" />
          <div className="shimmer mt-2 h-16 w-full rounded" />
        </div>
      ) : error ? (
        <div className="sales-copilot-fallback" role="alert">
          <p>{error}</p>
          <Button type="button" variant="secondary" size="md" onClick={() => { setLoading(true); void load(); }}>
            Retry
          </Button>
        </div>
      ) : data ? (
        <>
          <p className="sales-copilot-briefing">{data.briefing}</p>
          {data.copilotUnavailable ? (
            <p className="sales-copilot-note">
              Sales Copilot is unavailable. Follow-ups already on your list are still here.
            </p>
          ) : null}

          {data.actions.length === 0 ? (
            <p className="sales-copilot-note">No actions need you right now.</p>
          ) : (
            <div className={data.actions.length > 1 ? "sales-copilot-board" : "sales-copilot-board is-single"}>
              <WorkspaceCard
                task={data.actions[0]!}
                featured
                timeZone={data.timezone}
                generatedAt={data.generatedAt}
                busy={busyId === data.actions[0]!.id}
                disabled={busyId != null}
                onPrimary={onPrimary}
              />
              {data.actions.length > 1 ? (
                <div className="sales-copilot-secondary">
                  {data.actions.slice(1, 3).map((task) => (
                    <WorkspaceCard
                      key={task.id}
                      task={task}
                      featured={false}
                      timeZone={data.timezone}
                      generatedAt={data.generatedAt}
                      busy={busyId === task.id}
                      disabled={busyId != null}
                      onPrimary={onPrimary}
                    />
                  ))}
                </div>
              ) : null}
            </div>
          )}

          <Link href={data.viewAllHref} className="sales-copilot-view-all">
            <span>View all Tasks</span>
            <span className="sales-copilot-view-all-end">
              <span className="sales-copilot-view-all-count">{data.openCount}</span>
              <ChevronRight size={16} strokeWidth={1.8} aria-hidden />
            </span>
          </Link>

          <section className="sales-copilot-updates" aria-label={data.updates.heading}>
            <div className="sales-copilot-updates-heading">
              <h2 className="sales-copilot-updates-title">{data.updates.heading}</h2>
              {data.updates.timeframe ? <p className="sales-copilot-updates-time">{data.updates.timeframe}</p> : null}
            </div>
            {data.updates.unavailable ? (
              <p className="sales-copilot-note">Recent updates could not be loaded.</p>
            ) : data.updates.items.length === 0 ? (
              <p className="sales-copilot-note">
                {data.updates.heading === "While you were away"
                  ? "Nothing new since your last visit."
                  : "Nothing new in the last 24 hours."}
              </p>
            ) : (
              <ul>
                {data.updates.items.map((item) => (
                  <UpdateRow key={item.id} item={item} timeZone={data.timezone} />
                ))}
              </ul>
            )}
          </section>
        </>
      ) : null}

      {detail && data ? (
        <TaskDetailDrawer
          task={detail}
          timeZone={data.timezone}
          busy={busyId === detail.id}
          error={actionError}
          onClose={closeDetail}
          onComplete={(task) => void completeManual(task)}
          onReschedule={(task) => {
            setDetail(null);
            setRescheduleDate(toDateKey(addDays(new Date(), 1)));
            setRescheduleTask(task);
          }}
          onAct={(task, body) => void runCopilot(task, body)}
          onDraft={openDraft}
        />
      ) : null}

      {rescheduleTask ? (
        <div className="fixed inset-0 z-[90] flex items-end justify-center p-4 sm:items-center">
          <button type="button" className="absolute inset-0 bg-black/50" aria-label="Close reschedule" onClick={() => setRescheduleTask(null)} />
          <div role="dialog" aria-modal="true" aria-labelledby="reschedule-title" className="relative z-10 w-full max-w-sm rounded-[12px] border border-sales-border bg-sales-surface p-4">
            <h3 id="reschedule-title" className="text-[16px] font-semibold text-sales-text-primary">Reschedule</h3>
            <p className="mt-1 text-[13px] text-sales-text-secondary">{rescheduleTask.title}</p>
            <label className="mt-3 block text-[12px] font-medium text-sales-text-secondary">
              New date
              <input
                type="date"
                className="mt-1 min-h-11 w-full rounded-[8px] border border-sales-border bg-transparent px-2 text-[16px] text-sales-text-primary"
                value={rescheduleDate}
                onChange={(event) => setRescheduleDate(event.target.value)}
              />
            </label>
            <div className="mt-4 flex justify-end gap-2">
              <Button type="button" variant="secondary" size="md" onClick={() => setRescheduleTask(null)}>
                Cancel
              </Button>
              <Button type="button" variant="primary" size="md" loading={busyId === rescheduleTask.id} onClick={() => void saveReschedule()}>
                Save
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}
