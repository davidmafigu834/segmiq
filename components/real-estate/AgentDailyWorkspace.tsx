"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { DealSideBadge } from "@/components/real-estate/DealSideBadge";
import { RealEstateInquiryWorkspace } from "@/components/real-estate/RealEstateInquiryWorkspace";
import { KpiCard, CardShell } from "@/components/dashboard/sales/KpiCard";
import type { AgentReDashboard } from "@/lib/sales/get-agent-real-estate-dashboard";
import { OfferDetailPanel } from "@/components/real-estate/offers/OfferDetailPanel";
import { ComplianceCasePanel } from "@/components/real-estate/compliance/ComplianceCasePanel";
import { rePipelineStageLabel } from "@/lib/real-estate/pipeline";
import type { PriorityReasonId } from "@/lib/real-estate/priority";
import { cn } from "@/lib/ui/cn";

const PRIORITY_LIMIT = 6;
const SIDE_LIMIT = 5;

function nameInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
  return `${parts[0]![0] ?? ""}${parts[1]![0] ?? ""}`.toUpperCase();
}

function whyTone(reasonId: PriorityReasonId): string {
  if (reasonId === "overdue_follow_up" || reasonId === "stale_inquiry") {
    return "bg-sales-danger-soft text-sales-danger-fg";
  }
  if (reasonId === "viewing_today" || reasonId === "viewing_awaiting_follow_up") {
    return "bg-sales-warning-soft text-sales-warning-fg";
  }
  if (reasonId === "new_uncontacted") {
    return "bg-sales-info-soft text-sales-info-fg";
  }
  return "bg-sales-neutral-100 text-sales-text-secondary";
}

function RowAction({
  label,
  onClick,
  primary,
}: {
  label: string;
  onClick: () => void;
  primary?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "dashboard-action-btn inline-flex min-h-9 items-center justify-center rounded-sales-md px-2.5 text-[12px] font-semibold",
        primary
          ? "dashboard-action-btn--next text-sales-text-primary hover:bg-sales-surface-hover"
          : "text-sales-text-primary hover:bg-sales-surface-hover"
      )}
    >
      {label}
    </button>
  );
}

function EmptyLine({ children }: { children: string }) {
  return (
    <div className="px-5 py-5 text-center">
      <p className="text-[13px] font-medium text-sales-text-primary">{children}</p>
    </div>
  );
}

export function AgentDailyWorkspace({
  clientId,
  data,
}: {
  clientId: string;
  firstName?: string;
  data: AgentReDashboard;
}) {
  const router = useRouter();
  const [openLeadId, setOpenLeadId] = useState<string | null>(null);
  const [openOfferId, setOpenOfferId] = useState<string | null>(null);
  const [openCaseId, setOpenCaseId] = useState<string | null>(null);
  const [completingId, setCompletingId] = useState<string | null>(null);

  const priorities = data.priorities.slice(0, PRIORITY_LIMIT);
  const viewings = data.viewingsToday.slice(0, SIDE_LIMIT);
  const followUps = data.followUps.slice(0, SIDE_LIMIT);
  const offers = data.offersNeedingAttention.slice(0, SIDE_LIMIT);
  const cases = data.complianceActions.slice(0, SIDE_LIMIT);

  async function completeFollowUp(leadId: string) {
    setCompletingId(leadId);
    try {
      await fetch(`/api/clients/${clientId}/leads/${leadId}/real-estate`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ follow_up_date: null }),
      });
      router.refresh();
    } finally {
      setCompletingId(null);
    }
  }

  return (
    <div className="space-y-3">
      <div className="dashboard-group relative z-[1] grid grid-cols-2 gap-3 min-[900px]:grid-cols-4">
        <KpiCard
          item={{
            id: "new",
            label: "New inquiries",
            value: String(data.summary.newInquiries),
            supporting: "Today",
            icon: "enquiries",
            href: "/sales/call-now",
          }}
        />
        <KpiCard
          item={{
            id: "followups",
            label: "Follow-ups due",
            value: String(data.summary.followUpsDue),
            supporting: "Today",
            icon: "followups",
            href: "/sales/tasks",
          }}
        />
        <KpiCard
          item={{
            id: "viewings",
            label: "Viewings today",
            value: String(data.summary.viewingsToday),
            supporting: "Scheduled",
            icon: "customers",
            href: "/sales/calendar",
          }}
        />
        <KpiCard
          item={{
            id: "attention",
            label: "Needs attention",
            value: String(data.summary.needingAttention),
            supporting: "Priority work",
            icon: "deals",
            href: "/sales/pipeline",
          }}
        />
      </div>

      <CardShell
        title="Priority inquiries"
        className="dashboard-panel--table"
        action={
          <Link
            href="/sales/pipeline"
            className="text-[12px] font-medium text-sales-text-secondary transition-colors hover:text-sales-text-primary"
          >
            View pipeline
          </Link>
        }
      >
        {priorities.length === 0 ? (
          <EmptyLine>Nothing queued right now.</EmptyLine>
        ) : (
          <>
            <div className="hidden w-full md:block">
              <table className="dashboard-table w-full table-fixed text-left">
                <colgroup>
                  <col className="w-[32%]" />
                  <col className="w-[28%]" />
                  <col className="w-[22%]" />
                  <col className="w-[18%]" />
                </colgroup>
                <thead>
                  <tr className="border-b border-sales-border-subtle bg-sales-surface-subtle text-[10px] font-semibold uppercase tracking-[0.08em] text-sales-text-muted">
                    <th className="px-5 py-2.5 font-semibold">Customer</th>
                    <th className="px-3 py-2.5 font-semibold">Why</th>
                    <th className="px-3 py-2.5 font-semibold">Next</th>
                    <th className="px-5 py-2.5 font-semibold">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[rgba(125,148,194,0.07)]">
                  {priorities.map((item) => (
                    <tr key={item.id} className="dashboard-list-row h-[54px]">
                      <td className="px-5 py-2">
                        <div className="flex min-w-0 items-center gap-2.5">
                          <span
                            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[var(--sales-neutral-100)] text-[10px] font-semibold text-sales-text-secondary"
                            aria-hidden
                          >
                            {nameInitials(item.name)}
                          </span>
                          <div className="min-w-0">
                            <p className="truncate text-[13px] font-semibold text-sales-text-primary">
                              {item.name}
                            </p>
                            <div className="mt-0.5 flex items-center gap-1.5">
                              <DealSideBadge dealSide={item.dealSide} />
                              <p className="truncate text-[11px] text-sales-text-muted">
                                {rePipelineStageLabel(item.stage)}
                              </p>
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="px-3 py-2">
                        <span
                          className={cn(
                            "inline-flex max-w-full truncate rounded-sales-sm px-1.5 py-0.5 text-[11px] font-semibold",
                            whyTone(item.reasonId)
                          )}
                        >
                          {item.why}
                        </span>
                      </td>
                      <td className="px-3 py-2 text-[12px] text-sales-text-secondary">{item.nextLabel}</td>
                      <td className="px-5 py-2">
                        <RowAction
                          label={item.actionId === "find_matches" ? "Find matches" : "Open"}
                          primary={item.actionId === "find_matches" || item.actionId === "contact"}
                          onClick={() => setOpenLeadId(item.id)}
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <ul className="divide-y divide-sales-border-subtle md:hidden">
              {priorities.map((item) => (
                <li key={item.id} className="flex items-center justify-between gap-3 px-4 py-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5">
                      <p className="truncate text-[13px] font-semibold text-sales-text-primary">{item.name}</p>
                      <DealSideBadge dealSide={item.dealSide} />
                    </div>
                    <p className="mt-0.5 truncate text-[12px] text-sales-text-secondary">{item.why}</p>
                  </div>
                  <RowAction
                    label={item.actionId === "find_matches" ? "Match" : "Open"}
                    primary
                    onClick={() => setOpenLeadId(item.id)}
                  />
                </li>
              ))}
            </ul>
          </>
        )}
      </CardShell>

      <div className="grid grid-cols-1 items-start gap-3 lg:grid-cols-2">
        <CardShell
          title="Today’s viewings"
          action={
            <Link
              href="/sales/calendar"
              className="text-[12px] font-medium text-sales-text-secondary transition-colors hover:text-sales-text-primary"
            >
              Calendar
            </Link>
          }
        >
          {viewings.length === 0 ? (
            <EmptyLine>No viewings scheduled today.</EmptyLine>
          ) : (
            <ul className="divide-y divide-sales-border-subtle">
              {viewings.map((v) => (
                <li key={v.id} className="flex h-[52px] items-center justify-between gap-3 px-5">
                  <div className="min-w-0">
                    <p className="truncate text-[13px] font-semibold text-sales-text-primary">
                      {v.contactName ?? "Client"}
                    </p>
                    <p className="truncate text-[11px] text-sales-text-muted">
                      {new Date(v.scheduledAt).toLocaleTimeString("en-GB", {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                      {" · "}
                      {v.listingLabel}
                    </p>
                  </div>
                  {v.leadId ? (
                    <RowAction label="Open" onClick={() => setOpenLeadId(v.leadId)} />
                  ) : (
                    <Link
                      href="/sales/listings"
                      className="dashboard-action-btn inline-flex min-h-9 items-center rounded-sales-md px-2.5 text-[12px] font-semibold text-sales-text-primary hover:bg-sales-surface-hover"
                    >
                      Listing
                    </Link>
                  )}
                </li>
              ))}
            </ul>
          )}
        </CardShell>

        <CardShell
          title="Follow-ups due"
          action={
            <Link
              href="/sales/tasks"
              className="text-[12px] font-medium text-sales-text-secondary transition-colors hover:text-sales-text-primary"
            >
              Tasks
            </Link>
          }
        >
          {followUps.length === 0 ? (
            <EmptyLine>No follow-ups due today.</EmptyLine>
          ) : (
            <ul className="divide-y divide-sales-border-subtle">
              {followUps.map((f) => (
                <li key={f.leadId} className="flex h-[52px] items-center justify-between gap-3 px-5">
                  <div className="min-w-0">
                    <p className="truncate text-[13px] font-semibold text-sales-text-primary">{f.name}</p>
                    <p
                      className={cn(
                        "truncate text-[11px]",
                        f.overdue ? "font-medium text-sales-danger-fg" : "text-sales-text-muted"
                      )}
                    >
                      {f.overdue ? "Overdue" : "Due today"}
                      {f.note ? ` · ${f.note}` : ""}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-1">
                    <RowAction
                      label={completingId === f.leadId ? "…" : "Done"}
                      onClick={() => void completeFollowUp(f.leadId)}
                    />
                    <RowAction label="Open" primary onClick={() => setOpenLeadId(f.leadId)} />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardShell>
      </div>

      {offers.length > 0 || cases.length > 0 ? (
        <div className="grid grid-cols-1 items-start gap-3 lg:grid-cols-2">
          {offers.length > 0 ? (
            <CardShell
              title="Offers needing attention"
              action={
                <Link
                  href="/sales/offers"
                  className="text-[12px] font-medium text-sales-text-secondary transition-colors hover:text-sales-text-primary"
                >
                  All offers
                </Link>
              }
            >
              <ul className="divide-y divide-sales-border-subtle">
                {offers.map((o) => (
                  <li key={o.id} className="flex h-[52px] items-center justify-between gap-3 px-5">
                    <div className="min-w-0">
                      <p className="truncate text-[13px] font-semibold text-sales-text-primary">
                        {o.buyerName ?? "Buyer"}
                      </p>
                      <p className="truncate text-[11px] text-sales-text-muted">
                        {o.why}
                        {o.amountLabel ? ` · ${o.amountLabel}` : ""}
                      </p>
                    </div>
                    <RowAction
                      label={o.reason === "counter_received" ? "Review" : "Open"}
                      primary
                      onClick={() => setOpenOfferId(o.id)}
                    />
                  </li>
                ))}
              </ul>
            </CardShell>
          ) : null}

          {cases.length > 0 ? (
            <CardShell title="Compliance">
              <ul className="divide-y divide-sales-border-subtle">
                {cases.map((c) => (
                  <li key={c.id} className="flex h-[52px] items-center justify-between gap-3 px-5">
                    <div className="min-w-0">
                      <p className="truncate text-[13px] font-semibold text-sales-text-primary">{c.contactName}</p>
                      <p className="truncate text-[11px] text-sales-text-muted">{c.why}</p>
                    </div>
                    <RowAction
                      label={c.nextLabel.includes("Upload") ? "Upload" : "Open"}
                      primary
                      onClick={() => setOpenCaseId(c.id)}
                    />
                  </li>
                ))}
              </ul>
            </CardShell>
          ) : null}
        </div>
      ) : null}

      {openLeadId ? (
        <RealEstateInquiryWorkspace
          clientId={clientId}
          leadId={openLeadId}
          onClose={() => setOpenLeadId(null)}
          onCall={() => undefined}
          onWhatsApp={() => undefined}
          overlay
          stacked
        />
      ) : null}

      {openOfferId ? (
        <OfferDetailPanel
          clientId={clientId}
          offerId={openOfferId}
          complianceHref={null}
          onClose={() => setOpenOfferId(null)}
          onChanged={() => router.refresh()}
        />
      ) : null}

      {openCaseId ? (
        <ComplianceCasePanel
          clientId={clientId}
          caseId={openCaseId}
          onClose={() => setOpenCaseId(null)}
          onChanged={() => router.refresh()}
        />
      ) : null}
    </div>
  );
}
