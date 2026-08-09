"use client";

import { useMemo, useState } from "react";
import { format } from "date-fns";
import { PremiumSheet } from "@/components/sales/PremiumSheet";
import { Button, FieldError, FieldLabel, Input, MenuSelect } from "@/components/sales/ui";
import { formatDealCurrency } from "@/lib/sales/format";
import {
  goalPeriodBounds,
  nextPeriodKey,
  parseGoalPeriodKey,
} from "@/lib/sales/goals/period";

export function SetGoalDialog({
  mode,
  goalId,
  initialPeriodKey,
  initialTarget,
  currency,
  onClose,
  onSuccess,
}: {
  mode: "create" | "edit";
  goalId?: string | null;
  initialPeriodKey: string;
  initialTarget?: number;
  currency: string;
  onClose: () => void;
  onSuccess: (opts: { periodKey: string; mode: "create" | "edit"; target: number }) => void;
}) {
  const [periodKey, setPeriodKey] = useState(parseGoalPeriodKey(initialPeriodKey));
  const [amount, setAmount] = useState(
    initialTarget != null && initialTarget > 0 ? String(Math.round(initialTarget)) : ""
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const periodOptions = useMemo(() => {
    const now = new Date();
    const thisKey = format(now, "yyyy-MM");
    const nextKey = nextPeriodKey(thisKey);
    const opts = [
      { value: thisKey, label: goalPeriodBounds(thisKey).label },
      { value: nextKey, label: `${goalPeriodBounds(nextKey).label} (upcoming)` },
    ];
    if (mode === "edit" && !opts.some((o) => o.value === periodKey)) {
      opts.unshift({ value: periodKey, label: goalPeriodBounds(periodKey).label });
    }
    return opts;
  }, [mode, periodKey]);

  const bounds = goalPeriodBounds(periodKey);
  const prefix = currency === "USD" || !currency ? "$" : `${currency} `;

  async function handleSave() {
    const targetValue = Number(String(amount).replace(/,/g, ""));
    if (!(targetValue > 0) || !Number.isFinite(targetValue)) {
      setError("Enter a target greater than zero.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      if (mode === "edit") {
        if (!goalId) {
          setError("Goal not found.");
          return;
        }
        const patch = await fetch(`/api/sales/goals/${goalId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ targetValue }),
        });
        const json = await patch.json().catch(() => ({}));
        if (!patch.ok) {
          setError((json as { error?: string }).error ?? "Couldn't save goal");
          return;
        }
      } else {
        const res = await fetch("/api/sales/goals", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ targetValue, periodKey, currency }),
        });
        const json = await res.json().catch(() => ({}));
        if (!res.ok) {
          setError((json as { error?: string }).error ?? "Couldn't save goal");
          return;
        }
      }
      onSuccess({ periodKey, mode, target: targetValue });
      onClose();
    } catch {
      setError("Couldn't save goal");
    } finally {
      setSaving(false);
    }
  }

  return (
    <PremiumSheet
      title={mode === "edit" ? "Edit sales goal" : "Set sales goal"}
      description="Choose the revenue target you want to achieve during this period."
      onClose={onClose}
      size="md"
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button variant="primary" onClick={() => void handleSave()} disabled={saving}>
            {saving ? "Saving…" : mode === "edit" ? "Save changes" : "Set goal"}
          </Button>
        </div>
      }
    >
      <div className="space-y-4">
        <div>
          <FieldLabel>Goal type</FieldLabel>
          <MenuSelect
            aria-label="Goal type"
            value="REVENUE_WON"
            onChange={() => undefined}
            options={[{ value: "REVENUE_WON", label: "Revenue won" }]}
            className="mt-1.5 w-full"
          />
        </div>

        <div>
          <FieldLabel>Period</FieldLabel>
          {mode === "edit" ? (
            <p className="mt-1.5 rounded-[10px] border border-sales-border bg-[#F9FAFB] px-3 py-2.5 text-[13px] font-medium text-sales-text-primary">
              {goalPeriodBounds(periodKey).label}
            </p>
          ) : (
            <MenuSelect
              aria-label="Goal period"
              value={periodKey}
              onChange={setPeriodKey}
              options={periodOptions}
              className="mt-1.5 w-full"
            />
          )}
          <p className="mt-1.5 text-[12px] text-sales-text-muted">
            {format(bounds.periodStart, "d MMM yyyy")} – {format(bounds.periodEnd, "d MMM yyyy")}
          </p>
        </div>

        <div>
          <FieldLabel htmlFor="goal-target">Target amount</FieldLabel>
          <div className="relative mt-1.5">
            <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[13px] font-medium text-sales-text-muted">
              {prefix.trim()}
            </span>
            <Input
              id="goal-target"
              inputMode="decimal"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="pl-8"
              placeholder="10000"
              aria-invalid={!!error}
            />
          </div>
          {amount && Number(String(amount).replace(/,/g, "")) > 0 ? (
            <p className="mt-1.5 text-[12px] text-sales-text-muted">
              {formatDealCurrency(Number(String(amount).replace(/,/g, "")), { currency })}
            </p>
          ) : null}
          {error ? <FieldError>{error}</FieldError> : null}
        </div>
      </div>
    </PremiumSheet>
  );
}
