"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  Check,
  ChevronRight,
  CircleCheck,
  Phone,
  Target,
  Zap,
} from "lucide-react";
import { SiWhatsapp } from "react-icons/si";
import {
  Badge,
  Button,
  Card,
  CardContent,
  Progress,
  Skeleton,
} from "@/components/sales/ui";
import { openWhatsAppAndLog } from "@/lib/whatsapp-opener";
import { cn } from "@/lib/ui/cn";
import type {
  DailySalesPlanPayload,
  SalesActionRecommendation,
} from "@/lib/sales/intelligence/types";
import { FocusModeOverlay } from "./FocusModeOverlay";

async function postAction(
  rec: SalesActionRecommendation,
  action: "complete" | "snooze" | "skip" | "resolve",
  extra?: { skipReason?: string; snoozePreset?: "later_today" | "tomorrow_morning" }
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
      ...extra,
    }),
  });
  if (!res.ok) throw new Error("Failed");
}

function entityHref(rec: SalesActionRecommendation): string {
  const dealId =
    (typeof rec.metadata?.dealId === "string" && rec.metadata.dealId) ||
    (rec.sourceEntityType === "deal" ? rec.sourceEntityId : null);
  if (dealId) return `/sales/deals/${dealId}`;
  const id = rec.customer?.leadId ?? rec.sourceEntityId;
  if (!id) return "/sales/call-now";
  const source = String(rec.customer?.source ?? "");
  if (source.includes("WHATSAPP")) return `/sales/inbox?lead=${id}`;
  return `/sales/call-now?lead=${id}`;
}

function ProgressRow({
  label,
  completed,
  target,
}: {
  label: string;
  completed: number;
  target: number;
}) {
  const pct = target > 0 ? Math.min(100, Math.round((completed / target) * 100)) : 0;
  const done = completed >= target && target > 0;
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between gap-2 text-[12px]">
        <span className="font-medium text-sales-text-secondary">{label}</span>
        <span
          className={cn(
            "tabular-nums font-semibold",
            done ? "text-sales-success" : "text-sales-text-primary"
          )}
        >
          {completed} / {target}
          {done ? <Check className="ml-1 inline h-3.5 w-3.5" aria-hidden /> : null}
        </span>
      </div>
      <Progress
        value={pct}
        className="h-1.5"
        tone={done ? "success" : "brand"}
      />
      <span className="sr-only">
        {label}: {completed} of {target}
      </span>
    </div>
  );
}

function ActionButtons({
  rec,
  dense,
  onOpenFocus,
}: {
  rec: SalesActionRecommendation;
  dense?: boolean;
  onOpenFocus?: () => void;
}) {
  const phone = rec.customer?.phone;
  const size = dense ? "sm" : "md";
  return (
    <div className={cn("flex flex-wrap items-center gap-2", dense && "gap-1.5")}>
      {rec.availableActions.includes("call") && phone ? (
        <Button
          variant="primary"
          size={size}
          className={cn("min-h-11", dense && "min-h-9")}
          leftIcon={<Phone size={16} strokeWidth={1.8} />}
          onClick={() => {
            window.location.href = `tel:${phone}`;
          }}
        >
          Call
        </Button>
      ) : null}
      {rec.availableActions.includes("whatsapp") && phone ? (
        <Button
          variant="secondary"
          size={size}
          className={cn("min-h-11", dense && "min-h-9")}
          leftIcon={<SiWhatsapp size={16} color="#25D366" />}
          onClick={() => {
            const leadId = rec.customer?.leadId;
            if (!leadId || !phone) return;
            void openWhatsAppAndLog({
              leadId,
              clientId: "",
              leadName: rec.customer?.name ?? null,
              leadPhone: phone,
              repName: "",
            });
          }}
        >
          WhatsApp
        </Button>
      ) : null}
      {rec.availableActions.includes("add_prospect") ? (
        <Button
          variant="primary"
          size={size}
          className={cn("min-h-11", dense && "min-h-9")}
          onClick={onOpenFocus}
        >
          Add prospect
        </Button>
      ) : null}
      {rec.customer?.leadId || rec.sourceEntityId ? (
        <Link
          href={entityHref(rec)}
          className={cn(
            "inline-flex items-center justify-center rounded-sales-md px-3 text-[13px] font-medium text-sales-text-secondary hover:bg-sales-surface-hover hover:text-sales-text-primary",
            dense ? "h-9 min-h-9" : "h-11 min-h-11"
          )}
        >
          Open
        </Link>
      ) : null}
    </div>
  );
}

export function DailySalesIntelligencePanel({
  onRequestAddProspect,
}: {
  onRequestAddProspect?: () => void;
}) {
  const [plan, setPlan] = useState<DailySalesPlanPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [focusOpen, setFocusOpen] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(false);
    try {
      const res = await fetch("/api/sales/daily-plan");
      if (!res.ok) throw new Error("fail");
      const json = (await res.json()) as DailySalesPlanPayload;
      setPlan(json);
    } catch {
      setError(true);
      setPlan(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  if (loading && !plan) {
    return (
      <div className="space-y-3" aria-busy="true" aria-label="Loading sales priorities">
        <Skeleton className="h-28 w-full rounded-sales-xl" />
        <div className="grid gap-3 lg:grid-cols-[minmax(0,1.7fr)_minmax(0,1fr)]">
          <Skeleton className="h-48 rounded-sales-xl" />
          <Skeleton className="h-48 rounded-sales-xl" />
        </div>
      </div>
    );
  }

  if (error || !plan) {
    return (
      <Card>
        <CardContent className="flex flex-wrap items-center justify-between gap-3 py-4">
          <p className="text-[13px] text-sales-text-secondary">
            We couldn&apos;t load your sales priorities right now. Your existing tasks are still
            available below.
          </p>
          <Button variant="secondary" size="sm" onClick={() => void load()}>
            Retry
          </Button>
        </CardContent>
      </Card>
    );
  }

  const nba = plan.nextBestAction;
  const upNext = plan.queue.slice(1);
  const priorityTarget = Math.max(plan.progress.priorityTotal, 1);

  return (
    <div className="space-y-3">
      {/* Today's Focus */}
      <Card className="overflow-hidden border-sales-border">
        <CardContent className="flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <Target size={16} strokeWidth={1.8} className="text-sales-brand-fg" aria-hidden />
              <p className="text-[11px] font-semibold uppercase tracking-[0.06em] text-sales-text-muted">
                Today&apos;s focus
              </p>
            </div>
            <h2 className="mt-1.5 text-[20px] font-semibold tracking-[-0.02em] text-sales-text-primary sm:text-[22px]">
              {plan.focus.title}
            </h2>
            <p className="mt-1 max-w-xl text-[13px] leading-relaxed text-sales-text-secondary">
              {plan.focus.body}
            </p>
            {plan.progress.planComplete ? (
              <p className="mt-2 flex items-center gap-1.5 text-[13px] font-medium text-sales-success">
                <CircleCheck size={16} aria-hidden />
                Today&apos;s sales plan complete
              </p>
            ) : null}
          </div>
          <div className="flex shrink-0 flex-col items-stretch gap-2 sm:items-end">
            {plan.focus.priorityActionCount > 0 ? (
              <Badge tone="neutral" className="justify-center">
                {plan.focus.priorityActionCount} priority action
                {plan.focus.priorityActionCount === 1 ? "" : "s"}
              </Badge>
            ) : null}
            <Button
              variant="primary"
              size="md"
              className="min-h-11"
              leftIcon={<Zap size={16} strokeWidth={1.8} />}
              onClick={() => {
                if (plan.focus.mode === "BUILD" && onRequestAddProspect && !nba?.customer) {
                  onRequestAddProspect();
                  return;
                }
                setFocusOpen(true);
              }}
              disabled={!nba && plan.focus.mode !== "BUILD"}
            >
              Start focus mode
            </Button>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-3 lg:grid-cols-[minmax(0,1.7fr)_minmax(280px,1fr)]">
        {/* Next Best Action + Up Next */}
        <div className="min-w-0 space-y-3">
          {nba ? (
            <Card>
              <CardContent className="space-y-4 p-4 sm:p-5">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-[0.06em] text-sales-text-muted">
                      Next best action
                    </p>
                    <div className="mt-2 flex items-baseline gap-2">
                      <span className="text-[28px] font-semibold tabular-nums text-sales-text-primary">
                        1
                      </span>
                      <h3 className="text-[18px] font-semibold text-sales-text-primary">
                        {nba.title}
                      </h3>
                    </div>
                    {nba.subtitle ? (
                      <p className="mt-1 text-[13px] text-sales-text-secondary">{nba.subtitle}</p>
                    ) : null}
                    {nba.urgencyLabel ? (
                      <p className="mt-1 text-[12px] font-medium text-sales-text-muted">
                        {nba.urgencyLabel}
                      </p>
                    ) : null}
                  </div>
                  <Badge tone="neutral" appearance="outline">
                    Recommended by SegmiQ
                  </Badge>
                </div>

                <div className="rounded-[10px] border border-sales-border-subtle bg-[var(--sales-neutral-50)] px-3.5 py-3 dark:bg-[var(--sales-surface-raised)]">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.05em] text-sales-text-muted">
                    Recommended action
                  </p>
                  <p className="mt-1 text-[14px] font-semibold text-sales-text-primary">
                    {nba.recommendedActionLabel}
                  </p>
                  <p className="mt-2 text-[13px] leading-relaxed text-sales-text-secondary">
                    <span className="font-medium text-sales-text-primary">Why this is first. </span>
                    {nba.reason}
                  </p>
                </div>

                <ActionButtons
                  rec={nba}
                  onOpenFocus={() => {
                    if (onRequestAddProspect) onRequestAddProspect();
                    else setFocusOpen(true);
                  }}
                />
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardContent className="py-6 text-center">
                <p className="text-[14px] font-semibold text-sales-text-primary">
                  Your priority deal queue is clear
                </p>
                <p className="mt-1 text-[13px] text-sales-text-secondary">
                  {plan.goal.hasGoal
                    ? "Now build tomorrow’s opportunities."
                    : "Add prospects or capture new opportunities to keep building your pipeline."}
                </p>
                <div className="mt-4 flex justify-center">
                  <Button
                    variant="primary"
                    size="md"
                    className="min-h-11"
                    onClick={() => onRequestAddProspect?.()}
                  >
                    Add prospect
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {upNext.length > 0 ? (
            <Card>
              <CardContent className="p-0">
                <div className="border-b border-sales-border-subtle px-4 py-3 sm:px-5">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.06em] text-sales-text-muted">
                    Up next
                  </p>
                </div>
                <ul className="divide-y divide-sales-border-subtle">
                  {upNext.map((rec, idx) => (
                    <li
                      key={rec.idempotencyKey}
                      className="flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-5"
                    >
                      <div className="flex min-w-0 items-start gap-3">
                        <span className="w-5 shrink-0 text-[13px] font-semibold tabular-nums text-sales-text-muted">
                          {idx + 2}
                        </span>
                        <div className="min-w-0">
                          <p className="truncate text-[13px] font-semibold text-sales-text-primary">
                            {rec.title}
                          </p>
                          <p className="truncate text-[12px] text-sales-text-secondary">
                            {[rec.subtitle, rec.recommendedActionLabel].filter(Boolean).join(" · ")}
                          </p>
                          <p className="mt-0.5 truncate text-[12px] text-sales-text-muted">
                            {rec.urgencyLabel ?? rec.reason}
                          </p>
                        </div>
                      </div>
                      <ActionButtons rec={rec} dense />
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          ) : null}
        </div>

        {/* Today's Plan */}
        <Card className="h-fit">
          <CardContent className="space-y-4 p-4 sm:p-5">
            <div className="flex items-center justify-between gap-2">
              <p className="text-[11px] font-semibold uppercase tracking-[0.06em] text-sales-text-muted">
                Today&apos;s plan
              </p>
              <Link
                href="/sales/goals"
                className="inline-flex items-center gap-0.5 text-[12px] font-medium text-sales-brand-fg hover:underline"
              >
                Goals <ChevronRight size={14} aria-hidden />
              </Link>
            </div>

            <ProgressRow
              label="Priority deal actions"
              completed={plan.progress.priorityCompleted}
              target={priorityTarget}
            />

            {plan.progress.commitments.map((c) => (
              <ProgressRow
                key={c.kind}
                label={c.label}
                completed={c.completed}
                target={c.target}
              />
            ))}

            {!plan.settingsConfigured ? (
              <p className="text-[12px] leading-relaxed text-sales-text-muted">
                Daily activity targets are optional.{" "}
                <Link href="/sales/goals" className="font-medium text-sales-brand-fg hover:underline">
                  Configure on Goals
                </Link>{" "}
                when you want prospecting or call commitments.
              </p>
            ) : null}

            {plan.coverage.available || plan.coverage.coverageLabel ? (
              <div className="rounded-[10px] border border-sales-border-subtle px-3 py-2.5">
                <p className="text-[11px] font-semibold uppercase tracking-[0.05em] text-sales-text-muted">
                  Pipeline coverage
                </p>
                <p className="mt-1 text-[13px] font-semibold text-sales-text-primary">
                  {plan.coverage.coverageLabel}
                </p>
                <p className="mt-1 text-[12px] leading-snug text-sales-text-secondary">
                  {plan.coverage.interpretation}
                </p>
              </div>
            ) : null}
          </CardContent>
        </Card>
      </div>

      {focusOpen ? (
        <FocusModeOverlay
          plan={plan}
          onClose={() => {
            setFocusOpen(false);
            void load();
          }}
          onMutate={async (rec, action, extra) => {
            await postAction(rec, action, extra);
            await load();
          }}
          onAddProspect={() => {
            setFocusOpen(false);
            onRequestAddProspect?.();
          }}
        />
      ) : null}
    </div>
  );
}
