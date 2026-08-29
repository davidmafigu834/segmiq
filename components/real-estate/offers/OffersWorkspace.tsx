"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Handshake, Plus, Search } from "lucide-react";
import { Button, EmptyState, Select } from "@/components/sales/ui";
import { KpiCard } from "@/components/dashboard/sales/KpiCard";
import { CardShell } from "@/components/dashboard/sales/KpiCard";
import {
  deriveOfferAttention,
  offerVsAsking,
} from "@/lib/real-estate/offers";
import type { OfferListRow } from "@/lib/real-estate/offer-service";
import { cn } from "@/lib/ui/cn";
import { CreateOfferSheet, type CreateOfferPrefill } from "./CreateOfferSheet";
import { OfferDetailPanel, OfferStatusPill } from "./OfferDetailPanel";

type StatusTab = "active" | "submitted" | "negotiating" | "accepted" | "closed";

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
}: {
  clientId: string;
  variant: "manager" | "agent";
  inquiriesHref: string;
  complianceHref: string | null;
}) {
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
    if (j.summary) setSummary({ closed: 0, ...j.summary });
    setAgents(j.agents ?? []);
    setMulti(j.multiOfferListings ?? []);
    setLoading(false);
  }, [clientId, tab, q, agentId, min, max]);

  useEffect(() => {
    void load();
  }, [load]);

  const pills: Array<{ id: StatusTab; label: string; count: number }> = [
    { id: "active", label: "Active", count: summary.active },
    { id: "submitted", label: "Awaiting seller", count: summary.awaitingSeller },
    { id: "negotiating", label: "Negotiating", count: summary.negotiating },
    { id: "accepted", label: "Accepted", count: summary.accepted },
    { id: "closed", label: "Closed", count: summary.closed },
  ];

  const empty = emptyCopy(tab);

  if (loading && offers.length === 0) {
    return (
      <div className="space-y-3" aria-busy aria-label="Loading offers">
        <div className="grid grid-cols-2 gap-3 min-[900px]:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="shimmer h-[96px] rounded-[14px]" />
          ))}
        </div>
        <div className="shimmer h-10 rounded-[10px]" />
        <div className="shimmer h-[280px] rounded-[14px]" />
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="dashboard-group relative z-[1] grid grid-cols-2 gap-3 min-[900px]:grid-cols-4">
        <KpiCard
          item={{
            id: "active",
            label: "Active",
            value: String(summary.active),
            supporting: "In play",
            icon: "deals",
          }}
        />
        <KpiCard
          item={{
            id: "awaiting",
            label: "Awaiting seller",
            value: String(summary.awaitingSeller),
            supporting: "No response yet",
            icon: "followups",
          }}
        />
        <KpiCard
          item={{
            id: "negotiating",
            label: "Negotiating",
            value: String(summary.negotiating),
            supporting: "Counter or revise",
            icon: "pipeline",
          }}
        />
        <KpiCard
          item={{
            id: "accepted",
            label: "Accepted this month",
            value: String(summary.acceptedThisMonth),
            supporting: `${summary.accepted} accepted in total`,
            icon: "won",
          }}
        />
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="flex gap-2 overflow-x-auto pb-0.5">
          {pills.map((pill) => (
            <button
              key={pill.id}
              type="button"
              onClick={() => setTab(pill.id)}
              className={cn(
                "min-h-10 shrink-0 rounded-full px-3 text-[12px] font-medium transition-colors",
                tab === pill.id
                  ? "bg-sales-brand-soft text-sales-text-primary ring-1 ring-sales-brand-border"
                  : "border border-sales-border bg-sales-surface text-sales-text-secondary hover:text-sales-text-primary"
              )}
            >
              {pill.label} · {pill.count}
            </button>
          ))}
        </div>
        <div className="flex w-full min-w-0 flex-col gap-2 sm:w-auto sm:flex-row sm:items-center">
          {variant === "manager" ? (
            <Select
              value={agentId}
              onChange={(e) => setAgentId(e.target.value)}
              aria-label="Agent"
              className="sm:!w-40"
            >
              <option value="">All agents</option>
              {agents.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </Select>
          ) : null}
          <input
            type="number"
            inputMode="decimal"
            placeholder="Min"
            aria-label="Minimum offer"
            value={min}
            onChange={(e) => setMin(e.target.value)}
            className="h-10 w-full rounded-[10px] border border-sales-border bg-sales-surface px-3 text-[13px] text-sales-text-primary outline-none placeholder:text-sales-text-muted focus:border-sales-border-strong focus:ring-2 focus:ring-sales-brand/40 sm:w-24"
          />
          <input
            type="number"
            inputMode="decimal"
            placeholder="Max"
            aria-label="Maximum offer"
            value={max}
            onChange={(e) => setMax(e.target.value)}
            className="h-10 w-full rounded-[10px] border border-sales-border bg-sales-surface px-3 text-[13px] text-sales-text-primary outline-none placeholder:text-sales-text-muted focus:border-sales-border-strong focus:ring-2 focus:ring-sales-brand/40 sm:w-24"
          />
          <label className="relative block min-w-0 flex-1 sm:w-56">
            <span className="sr-only">Search offers</span>
            <Search
              size={15}
              strokeWidth={1.8}
              className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sales-text-muted"
              aria-hidden
            />
            <input
              type="search"
              placeholder="Buyer, property, agent…"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              className="h-10 w-full rounded-[10px] border border-sales-border bg-sales-surface py-2 pl-9 pr-3 text-[13px] text-sales-text-primary outline-none placeholder:text-sales-text-muted focus:border-sales-border-strong focus:ring-2 focus:ring-sales-brand/40"
            />
          </label>
          <Button
            type="button"
            variant="primary"
            size="md"
            onClick={() => setCreating({})}
            leftIcon={<Plus className="h-4 w-4" />}
          >
            Create offer
          </Button>
        </div>
      </div>

      {variant === "manager" && multi.length > 0 ? (
        <div className="flex flex-wrap items-center gap-2 rounded-[10px] border border-sales-border bg-sales-surface px-3 py-2 text-[12px]">
          <span className="font-semibold text-sales-text-primary">Competing</span>
          {multi.slice(0, 4).map((l) => (
            <button
              key={l.listingId}
              type="button"
              onClick={() => setQ(l.propertyLabel)}
              className="rounded-full border border-sales-border bg-sales-surface-subtle px-2.5 py-1 text-sales-text-secondary hover:text-sales-text-primary"
            >
              {l.propertyLabel} · {l.count}
            </button>
          ))}
        </div>
      ) : null}

      <CardShell
        title="Offers"
        className="dashboard-panel--table"
        action={
          loading ? (
            <span className="text-[11px] text-sales-text-muted">Updating…</span>
          ) : undefined
        }
      >
        {offers.length === 0 ? (
          <EmptyState
            icon={<Handshake className="h-4 w-4" strokeWidth={1.5} />}
            title={empty.title}
            description={empty.description}
            action={
              <div className="flex items-center gap-2">
                <Button type="button" variant="primary" size="sm" onClick={() => setCreating({})}>
                  Create offer
                </Button>
                <Link
                  href={inquiriesHref}
                  className="inline-flex h-8 items-center rounded-[8px] px-3 text-[12px] font-semibold text-sales-text-secondary hover:text-sales-text-primary"
                >
                  View inquiries
                </Link>
              </div>
            }
            size="compact"
          />
        ) : (
          <>
            <div className="hidden w-full md:block">
              <table className="dashboard-table w-full table-fixed text-left">
                <colgroup>
                  <col className="w-[34%]" />
                  <col className="w-[16%]" />
                  <col className="w-[14%]" />
                  <col className="w-[18%]" />
                  {variant === "manager" ? <col className="w-[10%]" /> : null}
                  <col className="w-[8%]" />
                </colgroup>
                <thead>
                  <tr className="border-b border-sales-border-subtle bg-sales-surface-subtle text-[10px] font-semibold uppercase tracking-[0.08em] text-sales-text-muted">
                    <th className="px-5 py-2.5 font-semibold">Buyer / property</th>
                    <th className="px-3 py-2.5 font-semibold">Offer</th>
                    <th className="px-3 py-2.5 font-semibold">Status</th>
                    <th className="px-3 py-2.5 font-semibold">Next</th>
                    {variant === "manager" ? (
                      <th className="px-3 py-2.5 font-semibold">Agent</th>
                    ) : null}
                    <th className="px-5 py-2.5 font-semibold text-right">Updated</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[rgba(125,148,194,0.07)]">
                  {offers.map((row) => (
                    <OfferTableRow
                      key={row.id}
                      row={row}
                      showAgent={variant === "manager"}
                      onOpen={() => setOpenId(row.id)}
                    />
                  ))}
                </tbody>
              </table>
            </div>
            <ul className="divide-y divide-sales-border-subtle md:hidden">
              {offers.map((row) => (
                <li key={row.id}>
                  <button
                    type="button"
                    className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-sales-surface-hover"
                    onClick={() => setOpenId(row.id)}
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
                </li>
              ))}
            </ul>
          </>
        )}
      </CardShell>

      {creating ? (
        <CreateOfferSheet
          clientId={clientId}
          prefill={creating}
          onClose={() => setCreating(null)}
          onCreated={(id) => {
            setCreating(null);
            setOpenId(id);
            void load();
          }}
        />
      ) : null}

      {openId ? (
        <OfferDetailPanel
          clientId={clientId}
          offerId={openId}
          complianceHref={complianceHref}
          onClose={() => setOpenId(null)}
          onChanged={() => void load()}
        />
      ) : null}
    </div>
  );
}

function OfferTableRow({
  row,
  showAgent,
  onOpen,
}: {
  row: OfferListRow;
  showAgent: boolean;
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
    <tr className="dashboard-list-row h-[56px] cursor-pointer" onClick={onOpen}>
      <td className="px-5 py-2">
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
      </td>
      <td className="px-3 py-2">
        <p className="text-[13px] font-semibold tabular-nums text-sales-text-primary">
          {row.currentAmountLabel}
        </p>
        <p className="truncate text-[11px] text-sales-text-muted">
          {vs ?? (row.listingPriceLabel ? `Ask ${row.listingPriceLabel}` : "—")}
        </p>
      </td>
      <td className="px-3 py-2">
        <OfferStatusPill status={row.status} />
      </td>
      <td className="px-3 py-2">
        <p
          className={cn(
            "truncate text-[12px]",
            nextHot ? "font-semibold text-sales-danger-fg" : "text-sales-text-secondary"
          )}
        >
          {next}
        </p>
      </td>
      {showAgent ? (
        <td className="px-3 py-2 text-[12px] text-sales-text-secondary">{row.agentName ?? "—"}</td>
      ) : null}
      <td className="px-5 py-2 text-right text-[11px] text-sales-text-muted">{row.lastActivityLabel}</td>
    </tr>
  );
}
