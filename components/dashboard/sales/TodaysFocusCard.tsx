"use client";

import { useCallback, useRef, useState } from "react";
import Link from "next/link";
import { ArrowRight, MoreHorizontal, Pencil, Phone } from "lucide-react";
import { SiWhatsapp } from "react-icons/si";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/sales/ui/DropdownMenu";
import { openWhatsAppAndLog } from "@/lib/whatsapp-opener";
import { cn } from "@/lib/ui/cn";
import type {
  DailySalesPlanProgress,
  FocusModeResult,
  SalesActionRecommendation,
} from "@/lib/sales/intelligence/types";
import type { SalesDealAttentionItem, SalesEnquiryPriorityItem } from "@/components/dashboard/sales/types";
import { buildFocusActionRows, type FocusActionRow } from "@/lib/sales/focus-todays-actions";
import styles from "./TodaysFocusCard.module.css";

async function postPlanAction(
  rec: SalesActionRecommendation,
  action: "complete" | "snooze" | "skip"
) {
  const res = await fetch("/api/sales/daily-plan/actions", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      idempotencyKey: rec.idempotencyKey,
      actionType: rec.actionType,
      reasonCode: rec.reasonCode,
      sourceEntityType: rec.sourceEntityType,
      sourceEntityId: rec.sourceEntityId,
      action,
      ...(action === "snooze" ? { snoozePreset: "later_today" as const } : {}),
      ...(action === "skip" ? { skipReason: "Dismissed from today's focus" } : {}),
    }),
  });
  if (!res.ok) {
    const body = (await res.json().catch(() => null)) as { error?: string } | null;
    throw new Error(body?.error || "Failed to update action");
  }
}

function PrimaryCtaButton({
  row,
  clientId,
  onAddProspect,
  className,
}: {
  row: FocusActionRow;
  clientId: string | null;
  onAddProspect?: () => void;
  className?: string;
}) {
  const base = styles.primaryButton;

  if (row.primary.kind === "whatsapp" && row.phone && row.leadId) {
    return (
      <button
        type="button"
        className={cn(base, className)}
        onClick={() => {
          void openWhatsAppAndLog({
            leadId: row.leadId!,
            clientId: clientId ?? "",
            leadName: row.customerName,
            leadPhone: row.phone!,
            repName: "",
          });
        }}
      >
        <SiWhatsapp size={14} aria-hidden />
        {row.primary.label}
      </button>
    );
  }

  if (row.primary.kind === "call" && row.phone) {
    return (
      <a href={`tel:${row.phone}`} className={cn(base, className)}>
        <Phone size={14} strokeWidth={1.8} aria-hidden />
        {row.primary.label}
      </a>
    );
  }

  if (row.primary.kind === "add_prospect") {
    return (
      <button type="button" className={cn(base, className)} onClick={() => onAddProspect?.()}>
        {row.primary.label}
      </button>
    );
  }

  const href = row.primary.href ?? row.href;
  return (
    <Link href={href} className={cn(base, className)}>
      {row.primary.label}
      <ArrowRight size={14} aria-hidden />
    </Link>
  );
}

function ActionRowMenu({
  row,
  onDismissed,
}: {
  row: FocusActionRow;
  onDismissed: (id: string, action: "complete" | "snooze" | "skip") => void;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const canMutate = Boolean(row.recommendation);

  const run = useCallback(
    async (action: "complete" | "snooze" | "skip") => {
      if (busy || !row.recommendation) return;
      setBusy(true);
      setError(null);
      try {
        await postPlanAction(row.recommendation, action);
        onDismissed(row.id, action);
      } catch {
        setError("Could not update this action. Please try again.");
      } finally {
        setBusy(false);
      }
    },
    [busy, onDismissed, row.id, row.recommendation]
  );

  return (
    <div className={styles.menu}>
      <DropdownMenu align="end">
        <DropdownMenuTrigger
          className={styles.iconButton}
          aria-label={`More actions for ${row.customerName}`}
          disabled={busy}
        >
          <MoreHorizontal size={16} strokeWidth={1.8} aria-hidden />
        </DropdownMenuTrigger>
        <DropdownMenuContent className="min-w-[180px]">
          <DropdownMenuItem
            onSelect={() => {
              window.location.href = row.href;
            }}
          >
            {row.dealId ? "Open deal" : "Open customer"}
          </DropdownMenuItem>
          {row.phone ? (
            <DropdownMenuItem
              onSelect={() => {
                window.location.href = `tel:${row.phone}`;
              }}
            >
              Call
            </DropdownMenuItem>
          ) : null}
          {canMutate ? (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem disabled={busy} onSelect={() => void run("complete")}>
                Mark done
              </DropdownMenuItem>
              <DropdownMenuItem disabled={busy} onSelect={() => void run("snooze")}>
                Snooze for later
              </DropdownMenuItem>
              <DropdownMenuItem disabled={busy} onSelect={() => void run("skip")}>
                Dismiss
              </DropdownMenuItem>
            </>
          ) : null}
        </DropdownMenuContent>
      </DropdownMenu>
      {error ? (
        <p role="alert" className={styles.error}>
          {error}
        </p>
      ) : null}
    </div>
  );
}

function statusLabel(row: FocusActionRow): string {
  switch (row.recommendation?.reasonCode) {
    case "QUOTE_EXPIRING":
      return "Quote expiring";
    case "FOLLOWUP_OVERDUE":
      return "Follow-up overdue";
    case "CUSTOMER_WAITING":
      return row.signal || "Waiting for your reply";
    case "FOLLOWUP_DUE_TODAY":
      return "Follow-up today";
    case "QUOTE_WAITING":
      return "Quote awaiting reply";
    case "QUOTE_VIEWED":
      return "Quote viewed";
    default:
      return row.signal || row.commercialState || "Next action";
  }
}

function suggestedMessage(row: FocusActionRow): string {
  const firstName = row.customerName.trim().split(/\s+/)[0] || "there";
  if (row.recommendation?.actionType === "RESPOND_TO_CUSTOMER") {
    return `Hi ${firstName}, thank you for your message. How can I help you with the next step?`;
  }
  const subject =
    row.recommendation?.actionType === "FOLLOW_UP_QUOTE"
      ? "your quotation"
      : row.opportunityLabel
        ? `your ${row.opportunityLabel}`
        : "your enquiry";
  return `Hi ${firstName}, following up on ${subject}. Would you like to discuss the next step?`;
}

function ActionInspector({
  row,
  clientId,
  onAddProspect,
  draft,
  onDraftChange,
  onActionFinished,
}: {
  row: FocusActionRow;
  clientId: string | null;
  onAddProspect?: () => void;
  draft: string;
  onDraftChange: (message: string) => void;
  onActionFinished: (id: string, action: "complete" | "snooze" | "skip") => void;
}) {
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const input = useRef<HTMLTextAreaElement>(null);
  const canMessage = Boolean(
    row.leadId && row.phone && row.availableActions.includes("whatsapp") && row.primary.kind !== "call"
  );
  const rec = row.recommendation;
  const quoteId =
    rec?.sourceEntityType === "quotation"
      ? rec.sourceEntityId
      : typeof rec?.metadata?.quotationId === "string"
        ? rec.metadata.quotationId
        : typeof rec?.metadata?.quoteId === "string"
          ? rec.metadata.quoteId
          : null;
  const firstName = row.customerName.trim().split(/\s+/)[0];
  const actionTitle =
    rec?.actionType === "RESPOND_TO_CUSTOMER"
      ? `Reply to ${firstName}`
      : row.primary.kind === "add_prospect"
        ? "Add a prospect"
        : row.primary.kind === "create_quote"
          ? `Quote ${firstName}`
          : `Follow up with ${firstName}`;
  const commandHref = `/sales/command?prompt=${encodeURIComponent(
    `Help me draft a message for ${row.customerName}. Context: ${row.reason}${row.opportunityLabel ? ` Opportunity: ${row.opportunityLabel}.` : ""}`
  )}`;
  const urgent = row.priority === "URGENT" || rec?.reasonCode === "CUSTOMER_WAITING";

  async function sendMessage() {
    if (busy || !draft.trim() || !row.leadId) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/leads/${encodeURIComponent(row.leadId)}/send-message`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: draft.trim() }),
      });
      const body = (await res.json().catch(() => null)) as { error?: string } | null;
      if (!res.ok) throw new Error(body?.error || "Could not send this WhatsApp message.");

      if (row.recommendation) {
        try {
          await postPlanAction(row.recommendation, "complete");
        } catch {
          setError("Message sent, but the action could not be marked complete. Use the menu to finish it.");
          return;
        }
      }
      onActionFinished(row.id, "complete");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not send this WhatsApp message.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <aside className={styles.inspector} aria-label={actionTitle}>
      <p className={cn(styles.statusLine, urgent && styles.statusUrgent)}>{statusLabel(row)}</p>
      <h3>{actionTitle}</h3>
      <p className={styles.reason}>{row.reason}</p>
      {row.opportunityLabel || row.valueLabel ? (
        <p className={styles.dealMeta}>{[row.opportunityLabel, row.valueLabel].filter(Boolean).join(" · ")}</p>
      ) : null}

      {canMessage ? (
        <div className={styles.compose}>
          <div className={styles.composeHead}>
            <label htmlFor={`focus-draft-${row.id}`}>Message</label>
            <Link className={styles.quietLink} href={commandHref}>
              Draft with SegmiQ
            </Link>
          </div>
          <textarea
            id={`focus-draft-${row.id}`}
            ref={input}
            aria-label={`Message to ${row.customerName}`}
            className={styles.message}
            value={draft}
            readOnly={!editing}
            onChange={(event) => onDraftChange(event.target.value)}
            rows={3}
          />
          <div className={styles.composeActions}>
            <button
              type="button"
              className={styles.primaryButton}
              onClick={() => void sendMessage()}
              disabled={busy || !draft.trim()}
            >
              <SiWhatsapp size={16} aria-hidden />
              {busy ? "Sending…" : "Send WhatsApp"}
            </button>
            <button
              type="button"
              className={styles.ghostButton}
              onClick={() => {
                setEditing(!editing);
                if (!editing) requestAnimationFrame(() => input.current?.focus());
              }}
            >
              <Pencil size={14} aria-hidden />
              {editing ? "Done" : "Edit"}
            </button>
          </div>
          {error ? (
            <p className={styles.error} role="alert">
              {error}
            </p>
          ) : null}
        </div>
      ) : (
        <div className={styles.compose}>
          <PrimaryCtaButton row={row} clientId={clientId} onAddProspect={onAddProspect} />
        </div>
      )}

      <div className={styles.inspectorLinks}>
        {row.leadId ? (
          <Link href={`/sales/inbox?lead=${encodeURIComponent(row.leadId)}`}>Conversation</Link>
        ) : null}
        <Link href={quoteId ? `/sales/quotes/${encodeURIComponent(quoteId)}` : row.href}>
          {quoteId ? "Quotation" : row.dealId ? "Deal" : "Record"}
        </Link>
      </div>
    </aside>
  );
}

export function TodaysFocusCard({
  focus,
  queue = [],
  progress = null,
  error,
  clientId = null,
  onAddProspect,
  fallbackEnquiries = [],
  fallbackDeals = [],
}: {
  focus: FocusModeResult | null;
  queue?: SalesActionRecommendation[];
  progress?: DailySalesPlanProgress | null;
  error?: boolean;
  clientId?: string | null;
  onAddProspect?: () => void;
  fallbackEnquiries?: SalesEnquiryPriorityItem[];
  fallbackDeals?: SalesDealAttentionItem[];
}) {
  const [dismissed, setDismissed] = useState<Set<string>>(() => new Set());
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [localCompleted, setLocalCompleted] = useState(0);
  const onDismissed = useCallback(
    (id: string, action: "complete" | "snooze" | "skip") => {
      setDismissed((previous) => new Set(previous).add(id));
      if (action === "complete") {
        setLocalCompleted((count) => Math.max(count, progress?.priorityCompleted ?? 0) + 1);
      }
    },
    [progress?.priorityCompleted]
  );
  const sourceRows = buildFocusActionRows(queue, {
    limit: Math.max(queue.length, fallbackEnquiries.length + fallbackDeals.length, 3),
    fallbackEnquiries,
    fallbackDeals,
  });
  const remainingRows = sourceRows.filter((row) => !dismissed.has(row.id));
  const topRows = remainingRows.slice(0, 3);
  const selected = topRows.find((row) => row.id === selectedId) ?? topRows[0];
  const completed = Math.max(progress?.priorityCompleted ?? 0, localCompleted);
  const total = Math.max(progress?.priorityTotal ?? sourceRows.length, completed);
  const waiting = remainingRows.filter(
    (row) =>
      row.recommendation?.reasonCode === "CUSTOMER_WAITING" ||
      row.recommendation?.actionType === "RESPOND_TO_CUSTOMER"
  ).length;

  if (!focus && !error && sourceRows.length === 0) return null;

  const ledeParts = [`${remainingRows.length} remaining`];
  if (waiting > 0) ledeParts.push(`${waiting} waiting`);

  return (
    <section
      className={styles.workspace}
      data-course-target="dashboard-todays-focus"
      aria-label="Today’s focus"
    >
      <header className={styles.header}>
        <div className={styles.headingGroup}>
          <h2>Today</h2>
          <p>{ledeParts.join(" · ")}</p>
        </div>
        <Link href="/sales/command?view=focus" className={styles.headerLink}>
          All actions
        </Link>
      </header>

      {selected ? (
        <div className={styles.content}>
          <ol className={styles.queue}>
            {topRows.map((row, index) => {
              const active = row.id === selected.id;
              return (
                <li key={row.id} className={cn(styles.row, active && styles.rowActive)}>
                  <button
                    type="button"
                    className={styles.rowHit}
                    aria-pressed={active}
                    onClick={() => setSelectedId(row.id)}
                  >
                    <span className={styles.rank}>{index + 1}</span>
                    <span className={styles.identity}>
                      <span className={styles.customer}>{row.customerName}</span>
                      <span className={styles.rowMeta}>{statusLabel(row)}</span>
                    </span>
                  </button>
                  <ActionRowMenu row={row} onDismissed={onDismissed} />
                </li>
              );
            })}
          </ol>
          <ActionInspector
            key={selected.id}
            row={selected}
            clientId={clientId}
            onAddProspect={onAddProspect}
            draft={drafts[selected.id] ?? suggestedMessage(selected)}
            onDraftChange={(message) =>
              setDrafts((previous) => ({ ...previous, [selected.id]: message }))
            }
            onActionFinished={onDismissed}
          />
        </div>
      ) : (
        <div className={styles.empty}>
          <h3>{error ? "Priorities couldn’t load" : "Nothing waiting"}</h3>
          <p>
            {error
              ? "Open tasks to keep working."
              : "No sales actions need you right now."}
          </p>
          <Link className={styles.headerLink} href={error ? "/sales/tasks" : "/sales/pipeline"}>
            {error ? "Open tasks" : "Pipeline"}
          </Link>
        </div>
      )}

      <footer className={styles.progressFooter} data-course-target="dashboard-sales-plan">
        <p>
          <span className={styles.progressCount}>
            {completed} of {total}
          </span>{" "}
          done
        </p>
        <Link href="/sales/command?view=focus">
          {remainingRows.length > 3 ? `See all ${remainingRows.length}` : "See all"}
        </Link>
      </footer>
    </section>
  );
}

/** @deprecated Prefer progress footer inside TodaysFocusCard. Kept for any external imports. */
export function TodaysSalesPlanStrip({
  headline,
  supporting,
  ctaLabel,
  ctaHref,
  state,
}: {
  headline: string;
  supporting: string;
  ctaLabel: string | null;
  ctaHref: string | null;
  state: "active" | "complete" | "build";
}) {
  return (
    <div
      data-course-target="dashboard-sales-plan"
      data-state={state}
      className="dashboard-panel dashboard-panel--analytics flex flex-col gap-3 overflow-hidden border-0 p-4 shadow-none sm:flex-row sm:items-center sm:justify-between sm:p-5"
    >
      <div className="min-w-0">
        <div className="flex items-start gap-2">
          <div>
            <p className="text-[14px] font-semibold text-sales-text-primary">{headline}</p>
            <p className="mt-1 text-[12px] text-sales-text-secondary">{supporting}</p>
          </div>
        </div>
      </div>
      {ctaLabel && ctaHref ? (
        <Link
          href={ctaHref}
          className="inline-flex min-h-11 shrink-0 items-center justify-center gap-1 rounded-sales-md bg-sales-text-primary px-4 text-[13px] font-semibold text-sales-bg transition-[opacity,transform] duration-150 hover:opacity-90 active:translate-y-px focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sales-brand"
        >
          {ctaLabel}
        </Link>
      ) : null}
    </div>
  );
}
