"use client";

/* Hallmark · genre: modern-minimal · macrostructure: Workbench · design-system: design.md · designed-as-app */
/* Hallmark · pre-emit critique: P4 H4 E4 S4 R4 V4 */

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Building2, CalendarPlus, Landmark, MapPin, MessageSquareText, UserPlus, Users } from "lucide-react";
import { CompanyDashboardHeader } from "@/components/dashboard/company/CompanyDashboardHeader";
import { CompanyTeamCalendarCard } from "@/components/dashboard/company/CompanyTeamCalendarCard";
import { CompanyFocusAreasCard } from "@/components/dashboard/company/CompanyFocusAreasCard";
import { CompanyFunnelCard } from "@/components/dashboard/company/CompanyFunnelCard";
import { CompanyTeamPerformanceCard } from "@/components/dashboard/company/CompanyTeamPerformanceCard";
import { CompanyDailyTeamReportCard } from "@/components/dashboard/company/CompanyDailyTeamReportCard";
import { CompanyWeeklyReportCardContainer } from "@/components/dashboard/company/CompanyWeeklyReportCard";
import { CompanyLeadSourcesCard } from "@/components/dashboard/company/CompanyLeadSourcesCard";
import { CompanyPipelineSnapshotCard } from "@/components/dashboard/company/CompanyPipelineSnapshotCard";
import { CompanyDealsAtRiskCard } from "@/components/dashboard/company/CompanyDealsAtRiskCard";
import { CompanyRevenueTrendCard } from "@/components/dashboard/company/CompanyRevenueTrendCard";
import { CompanyRecentActivityCard } from "@/components/dashboard/company/CompanyRecentActivityCard";
import { ReAgentOvernightBanner, ReAgentTeamVisibilityTable } from "@/components/dashboard/company/agent/ReAgentOvernightBanner";
import type { CompanySalesDashboardData } from "@/components/dashboard/company/types";
import { useAddHubSheet } from "@/components/sales/AddToHubSheet";
import type { TransactionListRow } from "@/lib/real-estate/transaction-service";
import type { DemandGap } from "@/lib/real-estate/buyer-match";
import { relativeTimeLabel } from "@/lib/real-estate/offers";
import type { UserRole } from "@/types";
import {
  ReDetailList,
  ReEmptyState,
  ReErrorState,
  ReFigureList,
  ReList,
  ReMetricGrid,
  RePartialNotice,
  ReQuickActions,
  ReRowAction,
  ReSection,
  ReSheet,
  ReSkeletonRows,
  ReStatCard,
  ReStatusBadge,
  ReViewAll,
  ReWorkItem,
  useReFetch,
  type ReFetchState,
} from "@/components/real-estate/ui";
import { AgencyAttentionPanel, useAgencyAttention, type AgencyAttentionPayload } from "./AgencyAttention";

type AcquisitionOverview = {
  incomplete: boolean;
  summary: { active: number; inProgress: number; overdue: number; lost: number; converted: number };
};

type OperationsReport = {
  incomplete: boolean;
  activeSearches: number;
  pausedSearches: number;
  searchesWithoutNextAction: number;
  agents: Array<{ agentId: string; searches: number; overdue: number }>;
};

type DemandReport = { incomplete: boolean; definition: string; gaps: DemandGap[] };

type TransactionsPayload = { rows?: TransactionListRow[]; counts?: Record<string, number> };

type CommissionTotals = {
  projectedCents: number;
  verifiedReceivedCents: number;
  approvedCents: number;
  outstandingPayableCents: number;
  paidCents: number;
  legacyUnverifiedCents: number;
  definition: string;
};

type CommissionPayload = {
  finance: boolean;
  scope: "organisation" | "own_allocations";
  total: number;
  incomplete: boolean;
  commissions: Array<{ currency: string | null }>;
  totals: CommissionTotals;
};

const TXN_PREVIEW = 6;
/** The attention feed returns at most this many rows per type. */
const ATTENTION_TYPE_LIMIT = 20;

function kpiValue(data: CompanySalesDashboardData, id: string) {
  return data.kpis.find((k) => k.id === id) ?? null;
}

function countPrefix(state: ReFetchState<AgencyAttentionPayload>, prefix: string): string | null {
  if (state.status !== "ready") return null;
  const n = (state.data.items ?? []).filter((i) => i.id.startsWith(`${prefix}-`)).length;
  return n >= ATTENTION_TYPE_LIMIT ? `${n}+` : String(n);
}

function money(cents: number, currency: string | null): string {
  const value = (Number(cents) || 0) / 100;
  const amount = value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return currency ? `${currency} ${amount}` : amount;
}

function todayLabel(): string {
  return new Date().toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" });
}

function DemoNote() {
  return <ReEmptyState compact title="Live agency data isn't shown in the demo" />;
}

export function AgencyOverview({
  data,
  unreadNotifications,
  notificationRole,
  userName,
  avatarUrl,
  fictional = false,
}: {
  data: CompanySalesDashboardData;
  unreadNotifications: number;
  notificationRole: UserRole;
  userName: string;
  avatarUrl?: string | null;
  fictional?: boolean;
}) {
  const router = useRouter();
  const live = !fictional;
  const base = `/api/clients/${data.clientId}`;
  const attention = useAgencyAttention(data.clientId, live);
  const acquisitions = useReFetch<AcquisitionOverview>(live ? `${base}/acquisitions/overview` : null);
  const operations = useReFetch<OperationsReport>(live ? `${base}/buyer-reports?report=operations` : null);
  const demand = useReFetch<DemandReport>(live ? `${base}/buyer-reports?report=demand` : null);
  const transactions = useReFetch<TransactionsPayload>(live ? `${base}/transactions?tab=active` : null);
  const commissions = useReFetch<CommissionPayload>(live ? `${base}/agency` : null);
  const [preview, setPreview] = useState<TransactionListRow | null>(null);

  const { openAddHubSheet, addHubSheetProps } = useAddHubSheet();
  const { hubSheet } = addHubSheetProps("direct", { realEstate: true });

  const listings = kpiValue(data, "active-listings");
  const viewings = kpiValue(data, "upcoming-viewings");
  const activeTxn = kpiValue(data, "active-transactions");
  const inquiries = kpiValue(data, "active-inquiries");
  const offers = kpiValue(data, "active-offers");
  const response = kpiValue(data, "response");

  const names = useMemo(() => {
    const map = new Map<string, string>();
    for (const m of data.team) map.set(m.id, m.name);
    for (const a of data.reAgentTeam ?? []) if (!map.has(a.agentId)) map.set(a.agentId, a.agentName);
    return map;
  }, [data.team, data.reAgentTeam]);

  const txnRows = transactions.status === "ready" ? transactions.data.rows ?? [] : [];
  const txnTotal = transactions.status === "ready" ? transactions.data.counts?.active ?? txnRows.length : null;

  const gaps = useMemo(() => {
    if (demand.status !== "ready") return [];
    return [...(demand.data.gaps ?? [])]
      .filter((g) => g.unmatchedSearchCount > 0)
      .sort((a, b) => b.unmatchedSearchCount - a.unmatchedSearchCount || b.searchCount - a.searchCount)
      .slice(0, 5);
  }, [demand.status, demand.data]);

  const workload = useMemo(() => {
    if (operations.status !== "ready") return [];
    return operations.data.agents
      .map((a) => ({
        ...a,
        name: a.agentId === "unassigned" ? "Unassigned" : names.get(a.agentId) ?? "Team member",
      }))
      .sort((a, b) => (a.agentId === "unassigned" ? 1 : b.agentId === "unassigned" ? -1 : a.name.localeCompare(b.name)));
  }, [operations.status, operations.data, names]);

  const quickActions = live
    ? {
        primary: {
          id: "inquiry",
          label: "Add inquiry",
          description: "Capture a new property inquiry",
          icon: <MessageSquareText size={16} strokeWidth={1.8} />,
          onSelect: openAddHubSheet,
        },
        secondary: [
          {
            id: "opportunity",
            label: "New property opportunity",
            description: "Record a property the agency could list",
            icon: <Building2 size={16} strokeWidth={1.8} />,
            onSelect: () => router.push("/client/acquisitions?new=1"),
          },
          {
            id: "buyer",
            label: "Add buyer or tenant",
            description: "Start a buyer or rental search",
            icon: <UserPlus size={16} strokeWidth={1.8} />,
            onSelect: () => router.push("/client/buyers?new=1"),
          },
          {
            id: "viewing",
            label: "Schedule viewing",
            description: "Opens the agency viewings page",
            icon: <CalendarPlus size={16} strokeWidth={1.8} />,
            onSelect: () => router.push("/client/viewings"),
          },
          {
            id: "team",
            label: "Add team member",
            description: "Invite an agent to the workspace",
            icon: <Users size={16} strokeWidth={1.8} />,
            onSelect: () => router.push("/client/team?invite=1"),
          },
        ],
      }
    : null;

  return (
    <>
      <CompanyDashboardHeader
        unreadNotifications={unreadNotifications}
        notificationRole={notificationRole}
        userName={userName}
        avatarUrl={avatarUrl}
        canAddLead={live}
        fictional={fictional}
        breadcrumb="Agency / Overview"
        title="Agency overview"
        description={`${data.clientName} · ${todayLabel()}`}
        primaryAction={null}
        titleActions={
          quickActions ? (
            <ReQuickActions primary={quickActions.primary} secondary={quickActions.secondary} sheetTitle="New" />
          ) : null
        }
      />

      {data.reAgentOvernight ? <ReAgentOvernightBanner summary={data.reAgentOvernight} /> : null}

      <div className="grid grid-cols-1 items-start gap-[var(--re-section-gap,16px)] layout:grid-cols-12">
        {live ? (
          <AgencyAttentionPanel state={attention} className="layout:order-2 layout:col-span-8" />
        ) : (
          <ReSection id="re-agency-attention" title="Management attention" className="layout:order-2 layout:col-span-8">
            <DemoNote />
          </ReSection>
        )}

        <div className="layout:order-1 layout:col-span-12">
          <h2 className="sr-only">Agency at a glance</h2>
          <ReMetricGrid label="Agency at a glance">
            <ReStatCard label="Available listings" value={listings?.value ?? null} supporting="Approved and on the market" href="/client/listings" />
            <ReStatCard
              label="Active buyer & tenant searches"
              value={operations.status === "ready" ? operations.data.activeSearches : null}
              supporting="Searches, not people"
              href="/client/buyers"
              state={live ? operations.status : "ready"}
              info="One person can have more than one active search."
            />
            <ReStatCard label="Viewings scheduled" value={viewings?.value ?? null} supporting="Booked and not yet held" href="/client/viewings" />
            <ReStatCard
              label="Transactions in progress"
              value={activeTxn?.value ?? null}
              supporting={activeTxn?.supporting ?? "After an accepted offer"}
              href="/client/transactions"
            />
          </ReMetricGrid>
        </div>

        <ReSection
          id="re-agency-transactions"
          title="Transactions in progress"
          count={txnTotal}
          className="layout:order-4 layout:col-span-8"
          flush
          action={<ReViewAll href="/client/transactions" />}
        >
          {!live ? (
            <DemoNote />
          ) : transactions.status === "loading" ? (
            <ReSkeletonRows rows={3} label="Loading transactions" />
          ) : transactions.status === "error" ? (
            <ReErrorState onRetry={transactions.reload} />
          ) : txnRows.length === 0 ? (
            <ReEmptyState title="No transactions in progress" description="Accepted offers move here once a transaction is opened." />
          ) : (
            <>
              <div className="hidden md:block">
                <table className="w-full table-fixed text-left">
                  <caption className="sr-only">Transactions in progress. Select a property to preview it.</caption>
                  <colgroup>
                    <col className="w-[30%]" />
                    <col className="w-[20%]" />
                    <col className="w-[16%]" />
                    <col className="w-[16%]" />
                    <col className="w-[18%]" />
                  </colgroup>
                  <thead>
                    <tr className="border-y border-sales-border-subtle bg-sales-surface-subtle text-[12px] text-sales-text-secondary">
                      <th scope="col" className="px-[var(--re-card-pad,16px)] py-2 font-medium">Property</th>
                      <th scope="col" className="px-3 py-2 font-medium">Buyer or tenant</th>
                      <th scope="col" className="px-3 py-2 font-medium">Agent</th>
                      <th scope="col" className="px-3 py-2 font-medium">Stage</th>
                      <th scope="col" className="px-3 py-2 pr-[var(--re-card-pad,16px)] font-medium">Progress</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-sales-border-subtle">
                    {txnRows.slice(0, TXN_PREVIEW).map((row) => (
                      <tr
                        key={row.id}
                        className="cursor-pointer transition-colors hover:bg-sales-surface-hover"
                        onClick={() => setPreview(row)}
                      >
                        <td className="px-[var(--re-card-pad,16px)] py-3">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setPreview(row);
                            }}
                            className="re-focus block max-w-full truncate rounded-[4px] text-left text-[14px] font-semibold text-sales-text-primary"
                          >
                            {row.propertyLabel}
                          </button>
                          <span className="block truncate text-[12px] text-sales-text-muted">{row.agreedPriceLabel}</span>
                        </td>
                        <td className="truncate px-3 py-3 text-[13px] text-sales-text-secondary">{row.buyerName ?? "—"}</td>
                        <td className="truncate px-3 py-3 text-[13px] text-sales-text-secondary">{row.agentName ?? "Unassigned"}</td>
                        <td className="px-3 py-3">
                          <ReStatusBadge label={row.statusLabel} tone="neutral" />
                        </td>
                        <td className="px-3 py-3 pr-[var(--re-card-pad,16px)] text-[12px] text-sales-text-secondary">
                          <span className="block tabular-nums">
                            {row.milestonesTotal > 0 ? `${row.milestonesDone} of ${row.milestonesTotal} steps` : "No steps yet"}
                          </span>
                          <span className="block text-sales-text-muted">Updated {relativeTimeLabel(row.updatedAt)}</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="md:hidden">
                <ReList label="Transactions in progress">
                  {txnRows.slice(0, TXN_PREVIEW).map((row) => (
                    <ReWorkItem
                      key={row.id}
                      icon={<Landmark />}
                      title={row.propertyLabel}
                      reason={[row.buyerName, row.agentName ? `Agent: ${row.agentName}` : null].filter(Boolean).join(" · ") || undefined}
                      status={<ReStatusBadge label={row.statusLabel} tone="neutral" />}
                      meta={
                        <span className="tabular-nums">
                          {row.milestonesTotal > 0 ? `${row.milestonesDone} of ${row.milestonesTotal} steps` : "No steps yet"} · Updated{" "}
                          {relativeTimeLabel(row.updatedAt)}
                        </span>
                      }
                      action={<ReRowAction label="Preview" srContext={row.propertyLabel} onClick={() => setPreview(row)} />}
                    />
                  ))}
                </ReList>
              </div>
            </>
          )}
        </ReSection>

        <div className="min-w-0 layout:order-3 layout:col-span-4">
          <CompanyTeamCalendarCard items={data.teamCalendar} overdueCount={data.teamCalendarOverdueCount} />
        </div>

        <div className="layout:order-6 layout:col-span-12">
          <h2 className="mb-3 text-[15px] font-semibold tracking-[-0.01em] text-sales-text-primary">Business operations</h2>
          <div className="grid grid-cols-1 items-start gap-[var(--re-section-gap,16px)] md:grid-cols-2 xl:grid-cols-3">
            <ReSection id="re-ops-acquisition" title="Property acquisition" action={<ReViewAll href="/client/acquisitions" />}>
              {!live ? (
                <DemoNote />
              ) : acquisitions.status === "loading" ? (
                <div className="-mx-[var(--re-card-pad,16px)]">
                  <ReSkeletonRows rows={2} label="Loading acquisition" />
                </div>
              ) : acquisitions.status === "error" ? (
                <div className="-mx-[var(--re-card-pad,16px)]">
                  <ReErrorState onRetry={acquisitions.reload} />
                </div>
              ) : (
                <>
                  <ReFigureList
                    items={[
                      { label: "Active opportunities", value: acquisitions.data.summary.active, href: "/client/acquisitions" },
                      { label: "Overdue follow-ups", value: acquisitions.data.summary.overdue, tone: "attention" },
                      { label: "Mandates to approve", value: countPrefix(attention, "mandate"), href: "/client/mandates", tone: "attention" },
                      { label: "Listings to approve", value: countPrefix(attention, "listing"), href: "/client/listings", tone: "attention" },
                    ]}
                  />
                  {acquisitions.data.incomplete ? (
                    <p className="mt-3 text-[12px] text-sales-warning-fg">Some opportunities could not be counted.</p>
                  ) : null}
                </>
              )}
            </ReSection>

            <ReSection id="re-ops-buyers" title="Buyer & tenant sales" action={<ReViewAll href="/client/buyers" />}>
              {!live ? (
                <DemoNote />
              ) : operations.status === "loading" ? (
                <div className="-mx-[var(--re-card-pad,16px)]">
                  <ReSkeletonRows rows={2} label="Loading buyer sales" />
                </div>
              ) : operations.status === "error" ? (
                <div className="-mx-[var(--re-card-pad,16px)]">
                  <ReErrorState onRetry={operations.reload} />
                </div>
              ) : (
                <>
                  <ReFigureList
                    items={[
                      { label: "Active searches", value: operations.data.activeSearches, href: "/client/buyers" },
                      { label: "Without a next step", value: operations.data.searchesWithoutNextAction, tone: "attention" },
                      { label: "Offers in negotiation", value: offers?.value ?? null, href: "/client/offers" },
                      { label: "Open inquiries", value: inquiries?.value ?? null, href: "/client/leads" },
                    ]}
                  />
                  <Link
                    href="/client/matching"
                    className="re-focus mt-3 inline-flex min-h-11 items-center rounded-[4px] text-[13px] font-semibold text-sales-text-primary underline-offset-2 hover:underline sm:min-h-0"
                  >
                    Open property matching
                  </Link>
                  {operations.data.incomplete ? (
                    <p className="mt-2 text-[12px] text-sales-warning-fg">Some searches could not be counted.</p>
                  ) : null}
                </>
              )}
            </ReSection>

            <ReSection
              id="re-ops-agency"
              title="Agency operations"
              className="md:col-span-2 xl:col-span-1"
              action={<ReViewAll href="/client/transactions" />}
            >
              {!live ? (
                <DemoNote />
              ) : attention.status === "loading" ? (
                <div className="-mx-[var(--re-card-pad,16px)]">
                  <ReSkeletonRows rows={2} label="Loading agency operations" />
                </div>
              ) : attention.status === "error" ? (
                <div className="-mx-[var(--re-card-pad,16px)]">
                  <ReErrorState onRetry={attention.reload} />
                </div>
              ) : (
                <ReFigureList
                  items={[
                    { label: "Transactions in progress", value: activeTxn?.value ?? null, href: "/client/transactions" },
                    { label: "Stalled 14+ days", value: countPrefix(attention, "txn"), tone: "attention" },
                    { label: "Documents overdue for review", value: countPrefix(attention, "doc"), tone: "attention" },
                    { label: "Payments to verify", value: countPrefix(attention, "pay"), href: "/client/commissions", tone: "attention" },
                  ]}
                />
              )}
            </ReSection>
          </div>
        </div>

        <CommissionOverview state={commissions} live={live} className="layout:order-5 layout:col-span-4" />

        <ReSection
          id="re-agency-workload"
          title="Team activity"
          description="Active buyer searches and overdue search follow-ups per agent."
          className="layout:order-7 layout:col-span-6"
          flush
          action={<ReViewAll href="/client/team" label="Team" />}
        >
          {response ? (
            <p className="px-[var(--re-card-pad,16px)] pb-2 text-[13px] text-sales-text-secondary">
              Average first response: <span className="font-semibold text-sales-text-primary">{response.value}</span>
              {response.trend ? <span className="text-sales-text-muted"> · {response.trend.label}</span> : null}
            </p>
          ) : null}
          {!live ? (
            <DemoNote />
          ) : operations.status === "loading" ? (
            <ReSkeletonRows rows={3} label="Loading team activity" />
          ) : operations.status === "error" ? (
            <ReErrorState onRetry={operations.reload} />
          ) : workload.length === 0 ? (
            <ReEmptyState compact title="No active buyer searches assigned yet" />
          ) : (
            <table className="w-full table-fixed text-left">
              <caption className="sr-only">Active buyer searches per agent, in name order</caption>
              <thead>
                <tr className="border-y border-sales-border-subtle bg-sales-surface-subtle text-[12px] text-sales-text-secondary">
                  <th scope="col" className="w-1/2 px-[var(--re-card-pad,16px)] py-2 font-medium">Agent</th>
                  <th scope="col" className="px-3 py-2 text-right font-medium">Searches</th>
                  <th scope="col" className="px-3 py-2 pr-[var(--re-card-pad,16px)] text-right font-medium">Overdue</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-sales-border-subtle text-[13px]">
                {workload.map((row) => (
                  <tr key={row.agentId}>
                    <td className="truncate px-[var(--re-card-pad,16px)] py-2.5 font-medium text-sales-text-primary">{row.name}</td>
                    <td className="px-3 py-2.5 text-right tabular-nums text-sales-text-secondary">{row.searches}</td>
                    <td
                      className={
                        row.overdue > 0
                          ? "px-3 py-2.5 pr-[var(--re-card-pad,16px)] text-right font-semibold tabular-nums text-sales-warning-fg"
                          : "px-3 py-2.5 pr-[var(--re-card-pad,16px)] text-right tabular-nums text-sales-text-secondary"
                      }
                    >
                      {row.overdue}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </ReSection>

        <ReSection
          id="re-agency-demand"
          title="Agency demand insights"
          description="Buyer and tenant searches this agency can't currently match with available stock."
          className="layout:order-8 layout:col-span-6"
          flush
          action={<ReViewAll href="/client/matching" label="Matching" />}
        >
          {!live ? (
            <DemoNote />
          ) : demand.status === "loading" ? (
            <ReSkeletonRows rows={3} label="Loading demand insights" />
          ) : demand.status === "error" ? (
            <ReErrorState onRetry={demand.reload} />
          ) : gaps.length === 0 ? (
            <ReEmptyState compact title="Every active search has matching stock" description={demand.data.definition} />
          ) : (
            <>
              {demand.data.incomplete ? <RePartialNotice>Some searches or listings could not be included.</RePartialNotice> : null}
              <ReList label="Unmatched demand">
                {gaps.map((gap) => {
                  const label = [gap.location, gap.intent === "rental" ? "To rent" : "To buy", gap.propertyType].filter(Boolean).join(" · ");
                  return (
                    <ReWorkItem
                      key={`${gap.intent}-${gap.location}-${gap.propertyType ?? "any"}`}
                      icon={<MapPin />}
                      title={label}
                      reason={`${gap.searchCount} ${gap.searchCount === 1 ? "search" : "searches"} from ${gap.contactCount} ${gap.contactCount === 1 ? "person" : "people"} · ${gap.eligibleListingCount} matching ${gap.eligibleListingCount === 1 ? "listing" : "listings"}`}
                      status={<ReStatusBadge label={`${gap.unmatchedSearchCount} unmatched`} urgency="today" />}
                      action={<ReRowAction label="Match" srContext={label} href="/client/matching" />}
                    />
                  );
                })}
              </ReList>
              <p className="px-[var(--re-card-pad,16px)] pb-2 pt-1 text-[12px] leading-snug text-sales-text-muted">{demand.data.definition}</p>
            </>
          )}
        </ReSection>

        <div className="space-y-[var(--re-section-gap,16px)] layout:order-9 layout:col-span-12">
          <h2 className="text-[15px] font-semibold tracking-[-0.01em] text-sales-text-primary">Inquiries & reporting</h2>
          <CompanyFocusAreasCard signals={data.focusAreas} viewAllHref={data.focusAreasViewAllHref} />
          {fictional ? null : <CompanyWeeklyReportCardContainer />}
          <CompanyDailyTeamReportCard report={data.dailyTeamReport} />
          {data.reAgentTeam?.length ? <ReAgentTeamVisibilityTable rows={data.reAgentTeam} /> : null}
          <div className="grid grid-cols-1 items-start gap-[var(--re-section-gap,16px)] layout:grid-cols-[minmax(0,1.55fr)_minmax(280px,0.95fr)]">
            <CompanyTeamPerformanceCard rows={data.team} teamTotal={data.teamTotal} viewAllHref={data.teamViewAllHref} />
            <div className="space-y-[var(--re-section-gap,16px)]">
              <CompanyFunnelCard stages={data.funnel} conversionRate={data.conversionRate} conversionDefinition={data.conversionDefinition} />
              <CompanyLeadSourcesCard sources={data.sources} empty={data.sourcesEmpty} />
            </div>
          </div>
          <CompanyPipelineSnapshotCard stages={data.pipelineSnapshot} />
          <div className="grid grid-cols-1 items-start gap-[var(--re-section-gap,16px)] lg:grid-cols-2 xl:grid-cols-3">
            <CompanyDealsAtRiskCard
              items={data.atRiskDeals}
              total={data.atRiskTotal}
              viewAllHref={data.atRiskViewAllHref}
              hasActiveDeals={data.hasActiveDeals}
            />
            <CompanyRevenueTrendCard
              points={data.revenueTrend}
              totalLabel={data.revenueTotalLabel}
              compare={data.revenueTrendCompare}
              hasHistory={data.hasRevenueHistory}
            />
            <CompanyRecentActivityCard items={data.recentActivity} />
          </div>
        </div>
      </div>

      {preview ? (
        <ReSheet
          title={preview.propertyLabel}
          description={preview.statusLabel}
          onClose={() => setPreview(null)}
          footer={
            <div className="flex flex-wrap items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setPreview(null)}
                className="re-focus inline-flex min-h-11 items-center rounded-[var(--re-radius-control,8px)] border border-sales-border px-4 text-[14px] font-semibold text-sales-text-primary hover:bg-sales-surface-hover"
              >
                Close
              </button>
              <Link
                href={`/client/transactions?open=${preview.id}`}
                className="re-focus inline-flex min-h-11 items-center rounded-[var(--re-radius-control,8px)] bg-sales-text-primary px-4 text-[14px] font-semibold text-sales-surface hover:opacity-90"
              >
                Open transaction
              </Link>
            </div>
          }
        >
          <ReDetailList
            items={[
              { label: "Buyer or tenant", value: preview.buyerName },
              { label: "Agent", value: preview.agentName ?? "Unassigned" },
              { label: "Type", value: preview.transactionType === "rental" ? "Rental" : "Sale" },
              { label: "Agreed price", value: preview.agreedPriceLabel },
              {
                label: "Progress",
                value: preview.milestonesTotal > 0 ? `${preview.milestonesDone} of ${preview.milestonesTotal} steps done` : "No steps recorded yet",
              },
              {
                label: "Expected completion",
                value: preview.expectedCompletionDate
                  ? new Date(preview.expectedCompletionDate).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })
                  : null,
              },
              { label: "Commission", value: preview.commissionTotalLabel },
              { label: "Last updated", value: relativeTimeLabel(preview.updatedAt) },
            ]}
          />
        </ReSheet>
      ) : null}

      {hubSheet}
    </>
  );
}

function CommissionOverview({
  state,
  live,
  className,
}: {
  state: ReFetchState<CommissionPayload>;
  live: boolean;
  className?: string;
}) {
  const currency = useMemo(() => {
    if (state.status !== "ready") return { code: null as string | null, mixed: false };
    const codes = new Set(state.data.commissions.map((c) => c.currency).filter((c): c is string => Boolean(c)));
    const complete = state.data.total <= state.data.commissions.length;
    if (codes.size === 1 && complete) return { code: [...codes][0]!, mixed: false };
    return { code: null, mixed: codes.size > 1 || !complete };
  }, [state.status, state.data]);

  return (
    <ReSection
      id="re-agency-commission"
      title="Commission overview"
      className={className}
      action={<ReViewAll href="/client/commissions" />}
    >
      {!live ? (
        <DemoNote />
      ) : state.status === "loading" ? (
        <div className="-mx-[var(--re-card-pad,16px)]">
          <ReSkeletonRows rows={3} label="Loading commission figures" />
        </div>
      ) : state.status === "error" ? (
        state.httpStatus === 503 ? (
          <ReEmptyState compact title="Commission tracking isn't switched on" description="Agency operations are not enabled for this workspace yet." />
        ) : state.httpStatus === 403 ? (
          <ReEmptyState compact title="Commission figures are limited to finance access" />
        ) : (
          <div className="-mx-[var(--re-card-pad,16px)]">
            <ReErrorState onRetry={state.reload} />
          </div>
        )
      ) : !state.data.finance || state.data.scope !== "organisation" ? (
        <ReEmptyState
          compact
          title="Agency totals are limited to finance access"
          description="Your own allocations are on the Commissions page."
        />
      ) : (
        <>
          <dl className="divide-y divide-sales-border-subtle">
            {[
              { label: "Projected", hint: "Expected, not yet earned or received", cents: state.data.totals.projectedCents },
              { label: "Verified received", hint: "Cash confirmed by finance", cents: state.data.totals.verifiedReceivedCents },
              { label: "Approved, not paid", hint: "Owed to staff", cents: state.data.totals.outstandingPayableCents },
              { label: "Paid to staff", hint: "Payouts recorded", cents: state.data.totals.paidCents },
            ].map((row) => (
              <div key={row.label} className="flex min-w-0 items-start justify-between gap-3 py-2.5 first:pt-0">
                <dt className="min-w-0">
                  <span className="block text-[13px] font-medium text-sales-text-primary">{row.label}</span>
                  <span className="block text-[12px] text-sales-text-muted">{row.hint}</span>
                </dt>
                <dd className="shrink-0 text-right text-[14px] font-semibold tabular-nums text-sales-text-primary">
                  {money(row.cents, currency.code)}
                </dd>
              </div>
            ))}
          </dl>
          <p className="mt-3 text-[12px] leading-snug text-sales-text-muted">
            These are separate stages of the same commissions. Don&apos;t add them together.
            {currency.mixed ? " Totals may combine more than one currency; see Commissions for per-record amounts." : ""}
          </p>
          {state.data.totals.legacyUnverifiedCents > 0 ? (
            <p className="mt-2 text-[12px] leading-snug text-sales-warning-fg">
              {money(state.data.totals.legacyUnverifiedCents, currency.code)} from older records is unverified and not included.
            </p>
          ) : null}
          {state.data.incomplete ? (
            <p className="mt-2 text-[12px] leading-snug text-sales-warning-fg">
              Totals could not include every record. Check Commissions before relying on them.
            </p>
          ) : null}
        </>
      )}
    </ReSection>
  );
}
