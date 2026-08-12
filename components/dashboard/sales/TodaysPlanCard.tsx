"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ChevronRight } from "lucide-react";
import { Card, CardContent, Progress, Skeleton } from "@/components/sales/ui";
import type { DailySalesPlanPayload } from "@/lib/sales/intelligence/types";

export function TodaysPlanCard() {
  const [plan, setPlan] = useState<DailySalesPlanPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const res = await fetch("/api/sales/daily-plan");
        if (!res.ok) throw new Error("fail");
        const json = (await res.json()) as DailySalesPlanPayload;
        if (!cancelled) setPlan(json);
      } catch {
        if (!cancelled) setError(true);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (loading) {
    return <Skeleton className="h-[140px] rounded-sales-xl" />;
  }

  if (error || !plan) return null;

  const remainingPriority = Math.max(
    0,
    plan.progress.priorityTotal - plan.progress.priorityCompleted
  );
  const prospectCommitment = plan.progress.commitments.find((c) => c.kind === "NEW_PROSPECTS");
  const totalActions =
    plan.progress.priorityTotal +
    plan.progress.commitments.reduce((s, c) => s + c.target, 0);
  const completedActions =
    plan.progress.priorityCompleted +
    plan.progress.commitments.reduce((s, c) => s + Math.min(c.completed, c.target), 0);
  const pct = totalActions > 0 ? Math.min(100, Math.round((completedActions / totalActions) * 100)) : 0;

  return (
    <Card>
      <CardContent className="space-y-3 p-4 sm:p-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.06em] text-sales-text-muted">
              Today&apos;s plan
            </p>
            <p className="mt-1 text-[15px] font-semibold text-sales-text-primary">
              {plan.focus.title}
            </p>
          </div>
          <Link
            href="/sales/tasks"
            className="inline-flex items-center gap-0.5 text-[12px] font-semibold text-sales-brand-fg hover:underline"
          >
            Continue <ChevronRight size={14} aria-hidden />
          </Link>
        </div>

        {totalActions > 0 ? (
          <>
            <p className="text-[13px] text-sales-text-secondary">
              {completedActions} / {totalActions} actions completed
            </p>
            <Progress value={pct} />
          </>
        ) : (
          <p className="text-[13px] text-sales-text-secondary">{plan.focus.body}</p>
        )}

        <ul className="space-y-1 text-[12px] text-sales-text-secondary">
          {remainingPriority > 0 ? (
            <li>{remainingPriority} priority action{remainingPriority === 1 ? "" : "s"} remaining</li>
          ) : (
            <li>Priority deal queue clear</li>
          )}
          {prospectCommitment ? (
            <li>
              {Math.max(0, prospectCommitment.target - prospectCommitment.completed)} prospecting
              contact{prospectCommitment.target - prospectCommitment.completed === 1 ? "" : "s"}{" "}
              remaining
            </li>
          ) : null}
        </ul>
      </CardContent>
    </Card>
  );
}
