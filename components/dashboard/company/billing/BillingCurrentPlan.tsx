"use client";

import { Check, ChevronDown, Crown } from "lucide-react";
import { Badge, Button } from "@/components/sales/ui";
import { formatBillingMoney, formatDate } from "@/lib/billing/format";
import { billedCadenceLabel, subscriptionStatusLabel, subscriptionStatusTone } from "@/lib/billing/status";
import type { CompanyBillingSubscription } from "@/lib/billing/company-billing-types";
import type { BadgeTone } from "@/components/sales/ui";

function statusTone(status: string): BadgeTone {
  const tone = subscriptionStatusTone(status);
  if (tone === "success" || tone === "warning" || tone === "danger" || tone === "info") return tone;
  return "neutral";
}

export function BillingCurrentPlan({
  subscription,
  loadError,
  onRetry,
  onManage,
}: {
  subscription: CompanyBillingSubscription | null;
  loadError?: boolean;
  onRetry?: () => void;
  onManage: () => void;
}) {
  if (loadError) {
    return (
      <section
        className="sd-card overflow-hidden p-5"
        data-course-target="billing-current-plan"
      >
        <p className="text-[15px] font-semibold text-sales-text-primary">Current Plan</p>
        <p className="mt-2 text-[13px] text-sales-text-secondary">
          We couldn&apos;t load your subscription details.
        </p>
        {onRetry ? (
          <Button variant="secondary" size="sm" className="mt-3" onClick={onRetry}>
            Retry
          </Button>
        ) : null}
      </section>
    );
  }

  if (!subscription) {
    return (
      <section
        className="sd-card overflow-hidden p-5"
        data-course-target="billing-current-plan"
      >
        <p className="text-[15px] font-semibold text-sales-text-primary">Current Plan</p>
        <p className="mt-2 text-[13px] text-sales-text-secondary">
          We couldn&apos;t find an active CRM subscription for this company.
        </p>
      </section>
    );
  }

  const statusLabel =
    subscription.status === "cancelled"
      ? "Cancelled"
      : subscriptionStatusLabel(subscription.status);
  const priceLabel =
    subscription.planKey == null && subscription.amount === 0
      ? "Custom"
      : formatBillingMoney(subscription.amount, subscription.currency);

  return (
    <section
      className="sd-card overflow-hidden px-5 py-4 sm:py-[18px]"
      data-course-target="billing-current-plan"
    >
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 flex-1">
          <div className="flex items-start gap-3.5">
            <span className="flex h-16 w-16 shrink-0 items-center justify-center rounded-[12px] bg-sales-brand-soft text-sales-brand-fg sm:h-[68px] sm:w-[68px]">
              <Crown size={28} strokeWidth={1.7} aria-hidden />
            </span>
            <div className="min-w-0 pt-0.5">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-[18px] font-semibold tracking-[-0.02em] text-sales-text-primary sm:text-[20px]">
                  {subscription.planLabel} Plan
                </h2>
                <Badge tone={statusTone(subscription.status)} appearance="soft">
                  {statusLabel}
                </Badge>
              </div>
              <p className="mt-1 text-[13px] leading-snug text-sales-text-secondary">
                {subscription.description}
              </p>
              {subscription.status === "cancelled" && subscription.cancelledAt ? (
                <p className="mt-1 text-[12px] text-sales-text-muted">
                  Cancelled on {formatDate(subscription.cancelledAt)}
                </p>
              ) : null}
              {subscription.status === "past_due" && subscription.graceEndsAt ? (
                <p className="mt-1 text-[12px] text-sales-warning-fg">
                  Access continues until {formatDate(subscription.graceEndsAt)} if payment stays unresolved.
                </p>
              ) : null}
            </div>
          </div>
          <ul className="mt-3.5 flex flex-wrap gap-x-4 gap-y-2">
            {subscription.features.slice(0, 4).map((feature) => (
              <li
                key={feature}
                className="inline-flex items-center gap-1.5 text-[12px] text-sales-text-secondary"
              >
                <Check size={14} strokeWidth={2} className="text-sales-success" aria-hidden />
                {feature}
              </li>
            ))}
          </ul>
        </div>
        <div className="flex shrink-0 flex-col items-start gap-3 sm:items-end">
          <div className="sm:text-right">
            <p className="text-[24px] font-semibold tabular-nums leading-none tracking-[-0.03em] text-sales-text-primary sm:text-[26px]">
              {priceLabel}
              {priceLabel !== "Custom" ? (
                <span className="ml-1 text-[13px] font-medium text-sales-text-muted">
                  / {subscription.billingCycle === "annual" ? "year" : "month"}
                </span>
              ) : null}
            </p>
            <p className="mt-1.5 text-[12px] text-sales-text-muted">
              {subscription.planKey == null && subscription.amount === 0
                ? "Billed by agreement"
                : billedCadenceLabel(subscription.billingCycle)}
            </p>
          </div>
          <Button
            variant="secondary"
            size="sm"
            rightIcon={<ChevronDown size={14} />}
            onClick={onManage}
            data-course-target="billing-manage-plan"
          >
            {subscription.planKey == null ? "Contact account team" : "Manage Plan"}
          </Button>
        </div>
      </div>
    </section>
  );
}
