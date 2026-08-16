"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  Building2,
  ChevronRight,
  Download,
  Headphones,
  Landmark,
  MoreVertical,
  Scale,
  Smartphone,
} from "lucide-react";
import { Badge, Button } from "@/components/sales/ui";
import { formatBillingMoney, formatDate } from "@/lib/billing/format";
import {
  billingCycleLabel,
  subscriptionStatusLabel,
  subscriptionStatusTone,
} from "@/lib/billing/status";
import type { CompanyBillingPageData } from "@/lib/billing/company-billing-types";
import type { BadgeTone } from "@/components/sales/ui";
import { cn } from "@/lib/ui/cn";

function statusTone(status: string): BadgeTone {
  const tone = subscriptionStatusTone(status);
  if (tone === "success" || tone === "warning" || tone === "danger" || tone === "info") return tone;
  return "neutral";
}

export function BillingRail({
  data,
  onUpdatePayment,
  onBillingInfo,
  onHistoryInvoices,
  onRetryPayment,
}: {
  data: CompanyBillingPageData;
  onUpdatePayment: () => void;
  onBillingInfo: () => void;
  onHistoryInvoices: () => void;
  onRetryPayment?: () => void;
}) {
  const sub = data.subscription;
  const cancelled = sub?.status === "cancelled";
  const nextLabel = cancelled ? "Access until" : "Next Billing Date";
  const nextValue = cancelled
    ? sub?.currentPeriodEnd
      ? formatDate(sub.currentPeriodEnd)
      : "Not applicable"
    : sub?.currentPeriodEnd
      ? formatDate(sub.currentPeriodEnd)
      : "Not applicable";
  const amount =
    !sub
      ? "—"
      : sub.planKey == null && sub.amount === 0
        ? "Custom"
        : formatBillingMoney(sub.amount, sub.currency);

  return (
    <>
      <section
        className="order-1 rounded-[12px] border border-sales-border bg-sales-surface px-5 py-4 md:order-2 layout:order-none"
        data-course-target="billing-summary"
      >
        <h2 className="text-[15px] font-semibold text-sales-text-primary">Billing Summary</h2>
        {data.errors.subscription ? (
          <div className="mt-3">
            <p className="text-[13px] text-sales-text-secondary">We couldn&apos;t load your subscription details.</p>
            {onRetryPayment ? (
              <Button variant="secondary" size="sm" className="mt-3" onClick={onRetryPayment}>
                Retry
              </Button>
            ) : null}
          </div>
        ) : (
          <>
            <dl className="mt-3 space-y-2">
              <SummaryRow label="Plan" value={sub ? `${sub.planLabel} Plan` : "—"} />
              <SummaryRow label="Billing Cycle" value={billingCycleLabel(sub?.billingCycle)} />
              <SummaryRow label={nextLabel} value={nextValue} />
              <SummaryRow label="Amount" value={amount} />
              <div className="flex items-center justify-between gap-3">
                <dt className="text-[12px] text-sales-text-secondary">Status</dt>
                <dd>
                  {sub ? (
                    <Badge tone={statusTone(sub.status)} appearance="soft">
                      {subscriptionStatusLabel(sub.status)}
                    </Badge>
                  ) : (
                    <span className="text-[13px] text-sales-text-muted">—</span>
                  )}
                </dd>
              </div>
            </dl>
            <Button variant="primary" size="md" className="mt-4 w-full" onClick={onUpdatePayment}>
              Update Payment Method
            </Button>
          </>
        )}
      </section>

      <section
        className="order-4 rounded-[12px] border border-sales-border bg-sales-surface px-5 py-4 layout:order-none"
        data-course-target="billing-payment-method"
      >
        <div className="flex items-start justify-between gap-2">
          <h2 className="text-[15px] font-semibold text-sales-text-primary">Payment Method</h2>
          {data.paymentMethod.kind !== "none" && !data.errors.paymentMethod ? (
            <PaymentMethodMenu onView={onUpdatePayment} />
          ) : null}
        </div>
        {data.errors.paymentMethod ? (
          <>
            <p className="mt-3 text-[13px] text-sales-text-secondary">
              We couldn&apos;t load the payment method.
            </p>
            {onRetryPayment ? (
              <Button variant="secondary" size="sm" className="mt-4 w-full" onClick={onRetryPayment}>
                Retry
              </Button>
            ) : null}
          </>
        ) : data.paymentMethod.kind === "none" ? (
          <>
            <p className="mt-3 text-[13px] text-sales-text-secondary">No payment method added.</p>
            <p className="mt-1 text-[12px] text-sales-text-muted">
              SegmiQ bills by invoice. Use the published bank transfer or mobile money details.
            </p>
            <Button variant="secondary" size="sm" className="mt-4 w-full" onClick={onUpdatePayment}>
              View payment instructions
            </Button>
          </>
        ) : (
          <>
            <div className="mt-3 flex items-center gap-3">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[10px] border border-sales-border bg-sales-surface-subtle text-sales-text-secondary">
                {data.paymentMethod.kind === "mobile_money" ? (
                  <Smartphone size={18} strokeWidth={1.7} aria-hidden />
                ) : (
                  <Landmark size={18} strokeWidth={1.7} aria-hidden />
                )}
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-[13px] font-medium text-sales-text-primary">
                  {data.paymentMethod.brandLabel}
                  {data.paymentMethod.masked ? ` ${data.paymentMethod.masked}` : ""}
                </p>
                <div className="mt-0.5 flex flex-wrap items-center gap-1.5">
                  <Badge tone="success" appearance="soft">
                    Primary
                  </Badge>
                  {data.paymentMethod.detail ? (
                    <span className="truncate text-[11px] text-sales-text-muted">{data.paymentMethod.detail}</span>
                  ) : null}
                </div>
              </div>
            </div>
            <Button variant="secondary" size="sm" className="mt-4 w-full" onClick={onUpdatePayment}>
              View payment instructions
            </Button>
          </>
        )}
      </section>

      <section
        className="order-6 rounded-[12px] border border-sales-border bg-sales-surface p-2.5 layout:order-none"
        data-course-target="billing-history"
      >
        <h2 className="px-2.5 pb-1 pt-2 text-[15px] font-semibold text-sales-text-primary">Billing History</h2>
        <nav className="mt-1">
          <HistoryRow icon={Download} label="View all invoices" onClick={onHistoryInvoices} />
          <HistoryRow icon={Building2} label="Update Billing Information" onClick={onBillingInfo} />
          <Link
            href="/legal/terms"
            target="_blank"
            rel="noreferrer"
            className="flex h-11 items-center gap-3 rounded-[8px] px-2.5 text-[13px] text-sales-text-primary hover:bg-sales-surface-hover"
          >
            <Scale size={16} className="shrink-0 text-sales-text-muted" aria-hidden />
            <span className="min-w-0 flex-1">View Subscription Terms</span>
            <ChevronRight size={15} className="text-sales-text-muted" aria-hidden />
          </Link>
        </nav>
      </section>

      <section className="order-7 rounded-[12px] border border-sales-border bg-sales-surface px-5 py-4 layout:order-none">
        <h2 className="text-[15px] font-semibold text-sales-text-primary">Need Help?</h2>
        <p className="mt-2 text-[13px] leading-relaxed text-sales-text-secondary">
          If you have any questions about billing or your subscription, our support team is here to help.
        </p>
        <Link
          href="/client/settings/company"
          className="mt-4 inline-flex h-8 w-full items-center justify-center gap-1.5 rounded-sales-sm border border-sales-border-strong bg-sales-surface text-[12px] font-semibold text-sales-text-primary shadow-sales-card hover:bg-sales-surface-hover"
        >
          <Headphones size={14} aria-hidden />
          Contact Support
        </Link>
      </section>
    </>
  );
}

function PaymentMethodMenu({ onView }: { onView: () => void }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onDoc(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        className="inline-flex h-8 w-8 items-center justify-center rounded-[8px] text-sales-text-muted hover:bg-sales-surface-hover hover:text-sales-text-primary"
        aria-label="Payment method actions"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        <MoreVertical size={16} />
      </button>
      {open ? (
        <div className="absolute right-0 z-20 mt-1 w-[220px] rounded-[10px] border border-sales-border bg-sales-surface p-1 shadow-sales-popover">
          <button
            type="button"
            className="flex h-9 w-full items-center rounded-[8px] px-2.5 text-left text-[13px] text-sales-text-primary hover:bg-sales-surface-hover"
            onClick={() => {
              setOpen(false);
              onView();
            }}
          >
            View payment instructions
          </button>
        </div>
      ) : null}
    </div>
  );
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <dt className="text-[12px] text-sales-text-secondary">{label}</dt>
      <dd className="truncate text-[13px] font-medium text-sales-text-primary">{value}</dd>
    </div>
  );
}

function HistoryRow({
  icon: Icon,
  label,
  onClick,
}: {
  icon: typeof Download;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex h-11 w-full items-center gap-3 rounded-[8px] px-2.5 text-left text-[13px] text-sales-text-primary hover:bg-sales-surface-hover"
      )}
    >
      <Icon size={16} className="shrink-0 text-sales-text-muted" aria-hidden />
      <span className="min-w-0 flex-1">{label}</span>
      <ChevronRight size={15} className="text-sales-text-muted" aria-hidden />
    </button>
  );
}
