"use client";

import { LeadIntentBadge } from "@/components/inbox/LeadIntentBadge";
import {
  facebookQualReasonsFromFormData,
  facebookQualScoreFromFormData,
  facebookQualTierFromFormData,
  type FbQualTier,
} from "@/lib/facebook/qualification";
import { scoreLabel } from "@/lib/inbox/scoring";

type Props = {
  formData: Record<string, unknown> | null | undefined;
  className?: string;
};

function tierLabel(tier: FbQualTier | null, score: number): "Hot" | "Warm" | "Cold" {
  if (tier === "hot") return "Hot";
  if (tier === "warm") return "Warm";
  if (tier === "cold") return "Cold";
  return scoreLabel(score);
}

function barColor(tier: FbQualTier | null, score: number): string {
  const label = tierLabel(tier, score);
  if (label === "Hot") return "var(--success)";
  if (label === "Warm") return "var(--warning)";
  return "var(--text-tertiary)";
}

/** Shows Instant Form hot/warm/cold score from client-configured answer rules. */
export function FacebookFormIntentSection({ formData, className = "" }: Props) {
  const score = facebookQualScoreFromFormData(formData);
  const tier = facebookQualTierFromFormData(formData);
  const reasons = facebookQualReasonsFromFormData(formData);

  if (score == null && !tier) return null;

  const displayScore = score ?? 0;
  const label = tierLabel(tier, displayScore);
  const colour = barColor(tier, displayScore);

  return (
    <div
      className={`rounded-xl border border-border bg-surface-card-alt px-4 py-3.5 ${className}`.trim()}
    >
      <div className="mb-2.5 flex flex-wrap items-center justify-between gap-2">
        <p className="text-[11px] font-semibold uppercase tracking-[0.06em] text-ink-tertiary">
          Form intent
        </p>
        <div className="flex flex-wrap items-center gap-1.5">
          <LeadIntentBadge score={displayScore} label={label} variant="default" showScore />
          {tier ? (
            <span className="inline-flex items-center rounded-full border border-[#1877F2]/35 bg-[#1877F2]/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-[#1877F2]">
              Form · {tier}
            </span>
          ) : null}
        </div>
      </div>

      <div className="mb-3 h-1 overflow-hidden rounded-full bg-[var(--bg-quaternary)]">
        <div
          className="h-1 rounded-full transition-[width] duration-700 ease-out"
          style={{ width: `${Math.max(displayScore, 2)}%`, background: colour }}
        />
      </div>

      {reasons.length > 0 ? (
        <ul className="space-y-1.5">
          {reasons.map((reason) => (
            <li
              key={reason}
              className="flex gap-2 text-[12px] leading-snug text-ink-secondary"
            >
              <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-[#1877F2]" aria-hidden />
              <span>{reason}</span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-[12px] text-ink-tertiary">
          Scored from Instant Form answers using your hot / warm / cold rules.
        </p>
      )}
    </div>
  );
}
