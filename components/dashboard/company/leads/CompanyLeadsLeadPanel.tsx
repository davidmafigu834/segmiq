"use client";

import { useEffect, useRef, useState, type HTMLAttributes } from "react";
import {
  Calendar,
  Check,
  Mail,
  MapPin,
  MoreHorizontal,
  Phone,
  X,
} from "lucide-react";
import { SiWhatsapp } from "react-icons/si";
import { cn } from "@/lib/ui/cn";
import {
  Avatar,
  Badge,
  Button,
  IconButton,
  Progress,
  Skeleton,
} from "@/components/sales/ui";
import { companyLeadLifecycleTone } from "@/lib/sales/company-leads-metrics";
import { SourceBadge } from "./CompanyLeadsTableCard";
import type { CompanyLeadDetail, CompanyLeadRow } from "./types";

function Section({
  children,
  className,
  ...rest
}: HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn("border-t border-sales-border-subtle px-4 py-3.5 sm:px-5", className)} {...rest}>
      {children}
    </div>
  );
}

function ContactAction({
  label,
  disabled,
  onClick,
  href,
  children,
}: {
  label: string;
  disabled?: boolean;
  onClick?: () => void;
  href?: string | null;
  children: React.ReactNode;
}) {
  const className = cn(
    "flex min-h-[44px] flex-1 flex-col items-center justify-center gap-1 rounded-[10px] border border-sales-border bg-[#151815]/[0.02] px-1 py-2 text-[11px] font-medium text-sales-text-secondary transition-colors dark:bg-[#151815]",
    disabled
      ? "cursor-not-allowed opacity-40"
      : "hover:border-sales-border-strong hover:bg-sales-surface-hover hover:text-sales-text-primary"
  );
  if (href && !disabled) {
    return (
      <a href={href} className={className} onClick={(e) => e.stopPropagation()}>
        {children}
        {label}
      </a>
    );
  }
  return (
    <button type="button" disabled={disabled} className={className} onClick={onClick}>
      {children}
      {label}
    </button>
  );
}

function MoreMenu({
  canReassign,
  canModify,
  hasDeal,
  notQualified,
  onAssign,
  onSchedule,
  onNotQualified,
  onCreateDeal,
  onOpenDeal,
}: {
  canReassign: boolean;
  canModify: boolean;
  hasDeal: boolean;
  notQualified: boolean;
  onAssign: () => void;
  onSchedule: () => void;
  onNotQualified: () => void;
  onCreateDeal: () => void;
  onOpenDeal: () => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onDoc(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  return (
    <div className="relative flex-1" ref={ref}>
      <button
        type="button"
        className="flex min-h-[44px] w-full flex-col items-center justify-center gap-1 rounded-[10px] border border-sales-border bg-[#151815]/[0.02] px-1 py-2 text-[11px] font-medium text-sales-text-secondary hover:border-sales-border-strong hover:bg-sales-surface-hover hover:text-sales-text-primary dark:bg-[#151815]"
        onClick={() => setOpen((v) => !v)}
      >
        <MoreHorizontal size={16} strokeWidth={1.8} />
        More
      </button>
      {open ? (
        <div
          role="menu"
          className="absolute right-0 z-30 mt-1 w-48 overflow-hidden rounded-[10px] border border-sales-border bg-sales-surface py-1 shadow-sales-popover"
        >
          {canReassign ? (
            <button
              type="button"
              role="menuitem"
              className="flex w-full px-3 py-2 text-left text-[13px] text-sales-text-primary hover:bg-sales-surface-hover"
              onClick={() => {
                setOpen(false);
                onAssign();
              }}
            >
              Assign Lead
            </button>
          ) : null}
          {canModify ? (
            <button
              type="button"
              role="menuitem"
              className="flex w-full px-3 py-2 text-left text-[13px] text-sales-text-primary hover:bg-sales-surface-hover"
              onClick={() => {
                setOpen(false);
                onSchedule();
              }}
            >
              Schedule follow-up
            </button>
          ) : null}
          {hasDeal ? (
            <button
              type="button"
              role="menuitem"
              className="flex w-full px-3 py-2 text-left text-[13px] text-sales-text-primary hover:bg-sales-surface-hover"
              onClick={() => {
                setOpen(false);
                onOpenDeal();
              }}
            >
              Open Deal
            </button>
          ) : canModify && !notQualified ? (
            <button
              type="button"
              role="menuitem"
              className="flex w-full px-3 py-2 text-left text-[13px] text-sales-text-primary hover:bg-sales-surface-hover"
              onClick={() => {
                setOpen(false);
                onCreateDeal();
              }}
            >
              Create Deal
            </button>
          ) : null}
          {canModify && !notQualified && !hasDeal ? (
            <button
              type="button"
              role="menuitem"
              className="flex w-full px-3 py-2 text-left text-[13px] text-sales-danger hover:bg-sales-surface-hover"
              onClick={() => {
                setOpen(false);
                onNotQualified();
              }}
            >
              Mark Not Qualified
            </button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

export function CompanyLeadsLeadPanel({
  row,
  detail,
  loading,
  error,
  onRetry,
  onClose,
  onCall,
  onWhatsApp,
  onAssign,
  onSchedule,
  onNotQualified,
  onCreateDeal,
  onOpenDeal,
  onViewDetails,
  onCompleteNext,
  overlay,
  stacked,
}: {
  row: CompanyLeadRow | null;
  detail: CompanyLeadDetail | null;
  loading: boolean;
  error: string | null;
  onRetry: () => void;
  onClose: () => void;
  onCall: () => void;
  onWhatsApp: () => void;
  onAssign: () => void;
  onSchedule: () => void;
  onNotQualified: () => void;
  onCreateDeal: () => void;
  onOpenDeal: () => void;
  onViewDetails: () => void;
  onCompleteNext: () => void;
  overlay?: boolean;
  stacked?: boolean;
}) {
  const data = detail;
  const name = data?.identity ?? row?.identity ?? "Lead";
  const lifecycle = data?.lifecycle ?? row?.lifecycle ?? "NEW";
  const lifecycleLabel = data?.lifecycleLabel ?? row?.lifecycleLabel ?? "New";
  const score = data?.leadScore ?? row?.leadScore ?? null;
  const intent = data?.intent ?? row?.intent;
  const intentLabel = data?.intentLabel ?? row?.intentLabel;
  const notQualified = lifecycle === "NOT_QUALIFIED";
  const hasDeal = data?.hasDeal ?? row?.hasDeal ?? false;
  const canModify = data?.canModify ?? row?.canModify ?? false;
  const canReassign = data?.canReassign ?? false;
  const canCreateDeal = data?.canCreateDeal ?? false;
  const next = data?.nextAction ?? row?.nextAction;
  const scoreTone =
    intent === "hot" ? "success" : intent === "warm" ? "warning" : "info";
  const scoreColor =
    intent === "hot"
      ? "text-sales-success-fg"
      : intent === "warm"
        ? "text-sales-warning-fg"
        : "text-sales-text-primary";

  const body = (
    <aside
      data-course-target="company-lead-detail"
      className={cn(
        "flex h-full min-h-0 flex-col overflow-hidden rounded-[14px] border border-sales-border bg-sales-surface shadow-sales-card",
        overlay &&
          "fixed inset-y-0 right-0 z-40 w-full max-w-[400px] rounded-none border-y-0 border-r-0 sm:rounded-l-[14px] sm:border-y sm:border-r",
        stacked && overlay && "inset-0 max-w-none rounded-none"
      )}
    >
      <div className="flex items-start justify-between gap-3 px-4 py-3.5 sm:px-5">
        <div className="flex min-w-0 items-start gap-3">
          <Avatar name={name} size="lg" />
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="min-w-0 truncate text-[16px] font-semibold leading-snug tracking-[-0.02em] text-sales-text-primary">
                {name}
              </h2>
              <Badge
                tone={companyLeadLifecycleTone(lifecycle)}
                appearance="soft"
                className="!px-2 !py-0.5 !text-[11px]"
              >
                {lifecycleLabel}
              </Badge>
            </div>
            {data?.enquiryContext || row?.enquiryContext ? (
              <p className="mt-0.5 truncate text-[12px] text-sales-text-secondary">
                {data?.enquiryContext ?? row?.enquiryContext}
              </p>
            ) : null}
            {data?.location || row?.location ? (
              <p className="mt-0.5 flex items-center gap-1 truncate text-[12px] text-sales-text-muted">
                <MapPin size={12} strokeWidth={1.8} />
                {data?.location ?? row?.location}
              </p>
            ) : null}
          </div>
        </div>
        <IconButton aria-label="Close Lead details" onClick={onClose}>
          <X size={16} strokeWidth={1.8} />
        </IconButton>
      </div>

      {error && !loading ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-3 px-5 py-10 text-center">
          <p className="text-[13px] text-sales-text-secondary">We couldn&apos;t load this Lead.</p>
          <Button variant="secondary" size="sm" onClick={onRetry}>
            Retry
          </Button>
        </div>
      ) : loading && !data ? (
        <div className="space-y-4 px-5 pb-5">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-20 w-full" />
        </div>
      ) : (
        <div className="min-h-0 flex-1 overflow-y-auto">
          <div className="flex gap-2 px-4 pb-3.5 sm:px-5">
            <ContactAction label="Call" disabled={!data?.canCall} onClick={onCall}>
              <Phone size={16} strokeWidth={1.8} />
            </ContactAction>
            <ContactAction
              label="WhatsApp"
              disabled={!data?.canWhatsApp}
              onClick={onWhatsApp}
            >
              <SiWhatsapp size={16} color="#25D366" />
            </ContactAction>
            <ContactAction
              label="Email"
              disabled={!data?.canEmail}
              href={data?.mailtoHref}
            >
              <Mail size={16} strokeWidth={1.8} />
            </ContactAction>
            <MoreMenu
              canReassign={canReassign}
              canModify={canModify}
              hasDeal={hasDeal}
              notQualified={notQualified}
              onAssign={onAssign}
              onSchedule={onSchedule}
              onNotQualified={onNotQualified}
              onCreateDeal={onCreateDeal}
              onOpenDeal={onOpenDeal}
            />
          </div>

          <Section data-course-target="company-lead-score">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-[11px] font-medium uppercase tracking-[0.04em] text-sales-text-muted">
                  Lead score
                </p>
                {score == null ? (
                  <p className="mt-1 text-[28px] font-semibold tabular-nums text-sales-text-muted">—</p>
                ) : (
                  <>
                    <p className={cn("mt-1 text-[36px] font-semibold leading-none tabular-nums", scoreColor)}>
                      {Math.round(score)}
                    </p>
                    {intentLabel ? (
                      <p className="mt-1.5 text-[12px] font-medium text-sales-text-secondary">{intentLabel}</p>
                    ) : null}
                    <Progress value={score} tone={scoreTone} className="mt-2 h-1.5" />
                  </>
                )}
              </div>
              <div>
                {data?.scoreSignals && data.scoreSignals.length > 0 ? (
                  <ul className="space-y-1.5">
                    {data.scoreSignals.map((s) => (
                      <li key={s.id} className="flex items-start gap-1.5 text-[12px] text-sales-text-secondary">
                        <Check size={14} strokeWidth={2} className="mt-0.5 shrink-0 text-sales-success" />
                        <span>{s.label}</span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-[12px] text-sales-text-muted">No qualification signals recorded yet.</p>
                )}
              </div>
            </div>
          </Section>

          <Section>
            <p className="mb-3 text-[11px] font-medium uppercase tracking-[0.04em] text-sales-text-muted">
              About this Lead
            </p>
            <div className="grid grid-cols-2 gap-x-3 gap-y-3">
              <div>
                <p className="text-[11px] text-sales-text-muted">Source</p>
                <div className="mt-1">
                  <SourceBadge
                    sourceKey={data?.sourceKey ?? row?.sourceKey ?? null}
                    sourceLabel={data?.sourceLabel ?? row?.sourceLabel ?? null}
                    sourceRaw={row?.sourceRaw}
                  />
                </div>
              </div>
              <div>
                <p className="text-[11px] text-sales-text-muted">Lead owner</p>
                <div className="mt-1 flex items-center gap-1.5">
                  {data?.ownerId || row?.ownerId ? (
                    <>
                      <Avatar
                        name={data?.ownerName ?? row?.ownerName ?? "Owner"}
                        src={data?.ownerAvatarUrl ?? row?.ownerAvatarUrl}
                        size="xs"
                      />
                      <span className="truncate text-[12px] font-medium text-sales-text-primary">
                        {data?.ownerName ?? row?.ownerName}
                      </span>
                    </>
                  ) : (
                    <span className="text-[12px] font-medium text-sales-warning-fg">Unassigned</span>
                  )}
                </div>
              </div>
              <div>
                <p className="text-[11px] text-sales-text-muted">First contact</p>
                <p className="mt-1 text-[12px] text-sales-text-primary">
                  {data?.firstContactLabel ?? "Not contacted yet"}
                </p>
              </div>
              <div>
                <p className="text-[11px] text-sales-text-muted">Last activity</p>
                <p className="mt-1 text-[12px] text-sales-text-primary">
                  {data?.lastActivityLabel ?? "No activity yet"}
                </p>
              </div>
            </div>
          </Section>

          <Section>
            <p className="mb-2 text-[11px] font-medium uppercase tracking-[0.04em] text-sales-text-muted">
              Customer need
            </p>
            {data?.customerNeed ? (
              <p className="text-[13px] leading-relaxed text-sales-text-primary">{data.customerNeed}</p>
            ) : (
              <p className="text-[13px] font-medium text-sales-text-secondary">Not captured yet</p>
            )}
          </Section>

          <Section data-course-target="company-lead-next-action">
            <p className="mb-2 text-[11px] font-medium uppercase tracking-[0.04em] text-sales-text-muted">
              Next action
            </p>
            {next?.hasNextAction ? (
              <div className="rounded-[12px] border border-sales-border bg-sales-surface-subtle p-3">
                <div className="flex items-start gap-2.5">
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[8px] bg-sales-neutral-100 text-sales-text-secondary">
                    <Calendar size={14} strokeWidth={1.8} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-[13px] font-semibold text-sales-text-primary">
                        {next.label ?? "Follow up"}
                      </p>
                      {next.whenLabel ? (
                        <span
                          className={cn(
                            "shrink-0 text-[11px] font-medium",
                            next.urgency === "overdue"
                              ? "text-sales-danger"
                              : next.urgency === "today"
                                ? "text-sales-warning-fg"
                                : "text-sales-text-muted"
                          )}
                        >
                          {next.whenLabel}
                        </span>
                      ) : null}
                    </div>
                    <div className="mt-2 flex items-center justify-between gap-2">
                      <div className="flex items-center gap-1.5">
                        <Avatar
                          name={data?.ownerName ?? row?.ownerName ?? "Unassigned"}
                          src={data?.ownerAvatarUrl ?? row?.ownerAvatarUrl}
                          size="xs"
                        />
                        <span className="text-[11px] text-sales-text-secondary">
                          {data?.ownerName ?? row?.ownerName ?? "Unassigned"}
                        </span>
                      </div>
                      {next.completable && canModify ? (
                        <label className="inline-flex cursor-pointer items-center gap-1.5 text-[12px] text-sales-text-secondary">
                          <input
                            type="checkbox"
                            className="h-3.5 w-3.5 rounded border-sales-border"
                            onChange={(e) => {
                              if (e.target.checked) onCompleteNext();
                            }}
                          />
                          Mark complete
                        </label>
                      ) : null}
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div>
                <p className="text-[13px] font-medium text-sales-text-primary">No next action scheduled</p>
                <p className="mt-1 text-[12px] text-sales-text-muted">
                  This Lead does not currently have another action planned.
                </p>
                {canModify ? (
                  <Button variant="secondary" size="sm" className="mt-3" onClick={onSchedule}>
                    Schedule follow-up
                  </Button>
                ) : null}
              </div>
            )}
          </Section>

          {notQualified && data?.notQualifiedReason ? (
            <Section>
              <p className="mb-1 text-[11px] font-medium uppercase tracking-[0.04em] text-sales-text-muted">
                Not Qualified
              </p>
              <p className="text-[13px] text-sales-text-secondary">{data.notQualifiedReason}</p>
            </Section>
          ) : null}

          {data?.relatedDeal ? (
            <Section>
              <p className="mb-2 text-[11px] font-medium uppercase tracking-[0.04em] text-sales-text-muted">
                Related Deal
              </p>
              <p className="text-[13px] font-semibold text-sales-text-primary">{data.relatedDeal.name}</p>
              <p className="mt-0.5 text-[12px] text-sales-text-secondary">
                {data.relatedDeal.stageLabel}
                {data.relatedDeal.valueLabel ? ` · ${data.relatedDeal.valueLabel}` : ""}
              </p>
            </Section>
          ) : null}
        </div>
      )}

      <div
        className="mt-auto flex gap-2 border-t border-sales-border px-4 py-3 sm:px-5"
        style={{ paddingBottom: "max(12px, env(safe-area-inset-bottom))" }}
      >
        <Button variant="secondary" size="md" className="flex-1" onClick={onViewDetails}>
          View full details
        </Button>
        {hasDeal ? (
          <Button variant="primary" size="md" className="flex-1" onClick={onOpenDeal}>
            Open Deal
          </Button>
        ) : notQualified ? (
          <Button variant="secondary" size="md" className="flex-1" disabled>
            Not Qualified
          </Button>
        ) : (
          <Button
            variant="primary"
            size="md"
            className="flex-1"
            data-course-target="company-lead-create-deal"
            disabled={!canCreateDeal}
            onClick={onCreateDeal}
          >
            Create Deal
          </Button>
        )}
      </div>
    </aside>
  );

  if (overlay) {
    return (
      <>
        <button
          type="button"
          aria-label="Close Lead details"
          className="fixed inset-0 z-30 bg-black/30"
          onClick={onClose}
        />
        {body}
      </>
    );
  }

  return body;
}
