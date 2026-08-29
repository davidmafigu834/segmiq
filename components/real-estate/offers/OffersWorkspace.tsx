"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Handshake } from "lucide-react";
import { Button, Input, SearchInput } from "@/components/sales/ui";
import { EmptyState } from "@/components/ui";
import type { OfferListRow } from "@/lib/real-estate/offer-service";
import type { OfferListTab } from "@/lib/real-estate/offer-service";
import { CreateOfferSheet, type CreateOfferPrefill } from "./CreateOfferSheet";
import { OfferDetailPanel, OfferStatusPill } from "./OfferDetailPanel";

const TABS: Array<{ id: OfferListTab; label: string }> = [
  { id: "active", label: "Active" },
  { id: "accepted", label: "Accepted" },
  { id: "rejected", label: "Rejected" },
  { id: "withdrawn", label: "Withdrawn" },
  { id: "expired", label: "Expired" },
  { id: "all", label: "All" },
];

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
  const [tab, setTab] = useState<OfferListTab>("active");
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
  });
  const [agents, setAgents] = useState<Array<{ id: string; name: string }>>([]);
  const [byAgent, setByAgent] = useState<Array<{ id: string; name: string; count: number }>>([]);
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
      byAgent?: Array<{ id: string; name: string; count: number }>;
      multiOfferListings?: Array<{ listingId: string; propertyLabel: string; count: number }>;
    };
    setOffers(j.offers ?? []);
    if (j.summary) setSummary(j.summary);
    setAgents(j.agents ?? []);
    setByAgent(j.byAgent ?? []);
    setMulti(j.multiOfferListings ?? []);
    setLoading(false);
  }, [clientId, tab, q, agentId, min, max]);

  useEffect(() => {
    void load();
  }, [load]);

  const cards = useMemo(
    () => [
      { label: "Active offers", value: summary.active },
      { label: "Awaiting seller response", value: summary.awaitingSeller },
      { label: "Negotiating", value: summary.negotiating },
      { label: "Accepted this month", value: summary.acceptedThisMonth },
    ],
    [summary]
  );

  return (
    <div className="min-w-0 w-full max-w-full pb-20">
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        {variant === "manager" ? (
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wide text-sales-text-muted">Sales</p>
            <h1 className="text-[22px] font-semibold tracking-[-0.03em] text-sales-text-primary">Offers</h1>
            <p className="mt-1 text-[13px] text-sales-text-secondary">
              Track property offers, seller responses and negotiations.
            </p>
          </div>
        ) : (
          <div />
        )}
        <Button variant="primary" onClick={() => setCreating({})}>
          Create offer
        </Button>
      </div>

      <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        {cards.map((c) => (
          <div key={c.label} className="workspace-card rounded-[14px] border border-sales-border bg-sales-surface px-4 py-3">
            <p className="text-[11px] font-medium text-sales-text-muted">{c.label}</p>
            <p className="mt-1 text-[22px] font-semibold tabular-nums tracking-[-0.03em]">{c.value}</p>
          </div>
        ))}
      </div>

      {variant === "manager" && (byAgent.length > 0 || multi.length > 0) ? (
        <div className="mb-5 grid grid-cols-1 gap-3 lg:grid-cols-2">
          {byAgent.length > 0 ? (
            <div className="workspace-card rounded-[14px] border border-sales-border bg-sales-surface p-4">
              <p className="text-[13px] font-semibold">Offers by agent</p>
              <ul className="mt-2 space-y-1.5 text-[13px]">
                {byAgent.slice(0, 8).map((a) => (
                  <li key={a.id} className="flex justify-between">
                    <span>{a.name}</span>
                    <span className="tabular-nums text-sales-text-secondary">{a.count}</span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
          {multi.length > 0 ? (
            <div className="workspace-card rounded-[14px] border border-sales-border bg-sales-surface p-4">
              <p className="text-[13px] font-semibold">Properties with multiple offers</p>
              <ul className="mt-2 space-y-1.5 text-[13px]">
                {multi.map((l) => (
                  <li key={l.listingId} className="flex justify-between gap-2">
                    <span className="truncate">{l.propertyLabel}</span>
                    <span className="tabular-nums text-sales-text-secondary">{l.count}</span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>
      ) : null}

      <div className="mb-4 flex gap-1 overflow-x-auto">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={`h-9 shrink-0 rounded-full px-3 text-[12px] font-medium ${
              tab === t.id
                ? "bg-sales-text-primary text-white"
                : "border border-sales-border text-sales-text-secondary"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="mb-4 grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-5">
        <SearchInput
          value={q}
          onChange={setQ}
          placeholder="Search buyer, property, agent"
        />
        {variant === "manager" ? (
          <select
            className="h-10 rounded-[10px] border border-sales-border bg-sales-surface px-3 text-[13px]"
            value={agentId}
            onChange={(e) => setAgentId(e.target.value)}
          >
            <option value="">All agents</option>
            {agents.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
          </select>
        ) : (
          <div />
        )}
        <Input type="number" placeholder="Min offer" value={min} onChange={(e) => setMin(e.target.value)} />
        <Input type="number" placeholder="Max offer" value={max} onChange={(e) => setMax(e.target.value)} />
      </div>

      {loading ? (
        <p className="text-[13px] text-sales-text-muted">Loading…</p>
      ) : offers.length === 0 ? (
        <div className="workspace-card rounded-[14px] border border-sales-border bg-sales-surface">
          <EmptyState
            icon={Handshake}
            title={tab === "active" ? "No active offers" : "No offers in this view"}
            description="Offers created by your agents will appear here as clients progress from property viewings into negotiation."
            action={
              <Link
                href={inquiriesHref}
                className="inline-flex h-10 items-center rounded-[10px] border border-sales-border px-3 text-[13px] font-medium"
              >
                View inquiries
              </Link>
            }
          />
        </div>
      ) : (
        <>
          <div className="hidden overflow-hidden workspace-card rounded-[14px] border border-sales-border bg-sales-surface lg:block">
            <table className="w-full text-left text-[13px]">
              <thead className="border-b border-sales-border-subtle text-[11px] font-semibold uppercase tracking-wide text-sales-text-muted">
                <tr>
                  <th className="px-4 py-2.5">Property</th>
                  <th className="px-4 py-2.5">Buyer</th>
                  <th className="px-4 py-2.5">Offer</th>
                  <th className="px-4 py-2.5">Listing price</th>
                  <th className="px-4 py-2.5">Status</th>
                  <th className="px-4 py-2.5">Compliance</th>
                  <th className="px-4 py-2.5">Agent</th>
                  <th className="px-4 py-2.5">Last update</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-sales-border-subtle">
                {offers.map((row) => (
                  <tr
                    key={row.id}
                    className="cursor-pointer hover:bg-sales-surface-hover"
                    onClick={() => setOpenId(row.id)}
                  >
                    <td className="px-4 py-3 font-medium">{row.propertyLabel}</td>
                    <td className="px-4 py-3">{row.buyerName ?? "—"}</td>
                    <td className="px-4 py-3 font-semibold tabular-nums">{row.currentAmountLabel}</td>
                    <td className="px-4 py-3 tabular-nums text-sales-text-secondary">
                      {row.listingPriceLabel ?? "—"}
                    </td>
                    <td className="px-4 py-3">
                      <OfferStatusPill status={row.status} />
                    </td>
                    <td className="px-4 py-3 text-sales-text-secondary">
                      {row.status === "accepted"
                        ? row.complianceLabel ?? "CDD not started"
                        : "—"}
                    </td>
                    <td className="px-4 py-3">{row.agentName ?? "—"}</td>
                    <td className="px-4 py-3 text-sales-text-secondary">
                      {row.lastEventLabel ? `${row.lastEventLabel} · ` : ""}
                      {row.lastActivityLabel}
                      <div className="text-[11px]">{row.nextActionLabel}</div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <ul className="space-y-2 lg:hidden">
            {offers.map((row) => (
              <li key={row.id}>
                <button
                  type="button"
                  className="w-full workspace-card rounded-[14px] border border-sales-border bg-sales-surface p-4 text-left"
                  onClick={() => setOpenId(row.id)}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="truncate text-[14px] font-semibold">{row.propertyLabel}</p>
                      <p className="text-[13px] text-sales-text-secondary">{row.buyerName ?? "Buyer"}</p>
                    </div>
                    <OfferStatusPill status={row.status} />
                  </div>
                  <p className="mt-2 text-[20px] font-semibold tabular-nums tracking-[-0.03em]">
                    {row.currentAmountLabel}
                  </p>
                  <p className="text-[12px] text-sales-text-muted">
                    Listing {row.listingPriceLabel ?? "—"}
                    {row.agentName ? ` · ${row.agentName}` : ""}
                  </p>
                  <p className="mt-1 text-[12px] text-sales-text-secondary">
                    {row.lastEventLabel ? `${row.lastEventLabel} · ` : ""}
                    {row.lastActivityLabel}
                  </p>
                  <p className="mt-1 text-[11px] font-medium uppercase tracking-wide text-sales-text-muted">
                    {row.nextActionLabel}
                    {row.status === "accepted"
                      ? ` · ${row.complianceLabel ?? "CDD not started"}`
                      : ""}
                  </p>
                </button>
              </li>
            ))}
          </ul>
        </>
      )}

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
