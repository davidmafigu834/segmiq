"use client";

import { useCallback, useState } from "react";
import Link from "next/link";
import {
  ArrowRight,
  CheckCircle2,
  Crosshair,
  MoreHorizontal,
  Phone,
} from "lucide-react";
import { SiWhatsapp } from "react-icons/si";
import { Badge } from "@/components/sales/ui";
import { Card, CardContent } from "@/components/sales/ui";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/sales/ui/DropdownMenu";
import { Progress } from "@/components/sales/ui";
import { openWhatsAppAndLog } from "@/lib/whatsapp-opener";
import { cn } from "@/lib/ui/cn";
import type {
  DailySalesPlanProgress,
  FocusModeResult,
  SalesActionRecommendation,
} from "@/lib/sales/intelligence/types";
import type {
  SalesDealAttentionItem,
  SalesEnquiryPriorityItem,
} from "@/components/dashboard/sales/types";
import {
  buildFocusActionRows,
  type FocusActionRow,
  type FocusPriorityTier,
} from "@/lib/sales/focus-todays-actions";

const DESKTOP_LIMIT = 5;
const MOBILE_LIMIT = 3;

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

function PriorityBadge({ tier }: { tier: FocusPriorityTier }) {
  const tone =
    tier === "URGENT"
      ? "bg-sales-danger-soft text-sales-danger-fg"
      : tier === "HIGH"
        ? "bg-sales-warning-soft text-sales-warning-fg"
        : "bg-sales-info-soft text-sales-info-fg";
  return (
    <span
      className={cn(
        "inline-flex rounded-sales-sm px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-[0.06em]",
        tone
      )}
    >
      {tier}
    </span>
  );
}

function SignalDot({ tier }: { tier: FocusPriorityTier }) {
  const color =
    tier === "URGENT"
      ? "bg-sales-danger"
      : tier === "HIGH"
        ? "bg-sales-warning"
        : "bg-sales-info";
  return <span className={cn("mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full", color)} aria-hidden />;
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
  onDismissed: (id: string) => void;
}) {
  const [busy, setBusy] = useState(false);
  const canMutate = Boolean(row.recommendation);

  const run = useCallback(
    async (action: "complete" | "snooze" | "skip") => {
      if (busy || !row.recommendation) return;
      setBusy(true);
      try {
        await postPlanAction(row.recommendation, action);
        onDismissed(row.id);
      } catch {
        /* keep row visible */
      } finally {
        setBusy(false);
      }
    },
    [busy, onDismissed, row.id, row.recommendation]
  );

  return (
    <DropdownMenu align="end">
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
    </DropdownMenu>
  );
}

function FocusActionRowView({
  row,
  clientId,
  onAddProspect,
  onDismissed,
  mobileHidden,
}: {
  row: FocusActionRow;
  clientId: string | null;
  onAddProspect?: () => void;
  onDismissed: (id: string) => void;
  mobileHidden?: boolean;
}) {
  return (
    <li
      className={cn(
        "group border-b border-sales-border-subtle last:border-b-0",
        mobileHidden && "hidden layout:block"
      )}
    >
      {/* Desktop / tablet layout */}
      <div className="hidden items-start gap-3 px-5 py-3.5 transition-colors group-hover:bg-sales-surface-hover/40 sm:px-6 md:flex">
        <div className="flex w-[72px] shrink-0 flex-col items-start gap-1.5 pt-0.5">
          <span className="text-[12px] font-semibold tabular-nums text-sales-text-muted">
            {row.rank}
          </span>
          <PriorityBadge tier={row.priority} />
        </div>

        <div className="min-w-0 flex-1">
          <Link href={row.href} className="block min-w-0 focus-visible:outline-none">
            <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
              <p className="truncate text-[14px] font-semibold tracking-[-0.01em] text-sales-text-primary group-hover:underline">
                {row.customerName}
              </p>
              {row.valueLabel ? (
                <span className="shrink-0 text-[13px] font-semibold tabular-nums text-sales-text-primary">
                  {row.valueLabel}
                </span>
              ) : null}
            </div>
            {row.opportunityLabel ? (
              <p className="mt-0.5 truncate text-[13px] text-sales-text-secondary">
                {row.opportunityLabel}
              </p>
            ) : null}
            <p className="mt-1.5 text-[13px] leading-snug text-sales-text-secondary">
              {row.reason}
            </p>
            <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1">
              {row.commercialState ? (
                <span className="text-[11px] font-medium text-sales-text-muted">
                  {row.commercialState}
                </span>
              ) : null}
              {row.signal ? (
                <span className="inline-flex items-center gap-1.5 text-[11px] font-medium text-sales-text-muted">
                  <SignalDot tier={row.priority} />
                  {row.signal}
                </span>
              ) : null}
            </div>
          </Link>
        </div>

        <div className="flex shrink-0 items-center gap-1.5 pt-0.5">
          <PrimaryCtaButton
            row={row}
            clientId={clientId}
            onAddProspect={onAddProspect}
            className="min-w-[132px]"
          />
          <ActionRowMenu row={row} onDismissed={onDismissed} />
        </div>
      </div>

      {/* Mobile stacked layout */}
      <div className="flex flex-col gap-3 px-4 py-3.5 transition-colors group-hover:bg-sales-surface-hover/40 md:hidden">
        <div className="flex items-start justify-between gap-3">
          <div className="flex min-w-0 items-start gap-2.5">
            <span className="pt-0.5 text-[12px] font-semibold tabular-nums text-sales-text-muted">
              {row.rank}
            </span>
            <div className="min-w-0">
              <div className="mb-1.5">
                <PriorityBadge tier={row.priority} />
              </div>
              <Link href={row.href} className="block min-w-0">
                <p className="truncate text-[14px] font-semibold text-sales-text-primary">
                  {row.customerName}
                </p>
                {row.opportunityLabel ? (
                  <p className="mt-0.5 truncate text-[13px] text-sales-text-secondary">
                    {row.opportunityLabel}
                  </p>
                ) : null}
              </Link>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-1">
            {row.valueLabel ? (
              <span className="text-[13px] font-semibold tabular-nums text-sales-text-primary">
                {row.valueLabel}
              </span>
            ) : null}
            <ActionRowMenu row={row} onDismissed={onDismissed} />
          </div>
        </div>

        <p className="text-[13px] leading-snug text-sales-text-secondary">{row.reason}</p>

        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          {row.commercialState ? (
            <span className="text-[11px] font-medium text-sales-text-muted">
              {row.commercialState}
            </span>
          ) : null}
          {row.signal ? (
            <span className="inline-flex items-center gap-1.5 text-[11px] font-medium text-sales-text-muted">
              <SignalDot tier={row.priority} />
              {row.signal}
            </span>
          ) : null}
        </div>

        <PrimaryCtaButton
          row={row}
          clientId={clientId}
          onAddProspect={onAddProspect}
          className="w-full"
        />
      </div>
    </li>
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

  const onDismissed = useCallback((id: string) => {
    setDismissed((prev) => {
      const next = new Set(prev);
      next.add(id);
      return next;
    });
  }, []);

  if (error && queue.length === 0 && fallbackEnquiries.length === 0 && fallbackDeals.length === 0) {
    return (
      <Card className="dashboard-panel dashboard-panel--attention overflow-hidden border-0 shadow-none">
        <CardContent className="px-5 py-5 sm:px-6">
          <p className="dashboard-focus-kicker">What should I focus on today?</p>
          <p className="mt-3 text-[15px] font-semibold text-sales-text-primary">
            Priorities couldn&apos;t load
          </p>
          <p className="mt-1.5 text-[13px] text-sales-text-secondary">
            Your CRM data is unchanged — open tasks to keep working.
          </p>
          <Link
            href="/sales/tasks"
            className="mt-4 inline-flex min-h-11 items-center gap-1.5 rounded-sales-md bg-sales-brand px-4 text-[13px] font-semibold text-sales-ink"
          >
            Open tasks <ArrowRight size={14} aria-hidden />
          </Link>
        </CardContent>
      </Card>
    );
  }

  if (!focus) return null;

  const visibleQueue = queue.filter((q) => {
    const key = q.idempotencyKey || q.id;
    return !dismissed.has(key);
  });
  const allRows = buildFocusActionRows(visibleQueue, {
    limit: DESKTOP_LIMIT,
    fallbackEnquiries: fallbackEnquiries.filter((e) => !dismissed.has(e.id)),
    fallbackDeals: fallbackDeals.filter((d) => !dismissed.has(d.id)),
  });
  const fallbackCount =
    fallbackEnquiries.filter((e) => !dismissed.has(e.id)).length +
    fallbackDeals.filter((d) => !dismissed.has(d.id)).length;
  const totalActions = visibleQueue.length > 0 ? visibleQueue.length : fallbackCount;
  const remaining =
    progress != null
      ? Math.max(0, progress.priorityTotal - progress.priorityCompleted)
      : Math.max(0, totalActions);
  const completed = progress?.priorityCompleted ?? 0;
  const priorityTotal = progress?.priorityTotal ?? totalActions;
  const progressPct =
    priorityTotal > 0 ? Math.min(100, Math.round((completed / priorityTotal) * 100)) : 0;
  const showProgress =
    progress != null && priorityTotal > 0 && !progress.planComplete;
  const caughtUp = allRows.length === 0;

  return (
    <Card
      data-course-target="dashboard-todays-focus"
      className="dashboard-panel dashboard-panel--attention dashboard-panel--focus overflow-hidden border-0 shadow-none"
    >
      <CardContent className="p-0">
        {/* Header */}
        <div className="border-b border-sales-border-subtle px-5 py-4 sm:px-6 sm:py-5">
          <div className="flex flex-col gap-4 layout:flex-row layout:items-start layout:justify-between">
            <div className="min-w-0 flex-1">
              <div className="flex items-start gap-3">
                <span className="dashboard-focus-icon mt-0.5 hidden sm:flex" aria-hidden>
                  <Crosshair size={16} strokeWidth={1.8} />
                </span>
                <div className="min-w-0">
                  <h2 className="dashboard-focus-title">What should I focus on today?</h2>
                  <p className="mt-2 max-w-2xl text-[13px] leading-relaxed text-sales-text-secondary sm:text-[14px]">
                    SegmiQ has analysed your enquiries, deals and activity to identify the actions
                    most likely to move revenue today.
                  </p>
                  <div className="mt-2.5 flex flex-wrap items-center gap-2">
                    <Badge tone="brand" appearance="soft" size="sm">
                      {focus.mode === "BUILD"
                        ? "Build pipeline"
                        : focus.mode === "CLOSE"
                          ? "Close opportunities"
                          : "Move deals"}
                    </Badge>
                  </div>
                </div>
              </div>
            </div>

            <Link
              href="/sales/command?view=focus"
              className="inline-flex min-h-10 shrink-0 items-center justify-center gap-1 self-start rounded-sales-md border border-sales-border px-3 text-[13px] font-semibold text-sales-text-secondary transition-colors hover:border-sales-border-strong hover:bg-sales-surface-hover hover:text-sales-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sales-brand"
            >
              Ask SegmiQ
              <ArrowRight size={14} aria-hidden />
            </Link>
          </div>
        </div>

        {/* Actions */}
        <div className="px-0 pb-1">
          <div className="flex items-center justify-between gap-3 px-5 py-3 sm:px-6">
            <div className="flex min-w-0 items-center gap-2">
              <p className="text-[12px] font-semibold uppercase tracking-[0.08em] text-sales-text-muted">
                Top actions for you
              </p>
              {totalActions > 0 ? (
                <span className="inline-flex rounded-sales-sm bg-sales-neutral-100 px-1.5 py-0.5 text-[11px] font-semibold tabular-nums text-sales-text-secondary">
                  {totalActions} action{totalActions === 1 ? "" : "s"}
                </span>
              ) : null}
            </div>
            <Link
              href="/sales/tasks"
              className="text-[12px] font-medium text-sales-text-secondary transition-colors hover:text-sales-text-primary"
            >
              View all →
            </Link>
          </div>

          {caughtUp ? (
            <div className="mx-5 mb-5 rounded-[10px] border border-sales-border-subtle bg-sales-surface-subtle/60 px-5 py-6 text-center sm:mx-6">
              <CheckCircle2
                size={22}
                className="mx-auto text-sales-success"
                strokeWidth={1.8}
                aria-hidden
              />
              <p className="mt-3 text-[15px] font-semibold text-sales-text-primary">
                You&apos;re caught up
              </p>
              <p className="mx-auto mt-1.5 max-w-md text-[13px] leading-relaxed text-sales-text-secondary">
                No urgent sales actions need your attention right now.
              </p>
              <div className="mt-4 flex flex-wrap items-center justify-center gap-3">
                <Link
                  href="/sales/pipeline"
                  className="inline-flex min-h-11 items-center gap-1.5 rounded-sales-md bg-sales-brand px-4 text-[13px] font-semibold text-sales-ink"
                >
                  Review pipeline <ArrowRight size={14} aria-hidden />
                </Link>
                <Link
                  href="/sales/leads"
                  className="inline-flex min-h-11 items-center text-[13px] font-semibold text-sales-text-secondary hover:text-sales-text-primary"
                >
                  Find opportunities →
                </Link>
              </div>
            </div>
          ) : (
            <ul>
              {allRows.map((row, index) => (
                <FocusActionRowView
                  key={row.id}
                  row={row}
                  clientId={clientId}
                  onAddProspect={onAddProspect}
                  onDismissed={onDismissed}
                  mobileHidden={index >= MOBILE_LIMIT}
                />
              ))}
            </ul>
          )}

          {!caughtUp && totalActions > MOBILE_LIMIT ? (
            <div className="border-t border-sales-border-subtle px-5 py-3 layout:hidden sm:px-6">
              <Link
                href="/sales/tasks"
                className="inline-flex min-h-11 w-full items-center justify-center gap-1.5 rounded-sales-md border border-sales-border text-[13px] font-semibold text-sales-text-primary transition-colors hover:bg-sales-surface-hover"
              >
                View all actions
                <ArrowRight size={14} aria-hidden />
              </Link>
            </div>
          ) : null}
        </div>

        {/* Folded plan progress (replaces separate TodaysSalesPlanStrip when data exists) */}
        {showProgress ? (
          <div
            data-course-target="dashboard-sales-plan"
            className="border-t border-sales-border-subtle px-5 py-4 sm:px-6"
          >
            <div className="flex items-center justify-between gap-3">
              <p className="text-[12px] font-semibold text-sales-text-primary">Today&apos;s progress</p>
              <p className="text-[12px] tabular-nums text-sales-text-muted">
                {completed} completed · {remaining} remaining
              </p>
            </div>
            <div className="mt-2.5">
              <Progress value={progressPct} className="h-1.5" tone="brand" />
            </div>
          </div>
        ) : progress?.planComplete ? (
          <div
            data-course-target="dashboard-sales-plan"
            className="flex items-center gap-2 border-t border-sales-border-subtle px-5 py-3.5 text-[13px] font-medium text-sales-success sm:px-6"
          >
            <CheckCircle2 size={16} aria-hidden />
            Today&apos;s sales plan is complete
          </div>
        ) : (
          <div data-course-target="dashboard-sales-plan" className="sr-only">
            Today&apos;s sales plan
          </div>
        )}
      </CardContent>
    </Card>
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
