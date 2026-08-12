"use client";

import type { DealReadinessResult } from "@/lib/sales/deals/readiness";
import { Check, Circle } from "lucide-react";

export function DealReadinessCard({
  readiness,
  onCreateDeal,
  onKeepQualifying,
  creating = false,
  compact = false,
}: {
  readiness: DealReadinessResult;
  onCreateDeal?: () => void;
  onKeepQualifying?: () => void;
  creating?: boolean;
  compact?: boolean;
}) {
  return (
    <section
      className={
        compact
          ? "rounded-[12px] border border-[#E4E7EC] bg-white p-3 dark:border-[#272C27] dark:bg-[#151815]"
          : "rounded-[14px] border border-[#E4E7EC] bg-white p-4 dark:border-[#272C27] dark:bg-[#151815]"
      }
      aria-label="Deal readiness"
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-[13px] font-semibold text-[#101828] dark:text-[#F7F8F5]">
            Deal readiness
          </h3>
          <p className="mt-0.5 text-[12px] text-[#667085] dark:text-[#B1B7AE]">
            {readiness.requiredDone} of {readiness.requiredTotal} required details ready
            {" · "}
            {readiness.statusLabel}
          </p>
        </div>
      </div>

      <ul className="mt-3 space-y-1.5">
        {readiness.items.map((item) => (
          <li key={item.id} className="flex items-start gap-2 text-[12px]">
            {item.done ? (
              <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#027A48]" aria-hidden />
            ) : (
              <Circle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#98A2B3]" aria-hidden />
            )}
            <span
              className={
                item.done
                  ? "text-[#344054] dark:text-[#B1B7AE]"
                  : "text-[#667085] dark:text-[#B1B7AE]"
              }
            >
              {item.label}
              {!item.required ? (
                <span className="text-[#98A2B3]"> (optional)</span>
              ) : null}
            </span>
          </li>
        ))}
      </ul>

      {readiness.ready ? (
        <div className="mt-4 rounded-[12px] border border-[rgba(212,255,79,0.45)] bg-[rgba(212,255,79,0.12)] p-3 dark:bg-[rgba(212,255,79,0.08)]">
          <p className="text-[13px] font-semibold text-[#101828] dark:text-[#F7F8F5]">
            This looks like a real opportunity
          </p>
          <p className="mt-1 text-[12px] text-[#667085] dark:text-[#B1B7AE]">
            You have confirmed the customer&apos;s requirement and next step.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            {onCreateDeal ? (
              <button
                type="button"
                disabled={creating}
                onClick={onCreateDeal}
                className="min-h-[44px] rounded-[10px] bg-[#101828] px-4 text-[13px] font-semibold text-white disabled:opacity-60 dark:bg-[#D4FF4F] dark:text-[#101828]"
              >
                {creating ? "Creating…" : "Create deal"}
              </button>
            ) : null}
            {onKeepQualifying ? (
              <button
                type="button"
                onClick={onKeepQualifying}
                className="min-h-[44px] rounded-[10px] border border-[#E4E7EC] bg-white px-4 text-[13px] font-medium text-[#344054] dark:border-[#272C27] dark:bg-transparent dark:text-[#B1B7AE]"
              >
                Keep qualifying
              </button>
            ) : null}
          </div>
        </div>
      ) : null}
    </section>
  );
}
