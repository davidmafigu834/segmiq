"use client";

import { useCallback, useRef, useState } from "react";
import Link from "next/link";
import {
  AlertCircle, ArrowRight, CalendarDays, CheckCircle2, Clock3, Crosshair,
  ExternalLink, FileText, ListTodo, MessageCircle, MoreHorizontal, Pencil,
  Phone, Sparkles, UserRound,
} from "lucide-react";
import { SiWhatsapp } from "react-icons/si";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/sales/ui/DropdownMenu";
import { buildWhatsAppUrl, fetchClientWhatsAppMeta, normalizePhoneForWhatsApp, openExternalUrl, openWhatsAppAndLog } from "@/lib/whatsapp-opener";
import { cn } from "@/lib/ui/cn";
import type { DailySalesPlanProgress, FocusModeResult, SalesActionRecommendation } from "@/lib/sales/intelligence/types";
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
    }),
  });
  if (!res.ok) throw new Error("Failed to update action");
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
  const base =
    "inline-flex min-h-11 items-center justify-center gap-1.5 rounded-sales-md bg-sales-brand px-3.5 text-[13px] font-semibold text-sales-ink transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sales-brand";

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
      <button
        type="button"
        className={cn(base, className)}
        onClick={() => onAddProspect?.()}
      >
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
    <div className={styles.menu}><DropdownMenu align="end">
      <DropdownMenuTrigger
        className="inline-flex h-9 w-9 items-center justify-center rounded-sales-md text-sales-text-muted transition-colors hover:bg-sales-surface-hover hover:text-sales-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sales-brand"
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
    </DropdownMenu>{error ? <p role="alert" className={styles.error}>{error}</p> : null}</div>
  );
}


function statusLabel(row: FocusActionRow): string {
  switch (row.recommendation?.reasonCode) {
    case "QUOTE_EXPIRING": return "Quote expiring";
    case "FOLLOWUP_OVERDUE": return "Follow-up overdue";
    case "CUSTOMER_WAITING": return row.signal || "Waiting for your reply";
    case "FOLLOWUP_DUE_TODAY": return "Follow-up today";
    case "QUOTE_WAITING": return "Quote awaiting reply";
    case "QUOTE_VIEWED": return "Quote viewed";
    default: return row.signal || row.commercialState || "Next action";
  }
}

function suggestedMessage(row: FocusActionRow): string {
  const firstName = row.customerName.trim().split(/\s+/)[0] || "there";
  if (row.recommendation?.actionType === "RESPOND_TO_CUSTOMER") {
    return `Hi ${firstName}, thank you for your message. How can I help you with the next step?`;
  }
  const subject = row.recommendation?.actionType === "FOLLOW_UP_QUOTE"
    ? "your quotation" : row.opportunityLabel ? `your ${row.opportunityLabel}` : "your enquiry";
  return `Hi ${firstName}, following up on ${subject}. Would you like to discuss the next step?`;
}

function SuggestedNextStep({
  row, clientId, onAddProspect, draft, onDraftChange,
}: {
  row: FocusActionRow;
  clientId: string | null;
  onAddProspect?: () => void;
  draft: string;
  onDraftChange: (message: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const input = useRef<HTMLTextAreaElement>(null);
  const canMessage = Boolean(row.phone && row.availableActions.includes("whatsapp") && row.primary.kind !== "call");
  const rec = row.recommendation;
  const quoteId = rec?.sourceEntityType === "quotation" ? rec.sourceEntityId
    : typeof rec?.metadata?.quotationId === "string" ? rec.metadata.quotationId
    : typeof rec?.metadata?.quoteId === "string" ? rec.metadata.quoteId : null;
  const firstName = row.customerName.trim().split(/\s+/)[0];
  const title = rec?.actionType === "RESPOND_TO_CUSTOMER" ? `Reply to ${firstName}`
    : row.primary.kind === "add_prospect" ? "Build your pipeline"
    : row.primary.kind === "create_quote" ? `Prepare a quote for ${firstName}`
    : `Follow up with ${firstName}`;
  const commandHref = `/sales/command?prompt=${encodeURIComponent(
    `Help me draft a message for ${row.customerName}. Context: ${row.reason}${row.opportunityLabel ? ` Opportunity: ${row.opportunityLabel}.` : ""}`
  )}`;

  async function reviewMessage() {
    if (busy || !draft.trim()) return;
    setBusy(true);
    setError(null);
    try {
      const meta = clientId ? await fetchClientWhatsAppMeta(clientId) : null;
      const digits = normalizePhoneForWhatsApp(row.phone, meta?.dial_code);
      if (!digits) throw new Error("This customer needs a valid phone number before opening WhatsApp.");
      openExternalUrl(buildWhatsAppUrl(digits, draft.trim()));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not open WhatsApp. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <aside className={styles.suggestion} aria-label="Suggested next step">
      <p className={styles.eyebrow}><Sparkles size={26} aria-hidden />Suggested next step</p>
      <h3>{title}</h3>
      <div className={styles.reasons}>
        <h4>Why this matters</h4>
        <p><AlertCircle size={20} aria-hidden className={row.priority === "URGENT" ? styles.dangerIcon : styles.accent} /><span>{statusLabel(row)}</span></p>
        <p><MessageCircle size={22} aria-hidden /><span>{row.reason}</span></p>
      </div>
      {canMessage ? (
        <div className={styles.messageSection}>
          <div className={styles.messageHeading}>
            <h4>Suggested message</h4>
            <Link className={styles.draftLink} href={commandHref}><Pencil size={16} aria-hidden />Draft with SegmiQ</Link>
          </div>
          <textarea
            ref={input}
            aria-label={`Suggested message to ${row.customerName}`}
            className={styles.message}
            value={draft}
            readOnly={!editing}
            onChange={(event) => onDraftChange(event.target.value)}
            rows={3}
          />
          <div className={styles.messageActions}>
            <button type="button" className={styles.primaryButton} onClick={() => void reviewMessage()} disabled={busy || !draft.trim()}>
              <SiWhatsapp size={23} aria-hidden />{busy ? "Opening WhatsApp…" : "Review & send"}
            </button>
            <button type="button" className={styles.outlineButton} onClick={() => {
              setEditing(!editing);
              if (!editing) requestAnimationFrame(() => input.current?.focus());
            }}><Pencil size={20} aria-hidden />{editing ? "Done editing" : "Edit draft"}</button>
          </div>
          {error ? <p className={styles.error} role="alert">{error}</p> : null}
        </div>
      ) : (
        <div className={styles.messageSection}>
          <h4>Next action</h4>
          <p className={styles.nextActionCopy}>{row.recommendation?.recommendedActionLabel || row.primary.label}</p>
          <PrimaryCtaButton row={row} clientId={clientId} onAddProspect={onAddProspect} className={styles.primaryButton} />
        </div>
      )}
      <div className={styles.relatedLinks}>
        {row.leadId ? <Link href={`/sales/inbox?lead=${encodeURIComponent(row.leadId)}`}>Open conversation <ExternalLink size={15} aria-hidden /></Link> : null}
        <Link href={quoteId ? `/sales/quotes/${encodeURIComponent(quoteId)}` : row.href}>
          {quoteId ? "View quotation" : row.dealId ? "View deal" : "View details"}<ExternalLink size={15} aria-hidden />
        </Link>
      </div>
    </aside>
  );
}

export function TodaysFocusCard({
  focus, queue = [], progress = null, error, clientId = null, onAddProspect,
  fallbackEnquiries = [], fallbackDeals = [],
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
  const onDismissed = useCallback((id: string, action: "complete" | "snooze" | "skip") => {
    setDismissed((previous) => new Set(previous).add(id));
    if (action === "complete") {
      setLocalCompleted((count) => Math.max(count, progress?.priorityCompleted ?? 0) + 1);
    }
  }, [progress?.priorityCompleted]);
  const sourceRows = buildFocusActionRows(queue, {
    limit: Math.max(queue.length, fallbackEnquiries.length + fallbackDeals.length, 3),
    fallbackEnquiries, fallbackDeals,
  });
  const remainingRows = sourceRows.filter((row) => !dismissed.has(row.id));
  const topRows = remainingRows.slice(0, 3);
  const selected = topRows.find((row) => row.id === selectedId) ?? topRows[0];
  const completed = Math.max(progress?.priorityCompleted ?? 0, localCompleted);
  const total = Math.max(progress?.priorityTotal ?? sourceRows.length, completed);
  const percent = total > 0 ? Math.min(100, completed / total * 100) : 0;
  const waiting = remainingRows.filter((row) => row.recommendation?.reasonCode === "CUSTOMER_WAITING" || row.recommendation?.actionType === "RESPOND_TO_CUSTOMER").length;
  const quotes = remainingRows.filter((row) => row.recommendation?.actionType === "FOLLOW_UP_QUOTE").length;
  const scheduled = remainingRows.filter((row) => ["COMPLETE_FOLLOW_UP", "COMPLETE_SCHEDULED_CALL", "COMPLETE_APPOINTMENT"].includes(row.recommendation?.actionType ?? "")).length;

  if (!focus && !error && sourceRows.length === 0) return null;
  return (
    <section className={styles.workspace} data-course-target="dashboard-todays-focus" aria-label="What should I focus on today?">
      <header className={styles.header}>
        <div className={styles.headingGroup}>
          <span className={styles.targetIcon}><Crosshair size={32} strokeWidth={1.5} aria-hidden /></span>
          <div><h2>What should I focus on today?</h2><p>Your next best actions, based on conversations and deals.</p></div>
        </div>
        <Link href="/sales/command?view=focus" className={styles.outlineButton}>Ask SegmiQ <ArrowRight size={20} aria-hidden /></Link>
      </header>
      <div className={styles.summary}>
        <span><ListTodo size={25} aria-hidden />{remainingRows.length} {remainingRows.length === 1 ? "action" : "actions"}</span>
        <span><UserRound size={25} aria-hidden />{waiting} waiting for you</span>
        <span><FileText size={25} aria-hidden />{quotes} {quotes === 1 ? "quote" : "quotes"} to follow up</span>
        <span><CalendarDays size={25} aria-hidden />{scheduled} scheduled follow-ups</span>
      </div>
      {selected ? (
        <div className={styles.content}>
          <div className={styles.priorities}>
            <div className={styles.listHeading}><h3>Start here</h3><span>Top {topRows.length}</span></div>
            <ul className={styles.cards}>
              {topRows.map((row, index) => {
                const active = row.id === selected.id;
                const waitingForReply = row.recommendation?.reasonCode === "CUSTOMER_WAITING";
                const tone = waitingForReply || row.priority === "HIGH" ? "warning" : row.priority === "URGENT" ? "danger" : "neutral";
                return (
                  <li key={row.id} className={cn(styles.actionCard, active && styles.selected)}>
                    <span className={cn(styles.avatar, styles[`avatar${index}`])} aria-hidden>
                      {row.customerName.trim().split(/\s+/).slice(0, 2).map((part) => part[0]).join("").toUpperCase()}
                    </span>
                    <div className={styles.cardBody}>
                      <div className={styles.cardHeading}>
                        <div className={styles.identity}>
                          <button type="button" aria-pressed={active} onClick={() => setSelectedId(row.id)} className={styles.customer}>{row.customerName}</button>
                          {row.opportunityLabel || row.valueLabel ? <p>{[row.opportunityLabel, row.valueLabel].filter(Boolean).join(" · ")}</p> : null}
                        </div>
                        <span className={cn(styles.status, styles[tone])}>
                          {tone === "warning" ? <Clock3 size={18} aria-hidden /> : <AlertCircle size={18} aria-hidden />}
                          {statusLabel(row)}
                        </span>
                      </div>
                      <p className={styles.reason}>{row.reason}</p>
                      <div className={styles.cardFooter}>
                        <button type="button" onClick={() => setSelectedId(row.id)} className={styles.details} aria-label={`View details for ${row.customerName}`} aria-pressed={active}>View details <ArrowRight size={18} aria-hidden /></button>
                        {!active ? <button type="button" className={styles.outlineButton} onClick={() => setSelectedId(row.id)}>
                          {waitingForReply ? "Review reply" : row.primary.kind === "call" ? "Prepare call" : "Review action"}
                        </button> : null}
                      </div>
                    </div>
                    <ActionRowMenu row={row} onDismissed={onDismissed} />
                  </li>
                );
              })}
            </ul>
          </div>
          <SuggestedNextStep
            key={selected.id}
            row={selected}
            clientId={clientId}
            onAddProspect={onAddProspect}
            draft={drafts[selected.id] ?? suggestedMessage(selected)}
            onDraftChange={(message) => setDrafts((previous) => ({ ...previous, [selected.id]: message }))}
          />
        </div>
      ) : (
        <div className={styles.empty}>
          <CheckCircle2 size={30} aria-hidden />
          <h3>{error ? "Priorities couldn’t load" : "You’re caught up"}</h3>
          <p>{error ? "Open your tasks to keep working." : "No urgent sales actions need your attention right now."}</p>
          <Link className={styles.outlineButton} href={error ? "/sales/tasks" : "/sales/pipeline"}>{error ? "Open tasks" : "Review pipeline"}<ArrowRight size={18} aria-hidden /></Link>
        </div>
      )}
      <footer className={styles.progressFooter} data-course-target="dashboard-sales-plan">
        <h4>Today’s progress</h4>
        <div className={styles.progressTrack} role="progressbar" aria-label="Today's action progress" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(percent)} aria-valuetext={`${completed} of ${total} completed`}>
          <span style={{ width: `${percent}%` }} />
        </div>
        <span className={styles.progressCount}>{completed} of {total} completed</span>
        <Link className={styles.details} href="/sales/command?view=focus">View all {remainingRows.length} actions <ArrowRight size={18} aria-hidden /></Link>
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
      className="dashboard-panel dashboard-panel--analytics flex flex-col gap-3 overflow-hidden border-0 p-4 shadow-none sm:flex-row sm:items-center sm:justify-between sm:p-5"
    >
      <div className="min-w-0">
        <div className="flex items-start gap-2">
          {state === "complete" ? (
            <CheckCircle2
              size={18}
              className="mt-0.5 shrink-0 text-sales-success"
              aria-hidden
            />
          ) : null}
          <div>
            <p className="text-[14px] font-semibold text-sales-text-primary">{headline}</p>
            <p className="mt-1 text-[12px] text-sales-text-secondary">{supporting}</p>
          </div>
        </div>
      </div>
      {ctaLabel && ctaHref ? (
        <Link
          href={ctaHref}
          className="inline-flex min-h-11 shrink-0 items-center justify-center gap-1 rounded-sales-md bg-sales-text-primary px-4 text-[13px] font-semibold text-sales-bg transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sales-brand"
        >
          {ctaLabel}
        </Link>
      ) : null}
    </div>
  );
}
