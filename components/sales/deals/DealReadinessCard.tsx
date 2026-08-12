"use client";

import type { DealReadinessResult } from "@/lib/sales/deals/readiness";
import { Check, Circle } from "lucide-react";
import { Button, Card, CardContent } from "@/components/sales/ui";
import { cn } from "@/lib/ui/cn";

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
    <Card
      variant={compact ? "compact" : "standard"}
      aria-label="Deal readiness"
      data-course-target="deal-readiness"
      className={cn(compact ? "p-0" : undefined)}
    >
      <CardContent className={cn(compact ? "p-3" : "space-y-0 pt-4")}>
        <div className="flex items-start justify-between gap-3">
          <div>
            <h3 className="text-[13px] font-semibold text-sales-text-primary">
              Deal readiness
            </h3>
            <p className="mt-0.5 text-[12px] text-sales-text-secondary">
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
                <Check
                  className="mt-0.5 h-3.5 w-3.5 shrink-0 text-sales-success"
                  aria-hidden
                />
              ) : (
                <Circle
                  className="mt-0.5 h-3.5 w-3.5 shrink-0 text-sales-text-muted"
                  aria-hidden
                />
              )}
              <span
                className={
                  item.done ? "text-sales-text-primary" : "text-sales-text-secondary"
                }
              >
                {item.label}
                {!item.required ? (
                  <span className="text-sales-text-muted"> (optional)</span>
                ) : null}
              </span>
            </li>
          ))}
        </ul>

        {readiness.ready ? (
          <div className="mt-4 rounded-sales-lg border border-sales-brand-border bg-sales-brand-soft p-3">
            <p className="text-[13px] font-semibold text-sales-text-primary">
              This looks like a real opportunity
            </p>
            <p className="mt-1 text-[12px] text-sales-text-secondary">
              You have confirmed the customer&apos;s requirement and next step.
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              {onCreateDeal ? (
                <Button
                  variant="primary"
                  size="md"
                  disabled={creating}
                  onClick={onCreateDeal}
                >
                  {creating ? "Creating…" : "Create Deal"}
                </Button>
              ) : null}
              {onKeepQualifying ? (
                <Button variant="secondary" size="md" onClick={onKeepQualifying}>
                  Keep qualifying
                </Button>
              ) : null}
            </div>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
