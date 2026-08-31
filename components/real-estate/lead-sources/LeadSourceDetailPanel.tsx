"use client";

import type { HTMLAttributes, ReactNode } from "react";
import { ArrowUpRight, Megaphone, X } from "lucide-react";
import { cn } from "@/lib/ui/cn";
import { Button, IconButton } from "@/components/sales/ui";
import { formatConversionPct } from "@/lib/real-estate/marketing";
import type { LeadSourceRow } from "@/lib/real-estate/lead-sources";

function Section({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("border-t border-sales-border-subtle px-4 py-3.5 sm:px-5", className)} {...props} />;
}

function Value({ label, value, strong }: { label: string; value: ReactNode; strong?: boolean }) {
  return (
    <div className="min-w-0">
      <p className="text-[11px] text-sales-text-muted">{label}</p>
      <div className={cn("mt-1 break-words text-[12px] text-sales-text-primary", strong && "font-semibold tabular-nums")}>
        {value}
      </div>
    </div>
  );
}

export function LeadSourceDetailPanel({
  row,
  rangeLabel,
  onClose,
  onViewInquiries,
  onOpenMarketing,
  overlay,
  stacked,
}: {
  row: LeadSourceRow | null;
  rangeLabel: string;
  onClose: () => void;
  onViewInquiries: () => void;
  onOpenMarketing: () => void;
  overlay?: boolean;
  stacked?: boolean;
}) {
  if (!row) return null;

  const steps = [
    { label: "Inquiries", value: row.inquiries },
    { label: "Qualified", value: row.qualified },
    { label: "Viewings", value: row.viewings },
    { label: "Offers", value: row.offers },
    { label: "Accepted", value: row.accepted },
  ];
  const max = Math.max(...steps.map((step) => step.value), 1);

  const body = (
    <aside
      className={cn(
        "flex h-full min-h-[660px] flex-col overflow-hidden workspace-card rounded-[14px] border border-sales-border bg-sales-surface shadow-sales-card",
        overlay &&
          "fixed inset-y-0 right-0 z-[70] w-full max-w-[410px] rounded-none border-y-0 border-r-0 sm:rounded-l-[14px] sm:border-y sm:border-r",
        stacked && overlay && "inset-0 max-w-none rounded-none"
      )}
    >
      <div className="flex items-start justify-between gap-3 px-4 py-4 sm:px-5">
        <div className="min-w-0">
          <h2 className="truncate text-[17px] font-semibold tracking-[-0.02em] text-sales-text-primary">
            {row.label}
          </h2>
          <p className="mt-0.5 text-[12px] text-sales-text-muted">{rangeLabel}</p>
        </div>
        <IconButton aria-label="Close source details" onClick={onClose}>
          <X size={16} />
        </IconButton>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto">
        <Section className="border-t-0">
          <h3 className="mb-3 text-[12px] font-semibold text-sales-text-primary">Acquisition funnel</h3>
          <ol className="space-y-2.5">
            {steps.map((step) => (
              <li key={step.label}>
                <div className="mb-1 flex items-center justify-between gap-2 text-[12px]">
                  <span className="text-sales-text-secondary">{step.label}</span>
                  <span className="tabular-nums font-medium text-sales-text-primary">{step.value}</span>
                </div>
                <div className="h-1.5 overflow-hidden rounded-full bg-sales-neutral-100">
                  <div
                    className="h-full rounded-full bg-sales-brand"
                    style={{ width: `${Math.max(6, Math.round((step.value / max) * 100))}%` }}
                  />
                </div>
              </li>
            ))}
          </ol>
        </Section>
        <Section>
          <h3 className="mb-3 text-[12px] font-semibold text-sales-text-primary">Outcomes</h3>
          <div className="grid grid-cols-2 gap-x-4 gap-y-3">
            <Value label="Inquiries" value={row.inquiries} strong />
            <Value label="Qualified" value={row.qualified} strong />
            <Value label="Viewings" value={row.viewings} strong />
            <Value label="Offers" value={row.offers} strong />
            <Value label="Accepted offers" value={row.accepted} strong />
            <Value label="Conversion" value={formatConversionPct(row.conversion)} strong />
          </div>
        </Section>
      </div>

      <div className="flex gap-2 border-t border-sales-border-subtle p-4">
        <Button variant="secondary" size="md" className="flex-1" onClick={onOpenMarketing} leftIcon={<Megaphone size={15} />}>
          Marketing
        </Button>
        <Button variant="primary" size="md" className="flex-1" onClick={onViewInquiries} rightIcon={<ArrowUpRight size={15} />}>
          View inquiries
        </Button>
      </div>
    </aside>
  );

  return (
    <>
      {overlay ? (
        <button
          type="button"
          aria-label="Close source details"
          className="fixed inset-0 z-[60] bg-black/25 backdrop-blur-[1px]"
          onClick={onClose}
        />
      ) : null}
      {body}
    </>
  );
}
