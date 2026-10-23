import { UsageMeter } from "./UsageMeter";
import type { AiUsageOverview } from "@/lib/platform-ai-usage/types";

export function CompanyAiUsageCard({ usage }: { usage: AiUsageOverview }) {
  return (
    <section className="sd-card p-5" aria-labelledby="ai-usage-heading">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 id="ai-usage-heading" className="text-base font-semibold">
            Agentic AI usage
          </h2>
          <p className="mt-1 text-sm text-[var(--text-secondary)]">
            {usage.periodStart && usage.periodEnd
              ? `${new Date(usage.periodStart).toLocaleDateString()} – ${new Date(usage.periodEnd).toLocaleDateString()}`
              : "Usage tracking is not contracted for this account."}
          </p>
        </div>
        <span className="rounded-full border border-[var(--border)] px-2.5 py-1 text-xs text-[var(--text-secondary)]">
          {usage.status.replaceAll("_", " ")}
        </span>
      </div>
      {usage.conversations && usage.actions ? (
        <div className="mt-5 grid gap-5 sm:grid-cols-2">
          <UsageMeter
            label="Customer conversations"
            metric={usage.conversations}
          />
          <UsageMeter label="Internal AI actions" metric={usage.actions} />
        </div>
      ) : (
        <p className="mt-4 text-sm text-[var(--text-secondary)]">
          Existing service continues unchanged. Historical operational activity
          is not treated as billable usage.
        </p>
      )}
    </section>
  );
}
