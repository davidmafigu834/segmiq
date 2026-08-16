"use client";

import { Check } from "lucide-react";
import { PremiumSheet } from "@/components/sales/PremiumSheet";
import { Badge, Button } from "@/components/sales/ui";
import { formatBillingMoney } from "@/lib/billing/format";
import {
  CRM_PLAN_DESCRIPTIONS,
  CRM_PLAN_FEATURES,
  CRM_PLAN_LABELS,
  getPlanAmount,
  type CrmPlan,
} from "@/lib/billing/plans";
import type { CompanyBillingSubscription } from "@/lib/billing/company-billing-types";
import { cn } from "@/lib/ui/cn";

const PLANS: CrmPlan[] = ["starter", "growth", "scale"];

export function ManageSubscriptionModal({
  subscription,
  onClose,
}: {
  subscription: CompanyBillingSubscription | null;
  onClose: () => void;
}) {
  const current = subscription?.planKey ?? null;
  const cycle = subscription?.billingCycle === "annual" ? "annual" : "monthly";

  return (
    <PremiumSheet
      title="Manage subscription"
      description="Plan changes are processed by your SegmiQ account team. Prices below are catalogue defaults — your current amount is what you are billed."
      onClose={onClose}
      footer={
        <div className="flex flex-wrap justify-end gap-2">
          <Button variant="secondary" size="md" onClick={onClose}>
            Close
          </Button>
          <Button variant="primary" size="md" onClick={() => { window.location.href = "/client/settings/company"; }}>
            Contact support
          </Button>
        </div>
      }
      maxWidthClass="max-w-[580px]"
    >
      {subscription ? (
        <p className="mb-4 text-[13px] text-sales-text-secondary">
          Current plan: <span className="font-medium text-sales-text-primary">{subscription.planLabel}</span>
          {" · "}
          {formatBillingMoney(subscription.amount, subscription.currency)}
        </p>
      ) : null}
      <div className="space-y-2.5">
        {PLANS.map((plan) => {
          const selected = plan === current;
          const amount = getPlanAmount(plan, cycle);
          return (
            <div
              key={plan}
              className={cn(
                "rounded-[12px] border px-4 py-3",
                selected ? "border-sales-brand-border bg-sales-brand-soft-solid" : "border-sales-border bg-sales-surface"
              )}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-[14px] font-semibold text-sales-text-primary">{CRM_PLAN_LABELS[plan]}</p>
                    {selected ? <Badge tone="brand">Current plan</Badge> : null}
                  </div>
                  <p className="mt-1 text-[12px] text-sales-text-secondary">{CRM_PLAN_DESCRIPTIONS[plan]}</p>
                  <ul className="mt-2 space-y-1">
                    {CRM_PLAN_FEATURES[plan].slice(0, 3).map((f) => (
                      <li key={f} className="flex items-center gap-1.5 text-[12px] text-sales-text-secondary">
                        <Check size={12} className="text-sales-success" aria-hidden />
                        {f}
                      </li>
                    ))}
                  </ul>
                </div>
                <p className="shrink-0 text-right text-[14px] font-semibold tabular-nums text-sales-text-primary">
                  {formatBillingMoney(amount, subscription?.currency ?? "USD")}
                  <span className="block text-[11px] font-medium text-sales-text-muted">
                    / {cycle === "annual" ? "year" : "month"}
                  </span>
                </p>
              </div>
            </div>
          );
        })}
      </div>
      <p className="mt-4 text-[12px] leading-relaxed text-sales-text-muted">
        Company managers cannot change plans from this page. Your agency issues invoices and applies upgrades,
        downgrades, and cancellations on the subscription record.
      </p>
    </PremiumSheet>
  );
}
