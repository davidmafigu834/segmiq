"use client";

import { useEffect, useMemo, useState } from "react";
import {
  ArrowRight,
  Check,
  ExternalLink,
  FileText,
  X,
} from "lucide-react";
import { format, formatDistanceToNowStrict, parseISO } from "date-fns";
import { Badge, Button, Skeleton } from "@/components/sales/ui";
import { PremiumSheet } from "@/components/sales/PremiumSheet";
import {
  formatQuoteAmount,
  formatQuoteStatus,
  formatQuoteValidity,
  getQuoteStatusTone,
} from "@/lib/sales/quotes";
import { formatDealStage } from "@/lib/sales/deals/display";
import {
  companyQuotationApprovalLabel,
  companyQuotationEngagement,
  companyQuotationEngagementLabel,
  companyQuotationIsPendingApproval,
  companyQuotationNextAction,
} from "@/lib/sales/company-quotations";
import { marginHealthLabel } from "@/lib/quotations/governance";
import { cn } from "@/lib/ui/cn";
import type { QuotationWorkspacePayload } from "@/lib/quotations/workspace-data";
import type { VersionDiffRow } from "@/lib/quotations/compare-versions";
import type { CompanyQuotationPermissions, CompanyQuotationRow } from "./types";

const MEANINGFUL_EVENTS = new Set([
  "CREATED",
  "PRICE_OVERRIDE",
  "MATERIAL_CHANGE",
  "APPROVAL_REQUESTED",
  "RESUBMITTED",
  "APPROVED",
  "CHANGES_REQUESTED",
  "REJECTED",
  "SENT",
  "VIEWED",
  "CUSTOMER_REQUESTED_CHANGES",
  "CUSTOMER_SELECTED_OPTION",
  "CUSTOMER_RESPONDED",
  "ACCEPTED",
  "DECLINED",
  "REVISION_CREATED",
]);

function quoteNumber(row: CompanyQuotationRow): string {
  return row.quoteNumber?.trim() || "Draft";
}

function fullDate(value: string | null | undefined, includeTime = false): string {
  if (!value) return "—";
  const date = parseISO(value);
  if (Number.isNaN(date.getTime())) return "—";
  return format(date, includeTime ? "MMM d, yyyy, h:mm a" : "MMM d, yyyy");
}

function relativeTime(value: string | null | undefined): string {
  if (!value) return "—";
  const date = parseISO(value);
  if (Number.isNaN(date.getTime())) return "—";
  return formatDistanceToNowStrict(date, { addSuffix: true });
}

function eventLabel(type: string): string {
  return type.replace(/_/g, " ").toLowerCase().replace(/\b\w/g, (char) => char.toUpperCase());
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="border-b border-sales-border-subtle px-4 py-3.5">
      <h3 className="mb-2.5 text-[10px] font-semibold uppercase tracking-[0.06em] text-sales-text-muted">
        {title}
      </h3>
      {children}
    </section>
  );
}

function Meta({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-3 text-[12px]">
      <dt className="text-sales-text-muted">{label}</dt>
      <dd className="min-w-0 text-right font-medium tabular-nums text-sales-text-primary">{children}</dd>
    </div>
  );
}

function approvalTone(status: string | null | undefined) {
  const value = (status || "not_required").replace(/-/g, "_");
  if (value === "pending" || value === "required" || value === "changes_requested") return "warning" as const;
  if (value === "approved") return "brand" as const;
  if (value === "rejected") return "danger" as const;
  return "neutral" as const;
}

export function CompanyQuotationDetailPanel({
  row,
  workspace,
  loading,
  error,
  overlay,
  stacked,
  permissions,
  onRetry,
  onClose,
  onViewPdf,
  onOpenDeal,
  onOpenCustomer,
  onOpenWorkspace,
  onDecided,
}: {
  row: CompanyQuotationRow | null;
  workspace: QuotationWorkspacePayload | null;
  loading: boolean;
  error: boolean;
  overlay: boolean;
  stacked: boolean;
  permissions: CompanyQuotationPermissions;
  onRetry: () => void;
  onClose: () => void;
  onViewPdf: () => void;
  onOpenDeal: () => void;
  onOpenCustomer: () => void;
  onOpenWorkspace: () => void;
  onDecided: () => void;
}) {
  const [dialog, setDialog] = useState<null | "approve" | "changes" | "reject">(null);
  const [compareOpen, setCompareOpen] = useState(false);

  useEffect(() => {
    setDialog(null);
    setCompareOpen(false);
  }, [row?.id]);

  if (!row) return null;

  const pending = companyQuotationIsPendingApproval(row);
  const approvalWidth = pending ? "w-[min(460px,94vw)]" : "w-[min(400px,94vw)]";
  const canDecide = permissions.canApprove && pending && !error;
  const fullScreenApproval = stacked && pending;

  const body = (
    <aside
      className={cn(
        "z-40 flex min-h-0 flex-col overflow-hidden border border-sales-border bg-sales-surface shadow-sales-card",
        overlay
          ? fullScreenApproval
            ? "fixed inset-0 rounded-none border-0"
            : stacked
              ? "fixed inset-x-0 bottom-0 max-h-[88dvh] rounded-t-[16px] border-b-0"
              : `fixed inset-y-0 right-0 ${approvalWidth} border-y-0 border-r-0 shadow-sales-modal`
          : "sticky top-0 max-h-[calc(100dvh-48px)] min-h-[600px] w-full rounded-[14px]"
      )}
      aria-label={pending ? `Approval request ${quoteNumber(row)}` : `Quotation ${quoteNumber(row)} details`}
      data-course-target="company-quotation-detail"
    >
      {pending ? (
        <ApprovalRail
          row={row}
          workspace={workspace}
          loading={loading}
          error={error}
          canDecide={canDecide}
          permissions={permissions}
          onRetry={onRetry}
          onClose={onClose}
          onOpenDeal={onOpenDeal}
          onOpenWorkspace={onOpenWorkspace}
          onCompare={() => setCompareOpen(true)}
          onApprove={() => setDialog("approve")}
          onRequestChanges={() => setDialog("changes")}
          onReject={() => setDialog("reject")}
        />
      ) : (
        <DetailRail
          row={row}
          workspace={workspace}
          loading={loading}
          error={error}
          permissions={permissions}
          onRetry={onRetry}
          onClose={onClose}
          onViewPdf={onViewPdf}
          onOpenDeal={onOpenDeal}
          onOpenCustomer={onOpenCustomer}
          onOpenWorkspace={onOpenWorkspace}
          onCompare={() => setCompareOpen(true)}
        />
      )}
    </aside>
  );

  return (
    <>
      {overlay ? (
        <>
          {!fullScreenApproval ? (
            <button
              type="button"
              aria-label="Close quotation details"
              className="fixed inset-0 z-30 bg-black/35"
              onClick={onClose}
            />
          ) : null}
          {body}
        </>
      ) : (
        body
      )}
      {dialog ? (
        <DecisionDialog
          row={row}
          kind={dialog}
          onClose={() => setDialog(null)}
          onDone={() => {
            setDialog(null);
            onDecided();
          }}
        />
      ) : null}
      {compareOpen && row.previousVersion ? (
        <CompareVersionsSheet
          currentId={row.id}
          otherId={row.previousVersion.id}
          onClose={() => setCompareOpen(false)}
        />
      ) : null}
    </>
  );
}

function DetailRail({
  row,
  workspace,
  loading,
  error,
  permissions,
  onRetry,
  onClose,
  onViewPdf,
  onOpenDeal,
  onOpenCustomer,
  onOpenWorkspace,
  onCompare,
}: {
  row: CompanyQuotationRow;
  workspace: QuotationWorkspacePayload | null;
  loading: boolean;
  error: boolean;
  permissions: CompanyQuotationPermissions;
  onRetry: () => void;
  onClose: () => void;
  onViewPdf: () => void;
  onOpenDeal: () => void;
  onOpenCustomer: () => void;
  onOpenWorkspace: () => void;
  onCompare: () => void;
}) {
  const engagement = companyQuotationEngagement(row);
  const validity = formatQuoteValidity(row.validUntil, { status: row.effectiveStatus });
  const sent = Boolean(row.sentAt);
  const accepted = row.effectiveStatus === "accepted";
  const declined = row.effectiveStatus === "rejected";
  const changesRequested = row.approvalStatus === "changes_requested";

  return (
    <>
      <header className="flex shrink-0 items-start justify-between gap-3 border-b border-sales-border-subtle px-4 py-3.5">
        <div className="min-w-0">
          <p className="truncate text-[15px] font-semibold text-sales-text-primary">{quoteNumber(row)}</p>
          <p className="mt-0.5 text-[11px] text-sales-text-muted">Version {row.revisionNumber}</p>
        </div>
        <div className="flex items-center gap-1.5">
          <Badge tone={getQuoteStatusTone(row.effectiveStatus)} appearance="soft" className="!text-[10px]">
            {formatQuoteStatus(row.effectiveStatus)}
          </Badge>
          <button
            type="button"
            aria-label="Close quotation details"
            className="inline-flex h-8 w-8 items-center justify-center rounded-[8px] text-sales-text-muted hover:bg-sales-surface-hover"
            onClick={onClose}
          >
            <X size={17} />
          </button>
        </div>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
        {loading && !workspace ? (
          <div className="space-y-3 p-4">
            <Skeleton className="h-20 rounded-[10px]" />
            <Skeleton className="h-36 rounded-[10px]" />
            <Skeleton className="h-28 rounded-[10px]" />
          </div>
        ) : (
          <>
            <Section title="Quotation summary">
              <p className="text-[22px] font-semibold tabular-nums tracking-tight text-sales-text-primary">
                {formatQuoteAmount(row.acceptedTotal ?? row.amount, row.currency)}
              </p>
              <dl className="mt-3 space-y-2">
                {row.subtotal != null ? <Meta label="Subtotal">{formatQuoteAmount(row.subtotal, row.currency)}</Meta> : null}
                {row.discountPercent != null && row.discountPercent > 0 ? (
                  <Meta label="Discount">{row.discountPercent}%</Meta>
                ) : null}
                {row.taxAmount != null && row.taxAmount !== 0 ? (
                  <Meta label="Tax">{formatQuoteAmount(row.taxAmount, row.currency)}</Meta>
                ) : null}
                <Meta label="Currency">{row.currency}</Meta>
                <Meta label="Valid until">
                  <span
                    className={cn(
                      validity.tone === "danger" && "text-sales-danger",
                      validity.tone === "warning" && "text-sales-warning-fg"
                    )}
                  >
                    {validity.primary}
                    {validity.secondary ? ` · ${validity.secondary}` : ""}
                  </span>
                </Meta>
              </dl>
            </Section>

            {error ? (
              <section className="border-b border-sales-border-subtle px-4 py-3">
                <p className="text-[12px] text-sales-text-muted">Some detail could not be refreshed.</p>
                <Button variant="secondary" size="sm" className="mt-2" onClick={onRetry}>
                  Retry
                </Button>
              </section>
            ) : null}

            <CommercialHealth row={row} permissions={permissions} />

            <Section title="Approval">
              {changesRequested ? (
                <div className="rounded-[10px] border border-sales-warning/30 bg-sales-warning-soft p-3">
                  <p className="text-[12px] font-semibold text-sales-warning-fg">Changes requested</p>
                  {row.approvalNote ? (
                    <p className="mt-1 text-[12px] text-sales-text-secondary">{row.approvalNote}</p>
                  ) : null}
                  <p className="mt-2 text-[11px] text-sales-text-muted">
                    Waiting on {row.owner?.name || "salesperson"}.
                  </p>
                </div>
              ) : row.approvalStatus === "approved" ? (
                <div>
                  <p className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-sales-brand-fg">
                    <Check size={14} /> Approved
                  </p>
                  <p className="mt-1 text-[11px] text-sales-text-muted">
                    {row.approvedByName || "Manager"}
                    {row.approvedAt ? ` · ${fullDate(row.approvedAt, true)}` : ""}
                  </p>
                  {row.approvalNote ? (
                    <p className="mt-2 text-[12px] text-sales-text-secondary">{row.approvalNote}</p>
                  ) : null}
                </div>
              ) : (
                <p className="text-[12px] text-sales-text-secondary">
                  {companyQuotationApprovalLabel(row.approvalStatus)}
                </p>
              )}
            </Section>

            {sent ? (
              <CustomerEngagement row={row} accepted={accepted} declined={declined} />
            ) : null}

            <Section title="Linked records">
              <dl className="space-y-2">
                <Meta label="Customer">
                  {row.contactId ? (
                    <button type="button" className="text-sales-info-fg hover:underline" onClick={onOpenCustomer}>
                      {row.customerName}
                    </button>
                  ) : (
                    row.customerName
                  )}
                </Meta>
                <Meta label="Deal">
                  {row.dealId ? (
                    <button type="button" className="text-sales-info-fg hover:underline" onClick={onOpenDeal}>
                      {row.dealName || "Open Deal"}
                    </button>
                  ) : (
                    "No Deal"
                  )}
                </Meta>
                {row.dealStage ? <Meta label="Deal stage">{formatDealStage(row.dealStage)}</Meta> : null}
                <Meta label="Salesperson">{row.owner?.name || "Unassigned"}</Meta>
              </dl>
            </Section>

            <Section title="Next action">
              <p className="text-[13px] font-medium text-sales-text-primary">{managerNextCopy(row)}</p>
              <p className="mt-1 text-[11px] text-sales-text-muted">{companyQuotationNextAction(row)}</p>
            </Section>

            {row.previousVersion ? (
              <Section title="Version">
                <p className="text-[12px] text-sales-text-secondary">
                  Version {row.previousVersion.revisionNumber}{" "}
                  {formatQuoteAmount(row.previousVersion.amount, row.currency)} → Version {row.revisionNumber}{" "}
                  {formatQuoteAmount(row.amount, row.currency)}
                </p>
                <button
                  type="button"
                  className="mt-2 text-[12px] font-semibold text-sales-brand-fg hover:underline"
                  onClick={onCompare}
                >
                  Compare versions
                </button>
              </Section>
            ) : null}

            <ActivitySection workspace={workspace} />
          </>
        )}
      </div>

      <footer className="shrink-0 space-y-2 border-t border-sales-border-subtle p-3 pb-[max(12px,env(safe-area-inset-bottom))]">
        <Button variant="secondary" size="md" className="w-full" leftIcon={<FileText size={14} />} onClick={onViewPdf}>
          View PDF
        </Button>
        <Button
          variant="secondary"
          size="md"
          className="w-full"
          rightIcon={<ArrowRight size={15} />}
          onClick={onOpenWorkspace}
        >
          {permissions.alsoSells ? "Open quotation workspace" : "Open quotation"}
        </Button>
      </footer>
    </>
  );
}

function ApprovalRail({
  row,
  workspace,
  loading,
  error,
  canDecide,
  permissions,
  onRetry,
  onClose,
  onOpenDeal,
  onOpenWorkspace,
  onCompare,
  onApprove,
  onRequestChanges,
  onReject,
}: {
  row: CompanyQuotationRow;
  workspace: QuotationWorkspacePayload | null;
  loading: boolean;
  error: boolean;
  canDecide: boolean;
  permissions: CompanyQuotationPermissions;
  onRetry: () => void;
  onClose: () => void;
  onOpenDeal: () => void;
  onOpenWorkspace: () => void;
  onCompare: () => void;
  onApprove: () => void;
  onRequestChanges: () => void;
  onReject: () => void;
}) {
  const difference =
    row.standardValue != null ? row.amount - row.standardValue : null;
  const beforeMargin =
    row.standardValue != null && row.costTotal != null && row.standardValue > 0
      ? Math.round(((row.standardValue - row.costTotal) / row.standardValue) * 1000) / 10
      : null;

  return (
    <>
      <header className="flex shrink-0 items-start justify-between gap-3 border-b border-sales-border-subtle px-4 py-3.5">
        <div className="min-w-0">
          <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-sales-warning-fg">
            Approval request
          </p>
          <p className="mt-1 truncate text-[15px] font-semibold text-sales-text-primary">{quoteNumber(row)}</p>
          <p className="mt-0.5 text-[11px] text-sales-text-muted">
            Version {row.revisionNumber}
            {row.customerName ? ` · ${row.customerName}` : ""}
          </p>
          <p className="mt-1 truncate text-[11px] text-sales-text-secondary">{row.title}</p>
          <p className="mt-2 text-[11px] text-sales-text-muted">
            {row.owner?.name || "Salesperson"} · {relativeTime(row.approvalRequestedAt || row.updatedAt)}
          </p>
        </div>
        <button
          type="button"
          aria-label="Close approval review"
          className="inline-flex h-8 w-8 items-center justify-center rounded-[8px] text-sales-text-muted hover:bg-sales-surface-hover"
          onClick={onClose}
        >
          <X size={17} />
        </button>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
        {loading && !workspace ? (
          <div className="space-y-3 p-4">
            <Skeleton className="h-28 rounded-[10px]" />
            <Skeleton className="h-32 rounded-[10px]" />
            <Skeleton className="h-24 rounded-[10px]" />
          </div>
        ) : (
          <>
            <Section title="Commercial snapshot">
              <p className="text-[11px] text-sales-text-muted">Proposed quotation</p>
              <p className="mt-1 text-[24px] font-semibold tabular-nums tracking-tight text-sales-text-primary">
                {formatQuoteAmount(row.amount, row.currency)}
              </p>
              <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2">
                {row.standardValue != null ? (
                  <div>
                    <p className="text-[10px] text-sales-text-muted">Standard value</p>
                    <p className="text-[12px] font-medium tabular-nums">{formatQuoteAmount(row.standardValue, row.currency)}</p>
                  </div>
                ) : null}
                {row.discountPercent != null ? (
                  <div>
                    <p className="text-[10px] text-sales-text-muted">Discount</p>
                    <p className="text-[12px] font-medium tabular-nums">{row.discountPercent}%</p>
                  </div>
                ) : null}
                {permissions.canSeeCost && row.costTotal != null ? (
                  <div>
                    <p className="text-[10px] text-sales-text-muted">Estimated cost</p>
                    <p className="text-[12px] font-medium tabular-nums">{formatQuoteAmount(row.costTotal, row.currency)}</p>
                  </div>
                ) : null}
                {permissions.canSeeCost && row.costTotal != null ? (
                  <div>
                    <p className="text-[10px] text-sales-text-muted">Gross profit</p>
                    <p className="text-[12px] font-medium tabular-nums">
                      {formatQuoteAmount(row.amount - row.costTotal, row.currency)}
                    </p>
                  </div>
                ) : null}
                {permissions.canSeeMargin && row.marginPercent != null ? (
                  <div>
                    <p className="text-[10px] text-sales-text-muted">Margin</p>
                    <p className="text-[12px] font-medium tabular-nums">{row.marginPercent}%</p>
                  </div>
                ) : null}
                {row.minMarginPercent != null ? (
                  <div>
                    <p className="text-[10px] text-sales-text-muted">Company minimum</p>
                    <p className="text-[12px] font-medium tabular-nums">{row.minMarginPercent}%</p>
                  </div>
                ) : null}
              </dl>
              {row.standardValue != null && difference != null ? (
                <div className="mt-4 grid grid-cols-2 gap-3 rounded-[10px] border border-sales-border-subtle p-3">
                  <div>
                    <p className="text-[10px] uppercase tracking-[0.05em] text-sales-text-muted">Standard</p>
                    <p className="mt-1 text-[14px] font-semibold tabular-nums">
                      {formatQuoteAmount(row.standardValue, row.currency)}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-[10px] uppercase tracking-[0.05em] text-sales-text-muted">Proposed</p>
                    <p className="mt-1 text-[14px] font-semibold tabular-nums">
                      {formatQuoteAmount(row.amount, row.currency)}
                    </p>
                    <p className="mt-1 text-[11px] tabular-nums text-sales-text-secondary">
                      {difference > 0 ? "+" : "−"}
                      {formatQuoteAmount(Math.abs(difference), row.currency)}
                      {row.discountPercent != null ? ` · ${row.discountPercent}%` : ""}
                    </p>
                  </div>
                </div>
              ) : null}
              {permissions.canSeeMargin && (beforeMargin != null || row.marginPercent != null) ? (
                <div className="mt-3">
                  <p className="text-[11px] font-medium text-sales-text-secondary">Margin impact</p>
                  {beforeMargin != null ? (
                    <p className="mt-1 text-[11px] text-sales-text-muted">Before discount: {beforeMargin}%</p>
                  ) : null}
                  {row.marginPercent != null ? (
                    <p className="text-[11px] text-sales-text-muted">After discount: {row.marginPercent}%</p>
                  ) : null}
                </div>
              ) : null}
            </Section>

            <Section title="Why approval is required">
              {row.approvalReasons.length > 0 ? (
                <ul className="space-y-2">
                  {row.approvalReasons.map((reason) => (
                    <li key={reason} className="rounded-[8px] bg-sales-surface-subtle px-3 py-2 text-[12px] text-sales-text-secondary">
                      {reason}
                    </li>
                  ))}
                </ul>
              ) : (
                <div className="space-y-2 text-[12px] text-sales-text-secondary">
                  {row.discountExceedsAuthority && row.maxDiscountPercent != null ? (
                    <p>Discount {row.discountPercent}% exceeds salesperson authority of {row.maxDiscountPercent}%.</p>
                  ) : null}
                  {row.marginHealth === "below_policy" && row.minMarginPercent != null ? (
                    <p>Proposed margin {row.marginPercent ?? "—"}% is below company minimum {row.minMarginPercent}%.</p>
                  ) : null}
                  {!row.discountExceedsAuthority && row.marginHealth !== "below_policy" ? (
                    <p>This quotation was submitted for commercial approval.</p>
                  ) : null}
                </div>
              )}
            </Section>

            <Section title="Salesperson context">
              {row.approvalNote ? (
                <blockquote className="border-l-2 border-sales-border pl-3 text-[12px] italic text-sales-text-secondary">
                  {row.approvalNote}
                </blockquote>
              ) : (
                <p className="text-[12px] text-sales-text-muted">No justification was submitted.</p>
              )}
            </Section>

            <Section title="Deal context">
              <dl className="space-y-2">
                <Meta label="Customer">{row.customerName}</Meta>
                <Meta label="Deal">{row.dealName || "No Deal"}</Meta>
                {row.dealValue != null ? <Meta label="Deal value">{formatQuoteAmount(row.dealValue, row.currency)}</Meta> : null}
                {row.dealStage ? <Meta label="Deal stage">{formatDealStage(row.dealStage)}</Meta> : null}
                <Meta label="Owner">{row.owner?.name || "Unassigned"}</Meta>
              </dl>
              {row.dealId ? (
                <button type="button" className="mt-2 text-[12px] font-semibold text-sales-brand-fg hover:underline" onClick={onOpenDeal}>
                  Open Deal
                </button>
              ) : null}
            </Section>

            {row.previousVersion ? (
              <Section title="Version context">
                <p className="text-[12px] text-sales-text-secondary">
                  Previous version {row.previousVersion.revisionNumber}: {formatQuoteAmount(row.previousVersion.amount, row.currency)}
                </p>
                <p className="mt-1 text-[12px] text-sales-text-secondary">
                  Current proposal {row.revisionNumber}: {formatQuoteAmount(row.amount, row.currency)}
                </p>
                <button
                  type="button"
                  className="mt-2 text-[12px] font-semibold text-sales-brand-fg hover:underline"
                  onClick={onCompare}
                >
                  Compare versions
                </button>
              </Section>
            ) : null}

            <ActivitySection workspace={workspace} title="Approval history" />

            {error ? (
              <section className="px-4 py-3">
                <p className="text-[12px] text-sales-danger">Approval state could not be verified.</p>
                <Button variant="secondary" size="sm" className="mt-2" onClick={onRetry}>
                  Retry
                </Button>
              </section>
            ) : null}
          </>
        )}
      </div>

      <footer className="shrink-0 space-y-2 border-t border-sales-border-subtle bg-sales-surface p-3 pb-[max(12px,env(safe-area-inset-bottom))]">
        {canDecide ? (
          <div className="flex flex-wrap justify-end gap-2">
            <Button variant="secondary" size="md" className="text-sales-danger" onClick={onReject}>
              Reject
            </Button>
            <Button variant="secondary" size="md" onClick={onRequestChanges}>
              Request changes
            </Button>
            <Button variant="primary" size="md" onClick={onApprove}>
              Approve
            </Button>
          </div>
        ) : (
          <p className="text-center text-[12px] text-sales-text-muted">
            {error ? "Approval actions are disabled until this quotation reloads safely." : "Awaiting approval from an authorised manager."}
          </p>
        )}
        <button
          type="button"
          className="flex w-full items-center justify-center gap-1 text-[12px] font-medium text-sales-text-secondary hover:text-sales-text-primary"
          onClick={onOpenWorkspace}
        >
          {permissions.alsoSells ? "Open quotation workspace" : "Open quotation"}
          <ExternalLink size={12} />
        </button>
      </footer>
    </>
  );
}

function CommercialHealth({
  row,
  permissions,
}: {
  row: CompanyQuotationRow;
  permissions: CompanyQuotationPermissions;
}) {
  const hasAny =
    permissions.canSeeCost && row.costTotal != null
      ? true
      : permissions.canSeeMargin && row.marginPercent != null
        ? true
        : row.discountPercent != null;
  if (!hasAny) return null;

  const health = row.marginHealth;
  const bar = row.marginPercent != null ? Math.max(0, Math.min(100, row.marginPercent)) : null;

  return (
    <Section title="Commercial health">
      <dl className="space-y-2">
        <Meta label="Selling value">{formatQuoteAmount(row.amount, row.currency)}</Meta>
        {permissions.canSeeCost && row.costTotal != null ? (
          <Meta label="Estimated cost">{formatQuoteAmount(row.costTotal, row.currency)}</Meta>
        ) : null}
        {permissions.canSeeCost && row.costTotal != null ? (
          <Meta label="Gross profit">{formatQuoteAmount(row.amount - row.costTotal, row.currency)}</Meta>
        ) : null}
        {permissions.canSeeMargin && row.marginPercent != null ? (
          <Meta label="Margin">{row.marginPercent}%</Meta>
        ) : null}
        {row.minMarginPercent != null ? <Meta label="Company minimum">{row.minMarginPercent}%</Meta> : null}
        {row.discountPercent != null ? <Meta label="Discount">{row.discountPercent}%</Meta> : null}
        {row.maxDiscountPercent != null ? <Meta label="Salesperson authority">{row.maxDiscountPercent}%</Meta> : null}
      </dl>
      {bar != null ? (
        <div className="mt-3">
          <div className="flex items-center justify-between text-[11px]">
            <span className="text-sales-text-muted">Margin</span>
            <span
              className={cn(
                "font-medium",
                health === "below_policy" && "text-sales-danger",
                health === "near_minimum" && "text-sales-warning-fg",
                health === "healthy" && "text-sales-success-fg"
              )}
            >
              {marginHealthLabel(health)}
            </span>
          </div>
          <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-sales-neutral-100">
            <div
              className={cn(
                "h-full rounded-full",
                health === "below_policy" && "bg-sales-danger",
                health === "near_minimum" && "bg-sales-warning",
                health === "healthy" && "bg-sales-brand",
                health === "unknown" && "bg-sales-neutral-400"
              )}
              style={{ width: `${bar}%` }}
            />
          </div>
        </div>
      ) : null}
      {row.standardValue != null ? (
        <dl className="mt-3 space-y-2 border-t border-sales-border-subtle pt-3">
          <Meta label="Standard value">{formatQuoteAmount(row.standardValue, row.currency)}</Meta>
          <Meta label="Proposed value">{formatQuoteAmount(row.amount, row.currency)}</Meta>
          <Meta label="Difference">
            {formatQuoteAmount(row.amount - row.standardValue, row.currency)}
          </Meta>
        </dl>
      ) : null}
    </Section>
  );
}

function CustomerEngagement({
  row,
  accepted,
  declined,
}: {
  row: CompanyQuotationRow;
  accepted: boolean;
  declined: boolean;
}) {
  const engagement = companyQuotationEngagement(row);
  return (
    <Section title="Customer engagement">
      {accepted ? (
        <div className="mb-3 rounded-[10px] border border-sales-success/25 bg-sales-success-soft p-3">
          <p className="text-[13px] font-semibold text-sales-success-fg">Quotation accepted</p>
          <p className="mt-1 text-[12px] tabular-nums text-sales-text-secondary">
            {formatQuoteAmount(row.acceptedTotal ?? row.amount, row.currency)} · Version {row.revisionNumber}
          </p>
          {row.selectedOptionLabel ? (
            <p className="mt-1 text-[12px] text-sales-text-secondary">Selected option: {row.selectedOptionLabel}</p>
          ) : null}
          {row.dealStage && row.dealStage !== "WON" ? (
            <p className="mt-2 text-[11px] text-sales-text-muted">Deal has not yet been marked Won.</p>
          ) : null}
        </div>
      ) : null}
      {declined ? (
        <div className="mb-3 rounded-[10px] border border-sales-danger/20 bg-sales-danger-soft p-3">
          <p className="text-[13px] font-semibold text-sales-danger">Quotation declined</p>
          {row.declinedReason || row.customerResponseCategory ? (
            <p className="mt-1 text-[12px] text-sales-text-secondary">
              {row.declinedReason || row.customerResponseCategory}
            </p>
          ) : null}
          {row.customerResponseMessage ? (
            <p className="mt-1 text-[12px] text-sales-text-secondary">{row.customerResponseMessage}</p>
          ) : null}
          <p className="mt-2 text-[11px] text-sales-text-muted">
            {row.dealStage ? `Deal is still ${formatDealStage(row.dealStage)}.` : "The related Deal remains independent."}
          </p>
        </div>
      ) : null}
      <dl className="space-y-2">
        <Meta label="State">{companyQuotationEngagementLabel(engagement)}</Meta>
        {row.sentAt ? <Meta label="Sent">{fullDate(row.sentAt, true)}</Meta> : null}
        {row.viewedAt ? <Meta label="First viewed">{fullDate(row.viewedAt, true)}</Meta> : null}
        {row.viewCount > 0 ? <Meta label="Views">{row.viewCount}</Meta> : null}
        {row.lastViewedAt ? <Meta label="Last viewed">{fullDate(row.lastViewedAt, true)}</Meta> : null}
        {row.customerResponseType ? (
          <Meta label="Response">{row.customerResponseType.replace(/_/g, " ")}</Meta>
        ) : sentWithoutResponse(row) ? (
          <Meta label="Response">No response</Meta>
        ) : null}
      </dl>
    </Section>
  );
}

function sentWithoutResponse(row: CompanyQuotationRow) {
  return Boolean(row.sentAt) && !row.customerResponseType && row.effectiveStatus !== "accepted" && row.effectiveStatus !== "rejected";
}

function ActivitySection({
  workspace,
  title = "Recent activity",
}: {
  workspace: QuotationWorkspacePayload | null;
  title?: string;
}) {
  const events = useMemo(
    () =>
      (workspace?.events ?? [])
        .filter((event) => MEANINGFUL_EVENTS.has(String(event.event_type)))
        .slice(0, 8),
    [workspace?.events]
  );
  if (!workspace) return null;
  if (events.length === 0) return null;
  return (
    <Section title={title}>
      <ol className="space-y-2.5">
        {events.map((event) => (
          <li key={event.id} className="flex items-start justify-between gap-3 text-[12px]">
            <div className="min-w-0">
              <p className="font-medium text-sales-text-primary">{eventLabel(String(event.event_type))}</p>
              <p className="mt-0.5 text-[11px] text-sales-text-muted">{event.actor_name}</p>
            </div>
            <span className="shrink-0 text-[10px] text-sales-text-muted">{fullDate(event.created_at, true)}</span>
          </li>
        ))}
      </ol>
    </Section>
  );
}

function managerNextCopy(row: CompanyQuotationRow): string {
  if (companyQuotationIsPendingApproval(row)) return "Approval required";
  if (row.customerResponseType === "changes_requested") return "Customer requested changes";
  if (row.approvalStatus === "changes_requested") return "Waiting on salesperson revisions";
  if (row.effectiveStatus === "accepted") return "Quotation accepted";
  if (row.sentAt) return "Quotation is with the customer";
  return "No manager action required";
}

function DecisionDialog({
  row,
  kind,
  onClose,
  onDone,
}: {
  row: CompanyQuotationRow;
  kind: "approve" | "changes" | "reject";
  onClose: () => void;
  onDone: () => void;
}) {
  const [note, setNote] = useState("");
  const [instruction, setInstruction] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const title =
    kind === "approve" ? "Approve quotation exception?" : kind === "changes" ? "Request changes" : "Reject quotation";

  async function submit() {
    if (kind === "reject" && !note.trim()) {
      setError("Add a reason before rejecting.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      const composed =
        kind === "changes" && instruction
          ? `${instruction}${note.trim() ? `. ${note.trim()}` : ""}`
          : note.trim();
      const res = await fetch(`/api/quotations/${row.id}/approve`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          decision: kind === "changes" ? "request_changes" : kind,
          note: composed || undefined,
        }),
      });
      const json = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(json.error || "Could not update approval");
      onDone();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <PremiumSheet title={title} size="sm" maxWidthClass="max-w-md" onClose={onClose}>
      <div className="space-y-3">
        {kind === "approve" ? (
          <dl className="space-y-2 text-[12px]">
            <Meta label="Quotation">{quoteNumber(row)}</Meta>
            <Meta label="Value">{formatQuoteAmount(row.amount, row.currency)}</Meta>
            {row.discountPercent != null ? <Meta label="Discount">{row.discountPercent}%</Meta> : null}
            {row.marginPercent != null ? <Meta label="Margin">{row.marginPercent}%</Meta> : null}
          </dl>
        ) : null}
        {kind === "changes" ? (
          <div className="flex flex-wrap gap-1.5">
            {["Adjust discount", "Change price", "Change payment terms", "Review scope", "Other"].map((item) => (
              <button
                key={item}
                type="button"
                className={cn(
                  "rounded-full border px-2.5 py-1 text-[11px]",
                  instruction === item
                    ? "border-sales-brand-border bg-sales-brand-soft text-sales-text-primary"
                    : "border-sales-border text-sales-text-secondary"
                )}
                onClick={() => setInstruction(item)}
              >
                {item}
              </button>
            ))}
          </div>
        ) : null}
        <textarea
          className="w-full rounded-[8px] border border-sales-border bg-sales-surface px-3 py-2 text-[12px] outline-none focus:border-sales-brand-border"
          rows={3}
          placeholder={
            kind === "approve"
              ? "Optional comment"
              : kind === "changes"
                ? "Maximum discount approved is…"
                : "Reason for rejection"
          }
          value={note}
          onChange={(event) => setNote(event.target.value)}
        />
        {error ? <p className="text-[12px] text-sales-danger">{error}</p> : null}
        <div className="flex justify-end gap-2">
          <Button variant="secondary" size="sm" onClick={onClose}>
            Cancel
          </Button>
          <Button
            variant={kind === "reject" ? "secondary" : "primary"}
            size="sm"
            loading={busy}
            className={kind === "reject" ? "text-sales-danger" : undefined}
            onClick={() => void submit()}
          >
            {kind === "approve" ? "Approve quotation" : kind === "changes" ? "Send changes to salesperson" : "Reject quotation"}
          </Button>
        </div>
      </div>
    </PremiumSheet>
  );
}

function CompareVersionsSheet({
  currentId,
  otherId,
  onClose,
}: {
  currentId: string;
  otherId: string;
  onClose: () => void;
}) {
  const [diffs, setDiffs] = useState<VersionDiffRow[] | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/quotations/${currentId}/compare?other=${otherId}`)
      .then(async (res) => {
        const json = (await res.json()) as { diffs?: VersionDiffRow[] };
        if (!res.ok || !json.diffs) throw new Error("compare failed");
        if (!cancelled) setDiffs(json.diffs);
      })
      .catch(() => {
        if (!cancelled) setError(true);
      });
    return () => {
      cancelled = true;
    };
  }, [currentId, otherId]);

  return (
    <PremiumSheet title="Compare versions" size="sm" maxWidthClass="max-w-lg" onClose={onClose}>
      {error ? (
        <p className="text-[12px] text-sales-text-muted">Version comparison could not be loaded.</p>
      ) : !diffs ? (
        <div className="space-y-2">
          <Skeleton className="h-8" />
          <Skeleton className="h-8" />
          <Skeleton className="h-8" />
        </div>
      ) : diffs.length === 0 ? (
        <p className="text-[12px] text-sales-text-muted">No commercial differences between these versions.</p>
      ) : (
        <ul className="divide-y divide-sales-border-subtle">
          {diffs.map((diff) => (
            <li key={`${diff.field}-${diff.from}-${diff.to}`} className="grid grid-cols-[minmax(0,1.2fr)_1fr_1fr] gap-2 py-2.5 text-[12px]">
              <p className="font-medium text-sales-text-primary">
                {diff.field}
                <span className="ml-2 rounded-full bg-sales-neutral-100 px-1.5 py-0.5 text-[9px] uppercase text-sales-text-muted">
                  {diff.from === "—" ? "Added" : diff.to === "—" ? "Removed" : "Changed"}
                </span>
              </p>
              <p className="tabular-nums text-sales-text-muted">{diff.from}</p>
              <p className="tabular-nums text-sales-text-primary">{diff.to}</p>
            </li>
          ))}
        </ul>
      )}
    </PremiumSheet>
  );
}
