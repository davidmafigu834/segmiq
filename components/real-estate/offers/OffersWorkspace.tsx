"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Handshake, Plus } from "lucide-react";
import { CompanyKpiCard } from "@/components/dashboard/company/CompanyKpiCard";
import { useMediaQuery } from "@/components/dashboard/company/team/CompanyTeamInviteDialog";
import {
  Button,
  DataTableBody,
  DataTableEl,
  DataTableHead,
  DataTableRow,
  DataTableTd,
  DataTableTh,
  EmptyState,
  MenuSelect,
  SearchInput,
} from "@/components/sales/ui";
import {
  deriveOfferAttention,
  offerVsAsking,
} from "@/lib/real-estate/offers";
import type { OfferListRow } from "@/lib/real-estate/offer-service";
import { cn } from "@/lib/ui/cn";
import { CreateOfferSheet, type CreateOfferPrefill } from "./CreateOfferSheet";
import { OfferDetailPanel, OfferStatusPill } from "./OfferDetailPanel";

type StatusTab = "active" | "submitted" | "negotiating" | "accepted" | "closed";

const TABS: Array<{ id: StatusTab; label: string }> = [
  { id: "active", label: "Active" },
  { id: "submitted", label: "Awaiting seller" },
  { id: "negotiating", label: "Negotiating" },
  { id: "accepted", label: "Accepted" },
  { id: "closed", label: "Closed" },
];

function initials(name: string | null): string {
  const parts = (name ?? "Buyer").trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "B";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
}

function emptyCopy(tab: StatusTab): { title: string; description: string } {
  if (tab === "active") {
    return {
      title: "No active offers",
      description: "Create an offer from a viewing or inquiry when a buyer is ready to bid.",
    };
  }
  if (tab === "submitted") {
    return {
      title: "Nothing awaiting the seller",
      description: "Submitted offers waiting on a seller response will show here.",
    };
  }
  if (tab === "negotiating") {
    return {
      title: "No negotiations in play",
      description: "Counters and revisions land here until someone accepts or walks away.",
    };
  }
  if (tab === "accepted") {
    return {
      title: "No accepted offers",
      description: "Accepted bids move here so you can start compliance.",
    };
  }
  return {
    title: "No closed offers",
    description: "Rejected, withdrawn, and expired offers are kept here for history.",
  };
}

export function OffersWorkspace({
  clientId,
  variant,
  inquiriesHref,
  complianceHref,
  hideCreateButton = false,
  headerCreateNonce = 0,
  onSelectionChange,
}: {
  clientId: string;
  variant: "manager" | "agent";
  inquiriesHref: string;
  complianceHref: string | null;
  hideCreateButton?: boolean;
  headerCreateNonce?: number;
  onSelectionChange?: (id: string | null) => void;
}) {
  const router = useRouter();
  const overlayPanel = useMediaQuery("(max-width: 1279px)");
  const stackedSplit = useMediaQuery("(max-width: 767px)");
  const [tab, setTab] = useState<StatusTab>("active");
  const [q, setQ] = useState("");
  const [agentId, setAgentId] = useState("");
  const [min, setMin] = useState("");
  const [max, setMax] = useState("");
  const [loading, setLoading] = useState(true);
  const [offers, setOffers] = useState<OfferListRow[]>([]);
  const [summary, setSummary] = useState({
    active: 0,
    awaitingSeller: 0,
    negotiating: 0,
    acceptedThisMonth: 0,
    accepted: 0,
    closed: 0,
  });
  const [agents, setAgents] = useState<Array<{ id: string; name: string }>>([]);
  const [multi, setMulti] = useState<Array<{ listingId: string; propertyLabel: string; count: number }>>([]);
  const [openId, setOpenId] = useState<string | null>(null);
  const [creating, setCreating] = useState<CreateOfferPrefill | null>(null);

  const select = useCallback(
    (id: string | null) => {
      setOpenId(id);
      onSelectionChange?.(id);
    },
    [onSelectionChange]
  );

  const load = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams({ tab });
    if (q.trim()) params.set("q", q.trim());
    if (agentId) params.set("agent_id", agentId);
    if (min) params.set("min", min);
    if (max) params.set("max", max);
    const res = await fetch(`/api/clients/${clientId}/offers?${params.toString()}`);
    const j = (await res.json()) as {
      offers?: OfferListRow[];
      summary?: typeof summary;
      agents?: Array<{ id: string; name: string }>;
      multiOfferListings?: Array<{ listingId: string; propertyLabel: string; count: number }>;
    };
    setOffers(j.offers ?? []);
    if (j.summary) setSummary(j.summary);
    setAgents(j.agents ?? []);
    setMulti(j.multiOfferListings ?? []);
    setLoading(false);
  }, [clientId, tab, q, agentId, min, max]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (headerCreateNonce > 0) setCreating({});
  }, [headerCreateNonce]);

  const tabCounts: Record<StatusTab, number> = {
    active: summary.active,
    submitted: summary.awaitingSeller,
    negotiating: summary.negotiating,
    accepted: summary.accepted,
    closed: summary.closed,
  };

  const empty = emptyCopy(tab);

  const table = (
    <section className="flex min-h-[660px] min-w-0 flex-col overflow-hidden workspace-card rounded-[14px] border border-sales-border bg-sales-surface shadow-sales-card">
      <div className="flex flex-col gap-3 border-b border-sales-border-subtle px-3 py-3 sm:px-4">
        <div
          className="scrollbar-hide flex min-w-0 gap-4 overflow-x-auto overscroll-x-contain"
          role="tablist"
          aria-label="Offer status"
        >
          {TABS.map((item) => {
            const active = tab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => setTab(item.id)}
                className={cn(
                  "relative flex h-11 shrink-0 items-center gap-1.5 whitespace-nowrap px-1 text-[13px] transition-colors duration-150",
                  active
                    ? "font-semibold text-sales-text-primary"
                    : "font-medium text-sales-text-secondary hover:text-sales-text-primary"
                )}
              >
                {item.label}
                <span className="tabular-nums text-sales-text-muted">{tabCounts[item.id]}</span>
                {active ? (
                  <span className="absolute inset-x-0 -bottom-px h-[3px] bg-sales-brand" aria-hidden />
                ) : null}
              </button>
            );
          })}
        </div>
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          <SearchInput
            value={q}
            onChange={setQ}
            placeholder="Search buyer, property, agent…"
            className="min-w-0 w-full sm:w-[240px]"
          />
          {variant === "manager" ? (
            <MenuSelect
              value={agentId}
              onChange={setAgentId}
              aria-label="Agent"
              options={[
                { value: "", label: "All agents" },
                ...agents.map((a) => ({ value: a.id, label: a.name })),
              ]}
            />
          ) : null}
          <input
            type="number"
            inputMode="decimal"
            placeholder="Min"
            aria-label="Minimum offer"
            value={min}
            onChange={(e) => setMin(e.target.value)}
            className="h-10 w-24 rounded-[10px] border border-sales-border bg-sales-surface px-3 text-[13px] text-sales-text-primary outline-none placeholder:text-sales-text-muted focus:border-sales-border-strong focus:ring-2 focus:ring-sales-brand/40"
          />
          <input
            type="number"
            inputMode="decimal"
            placeholder="Max"
            aria-label="Maximum offer"
            value={max}
            onChange={(e) => setMax(e.target.value)}
            className="h-10 w-24 rounded-[10px] border border-sales-border bg-sales-surface px-3 text-[13px] text-sales-text-primary outline-none placeholder:text-sales-text-muted focus:border-sales-border-strong focus:ring-2 focus:ring-sales-brand/40"
          />
          {!hideCreateButton ? (
            <Button
              type="button"
              variant="primary"
              size="md"
              onClick={() => setCreating({})}
              leftIcon={<Plus className="h-4 w-4" />}
            >
              Create offer
            </Button>
          ) : null}
        </div>
        {variant === "manager" && multi.length > 0 ? (
          <div className="flex flex-wrap items-center gap-2 text-[12px]">
            <span className="font-semibold text-sales-text-primary">Competing</span>
            {multi.slice(0, 4).map((listing) => (
              <button
                key={listing.listingId}
                type="button"
                onClick={() => setQ(listing.propertyLabel)}
                className="rounded-full border border-sales-border bg-sales-surface-subtle px-2.5 py-1 text-sales-text-secondary hover:text-sales-text-primary"
              >
                {listing.propertyLabel} · {listing.count}
              </button>
            ))}
          </div>
        ) : null}
      </div>

      {loading && offers.length === 0 ? (
        <p className="px-4 py-8 text-[13px] text-sales-text-muted sm:px-5">Loading…</p>
      ) : offers.length === 0 ? (
        <div className="flex flex-1 items-center justify-center">
          <EmptyState
            icon={<Handshake className="h-4 w-4" strokeWidth={1.5} />}
            title={empty.title}
            description={empty.description}
            action={
              <div className="flex items-center gap-2">
                <Button type="button" variant="primary" size="sm" onClick={() => setCreating({})}>
                  Create offer
                </Button>
                <button
                  type="button"
                  className="inline-flex h-8 items-center rounded-[8px] px-3 text-[12px] font-semibold text-sales-text-secondary hover:text-sales-text-primary"
                  onClick={() => router.push(inquiriesHref)}
                >
                  View inquiries
                </button>
              </div>
            }
            size="compact"
          />
        </div>
      ) : (
        <>
          <div className="hidden min-w-0 flex-1 overflow-x-auto md:block">
            <DataTableEl className="min-w-[860px]">
              <DataTableHead>
                <tr>
                  <DataTableTh>Buyer / property</DataTableTh>
                  <DataTableTh>Offer</DataTableTh>
                  <DataTableTh>Status</DataTableTh>
                  <DataTableTh>Next</DataTableTh>
                  {variant === "manager" ? <DataTableTh>Agent</DataTableTh> : null}
                  <DataTableTh className="text-right">Updated</DataTableTh>
                </tr>
              </DataTableHead>
              <DataTableBody>
                {offers.map((row) => (
                  <OfferTableRow
                    key={row.id}
                    row={row}
                    showAgent={variant === "manager"}
                    selected={row.id === openId}
                    onOpen={() => select(row.id)}
                  />
                ))}
              </DataTableBody>
            </DataTableEl>
          </div>
          <div className="divide-y divide-sales-border-subtle md:hidden">
            {offers.map((row) => (
              <button
                key={row.id}
                type="button"
                className={cn(
                  "flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-sales-surface-hover",
                  row.id === openId && "bg-sales-brand-soft"
                )}
                onClick={() => select(row.id)}
              >
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-sales-neutral-100 text-[11px] font-semibold text-sales-text-secondary">
                  {initials(row.buyerName)}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[13px] font-semibold text-sales-text-primary">
                    {row.buyerName ?? "Buyer"}
                  </p>
                  <p className="mt-0.5 truncate text-[11px] text-sales-text-muted">
                    {row.propertyLabel}
                    {" · "}
                    {row.currentAmountLabel}
                  </p>
                </div>
                <OfferStatusPill status={row.status} />
              </button>
            ))}
          </div>
        </>
      )}
    </section>
  );

  const panel = openId ? (
    <OfferDetailPanel
      clientId={clientId}
      offerId={openId}
      complianceHref={complianceHref}
      onClose={() => select(null)}
      onChanged={() => void load()}
      overlay={overlayPanel}
      stacked={stackedSplit}
    />
  ) : null;

  return (
    <div className="space-y-4 sm:space-y-5">
      <div className="grid w-full grid-cols-2 gap-3 md:grid-cols-4">
        <CompanyKpiCard
          item={{
            id: "active",
            label: "Active",
            value: String(summary.active),
            supporting: "In play",
            icon: "deals",
          }}
        />
        <CompanyKpiCard
          item={{
            id: "awaiting",
            label: "Awaiting seller",
            value: String(summary.awaitingSeller),
            supporting: "No response yet",
            icon: "followups",
          }}
        />
        <CompanyKpiCard
          item={{
            id: "negotiating",
            label: "Negotiating",
            value: String(summary.negotiating),
            supporting: "Counter or revise",
            icon: "pipeline",
          }}
        />
        <CompanyKpiCard
          item={{
            id: "accepted",
            label: "Accepted this month",
            value: String(summary.acceptedThisMonth),
            supporting: `${summary.accepted} accepted in total`,
            icon: "won",
          }}
        />
      </div>

      {openId && !overlayPanel ? (
        <div className="grid grid-cols-1 items-stretch gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(360px,30%)]">
          {table}
          <div className="min-h-0 xl:sticky xl:top-0">{panel}</div>
        </div>
      ) : (
        table
      )}

      {openId && overlayPanel ? panel : null}

      {creating ? (
        <CreateOfferSheet
          clientId={clientId}
          prefill={creating}
          onClose={() => setCreating(null)}
          onCreated={(id) => {
            setCreating(null);
            select(id);
            void load();
          }}
        />
      ) : null}
    </div>
  );
}

function OfferTableRow({
  row,
  showAgent,
  selected,
  onOpen,
}: {
  row: OfferListRow;
  showAgent: boolean;
  selected: boolean;
  onOpen: () => void;
}) {
  const vs = useMemo(
    () => offerVsAsking(row.currentAmount, row.listingPrice),
    [row.currentAmount, row.listingPrice]
  );
  const attention = useMemo(
    () =>
      deriveOfferAttention({
        status: row.status,
        updatedAt: row.lastActivityAt,
        expiryDate: row.expiryDate,
      }),
    [row.status, row.lastActivityAt, row.expiryDate]
  );
  const next =
    row.status === "accepted"
      ? row.complianceLabel ?? row.nextActionLabel
      : attention?.why ?? row.nextActionLabel;
  const nextHot =
    attention?.reason === "counter_received" ||
    attention?.reason === "expiry_approaching" ||
    attention?.reason === "stale_negotiation";

  return (
    <DataTableRow selected={selected} className="h-[56px] cursor-pointer" onClick={onOpen}>
      <DataTableTd>
        <div className="flex min-w-0 items-center gap-2.5">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-sales-neutral-100 text-[11px] font-semibold text-sales-text-secondary">
            {initials(row.buyerName)}
          </span>
          <div className="min-w-0">
            <p className="truncate text-[13px] font-semibold text-sales-text-primary">
              {row.buyerName ?? "Buyer"}
            </p>
            <p className="truncate text-[11px] text-sales-text-muted">{row.propertyLabel}</p>
          </div>
        </div>
      </DataTableTd>
      <DataTableTd>
        <p className="text-[13px] font-semibold tabular-nums text-sales-text-primary">
          {row.currentAmountLabel}
        </p>
        <p className="truncate text-[11px] text-sales-text-muted">
          {vs ?? (row.listingPriceLabel ? `Ask ${row.listingPriceLabel}` : "—")}
        </p>
      </DataTableTd>
      <DataTableTd>
        <OfferStatusPill status={row.status} />
      </DataTableTd>
      <DataTableTd>
        <p
          className={cn(
            "truncate text-[12px]",
            nextHot ? "font-semibold text-sales-danger-fg" : "text-sales-text-secondary"
          )}
        >
          {next}
        </p>
      </DataTableTd>
      {showAgent ? (
        <DataTableTd className="text-[12px] text-sales-text-secondary">{row.agentName ?? "—"}</DataTableTd>
      ) : null}
      <DataTableTd className="text-right text-[11px] text-sales-text-muted">{row.lastActivityLabel}</DataTableTd>
    </DataTableRow>
  );
}
