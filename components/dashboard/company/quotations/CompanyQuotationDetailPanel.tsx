"use client";

import { useEffect, useRef, useState } from "react";
import {
  ArrowRight,
  Copy,
  ExternalLink,
  FilePenLine,
  FileText,
  MoreHorizontal,
  Send,
  X,
} from "lucide-react";
import { format, parseISO } from "date-fns";
import type { QuotationWithItems } from "@/components/sales/quotes/CreateQuoteDialog";
import { Avatar, Badge, Button, Skeleton } from "@/components/sales/ui";
import {
  formatQuoteAmount,
  formatQuoteStatus,
  formatQuoteValidity,
  getQuoteStatusTone,
} from "@/lib/sales/quotes";
import { companyQuotationSendLabel } from "@/lib/sales/company-quotations";
import { cn } from "@/lib/ui/cn";
import type { CompanyQuotationRow } from "./types";

function quoteNumber(row: CompanyQuotationRow): string {
  if (!row.quoteNumber?.trim()) return "Draft";
  if (row.revisionNumber > 1 && !/-R\d+$/i.test(row.quoteNumber)) {
    return `${row.quoteNumber}-R${row.revisionNumber}`;
  }
  return row.quoteNumber;
}

function fullDate(value: string | null | undefined, includeTime = false): string {
  if (!value) return "—";
  const date = parseISO(value);
  if (Number.isNaN(date.getTime())) return "—";
  return format(date, includeTime ? "MMM d, yyyy, h:mm a" : "MMM d, yyyy");
}

function MetaRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[88px_minmax(0,1fr)] items-start gap-3 text-[11px]">
      <dt className="text-sales-text-muted">{label}</dt>
      <dd className="min-w-0 text-right font-medium text-sales-text-primary">{children}</dd>
    </div>
  );
}

function DetailMenu({
  row,
  onEdit,
  onDuplicate,
  onRevise,
  onOpenDeal,
  onOpenCustomer,
}: {
  row: CompanyQuotationRow;
  onEdit: () => void;
  onDuplicate: () => void;
  onRevise: () => void;
  onOpenDeal: () => void;
  onOpenCustomer: () => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function close(event: MouseEvent) {
      if (ref.current && !ref.current.contains(event.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [open]);

  const canRevise = ["sent", "viewed", "rejected", "expired"].includes(row.effectiveStatus);
  const item = (label: string, handler: () => void, icon: React.ReactNode) => (
    <button
      type="button"
      role="menuitem"
      className="flex w-full items-center gap-2 px-3 py-2 text-left text-[12px] text-sales-text-primary hover:bg-sales-surface-hover"
      onClick={() => {
        setOpen(false);
        handler();
      }}
    >
      <span className="text-sales-text-muted [&_svg]:h-3.5 [&_svg]:w-3.5">{icon}</span>
      {label}
    </button>
  );

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        aria-label="More quotation actions"
        className="inline-flex h-9 w-9 items-center justify-center rounded-[8px] border border-sales-border bg-sales-surface text-sales-text-secondary hover:bg-sales-surface-hover"
        onClick={() => setOpen((value) => !value)}
      >
        <MoreHorizontal size={16} />
      </button>
      {open ? (
        <div className="absolute right-0 top-10 z-40 w-48 overflow-hidden rounded-[10px] border border-sales-border bg-sales-surface py-1 shadow-sales-popover">
          {row.effectiveStatus === "draft" ? item("Edit quotation", onEdit, <FilePenLine />) : null}
          {canRevise ? item("Create revision", onRevise, <FileText />) : null}
          {item("Duplicate", onDuplicate, <Copy />)}
          {row.dealId ? item("Open Deal", onOpenDeal, <ExternalLink />) : null}
          {row.contactId ? item("Open customer", onOpenCustomer, <ExternalLink />) : null}
        </div>
      ) : null}
    </div>
  );
}

export function CompanyQuotationDetailPanel({
  row,
  detail,
  loading,
  error,
  overlay,
  stacked,
  sending,
  onRetry,
  onClose,
  onViewPdf,
  onSend,
  onEdit,
  onDuplicate,
  onRevise,
  onOpenDeal,
  onOpenCustomer,
  onViewFull,
}: {
  row: CompanyQuotationRow | null;
  detail: QuotationWithItems | null;
  loading: boolean;
  error: boolean;
  overlay: boolean;
  stacked: boolean;
  sending: boolean;
  onRetry: () => void;
  onClose: () => void;
  onViewPdf: () => void;
  onSend: () => void;
  onEdit: () => void;
  onDuplicate: () => void;
  onRevise: () => void;
  onOpenDeal: () => void;
  onOpenCustomer: () => void;
  onViewFull: () => void;
}) {
  const [showAllItems, setShowAllItems] = useState(false);

  useEffect(() => setShowAllItems(false), [row?.id]);

  if (!row) return null;

  const items = detail?.items ?? [];
  const visibleItems = showAllItems ? items : items.slice(0, 5);
  const subtotal = Number(detail?.subtotal ?? row.amount) || 0;
  const taxRate = Number(detail?.tax_rate) || 0;
  const taxAmount = Number(detail?.tax_amount) || 0;
  const otherAmount = Number(detail?.other_amount) || 0;
  const total = Number(detail?.total ?? row.amount) || 0;
  const sendLabel = companyQuotationSendLabel(row.effectiveStatus);
  const validity = formatQuoteValidity(row.validUntil, { status: row.effectiveStatus });

  const body = (
    <aside
      className={cn(
        "z-40 flex min-h-0 flex-col overflow-hidden border border-sales-border bg-sales-surface shadow-sales-card",
        overlay
          ? stacked
            ? "fixed inset-x-0 bottom-0 max-h-[88dvh] rounded-t-[16px] border-b-0"
            : "fixed inset-y-0 right-0 w-[min(380px,92vw)] border-y-0 border-r-0 shadow-sales-modal"
          : "sticky top-0 max-h-[calc(100dvh-48px)] min-h-[600px] w-[352px] rounded-[14px]"
      )}
      aria-label={`Quotation ${quoteNumber(row)} details`}
      data-course-target="company-quotation-detail"
    >
      <header className="flex shrink-0 items-center justify-between gap-3 border-b border-sales-border-subtle px-4 py-3.5">
        <div className="flex min-w-0 items-center gap-2">
          <h2 className="truncate text-[14px] font-semibold text-sales-text-primary">
            Quotation {quoteNumber(row)}
          </h2>
          <Badge
            tone={getQuoteStatusTone(row.effectiveStatus)}
            appearance="soft"
            className="shrink-0 !text-[10px]"
          >
            {formatQuoteStatus(row.effectiveStatus)}
          </Badge>
        </div>
        <button
          type="button"
          aria-label="Close quotation details"
          className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-[8px] text-sales-text-muted hover:bg-sales-surface-hover hover:text-sales-text-primary"
          onClick={onClose}
        >
          <X size={17} strokeWidth={1.8} />
        </button>
      </header>

      <div className="flex shrink-0 items-center gap-2 border-b border-sales-border-subtle px-3 py-2.5">
        <Button
          variant="secondary"
          size="sm"
          className="min-w-0 flex-1"
          leftIcon={<FileText size={14} />}
          data-course-target="quotation-view-pdf"
          onClick={onViewPdf}
        >
          View PDF
        </Button>
        {sendLabel ? (
          <Button
            variant="secondary"
            size="sm"
            className="min-w-0 flex-1"
            loading={sending}
            leftIcon={<Send size={14} />}
            data-course-target="quotation-send"
            onClick={onSend}
          >
            {sendLabel}
          </Button>
        ) : null}
        <DetailMenu
          row={row}
          onEdit={onEdit}
          onDuplicate={onDuplicate}
          onRevise={onRevise}
          onOpenDeal={onOpenDeal}
          onOpenCustomer={onOpenCustomer}
        />
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
        {loading ? (
          <div className="space-y-3 p-4">
            <Skeleton className="h-16 rounded-[10px]" />
            <Skeleton className="h-44 rounded-[10px]" />
            <Skeleton className="h-32 rounded-[10px]" />
            <Skeleton className="h-36 rounded-[10px]" />
          </div>
        ) : error ? (
          <div className="flex min-h-[320px] flex-col items-center justify-center px-6 text-center">
            <p className="text-[13px] font-semibold text-sales-text-primary">
              We couldn&apos;t load this quotation.
            </p>
            <p className="mt-1 text-[12px] text-sales-text-muted">The table data is still available.</p>
            <Button variant="secondary" size="sm" className="mt-4" onClick={onRetry}>
              Retry
            </Button>
          </div>
        ) : (
          <>
            <section className="border-b border-sales-border-subtle p-4">
              <div className="flex items-center gap-3">
                <Avatar name={row.customerName} size="md" />
                <div className="min-w-0 flex-1">
                  <div className="flex min-w-0 items-center gap-2">
                    <p className="truncate text-[13px] font-semibold text-sales-text-primary">
                      {row.customerName}
                    </p>
                    <Badge tone="success" appearance="soft" className="shrink-0 !px-1.5 !py-0 !text-[9px]">
                      {row.contactId ? "Customer" : "Lead"}
                    </Badge>
                  </div>
                  <p className="mt-0.5 truncate text-[11px] text-sales-text-muted">
                    {row.customerPhone || row.customerEmail || "No contact details"}
                  </p>
                </div>
                {row.contactId ? (
                  <button
                    type="button"
                    aria-label="Open customer"
                    className="inline-flex h-8 w-8 items-center justify-center rounded-[8px] text-sales-text-muted hover:bg-sales-surface-hover"
                    onClick={onOpenCustomer}
                  >
                    <ExternalLink size={14} />
                  </button>
                ) : null}
              </div>
            </section>

            <section className="space-y-3 border-b border-sales-border-subtle p-4">
              <dl className="space-y-3">
                <MetaRow label="Deal">
                  {row.dealId ? (
                    <button type="button" className="truncate text-sales-info-fg hover:underline" onClick={onOpenDeal}>
                      {row.dealName || "Open Deal"} ↗
                    </button>
                  ) : (
                    "No Deal"
                  )}
                </MetaRow>
                <MetaRow label="Quote Date">{fullDate(row.quoteDate)}</MetaRow>
                <MetaRow label="Valid Until">
                  <span
                    className={cn(
                      validity.tone === "danger" && "text-sales-danger",
                      validity.tone === "warning" && "text-sales-warning-fg"
                    )}
                  >
                    {validity.primary}
                    {validity.secondary ? ` (${validity.secondary})` : ""}
                  </span>
                </MetaRow>
                <MetaRow label="Owner">
                  {row.owner ? (
                    <span className="inline-flex max-w-full items-center justify-end gap-1.5">
                      <Avatar name={row.owner.name} src={row.owner.avatarUrl} size="xs" />
                      <span className="truncate">{row.owner.name}</span>
                    </span>
                  ) : (
                    "Unassigned"
                  )}
                </MetaRow>
                <MetaRow label="Created">{fullDate(row.createdAt, true)}</MetaRow>
                <MetaRow label="Last Updated">{fullDate(row.updatedAt, true)}</MetaRow>
              </dl>
            </section>

            <section className="border-b border-sales-border-subtle p-3" data-course-target="quotation-amount-summary">
              <div className="rounded-[10px] border border-sales-border p-3">
                <h3 className="mb-2.5 text-[11px] font-semibold text-sales-text-primary">Amount Summary</h3>
                <dl className="space-y-2 text-[11px]">
                  <div className="flex items-center justify-between gap-3">
                    <dt className="text-sales-text-muted">Subtotal</dt>
                    <dd className="font-medium tabular-nums text-sales-text-primary">
                      {formatQuoteAmount(subtotal, row.currency)}
                    </dd>
                  </div>
                  {otherAmount !== 0 ? (
                    <div className="flex items-center justify-between gap-3">
                      <dt className="text-sales-text-muted">{otherAmount < 0 ? "Discount" : "Other"}</dt>
                      <dd
                        className={cn(
                          "font-medium tabular-nums",
                          otherAmount < 0 ? "text-sales-danger" : "text-sales-text-primary"
                        )}
                      >
                        {formatQuoteAmount(otherAmount, row.currency)}
                      </dd>
                    </div>
                  ) : null}
                  {taxRate !== 0 || taxAmount !== 0 ? (
                    <div className="flex items-center justify-between gap-3">
                      <dt className="text-sales-text-muted">Tax ({taxRate}%)</dt>
                      <dd className="font-medium tabular-nums text-sales-text-primary">
                        {formatQuoteAmount(taxAmount, row.currency)}
                      </dd>
                    </div>
                  ) : null}
                  <div className="mt-2 flex items-center justify-between gap-3 border-t border-sales-border-subtle pt-2.5">
                    <dt className="text-[13px] font-semibold text-sales-text-primary">Total</dt>
                    <dd className="text-[16px] font-semibold tabular-nums text-sales-text-primary">
                      {formatQuoteAmount(total, row.currency)}
                    </dd>
                  </div>
                </dl>
              </div>
            </section>

            <section className="p-3" data-course-target="quotation-items">
              <div className="rounded-[10px] border border-sales-border p-3">
                <h3 className="mb-2.5 text-[11px] font-semibold text-sales-text-primary">
                  Items ({items.length})
                </h3>
                {items.length > 0 ? (
                  <ul className="divide-y divide-sales-border-subtle">
                    {visibleItems.map((item) => (
                      <li key={item.id} className="grid grid-cols-[minmax(0,1fr)_auto_auto] items-start gap-2 py-2 first:pt-0 last:pb-0">
                        <div className="min-w-0">
                          <p className="truncate text-[11px] font-medium text-sales-text-secondary">
                            {item.item_name}
                          </p>
                          {item.description ? (
                            <p className="mt-0.5 line-clamp-1 text-[10px] text-sales-text-muted">
                              {item.description}
                            </p>
                          ) : null}
                        </div>
                        <span className="text-[10px] tabular-nums text-sales-text-muted">×{Number(item.quantity)}</span>
                        <span className="text-right text-[10px] font-medium tabular-nums text-sales-text-primary">
                          {formatQuoteAmount(Number(item.amount), row.currency)}
                        </span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="py-2 text-[11px] text-sales-text-muted">No line items yet.</p>
                )}
                {items.length > 5 ? (
                  <button
                    type="button"
                    className="mt-3 text-[11px] font-semibold text-sales-brand-fg hover:underline"
                    onClick={() => setShowAllItems((value) => !value)}
                  >
                    {showAllItems ? "Show fewer items" : `View all ${items.length} items`}
                  </button>
                ) : null}
              </div>
            </section>
          </>
        )}
      </div>

      <footer className="shrink-0 border-t border-sales-border-subtle p-3 pb-[max(12px,env(safe-area-inset-bottom))]">
        <Button
          variant="secondary"
          size="md"
          className="w-full"
          rightIcon={<ArrowRight size={15} />}
          onClick={onViewFull}
        >
          View Full Quotation
        </Button>
      </footer>
    </aside>
  );

  if (!overlay) return body;
  return (
    <>
      <button
        type="button"
        aria-label="Close quotation details"
        className="fixed inset-0 z-30 bg-black/35"
        onClick={onClose}
      />
      {body}
    </>
  );
}
