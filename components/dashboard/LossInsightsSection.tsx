"use client";

import { useEffect, useState } from "react";
import {
  DollarSign,
  Pause,
  XCircle,
  Filter,
  TrendingDown,
  type LucideIcon,
} from "lucide-react";
import { Card, CardBody } from "@/components/ui/Card";
import {
  FOLLOW_UP_HOLDUP_REASONS,
  LOST_REASONS,
  NOT_QUALIFIED_REASONS,
} from "@/lib/call-log-constants";
import { LOSS_MIN_REASONED_EVENTS } from "@/lib/loss-analysis-constants";

type LossAnalysis = {
  windowStart: string;
  windowEnd: string;
  totalCallLogsInWindow: number;
  totalReasonedEvents: number;
  stallReasons: Record<string, number>;
  lostReasons: Record<string, number>;
  notFitReasons: Record<string, number>;
  recoverablePile: {
    count: number;
    estimatedValue: number | null;
    leadIds: string[];
  };
  hasEnoughData: boolean;
};

function ReasonBars({
  title,
  reasons,
  counts,
  hint,
  Icon,
  iconColor,
}: {
  title: string;
  reasons: readonly string[];
  counts: Record<string, number>;
  hint?: string;
  Icon: LucideIcon;
  iconColor: string;
}) {
  const entries = reasons
    .map((r) => ({ label: r, count: counts[r] ?? 0 }))
    .filter((e) => e.count > 0);

  if (entries.length === 0) return null;

  const max = Math.max(...entries.map((e) => e.count), 1);

  return (
    <div className="mb-4 last:mb-0">
      <div className="mb-2 flex items-center gap-2">
        <Icon className="h-4 w-4 shrink-0" style={{ color: iconColor }} aria-hidden />
        <p className="m-0 text-[11px] font-semibold uppercase tracking-[0.06em] text-[var(--text-tertiary)]">
          {title}
        </p>
      </div>
      {hint ? (
        <p className="mb-2.5 text-[12px] text-[var(--text-tertiary)]">{hint}</p>
      ) : null}
      <div className="flex flex-col gap-2">
        {entries.map(({ label, count }) => (
          <div key={label}>
            <div className="mb-1 flex items-center justify-between gap-2">
              <span className="text-[12px] text-[var(--text-secondary)]">{label}</span>
              <span className="font-mono text-[11px] tabular-nums text-[var(--text-tertiary)]">
                {count}
              </span>
            </div>
            <div className="h-1.5 overflow-hidden rounded-full bg-[var(--bg-quaternary)]">
              <div
                className="h-full rounded-full bg-[var(--text-tertiary)]"
                style={{ width: `${Math.round((count / max) * 100)}%` }}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function LossInsightsSection({ clientId }: { clientId: string }) {
  const [analysis, setAnalysis] = useState<LossAnalysis | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    fetch(`/api/reports/client/loss?clientId=${clientId}&days=30`)
      .then((r) => r.json())
      .then((data: { analysis?: LossAnalysis }) => {
        if (data.analysis) setAnalysis(data.analysis);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [clientId]);

  if (loading) {
    return (
      <Card>
        <CardBody>
          <div className="h-[120px] animate-pulse rounded-xl bg-[var(--bg-quaternary)]" />
        </CardBody>
      </Card>
    );
  }

  if (!analysis) return null;

  const hasAnyReasons =
    analysis.totalReasonedEvents > 0 ||
    Object.values(analysis.stallReasons).some((n) => n > 0) ||
    Object.values(analysis.lostReasons).some((n) => n > 0) ||
    Object.values(analysis.notFitReasons).some((n) => n > 0);

  if (!analysis.hasEnoughData && !hasAnyReasons) {
    const totalCalls = analysis.totalCallLogsInWindow ?? 0;
    return (
      <Card>
        <CardBody>
          <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--text-tertiary)]">
            Loss analysis — last 30 days
          </p>
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <TrendingDown
              className="mb-3 h-7 w-7 text-[var(--text-disabled)]"
              aria-hidden
            />
            <p className="m-0 text-[13px] text-[var(--text-secondary)]">
              {totalCalls > 0
                ? `${totalCalls} calls logged — no stall, lost, or not-a-fit reasons yet`
                : "Not enough outcome data yet"}
            </p>
            <p className="mt-1.5 max-w-md text-[12px] text-[var(--text-tertiary)]">
              {totalCalls > 0 ? (
                <>
                  Call logs are saving, but this section needs outcomes with a reason:
                  reached → follow-up / lost / not qualified, or &quot;Call me back&quot; with a
                  schedule. No-answer logs don&apos;t appear here.
                </>
              ) : (
                <>
                  Keep logging calls with the two-step flow — stall, lost, and not-a-fit
                  reasons will appear here as patterns emerge.
                </>
              )}
            </p>
          </div>
        </CardBody>
      </Card>
    );
  }

  const pile = analysis.recoverablePile;
  const pileValueLabel =
    pile.estimatedValue != null && pile.estimatedValue > 0
      ? `$${pile.estimatedValue.toLocaleString()}`
      : null;

  const partial = !analysis.hasEnoughData;

  return (
    <Card>
      <CardBody>
        <p className="mb-4 text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--text-tertiary)]">
          Loss analysis —{" "}
          {partial
            ? `${analysis.totalReasonedEvents} of ${LOSS_MIN_REASONED_EVENTS} outcomes logged (30 days)`
            : `${analysis.totalReasonedEvents} outcomes logged (30 days)`}
        </p>

        {partial ? (
          <p className="mb-4 text-[12px] text-[var(--text-tertiary)]">
            Early signal from your team&apos;s call logs — keep logging stall, lost, and
            not-a-fit reasons for fuller patterns.
          </p>
        ) : null}

        {partial ? null : (
        <div className="mb-5 rounded-xl border border-[rgba(96,165,250,0.2)] bg-[rgba(96,165,250,0.06)] px-4 py-4">
          <div className="flex items-start gap-3">
            <DollarSign
              className="mt-0.5 h-5 w-5 shrink-0 text-[#60a5fa]"
              aria-hidden
            />
            <div>
              <p className="m-0 text-[10px] font-semibold uppercase tracking-[0.06em] text-[var(--text-tertiary)]">
                Recoverable pipeline
              </p>
              <p className="mt-1 font-display text-[28px] leading-none text-[var(--text-primary)]">
                {pile.count} {pile.count === 1 ? "lead" : "leads"}
                {pileValueLabel ? (
                  <span className="ml-2 text-[18px] text-[#60a5fa]">
                    · {pileValueLabel} on the table
                  </span>
                ) : null}
              </p>
              <p className="mt-2 text-[12px] leading-relaxed text-[var(--text-secondary)]">
                Still in the pipeline with affordability or timing hold-ups — worth a
                follow-up when circumstances change.
              </p>
            </div>
          </div>
        </div>
        )}

        <ReasonBars
          title="Where deals pause"
          reasons={FOLLOW_UP_HOLDUP_REASONS}
          counts={analysis.stallReasons}
          Icon={Pause}
          iconColor="#f5a623"
        />

        <ReasonBars
          title="Where deals ended"
          reasons={LOST_REASONS}
          counts={analysis.lostReasons}
          Icon={XCircle}
          iconColor="var(--error)"
        />

        <ReasonBars
          title="Not a fit"
          reasons={NOT_QUALIFIED_REASONS}
          counts={analysis.notFitReasons}
          hint="Signals ad targeting — not a sales execution issue."
          Icon={Filter}
          iconColor="#a78bfa"
        />
      </CardBody>
    </Card>
  );
}
