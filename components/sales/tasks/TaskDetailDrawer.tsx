"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { PremiumSheet } from "@/components/sales/PremiumSheet";
import { Button } from "@/components/sales/ui";
import { formatScheduleWhen, scheduleLine } from "@/lib/sales/tasks/format";
import type { SalesTaskItem } from "@/lib/sales/tasks/types";

export type TaskActionBody = {
  action: "approve" | "dismiss" | "snooze" | "retry" | "complete" | "choose";
  proposedAt?: string;
  snoozeUntil?: string;
  productId?: string;
};

function datetimeLocalValue(iso: string | null): string {
  if (!iso) return "";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function usesSchedule(task: SalesTaskItem): boolean {
  const action = task.copilot?.actionType;
  return (
    action === "update_reminder" ||
    action === "create_reminder" ||
    action === "customer_checkin" ||
    action === "contact_later" ||
    action === "appointment" ||
    Boolean(task.copilot?.linkedQuotationId) === false && Boolean(task.schedule.at) && task.copilot?.primaryAction === "review"
  );
}

function payloadLines(task: SalesTaskItem, timeZone: string): string[] {
  const payload = task.copilot?.payload ?? {};
  const lines: string[] = [];
  const followUp = typeof payload.followUpAt === "string" ? payload.followUpAt : task.copilot?.proposedAt;
  if (followUp) {
    const suggested = payload.hourSuggested === true || task.copilot?.hourSuggested;
    lines.push(`Proposed follow-up: ${formatScheduleWhen(followUp, timeZone)}${suggested ? " (suggested hour)" : ""}`);
  }
  if (task.schedule.expectedReplyAt) {
    lines.push(`Expected reply: ${formatScheduleWhen(task.schedule.expectedReplyAt, timeZone)}`);
  }
  if (typeof payload.currentLabel === "string" && payload.currentLabel) {
    lines.push(`Current reminder: ${payload.currentLabel}`);
  }
  if (typeof payload.subject === "string" && payload.subject) lines.push(`Subject: ${payload.subject}`);
  if (typeof payload.source === "string" && payload.source) lines.push(`Source: ${payload.source.replaceAll("_", " ").toLowerCase()}`);
  if (payload.awaitingCustomerConfirmation === true) lines.push("The customer has not confirmed this time.");
  if (Array.isArray(payload.items)) {
    for (const item of payload.items) {
      if (!item || typeof item !== "object") continue;
      const row = item as { name?: string; quantity?: number };
      if (row.name) lines.push(`Draft item: ${row.quantity ?? ""} × ${row.name}`.replace("×  ", ""));
    }
  }
  if (typeof payload.question === "string" && payload.question) lines.push(`Question: ${payload.question}`);
  return lines;
}

function statusWord(value: string): string {
  if (value === "needs_review" || value === "pending") return "Pending review";
  if (value === "none") return "Not run";
  if (value === "succeeded") return "Saved";
  if (value === "failed") return "Failed";
  if (value === "approved") return "Approved";
  if (value === "open") return "Open";
  if (value === "fulfilled") return "Fulfilled";
  return value.replaceAll("_", " ");
}

export function TaskDetailDrawer({
  task,
  timeZone,
  busy,
  error,
  onClose,
  onComplete,
  onReschedule,
  onAct,
  onDraft,
}: {
  task: SalesTaskItem;
  timeZone: string;
  busy: boolean;
  error: string | null;
  onClose: () => void;
  onComplete: (task: SalesTaskItem) => void;
  onReschedule: (task: SalesTaskItem) => void;
  onAct: (task: SalesTaskItem, body: TaskActionBody) => void;
  onDraft?: (task: SalesTaskItem) => void;
}) {
  const [when, setWhen] = useState(() => datetimeLocalValue(task.copilot?.proposedAt ?? task.schedule.at));
  const [edited, setEdited] = useState(false);
  const [snoozeOpen, setSnoozeOpen] = useState(false);
  const [snoozeUntil, setSnoozeUntil] = useState("");
  const [evidenceOpen, setEvidenceOpen] = useState(false);

  useEffect(() => {
    setWhen(datetimeLocalValue(task.copilot?.proposedAt ?? task.schedule.at));
    setEdited(false);
    setSnoozeOpen(false);
    setSnoozeUntil("");
    setEvidenceOpen(false);
  }, [task.id, task.copilot?.proposedAt, task.schedule.at]);

  const copilot = task.copilot;
  const scheduled = copilot ? usesSchedule(task) && copilot.primaryAction === "review" : false;
  const options = Array.isArray(copilot?.payload.options)
    ? (copilot.payload.options as Array<{ id?: string; name?: string }>).filter((option) => option.id)
    : [];
  const confirmLabel = copilot?.executionStatus === "failed"
    ? "Retry"
    : copilot?.primaryAction === "complete"
      ? "Complete"
      : copilot?.actionLabel ?? "Save";
  const explanation = copilot?.explanation || task.notes;

  return (
    <PremiumSheet
      title={task.title}
      description={task.relatedName}
      onClose={onClose}
      closeDisabled={busy}
      size="md"
      footer={
        <div className="flex flex-wrap items-center justify-end gap-2">
          {copilot ? (
            <>
              <Button variant="secondary" size="md" disabled={busy} onClick={() => onAct(task, { action: "dismiss" })}>
                Dismiss
              </Button>
              {snoozeOpen ? (
                <Button
                  variant="secondary"
                  size="md"
                  disabled={busy || !snoozeUntil}
                  onClick={() => onAct(task, { action: "snooze", snoozeUntil: new Date(snoozeUntil).toISOString() })}
                >
                  Confirm snooze
                </Button>
              ) : (
                <Button variant="secondary" size="md" disabled={busy} onClick={() => setSnoozeOpen(true)}>
                  Snooze
                </Button>
              )}
              {copilot.primaryAction === "quote" && copilot.linkedQuotationId ? (
                <Link
                  href={`/sales/quotes/${copilot.linkedQuotationId}`}
                  className="inline-flex h-11 items-center rounded-[10px] bg-sales-brand px-3 text-[14px] font-semibold text-sales-brand-text"
                >
                  Review draft
                </Link>
              ) : copilot.primaryAction === "draft" ? (
                <Button variant="primary" size="md" disabled={busy} onClick={() => onDraft?.(task)}>
                  Draft reply
                </Button>
              ) : copilot.primaryAction === "missing" || copilot.primaryAction === "choose" || copilot.primaryAction === "details" ? null : (
                <Button
                  variant="primary"
                  size="md"
                  loading={busy}
                  disabled={busy || copilot.reviewStatus === "stale"}
                  onClick={() => {
                    if (copilot.executionStatus === "failed") {
                      onAct(task, { action: "retry" });
                      return;
                    }
                    if (copilot.primaryAction === "complete") {
                      onAct(task, { action: "complete" });
                      return;
                    }
                    onAct(task, {
                      action: "approve",
                      proposedAt: edited && when ? new Date(when).toISOString() : undefined,
                    });
                  }}
                >
                  {confirmLabel}
                </Button>
              )}
            </>
          ) : !task.completed ? (
            <>
              <Button variant="secondary" size="md" disabled={busy} onClick={() => onReschedule(task)}>
                Reschedule
              </Button>
              <Button variant="primary" size="md" loading={busy} onClick={() => onComplete(task)}>
                Complete
              </Button>
            </>
          ) : (
            <Button variant="secondary" size="md" onClick={onClose}>
              Close
            </Button>
          )}
        </div>
      }
    >
      <div className="space-y-4 text-[14px] leading-5">
        {error ? (
          <p role="alert" className="text-[13px] text-sales-danger">
            {error}
          </p>
        ) : null}
        {explanation ? <p className="text-sales-text-secondary">{explanation}</p> : null}
        <p className={task.schedule.overdue ? "font-medium text-sales-danger" : "text-sales-text-primary"}>
          {scheduleLine(task.schedule, timeZone)}
        </p>
        {task.schedule.expectedReplyAt ? (
          <p className="text-sales-text-secondary">
            Expected reply: {formatScheduleWhen(task.schedule.expectedReplyAt, timeZone)}
          </p>
        ) : null}
        {task.schedule.passedSuggestion ? (
          <p className="text-sales-text-secondary">This proposed time has passed. Choose a new time before it is saved.</p>
        ) : null}
        {copilot?.executionError ? <p className="text-sales-danger">{copilot.executionError}</p> : null}
        {copilot ? (
          <p className="text-[13px] text-sales-text-muted">Nothing is saved, dismissed, or completed until you use a button below.</p>
        ) : null}

        {payloadLines(task, timeZone).length ? (
          <ul className="space-y-1 text-[13px] text-sales-text-secondary">
            {payloadLines(task, timeZone).map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
        ) : null}

        {copilot?.missing.length ? (
          <div>
            <p className="font-semibold text-sales-text-primary">Still to confirm</p>
            <ul className="mt-1 list-disc pl-4 text-sales-text-secondary">
              {copilot.missing.map((label) => (
                <li key={label}>{label}</li>
              ))}
            </ul>
          </div>
        ) : null}

        {options.length ? (
          <div className="flex flex-col gap-2">
            {options.map((option) => (
              <button
                key={option.id}
                type="button"
                disabled={busy}
                onClick={() => onAct(task, { action: "choose", productId: option.id })}
                className="min-h-11 rounded-[8px] border border-sales-border px-3 text-left text-[14px] font-medium text-sales-text-primary disabled:opacity-50"
              >
                {option.name ?? "Choose"}
              </button>
            ))}
          </div>
        ) : null}

        {scheduled ? (
          <label className="block text-[12px] font-medium text-sales-text-secondary">
            Date and time
            <input
              type="datetime-local"
              value={when}
              onChange={(event) => {
                setWhen(event.target.value);
                setEdited(true);
              }}
              className="mt-1 min-h-11 w-full rounded-[8px] border border-sales-border bg-transparent px-2 text-[16px] text-sales-text-primary"
            />
          </label>
        ) : null}

        {snoozeOpen ? (
          <label className="block text-[12px] font-medium text-sales-text-secondary">
            Snooze until
            <input
              type="datetime-local"
              value={snoozeUntil}
              onChange={(event) => setSnoozeUntil(event.target.value)}
              className="mt-1 min-h-11 w-full rounded-[8px] border border-sales-border bg-transparent px-2 text-[16px] text-sales-text-primary"
            />
          </label>
        ) : null}

        {copilot?.evidence.length ? (
          <div>
            <button
              type="button"
              className="min-h-11 text-left text-[13px] font-semibold text-sales-text-primary"
              aria-expanded={evidenceOpen}
              onClick={() => setEvidenceOpen((open) => !open)}
            >
              {evidenceOpen ? "Hide supporting messages" : "View supporting messages"}
            </button>
            {evidenceOpen ? (
              <ul className="space-y-2">
                {copilot.evidence.map((item) => (
                  <li key={item.id || item.text} className="text-[13px] leading-5 text-sales-text-secondary">
                    {item.speaker === "customer" ? "Customer" : "You"}: “{item.text}”
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
        ) : null}

        {copilot ? (
          <dl className="grid grid-cols-3 gap-2 text-[12px] text-sales-text-muted">
            <div>
              <dt>Review</dt>
              <dd className="text-sales-text-secondary">{statusWord(copilot.reviewStatus)}</dd>
            </div>
            <div>
              <dt>Execution</dt>
              <dd className="text-sales-text-secondary">{statusWord(copilot.executionStatus)}</dd>
            </div>
            <div>
              <dt>Fulfilment</dt>
              <dd className="text-sales-text-secondary">{statusWord(copilot.fulfilmentStatus)}</dd>
            </div>
          </dl>
        ) : null}

        <div className="flex flex-wrap gap-3">
          {task.whatsappHref || task.leadHref ? (
            <Link href={task.whatsappHref ?? task.leadHref} className="inline-flex h-11 items-center text-[14px] font-semibold text-sales-text-primary">
              View chat
            </Link>
          ) : null}
          {copilot?.primaryAction === "draft" ? (
            <span className="text-[13px] text-sales-text-secondary">Draft reply from the task list. It is placed in the composer and is not sent.</span>
          ) : null}
        </div>
      </div>
    </PremiumSheet>
  );
}
