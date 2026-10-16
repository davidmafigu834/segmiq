"use client";

/* Hallmark · genre: modern-minimal · macrostructure: Workbench · design-system: design.md · designed-as-app */
/* Hallmark · pre-emit critique: P4 H4 E4 S4 R4 V4 */

import { useMemo, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import {
  Building2,
  CalendarClock,
  CalendarPlus,
  FileCheck2,
  Handshake,
  Home,
  Landmark,
  MessageSquareText,
  PhoneCall,
  Search,
  ShieldCheck,
  UserPlus,
  UsersRound,
} from "lucide-react";
import { DealSideBadge } from "@/components/real-estate/DealSideBadge";
import { RealEstateInquiryWorkspace } from "@/components/real-estate/RealEstateInquiryWorkspace";
import { OfferDetailPanel } from "@/components/real-estate/offers/OfferDetailPanel";
import { ComplianceCasePanel } from "@/components/real-estate/compliance/ComplianceCasePanel";
import type { AgentReDashboard } from "@/lib/sales/get-agent-real-estate-dashboard";
import type { TransactionListRow } from "@/lib/real-estate/transaction-service";
import type { OfferAttentionReason } from "@/lib/real-estate/offers";
import { rePipelineStageLabel } from "@/lib/real-estate/pipeline";
import { reTransactionStatusLabel } from "@/lib/real-estate/transactions";
import type { PriorityItem } from "@/lib/real-estate/priority";
import {
  ReActionMenu,
  ReEmptyState,
  ReErrorState,
  ReFigureList,
  ReGroupLabel,
  ReList,
  ReMetricGrid,
  RePageHeader,
  RePartialNotice,
  ReQuickActions,
  ReRowAction,
  ReSection,
  ReSkeletonRows,
  ReStatCard,
  ReStatusBadge,
  ReViewAll,
  ReWorkItem,
  useReFetch,
  type ReAction,
  type ReUrgency,
} from "@/components/real-estate/ui";

const ATTENTION_PREVIEW = 8;

type BuyerPriority = { id: string; title: string; detail: string; action: string };

type BuyerMetrics = {
  incomplete: boolean;
  metrics: {
    activeBuyers: number;
    activeTenants: number;
    newSearches: number;
    viewingsScheduled: number;
    offersInProgress: number;
    followUpDue: number;
  };
};

type AcquisitionOverview = {
  incomplete: boolean;
  summary: { active: number; inProgress: number; overdue: number; lost: number; converted: number };
  attention: Array<{ id: string; label: string; reason: string }>;
};

type TransactionsPayload = { rows?: TransactionListRow[]; counts?: Record<string, number> };

type AttentionGroup = "overdue" | "today" | "awaiting" | "opportunity";

const GROUP_LABEL: Record<AttentionGroup, string> = {
  overdue: "Overdue",
  today: "Due today",
  awaiting: "Waiting on a decision",
  opportunity: "Opportunities",
};

const GROUP_ORDER: AttentionGroup[] = ["overdue", "today", "awaiting", "opportunity"];

const GROUP_URGENCY: Record<AttentionGroup, ReUrgency> = {
  overdue: "overdue",
  today: "today",
  awaiting: "awaiting",
  opportunity: "opportunity",
};

type AttentionEntry = {
  key: string;
  group: AttentionGroup;
  icon: ReactNode;
  title: string;
  reason: string;
  meta?: ReactNode;
  statusLabel: string;
  action: { label: string; onClick?: () => void; href?: string };
  menu: ReAction[];
};

function inquiryGroup(item: PriorityItem): AttentionGroup {
  switch (item.reasonId) {
    case "overdue_follow_up":
      return item.why.startsWith("Overdue") ? "overdue" : "today";
    case "stale_inquiry":
      return "overdue";
    case "qualified_no_match":
      return "opportunity";
    default:
      return "today";
  }
}

function offerGroup(reason: OfferAttentionReason): AttentionGroup {
  if (reason === "stale_negotiation") return "overdue";
  if (reason === "awaiting_seller") return "awaiting";
  return "today";
}

function timeLabel(iso: string): string {
  return new Date(iso).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
}

/** Date-only follow-ups are stored as midday; treat them as "any time today". */
function followUpTime(dueAt: string): string | null {
  if (!dueAt.includes("T")) return null;
  const d = new Date(dueAt);
  if (Number.isNaN(d.getTime())) return null;
  if (d.getHours() === 12 && d.getMinutes() === 0) return null;
  return timeLabel(dueAt);
}

function todayLabel(): string {
  return new Date().toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" });
}

export function AgentDailyWorkspace({
  clientId,
  data,
  onAddInquiry,
  onLogCall,
  copilot,
}: {
  clientId: string;
  firstName?: string;
  data: AgentReDashboard;
  onAddInquiry?: () => void;
  onLogCall?: () => void;
  /** Sales Copilot board, rendered as its own section below the work. */
  copilot?: ReactNode;
}) {
  const router = useRouter();
  const [openLeadId, setOpenLeadId] = useState<string | null>(null);
  const [openOfferId, setOpenOfferId] = useState<string | null>(null);
  const [openCaseId, setOpenCaseId] = useState<string | null>(null);
  const [completingId, setCompletingId] = useState<string | null>(null);
  const [showAllAttention, setShowAllAttention] = useState(false);

  const buyerReports = useReFetch<{ priorities?: BuyerPriority[] }>(`/api/clients/${clientId}/buyer-reports`);
  const buyerMetrics = useReFetch<BuyerMetrics>(`/api/clients/${clientId}/buyer-searches?metrics=1`);
  const acquisitions = useReFetch<AcquisitionOverview>(`/api/clients/${clientId}/acquisitions/overview`);
  const transactions = useReFetch<TransactionsPayload>(`/api/clients/${clientId}/transactions?tab=active`);
  const buyerPriorities = buyerReports.status === "ready" ? buyerReports.data.priorities ?? [] : null;

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

  const attention = useMemo<AttentionEntry[]>(() => {
    const entries: AttentionEntry[] = [];

    for (const item of data.priorities) {
      const group = inquiryGroup(item);
      const followUp = item.reasonId === "overdue_follow_up" || item.reasonId === "viewing_awaiting_follow_up";
      entries.push({
        key: `inquiry-${item.id}`,
        group,
        icon: <MessageSquareText />,
        title: item.name,
        reason: item.why,
        meta: (
          <>
            <DealSideBadge dealSide={item.dealSide} />
            <span>{rePipelineStageLabel(item.stage)}</span>
            {item.nextLabel ? <span>Next: {item.nextLabel}</span> : null}
          </>
        ),
        statusLabel: group === "opportunity" ? "Needs a match" : GROUP_LABEL[group],
        action: {
          label: item.actionId === "find_matches" ? "Find matches" : "Open inquiry",
          onClick: () => setOpenLeadId(item.id),
        },
        menu: followUp
          ? [
              {
                id: "done",
                label: completingId === item.id ? "Saving…" : "Mark follow-up done",
                icon: <FileCheck2 />,
                disabled: completingId != null,
                onSelect: () => void completeFollowUp(item.id),
              },
            ]
          : [],
      });
    }

    const attentionOfferIds = new Set(data.offersNeedingAttention.map((o) => o.id));
    for (const offer of data.offersNeedingAttention) {
      const group = offerGroup(offer.reason);
      entries.push({
        key: `offer-${offer.id}`,
        group,
        icon: <Handshake />,
        title: offer.buyerName ?? "Buyer",
        reason: offer.why,
        meta: (
          <>
            <span className="min-w-0 truncate">{offer.propertyLabel}</span>
            {offer.amountLabel ? <span className="tabular-nums">{offer.amountLabel}</span> : null}
            {offer.updatedLabel ? <span>Updated {offer.updatedLabel}</span> : null}
          </>
        ),
        statusLabel: offer.reason === "counter_received" ? "Counter received" : GROUP_LABEL[group],
        action: {
          label: offer.reason === "counter_received" ? "Review counter" : "Open offer",
          onClick: () => setOpenOfferId(offer.id),
        },
        menu: offer.leadId
          ? [{ id: "lead", label: "Open buyer inquiry", icon: <MessageSquareText />, onSelect: () => setOpenLeadId(offer.leadId) }]
          : [],
      });
    }

    for (const c of data.complianceActions) {
      const upload = c.nextLabel.includes("Upload");
      entries.push({
        key: `case-${c.id}`,
        group: upload ? "today" : "awaiting",
        icon: <ShieldCheck />,
        title: c.contactName,
        reason: c.why,
        meta: <span>Compliance · {c.nextLabel}</span>,
        statusLabel: upload ? "Document needed" : "Compliance",
        action: { label: upload ? "Upload document" : "Open case", onClick: () => setOpenCaseId(c.id) },
        menu: [],
      });
    }

    for (const t of data.transactionsNeedingAttention) {
      entries.push({
        key: `txn-${t.id}`,
        group: "awaiting",
        icon: <Landmark />,
        title: t.propertyLabel,
        reason: t.why,
        meta: <span>Transaction · {reTransactionStatusLabel(t.status)}</span>,
        statusLabel: "Transaction",
        action: { label: "Open transaction", href: `/sales/transactions?open=${t.id}` },
        menu: t.leadId
          ? [{ id: "lead", label: "Open buyer inquiry", icon: <MessageSquareText />, onSelect: () => setOpenLeadId(t.leadId) }]
          : [],
      });
    }

    if (buyerPriorities) {
      for (const p of buyerPriorities) {
        if (p.id.startsWith("viewing-")) continue;
        if (p.id.startsWith("offer-")) {
          const offerId = p.id.slice("offer-".length);
          if (attentionOfferIds.has(offerId)) continue;
          entries.push({
            key: `buyer-${p.id}`,
            group: "awaiting",
            icon: <Handshake />,
            title: p.title,
            reason: p.detail,
            statusLabel: "Offer",
            action: { label: "Review offer", onClick: () => setOpenOfferId(offerId) },
            menu: [],
          });
          continue;
        }
        if (p.id.startsWith("match-")) {
          entries.push({
            key: `buyer-${p.id}`,
            group: "opportunity",
            icon: <Search />,
            title: p.title,
            reason: p.detail,
            statusLabel: "New matches",
            action: { label: "Review matches", href: `/sales/buyers/${p.id.slice("match-".length)}` },
            menu: [],
          });
          continue;
        }
        if (p.id.startsWith("follow-")) {
          entries.push({
            key: `buyer-${p.id}`,
            group: "today",
            icon: <UsersRound />,
            title: p.title,
            reason: `Buyer search · ${p.detail}`,
            statusLabel: "Due",
            action: { label: "Open search", href: `/sales/buyers/${p.id.slice("follow-".length)}` },
            menu: [],
          });
        }
      }
    }

    return GROUP_ORDER.flatMap((group) => entries.filter((e) => e.group === group));
    // completeFollowUp only closes over clientId/router; completingId drives its label.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data, buyerPriorities, completingId]);

  const shownAttention = showAllAttention ? attention : attention.slice(0, ATTENTION_PREVIEW);

  const schedule = useMemo(() => {
    type Row = { key: string; when: string; sort: string; overdue: boolean; node: ReactNode };
    const rows: Row[] = [];
    for (const v of data.viewingsToday) {
      rows.push({
        key: `v-${v.id}`,
        when: timeLabel(v.scheduledAt),
        sort: v.scheduledAt,
        overdue: false,
        node: (
          <ReWorkItem
            icon={<Home />}
            title={v.contactName ?? "Client"}
            reason={`Viewing · ${v.listingLabel}`}
            action={
              v.leadId ? (
                <ReRowAction label="Open" srContext={v.contactName ?? "viewing"} onClick={() => setOpenLeadId(v.leadId)} />
              ) : (
                <ReRowAction label="Viewings" href="/sales/viewings" />
              )
            }
          />
        ),
      });
    }
    for (const f of data.followUps) {
      const time = followUpTime(f.dueAt);
      rows.push({
        key: `f-${f.leadId}`,
        when: f.overdue ? "Overdue" : time ?? "Today",
        sort: f.overdue ? "0" : time ? f.dueAt : "~",
        overdue: f.overdue,
        node: (
          <ReWorkItem
            icon={<CalendarClock />}
            iconTone={f.overdue ? "danger" : "neutral"}
            title={f.name}
            reason={f.note ? `Follow-up · ${f.note}` : "Follow-up"}
            action={<ReRowAction label="Open" srContext={f.name} onClick={() => setOpenLeadId(f.leadId)} />}
            menu={
              <ReActionMenu
                label={`More actions for ${f.name}`}
                sheetTitle={f.name}
                actions={[
                  {
                    id: "done",
                    label: completingId === f.leadId ? "Saving…" : "Mark follow-up done",
                    icon: <FileCheck2 />,
                    disabled: completingId != null,
                    onSelect: () => void completeFollowUp(f.leadId),
                  },
                ]}
              />
            }
          />
        ),
      });
    }
    return rows.sort((a, b) => (a.overdue !== b.overdue ? (a.overdue ? -1 : 1) : a.sort.localeCompare(b.sort)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data, completingId]);

  const overdueFollowUps = data.followUps.filter((f) => f.overdue).length;
  const metrics = buyerMetrics.status === "ready" ? buyerMetrics.data.metrics : null;
  const txnRows = transactions.status === "ready" ? transactions.data.rows ?? [] : [];
  const txnTotal = transactions.status === "ready" ? transactions.data.counts?.active ?? txnRows.length : null;

  const quickActions = {
    primary: {
      id: "opportunity",
      label: "New opportunity",
      description: "Record a property you could list or rent out",
      icon: <Building2 size={16} strokeWidth={1.8} />,
      onSelect: () => router.push("/sales/acquisitions?new=1"),
    },
    secondary: [
      {
        id: "buyer",
        label: "Add buyer or tenant",
        description: "Start a buyer or rental search",
        icon: <UserPlus size={16} strokeWidth={1.8} />,
        onSelect: () => router.push("/sales/buyers?new=1"),
      },
      ...(onAddInquiry
        ? [
            {
              id: "inquiry",
              label: "Add inquiry",
              description: "Capture a new property inquiry",
              icon: <MessageSquareText size={16} strokeWidth={1.8} />,
              onSelect: onAddInquiry,
            },
          ]
        : []),
      {
        id: "match",
        label: "Find properties",
        description: "Match buyer searches to available stock",
        icon: <Search size={16} strokeWidth={1.8} />,
        onSelect: () => router.push("/sales/matching"),
      },
      {
        id: "viewing",
        label: "Schedule viewing",
        description: "Viewings are booked from a buyer search",
        icon: <CalendarPlus size={16} strokeWidth={1.8} />,
        onSelect: () => router.push("/sales/buyers"),
      },
      ...(onLogCall
        ? [
            {
              id: "call",
              label: "Log call",
              description: "Record a call against an inquiry",
              icon: <PhoneCall size={16} strokeWidth={1.8} />,
              onSelect: onLogCall,
            },
          ]
        : []),
    ],
  };

  const attentionCount = attention.length;

  return (
    <div className="space-y-[var(--re-section-gap,16px)]">
      <RePageHeader
        context={todayLabel()}
        title={
          <>
            <span className="sm:hidden">My day</span>
            <span className="hidden sm:inline">Today&apos;s work</span>
          </>
        }
        description={
          attentionCount > 0
            ? `${attentionCount} ${attentionCount === 1 ? "item needs" : "items need"} your next action.`
            : buyerReports.status === "loading"
              ? "Checking what needs your next action."
              : "Nothing needs your next action right now."
        }
        actions={<ReQuickActions primary={quickActions.primary} secondary={quickActions.secondary} sheetTitle="New" />}
      />

      <div className="grid grid-cols-1 items-start gap-[var(--re-section-gap,16px)] layout:grid-cols-12">
        <ReSection
          id="re-agent-attention"
          title="Needs your attention"
          description="Important customers, properties and deals that need your next action."
          count={attentionCount}
          className="layout:col-span-8"
          flush
          action={<ReViewAll href="/sales/pipeline" label="Pipeline" />}
        >
          {buyerReports.status === "error" ? (
            <RePartialNotice>
              Buyer search reminders didn&apos;t load, so this list may be missing some items.{" "}
              <button type="button" className="re-focus rounded-[4px] font-semibold underline" onClick={buyerReports.reload}>
                Try again
              </button>
            </RePartialNotice>
          ) : null}
          {attention.length === 0 ? (
            buyerReports.status === "loading" ? (
              <ReSkeletonRows rows={3} label="Loading your priorities" />
            ) : (
              <ReEmptyState
                title="Nothing needs your attention right now"
                description="New inquiries, offers waiting on you and overdue follow-ups will show here as they come in."
              />
            )
          ) : (
            <>
              <ReList label="Items that need your attention">
                {GROUP_ORDER.map((group) => {
                  const items = shownAttention.filter((e) => e.group === group);
                  if (items.length === 0) return null;
                  const total = attention.filter((e) => e.group === group).length;
                  return [
                    <ReGroupLabel key={`label-${group}`} count={total}>
                      {GROUP_LABEL[group]}
                    </ReGroupLabel>,
                    ...items.map((entry) => (
                      <ReWorkItem
                        key={entry.key}
                        icon={entry.icon}
                        iconTone={group === "overdue" ? "danger" : group === "today" ? "warning" : "neutral"}
                        title={entry.title}
                        reason={entry.reason}
                        meta={entry.meta}
                        status={<ReStatusBadge label={entry.statusLabel} urgency={GROUP_URGENCY[group]} />}
                        action={
                          <ReRowAction
                            label={entry.action.label}
                            srContext={entry.title}
                            onClick={entry.action.onClick}
                            href={entry.action.href}
                          />
                        }
                        menu={
                          entry.menu.length > 0 ? (
                            <ReActionMenu label={`More actions for ${entry.title}`} sheetTitle={entry.title} actions={entry.menu} />
                          ) : null
                        }
                      />
                    )),
                  ];
                })}
              </ReList>
              {attention.length > ATTENTION_PREVIEW ? (
                <div className="border-t border-sales-border-subtle px-[var(--re-card-pad,16px)] py-2">
                  <button
                    type="button"
                    aria-expanded={showAllAttention}
                    aria-controls="re-agent-attention"
                    onClick={() => setShowAllAttention((v) => !v)}
                    className="re-focus inline-flex min-h-11 items-center rounded-[var(--re-radius-control,8px)] px-2 text-[13px] font-semibold text-sales-text-primary hover:bg-sales-surface-hover sm:min-h-9"
                  >
                    {showAllAttention ? "Show fewer" : `Show all ${attention.length}`}
                  </button>
                </div>
              ) : null}
            </>
          )}
        </ReSection>

        <div className="layout:order-first layout:col-span-12">
          <h2 className="sr-only">My sales snapshot</h2>
          <ReMetricGrid label="My sales snapshot">
            <ReStatCard label="New inquiries" value={data.summary.newInquiries} supporting="Received today" href="/sales/leads" />
            <ReStatCard
              label="Follow-ups due"
              value={data.summary.followUpsDue}
              supporting={overdueFollowUps > 0 ? `${overdueFollowUps} overdue` : "Due today"}
              href="/sales/tasks"
              attention={overdueFollowUps > 0}
            />
            <ReStatCard label="Viewings today" value={data.summary.viewingsToday} supporting="Scheduled" href="/sales/viewings" />
            <ReStatCard
              label="Offers in progress"
              value={metrics?.offersInProgress ?? null}
              supporting="Submitted or negotiating"
              href="/sales/offers"
              state={buyerMetrics.status}
              info="Offers where you are the buyer's agent or the listing agent."
            />
          </ReMetricGrid>
        </div>

        <ReSection
          id="re-agent-schedule"
          title="Today's schedule"
          count={schedule.length}
          className="layout:col-span-4"
          flush
          action={<ReViewAll href="/sales/calendar" label="Calendar" />}
        >
          {schedule.length === 0 ? (
            <ReEmptyState
              title="Nothing scheduled today"
              description="Viewings and follow-ups due today appear here in time order."
              compact
            />
          ) : (
            <ul aria-label="Today's schedule" className="divide-y divide-sales-border-subtle">
              {schedule.map((row) => (
                <li key={row.key} className="grid grid-cols-[56px_minmax(0,1fr)] items-start">
                  <span
                    className={
                      row.overdue
                        ? "pl-[var(--re-card-pad,16px)] pt-[22px] text-[12px] font-semibold text-sales-danger-fg"
                        : "pl-[var(--re-card-pad,16px)] pt-[22px] text-[12px] font-semibold tabular-nums text-sales-text-secondary"
                    }
                  >
                    {row.when}
                  </span>
                  <ul className="min-w-0">{row.node}</ul>
                </li>
              ))}
            </ul>
          )}
        </ReSection>

        <div className="layout:col-span-12">
          <h2 className="mb-3 text-[15px] font-semibold tracking-[-0.01em] text-sales-text-primary">My active work</h2>
          <div className="grid grid-cols-1 items-start gap-[var(--re-section-gap,16px)] md:grid-cols-2 xl:grid-cols-3">
            <ReSection
              id="re-agent-buyers"
              title="Buyers & tenants"
              action={<ReViewAll href="/sales/buyers" />}
            >
              {buyerMetrics.status === "loading" ? (
                <div className="-mx-[var(--re-card-pad,16px)]">
                  <ReSkeletonRows rows={2} label="Loading buyer searches" />
                </div>
              ) : buyerMetrics.status === "error" ? (
                <div className="-mx-[var(--re-card-pad,16px)]">
                  <ReErrorState onRetry={buyerMetrics.reload} />
                </div>
              ) : metrics ? (
                <>
                  <ReFigureList
                    items={[
                      { label: "Active buyers", value: metrics.activeBuyers, href: "/sales/buyers" },
                      { label: "Active tenants", value: metrics.activeTenants, href: "/sales/buyers" },
                      { label: "Follow-ups due", value: metrics.followUpDue, tone: "attention" },
                      { label: "New this week", value: metrics.newSearches },
                    ]}
                  />
                  <p className="mt-3 text-[12px] leading-snug text-sales-text-muted">
                    People are counted once per search type. New this week counts searches.
                  </p>
                  {buyerMetrics.data.incomplete ? (
                    <p className="mt-2 text-[12px] text-sales-warning-fg">Some searches could not be counted.</p>
                  ) : null}
                </>
              ) : null}
            </ReSection>

            <ReSection
              id="re-agent-opportunities"
              title="Property opportunities"
              count={acquisitions.status === "ready" ? acquisitions.data.summary.active : null}
              flush
              action={<ReViewAll href="/sales/acquisitions" />}
            >
              {acquisitions.status === "loading" ? (
                <ReSkeletonRows rows={2} label="Loading property opportunities" />
              ) : acquisitions.status === "error" ? (
                <ReErrorState onRetry={acquisitions.reload} />
              ) : acquisitions.data.attention.length === 0 ? (
                <ReEmptyState
                  compact
                  title={acquisitions.data.summary.active === 0 ? "No active opportunities" : "Every opportunity has a next step"}
                  description={
                    acquisitions.data.summary.active === 0
                      ? "Record a property you could list to start tracking it here."
                      : `${acquisitions.data.summary.inProgress} in progress.`
                  }
                />
              ) : (
                <ReList label="Opportunities that need a next step">
                  {acquisitions.data.attention.slice(0, 4).map((row) => (
                    <ReWorkItem
                      key={row.id}
                      icon={<Building2 />}
                      iconTone={row.reason === "Overdue follow-up" ? "danger" : "neutral"}
                      title={row.label}
                      reason={row.reason}
                      action={<ReRowAction label="Open" srContext={row.label} href={`/sales/acquisitions/${row.id}`} />}
                    />
                  ))}
                </ReList>
              )}
              {acquisitions.status === "ready" && acquisitions.data.incomplete ? (
                <RePartialNotice>Some opportunities could not be loaded.</RePartialNotice>
              ) : null}
            </ReSection>

            <ReSection
              id="re-agent-transactions"
              title="Transactions in progress"
              count={txnTotal}
              flush
              className="md:col-span-2 xl:col-span-1"
              action={<ReViewAll href="/sales/transactions" />}
            >
              {transactions.status === "loading" ? (
                <ReSkeletonRows rows={2} label="Loading transactions" />
              ) : transactions.status === "error" ? (
                <ReErrorState onRetry={transactions.reload} />
              ) : txnRows.length === 0 ? (
                <ReEmptyState compact title="No transactions in progress" description="Accepted offers move here once a transaction is opened." />
              ) : (
                <ReList label="Transactions in progress">
                  {txnRows.slice(0, 4).map((row) => (
                    <ReWorkItem
                      key={row.id}
                      icon={<Landmark />}
                      title={row.propertyLabel}
                      reason={row.buyerName ? `With ${row.buyerName}` : undefined}
                      status={<ReStatusBadge label={row.statusLabel} tone="neutral" />}
                      meta={
                        row.milestonesTotal > 0 ? (
                          <span className="tabular-nums">
                            {row.milestonesDone} of {row.milestonesTotal} steps done
                          </span>
                        ) : null
                      }
                      action={<ReRowAction label="Open" srContext={row.propertyLabel} href={`/sales/transactions?open=${row.id}`} />}
                    />
                  ))}
                </ReList>
              )}
            </ReSection>
          </div>
        </div>

        {copilot ? <div className="min-w-0 layout:col-span-12">{copilot}</div> : null}
      </div>

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