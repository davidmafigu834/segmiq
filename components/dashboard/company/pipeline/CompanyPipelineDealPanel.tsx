"use client";

import { useEffect, useRef, useState, type HTMLAttributes } from "react";
import Link from "next/link";
import { Building2, ChevronDown, Phone, X } from "lucide-react";
import { SiWhatsapp } from "react-icons/si";
import { EntityDocumentsPanel } from "@/components/dashboard/company/documents/EntityDocumentsPanel";
import { cn } from "@/lib/ui/cn";
import {
  Avatar,
  Badge,
  Button,
  ErrorState,
  IconButton,
  PipelineStageBadge,
  Progress,
  Skeleton,
} from "@/components/sales/ui";
import { DEAL_ACTIVE_STAGES, DEAL_STAGE_LABEL, formatDealStage } from "@/lib/sales/deals/display";
import { companyPipelineHealthBarPct } from "@/lib/sales/company-pipeline-metrics";
import type { DealStage } from "@/types";
import type { CompanyPipelineDealDetail, CompanyPipelineDealRow } from "./types";

function healthTone(health: CompanyPipelineDealDetail["health"]): "success" | "warning" | "danger" {
  if (health === "at_risk") return "danger";
  if (health === "needs_attention") return "warning";
  return "success";
}

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

function StageControl({
  stage,
  canModify,
  onChange,
}: {
  stage: DealStage;
  canModify: boolean;
  onChange: (stage: DealStage) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const closed = stage === "WON" || stage === "LOST";

  useEffect(() => {
    if (!open) return;
    function onDoc(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  const badge = (
    <PipelineStageBadge
      status={stage}
      label={DEAL_STAGE_LABEL[stage] ?? formatDealStage(stage)}
      className="!px-2 !py-0.5 !text-[11px]"
    />
  );

  if (!canModify || closed) return badge;

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        className="inline-flex items-center gap-1"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        {badge}
        <ChevronDown size={14} className="text-sales-text-muted" />
      </button>
      {open ? (
        <div
          role="listbox"
          className="absolute left-0 z-30 mt-1 w-44 overflow-hidden rounded-[10px] border border-sales-border bg-sales-surface py-1 shadow-sales-popover"
        >
          {DEAL_ACTIVE_STAGES.map((s) => (
            <button
              key={s}
              type="button"
              role="option"
              aria-selected={s === stage}
              className="flex w-full px-3 py-2 text-left text-[13px] text-sales-text-primary hover:bg-sales-surface-hover"
              onClick={() => {
                setOpen(false);
                if (s !== stage) onChange(s);
              }}
            >
              {DEAL_STAGE_LABEL[s]}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}

export function CompanyPipelineDealPanel({
  row,
  detail,
  loading,
  error,
  onRetry,
  onClose,
  onViewDeal,
  onLogActivity,
  onSchedule,
  onChangeOwner,
  onChangeStage,
  clientId,
  overlay,
  stacked,
}: {
  row: CompanyPipelineDealRow | null;
  detail: CompanyPipelineDealDetail | null;
  loading: boolean;
  error: string | null;
  onRetry: () => void;
  onClose: () => void;
  onViewDeal: () => void;
  onLogActivity: () => void;
  onSchedule: () => void;
  onChangeOwner: () => void;
  onChangeStage: (stage: DealStage) => void;
  clientId?: string;
  overlay?: boolean;
  stacked?: boolean;
}) {
  const data = detail;
  const name = data?.dealName ?? row?.dealName ?? "Deal";
  const health = data?.health ?? row?.health ?? "on_track";
  const barPct = data?.healthBarPct ?? companyPipelineHealthBarPct(health);

  const body = (
    <aside
      data-course-target="company-pipeline-detail"
      className={cn(
        "flex h-full min-h-0 flex-col overflow-hidden workspace-card rounded-[14px] border border-sales-border bg-sales-surface shadow-sales-card",
        overlay &&
          "fixed inset-y-0 right-0 z-40 w-full max-w-[400px] rounded-none border-y-0 border-r-0 sm:rounded-l-[14px] sm:border-y sm:border-r",
        stacked && overlay && "inset-0 max-w-none rounded-none"
      )}
    >
      <div className="flex items-start justify-between gap-3 px-4 py-3.5 sm:px-5">
        <h2 className="min-w-0 text-[18px] font-semibold leading-snug tracking-[-0.02em] text-sales-text-primary">
          {name}
        </h2>
        <IconButton aria-label="Close Deal details" onClick={onClose}>
          <X size={16} strokeWidth={1.8} />
        </IconButton>
      </div>

      {error && !loading ? (
        <ErrorState
          title="Unable to load deal"
          description="We couldn't retrieve this deal's details right now."
          onRetry={onRetry}
          size="compact"
          className="flex-1"
        />
      ) : loading && !data ? (
        <div className="space-y-4 px-5 pb-5">
          <Skeleton className="h-8 w-40" />
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-24 w-full" />
        </div>
      ) : (
        <div className="min-h-0 flex-1 overflow-y-auto">
          <div className="flex items-start justify-between gap-3 px-4 pb-3.5 sm:px-5">
            <StageControl
              stage={data?.stage ?? row?.stage ?? "QUALIFIED"}
              canModify={data?.canModify ?? row?.canModify ?? false}
              onChange={onChangeStage}
            />
            <div className="text-right">
              <p className="text-[18px] font-semibold tabular-nums leading-none text-sales-text-primary">
                {data?.valueLabel ?? row?.valueLabel}
              </p>
              <p className="mt-1 text-[11px] text-sales-text-muted">Deal Value</p>
            </div>
          </div>

          <Section>
            <div className="flex items-start gap-3">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px] bg-sales-neutral-100 text-sales-text-secondary">
                <Building2 size={16} strokeWidth={1.8} />
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-[13px] font-semibold text-sales-text-primary">
                  {data?.customerName ?? row?.customerName}
                </p>
                {(data?.customerLocation ?? row?.customerLocation) ? (
                  <p className="truncate text-[12px] text-sales-text-muted">
                    {data?.customerLocation ?? row?.customerLocation}
                  </p>
                ) : null}
                <div className="mt-1.5 flex items-center gap-2">
                  {data?.telHref ? (
                    <a
                      href={data.telHref}
                      className="inline-flex items-center gap-1 text-[12px] text-sales-text-secondary hover:text-sales-text-primary"
                    >
                      <Phone size={13} strokeWidth={1.8} />
                      {data.customerPhone}
                    </a>
                  ) : data?.customerPhone ? (
                    <span className="text-[12px] text-sales-text-secondary">{data.customerPhone}</span>
                  ) : null}
                  {data?.whatsappHref ? (
                    <a
                      href={data.whatsappHref}
                      target={data.whatsappHref.startsWith("http") ? "_blank" : undefined}
                      rel="noreferrer"
                      aria-label="WhatsApp"
                      className="inline-flex h-7 w-7 items-center justify-center rounded-[8px] text-[#25D366] hover:bg-sales-surface-hover"
                    >
                      <SiWhatsapp size={14} />
                    </a>
                  ) : null}
                </div>
              </div>
            </div>
          </Section>

          <Section>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <p className="text-[11px] text-sales-text-muted">Expected Decision</p>
                <p className="mt-0.5 text-[13px] font-medium text-sales-text-primary">
                  {data?.expectedDecisionLabel ?? row?.expectedDecisionLabel}
                </p>
              </div>
              <div>
                <p className="text-[11px] text-sales-text-muted">Deal Owner</p>
                <button
                  type="button"
                  className="mt-0.5 flex items-center gap-2 text-left"
                  onClick={data?.canReassign ? onChangeOwner : undefined}
                  disabled={!data?.canReassign}
                >
                  <Avatar
                    name={data?.ownerName ?? row?.ownerName ?? "Unassigned"}
                    src={data?.ownerAvatarUrl ?? row?.ownerAvatarUrl}
                    size="sm"
                  />
                  <span className="truncate text-[13px] font-medium text-sales-text-primary">
                    {data?.ownerName ?? row?.ownerName ?? "Unassigned"}
                  </span>
                </button>
              </div>
            </div>
          </Section>

          <Section data-course-target="company-pipeline-next-action">
            <p className="text-[11px] font-medium uppercase tracking-[0.04em] text-sales-text-muted">
              Next Action
            </p>
            {(data?.nextAction ?? row?.nextAction)?.hasNextAction ? (
              <>
                <p className="mt-1 text-[14px] font-semibold text-sales-text-primary">
                  {(data?.nextAction ?? row?.nextAction)?.label || "Follow-up"}
                </p>
                <p
                  className={cn(
                    "mt-0.5 text-[12px]",
                    (data?.nextAction ?? row?.nextAction)?.urgency === "overdue"
                      ? "text-sales-danger"
                      : (data?.nextAction ?? row?.nextAction)?.urgency === "today"
                        ? "text-sales-warning-fg"
                        : "text-sales-text-secondary"
                  )}
                >
                  {(data?.nextAction ?? row?.nextAction)?.whenLabel}
                </p>
              </>
            ) : (
              <>
                <p className="mt-1 text-[14px] font-semibold text-sales-text-primary">
                  No next action scheduled
                </p>
                <p className="mt-0.5 text-[12px] text-sales-text-muted">
                  This active Deal does not have another action planned.
                </p>
                {(data?.canModify ?? row?.canModify) &&
                (data?.stage ?? row?.stage) !== "WON" &&
                (data?.stage ?? row?.stage) !== "LOST" ? (
                  <Button variant="secondary" size="sm" className="mt-2" onClick={onSchedule}>
                    Schedule follow-up
                  </Button>
                ) : null}
              </>
            )}
          </Section>

          <Section>
            <div className={cn("grid gap-2", (data?.canModify ?? row?.canModify) ? "grid-cols-2" : "grid-cols-1")}>
              <Button variant="secondary" size="sm" onClick={onViewDeal}>
                View Deal
              </Button>
              {(data?.canModify ?? row?.canModify) ? (
                <Button variant="secondary" size="sm" onClick={onLogActivity}>
                  Log Activity
                </Button>
              ) : null}
            </div>
          </Section>

          <Section data-course-target="company-pipeline-health">
            <div className="flex items-center justify-between gap-2">
              <p className="text-[13px] font-semibold text-sales-text-primary">Deal Health</p>
              <Badge tone={healthTone(health)} appearance="soft">
                {data?.healthLabel ?? row?.healthLabel}
              </Badge>
            </div>
            <p className="mt-1.5 text-[12px] leading-snug text-sales-text-secondary">
              {data?.healthReason ?? row?.healthReason}
            </p>
            <Progress
              value={barPct}
              tone={healthTone(health) === "success" ? "brand" : healthTone(health)}
              className="mt-2.5"
            />
          </Section>

          <Section>
            <p className="text-[13px] font-semibold text-sales-text-primary">Deal Summary</p>
            <dl className="mt-3 space-y-3">
              <div>
                <dt className="text-[11px] text-sales-text-muted">Customer need</dt>
                <dd className="mt-0.5 text-[13px] text-sales-text-primary">
                  {data?.customerNeed || "Not added"}
                </dd>
              </div>
              <div>
                <dt className="text-[11px] text-sales-text-muted">Decision maker</dt>
                <dd className="mt-0.5 text-[13px] text-sales-text-primary">
                  {data?.decisionMakerLabel || "Not added"}
                </dd>
              </div>
              <div>
                <dt className="text-[11px] text-sales-text-muted">Products / Services</dt>
                <dd className="mt-1 flex flex-wrap gap-1.5">
                  {(data?.products ?? []).length > 0 ? (
                    data!.products.map((p) => (
                      <span
                        key={p}
                        className="inline-flex rounded-[8px] bg-sales-neutral-100 px-2 py-0.5 text-[11px] text-sales-text-secondary"
                      >
                        {p}
                      </span>
                    ))
                  ) : (
                    <span className="text-[13px] text-sales-text-muted">Not added</span>
                  )}
                </dd>
              </div>
            </dl>
          </Section>

          {clientId && (data?.id ?? row?.id) ? (
            <Section>
              <EntityDocumentsPanel
                clientId={clientId}
                entityType="DEAL"
                entityId={data?.id ?? row!.id}
                entityLabel={name}
                compact
              />
            </Section>
          ) : null}

          <div className="px-4 py-3.5 sm:px-5">
            <Link
              href={data?.viewDealHref ?? `/client/deals/${row?.id ?? ""}`}
              className="text-[13px] font-medium text-sales-text-secondary hover:text-sales-text-primary"
            >
              View full details →
            </Link>
          </div>
        </div>
      )}
    </aside>
  );

  if (overlay) {
    return (
      <>
        <button
          type="button"
          className="fixed inset-0 z-30 bg-black/30"
          aria-label="Close Deal details"
          onClick={onClose}
        />
        {body}
      </>
    );
  }

  return body;
}
