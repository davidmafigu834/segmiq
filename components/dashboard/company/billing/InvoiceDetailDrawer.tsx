"use client";

import { useEffect, type ReactNode } from "react";
import { X } from "lucide-react";
import { Badge, Button, IconButton } from "@/components/sales/ui";
import { InvoicePaymentProof } from "./InvoicePaymentProof";
import { formatBillingMoney, formatDate } from "@/lib/billing/format";
import { invoiceStatusLabel, invoiceStatusTone } from "@/lib/billing/status";
import type { CompanyBillingInvoice } from "@/lib/billing/company-billing-types";
import type { BadgeTone } from "@/components/sales/ui";
import { cn } from "@/lib/ui/cn";

function statusTone(status: string): BadgeTone {
  const tone = invoiceStatusTone(status);
  if (tone === "success" || tone === "warning" || tone === "danger" || tone === "info") return tone;
  return "neutral";
}

export function InvoiceDetailDrawer({
  invoice,
  companyName,
  billingEmail,
  onClose,
  onDownload,
  onReceipt,
}: {
  invoice: CompanyBillingInvoice;
  companyName: string;
  billingEmail: string | null;
  onClose: () => void;
  onDownload: () => void;
  onReceipt: () => void;
}) {
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  return (
    <div className="fixed inset-0 z-[80] flex justify-end">
      <button type="button" className="absolute inset-0 bg-black/40" aria-label="Close invoice details" onClick={onClose} />
      <aside
        role="dialog"
        aria-modal
        aria-labelledby="invoice-detail-title"
        className="relative z-10 flex h-full w-full max-w-[460px] flex-col border-l border-sales-border bg-sales-surface shadow-sales-modal max-md:max-w-none"
      >
        <header className="flex shrink-0 items-start justify-between gap-3 border-b border-sales-border-subtle px-5 py-4">
          <div className="min-w-0">
            <h2 id="invoice-detail-title" className="text-[16px] font-semibold text-sales-text-primary">
              Invoice {invoice.invoiceNumber}
            </h2>
            <div className="mt-1.5">
              <Badge tone={statusTone(invoice.status)} appearance="soft">
                {invoiceStatusLabel(invoice.status)}
              </Badge>
            </div>
          </div>
          <IconButton aria-label="Close" size="sm" onClick={onClose}>
            <X size={16} />
          </IconButton>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
          <Section title="Invoice summary">
            <Grid
              rows={[
                ["Invoice date", formatDate(invoice.issuedAt)],
                ["Invoice number", invoice.invoiceNumber],
                ["Status", invoiceStatusLabel(invoice.status)],
                ["Amount", formatBillingMoney(invoice.amount, invoice.currency)],
              ]}
            />
          </Section>
          {invoice.periodStart || invoice.periodEnd ? (
            <Section title="Billing period">
              <Grid
                rows={[
                  ["Period start", formatDate(invoice.periodStart)],
                  ["Period end", formatDate(invoice.periodEnd)],
                ]}
              />
            </Section>
          ) : null}
          <Section title="Plan">
            <p className="text-[13px] text-sales-text-primary">{invoice.planLabel} Plan</p>
          </Section>
          <Section title="Amount">
            <Grid rows={[["Total", formatBillingMoney(invoice.amount, invoice.currency)]]} />
          </Section>
          <Section title="Payment">
            {invoice.status === "paid" ? (
              <Grid
                rows={[
                  ["Paid on", formatDate(invoice.paidAt)],
                  ["Method", invoice.paymentMethodLabel ?? "—"],
                ]}
              />
            ) : (
              <InvoicePaymentProof invoice={invoice} />
            )}
          </Section>
          <Section title="Billing information">
            <Grid
              rows={[
                ["Company", companyName || "—"],
                ["Billing email", billingEmail || "—"],
              ]}
            />
          </Section>
        </div>

        <footer className="flex shrink-0 flex-col gap-2 border-t border-sales-border-subtle px-5 py-4">
          <Button variant="primary" size="md" disabled={!invoice.pdfUrl} onClick={onDownload}>
            Download invoice
          </Button>
          {invoice.receiptPdfUrl ? (
            <Button variant="secondary" size="md" onClick={onReceipt}>
              Download receipt
            </Button>
          ) : null}
        </footer>
      </aside>
    </div>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="mb-5">
      <h3 className="mb-2 text-[11px] font-semibold uppercase tracking-[0.04em] text-sales-text-muted">{title}</h3>
      {children}
    </section>
  );
}

function Grid({ rows }: { rows: Array<[string, string]> }) {
  return (
    <dl className="grid grid-cols-2 gap-x-3 gap-y-2">
      {rows.map(([label, value]) => (
        <div key={label} className="min-w-0">
          <dt className="text-[11px] text-sales-text-muted">{label}</dt>
          <dd className={cn("mt-0.5 truncate text-[13px] text-sales-text-primary")}>{value}</dd>
        </div>
      ))}
    </dl>
  );
}
