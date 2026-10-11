"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { addDays } from "date-fns";
import { TaskDetailDrawer, type TaskActionBody } from "@/components/sales/tasks/TaskDetailDrawer";
import { Button } from "@/components/sales/ui";
import { useSalesToast } from "@/components/sales/ui/Toast";
import { customerDraft, stageCopilotDraft } from "@/lib/sales-copilot/draft";
import type { DailyWorkspacePayload } from "@/lib/sales/dashboard/load-daily-workspace";
import { notifySalesWorkChanged, SALES_WORK_CHANGED_EVENT } from "@/lib/sales/dashboard/refresh";
import {
  workspaceDateLine,
  workspaceExplanation,
  workspacePrimary,
} from "@/lib/sales/dashboard/daily-workspace";
import { formatScheduleWhen } from "@/lib/sales/tasks/format";
import type { SalesTaskItem } from "@/lib/sales/tasks/types";
import { toDateKey } from "@/lib/sales/calendar/format";

const VISIT_KEY = "segmiq:dashboard-visit";

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
      <p className="sales-copilot-kicker">Sales Copilot</p>
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
            <ol className="sales-copilot-list">
              {data.actions.map((task) => {
                const primary = workspacePrimary(task);
                const dateLine = workspaceDateLine(task, data.timezone);
                const chatHref = task.whatsappHref ?? (task.isWhatsAppCapable ? task.leadHref : null);
                const explanation = workspaceExplanation(task, new Date(data.generatedAt), data.timezone);
                return (
                  <li key={task.id} className="sales-copilot-row">
                    <h2 className="sales-copilot-action-title">{task.title}</h2>
                    <p className="sales-copilot-meta">{task.relatedName}</p>
                    <p className={`sales-copilot-date sales-copilot-date--${dateLine.tone}`}>{dateLine.text}</p>
                    <p className="sales-copilot-explanation">{explanation}</p>
                    <div className="sales-copilot-actions">
                      <Button
                        type="button"
                        variant="primary"
                        size="md"
                        loading={busyId === task.id}
                        disabled={busyId != null}
                        onClick={(event) => onPrimary(task, event.currentTarget)}
                      >
                        {primary.label}
                      </Button>
                      {chatHref ? (
                        <Link href={chatHref} className="sales-copilot-chat">
                          View chat
                        </Link>
                      ) : null}
                    </div>
                  </li>
                );
              })}
            </ol>
          )}

          <Link href={data.viewAllHref} className="sales-copilot-view-all">
            View all Tasks ({data.openCount})
          </Link>

          <div className="sales-copilot-updates">
            <h2 className="sales-copilot-updates-title">
              {data.updates.heading}
              {data.updates.timeframe ? <span> · {data.updates.timeframe}</span> : null}
            </h2>
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
                  <li key={item.id}>
                    <p>{item.summary}</p>
                    <p className="sales-copilot-meta">
                      <time dateTime={item.at}>{formatScheduleWhen(item.at, data.timezone)}</time>
                      {" · "}
                      <Link href={item.href}>{item.linkLabel}</Link>
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </div>
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
