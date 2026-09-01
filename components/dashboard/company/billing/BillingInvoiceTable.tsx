"use client";

import { ChevronLeft, ChevronRight, Download } from "lucide-react";
import {
  Badge,
  DataTableEl,
  DataTableHead,
  DataTableBody,
  DataTableRow,
  DataTableTh,
  DataTableTd,
  EmptyState,
  ErrorState,
  Tooltip,
} from "@/components/sales/ui";
import { formatBillingMoney, formatDate } from "@/lib/billing/format";
import { invoiceStatusLabel, invoiceStatusTone } from "@/lib/billing/status";
import { COMPANY_BILLING_INVOICE_PAGE_SIZE } from "@/lib/billing/company-billing-types";
import type { CompanyBillingInvoice } from "@/lib/billing/company-billing-types";
import type { BadgeTone } from "@/components/sales/ui";
import { cn } from "@/lib/ui/cn";

function statusTone(status: string): BadgeTone {
  const tone = invoiceStatusTone(status);
  if (tone === "success" || tone === "warning" || tone === "danger" || tone === "info") return tone;
  return "neutral";
}

export function BillingInvoiceTable({
  invoices,
  page,
  onPageChange,
  onOpen,
  onDownload,
  loadError,
  onRetry,
}: {
  invoices: CompanyBillingInvoice[];
  page: number;
  onPageChange: (page: number) => void;
  onOpen: (invoice: CompanyBillingInvoice) => void;
  onDownload: (invoice: CompanyBillingInvoice) => void;
  loadError?: boolean;
  onRetry?: () => void;
}) {
  const pageSize = COMPANY_BILLING_INVOICE_PAGE_SIZE;
  const total = invoices.length;
  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  const safePage = Math.min(page, pageCount);
  const slice = invoices.slice((safePage - 1) * pageSize, safePage * pageSize);
  const from = total === 0 ? 0 : (safePage - 1) * pageSize + 1;
  const to = Math.min(safePage * pageSize, total);
  const pages = Array.from({ length: Math.min(pageCount, 3) }, (_, i) => {
    if (pageCount <= 3) return i + 1;
    if (safePage <= 2) return i + 1;
    if (safePage >= pageCount - 1) return pageCount - 2 + i;
    return safePage - 1 + i;
  });

  return (
    <section
      id="billing-invoices"
      className="sd-card overflow-hidden"
      data-course-target="billing-invoices"
    >
      <header className="flex items-center gap-2 px-5 py-4">
        <h2 className="text-[15px] font-semibold text-sales-text-primary">Invoices</h2>
        <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-sales-neutral-100 px-1.5 text-[11px] font-medium text-sales-text-secondary">
          {total}
        </span>
      </header>

      {loadError ? (
        <ErrorState
          title="Unable to load invoices"
          description="We couldn't retrieve your billing invoices right now."
          onRetry={onRetry}
          size="compact"
          className="px-5 pb-8 pt-2"
        />
      ) : total === 0 ? (
        <EmptyState
          title="No invoices yet"
          description="Your billing invoices will appear here once generated."
          size="compact"
          className="px-5 pb-8 pt-2"
        />
      ) : (
        <>
          <div className="hidden overflow-x-auto md:block">
            <DataTableEl>
              <DataTableHead>
                <tr>
                  <DataTableTh>Invoice</DataTableTh>
                  <DataTableTh>Date</DataTableTh>
                  <DataTableTh>Status</DataTableTh>
                  <DataTableTh>Plan</DataTableTh>
                  <DataTableTh className="text-right">Amount</DataTableTh>
                  <DataTableTh>Payment Method</DataTableTh>
                  <DataTableTh className="w-12 text-right">Download</DataTableTh>
                </tr>
              </DataTableHead>
              <DataTableBody>
                {slice.map((invoice) => (
                  <DataTableRow
                    key={invoice.id}
                    className="!h-[52px] cursor-pointer"
                    onClick={() => onOpen(invoice)}
                  >
                    <DataTableTd className="font-medium tabular-nums">{invoice.invoiceNumber}</DataTableTd>
                    <DataTableTd className="text-sales-text-secondary">{formatDate(invoice.issuedAt)}</DataTableTd>
                    <DataTableTd>
                      <Badge tone={statusTone(invoice.status)} appearance="soft">
                        {invoiceStatusLabel(invoice.status)}
                      </Badge>
                    </DataTableTd>
                    <DataTableTd className="text-sales-text-secondary">{invoice.planLabel} Plan</DataTableTd>
                    <DataTableTd className="text-right tabular-nums">
                      {formatBillingMoney(invoice.amount, invoice.currency)}
                    </DataTableTd>
                    <DataTableTd className="text-sales-text-secondary">
                      {invoice.paymentMethodLabel ?? "—"}
                    </DataTableTd>
                    <DataTableTd className="text-right">
                      <Tooltip label="Download invoice">
                        <button
                          type="button"
                          aria-label={`Download invoice ${invoice.invoiceNumber}`}
                          className="inline-flex h-8 w-8 items-center justify-center rounded-[8px] text-sales-text-secondary hover:bg-sales-surface-hover hover:text-sales-text-primary disabled:opacity-35"
                          disabled={!invoice.pdfUrl}
                          onClick={(e) => {
                            e.stopPropagation();
                            onDownload(invoice);
                          }}
                        >
                          <Download size={15} strokeWidth={1.8} />
                        </button>
                      </Tooltip>
                    </DataTableTd>
                  </DataTableRow>
                ))}
              </DataTableBody>
            </DataTableEl>
          </div>

          <ul className="divide-y divide-sales-border-subtle md:hidden">
            {slice.map((invoice) => (
              <li key={invoice.id} className="px-5 py-3.5">
                <div className="flex flex-col gap-2">
                  <button type="button" className="flex w-full flex-col gap-2 text-left" onClick={() => onOpen(invoice)}>
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[13px] font-semibold tabular-nums text-sales-text-primary">
                        {invoice.invoiceNumber}
                      </span>
                      <Badge tone={statusTone(invoice.status)} appearance="soft">
                        {invoiceStatusLabel(invoice.status)}
                      </Badge>
                    </div>
                    <p className="text-[12px] text-sales-text-secondary">
                      {formatDate(invoice.issuedAt)} · {invoice.planLabel} Plan
                    </p>
                    <div className="flex items-center justify-between gap-2 text-[12px]">
                      <span className="font-medium tabular-nums text-sales-text-primary">
                        {formatBillingMoney(invoice.amount, invoice.currency)}
                      </span>
                      <span className="truncate text-sales-text-muted">{invoice.paymentMethodLabel ?? "—"}</span>
                    </div>
                  </button>
                  <div className="flex justify-end">
                    <button
                      type="button"
                      aria-label={`Download invoice ${invoice.invoiceNumber}`}
                      className="inline-flex h-11 min-w-11 items-center justify-center rounded-[8px] text-sales-text-secondary hover:bg-sales-surface-hover disabled:opacity-35"
                      disabled={!invoice.pdfUrl}
                      onClick={() => onDownload(invoice)}
                    >
                      <Download size={16} strokeWidth={1.8} />
                    </button>
                  </div>
                </div>
              </li>
            ))}
          </ul>

          <footer className="flex min-h-[52px] flex-col items-center justify-between gap-3 border-t border-sales-border-subtle px-4 py-2.5 sm:flex-row">
            <p className="text-[11px] text-sales-text-muted">
              Showing {from}–{to} of {total} invoices
            </p>
            <div className="flex items-center gap-1">
              <button
                type="button"
                aria-label="Previous page"
                disabled={safePage <= 1}
                className="inline-flex h-8 w-8 items-center justify-center rounded-[8px] text-sales-text-muted hover:bg-sales-surface-hover disabled:opacity-35"
                onClick={() => onPageChange(Math.max(1, safePage - 1))}
              >
                <ChevronLeft size={15} />
              </button>
              {pages.map((n) => (
                <button
                  type="button"
                  key={n}
                  className={cn(
                    "relative inline-flex h-8 min-w-8 items-center justify-center rounded-[8px] px-2 text-[11px] font-medium text-sales-text-secondary",
                    safePage === n &&
                      "bg-sales-surface-subtle font-semibold text-sales-text-primary after:absolute after:inset-x-1 after:bottom-0 after:h-0.5 after:rounded-full after:bg-sales-brand"
                  )}
                  onClick={() => onPageChange(n)}
                >
                  {n}
                </button>
              ))}
              <button
                type="button"
                aria-label="Next page"
                disabled={safePage >= pageCount}
                className="inline-flex h-8 w-8 items-center justify-center rounded-[8px] text-sales-text-muted hover:bg-sales-surface-hover disabled:opacity-35"
                onClick={() => onPageChange(Math.min(pageCount, safePage + 1))}
              >
                <ChevronRight size={15} />
              </button>
            </div>
          </footer>
        </>
      )}
    </section>
  );
}
