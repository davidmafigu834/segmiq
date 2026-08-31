"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { formatConversionPct, RE_SOURCE_LABEL, RE_SOURCE_TYPES } from "@/lib/real-estate/marketing";
import { WorkspaceUnderlineTabs } from "@/components/real-estate/workspace-chrome";
import { CompanyKpiCard } from "@/components/dashboard/company/CompanyKpiCard";

type Funnel = {
  inquiries: number;
  qualified: number;
  viewings: number;
  offers: number;
  accepted: number;
};

type SourceRow = Funnel & {
  sourceType: string;
  label: string;
  conversion: number | null;
};

type CampaignRow = Funnel & {
  id: string;
  name: string;
  platform: string;
  status: string;
  listingId: string | null;
  propertyLabel: string | null;
  spend: number | null;
  spendKind: "synced" | "reported" | null;
  costPerInquiry: number | null;
  costPerQualified: number | null;
  conversion: number | null;
  flags: Array<{ id: string; label: string }>;
};

type PropertyRow = Funnel & {
  listingId: string;
  propertyLabel: string;
  status: string;
  campaigns: number;
  daysListed: number | null;
  insight: string | null;
};

type AgentRow = Funnel & {
  agentId: string | null;
  name: string;
  assigned: number;
  contacted: number;
  uncontacted: number;
};

type Dashboard = {
  range: { from: string; to: string; label: string };
  cohortLabel: string;
  kpis: Funnel & { costPerInquiry: number | null; costPerQualified: number | null };
  funnel: Funnel;
  rates: {
    inquiryToQualified: number | null;
    qualifiedToViewing: number | null;
    viewingToOffer: number | null;
    offerToAccepted: number | null;
    inquiryToAccepted: number | null;
  };
  sources: SourceRow[];
  campaigns: CampaignRow[];
  properties: PropertyRow[];
  agents: AgentRow[];
  handoff: {
    assigned: number;
    contacted: number;
    uncontacted: number;
    medianFirstResponseMins: number | null;
    within15Pct: number | null;
    uncontactedAfter24h: number;
  };
  latest: Array<{
    leadId: string;
    name: string;
    sourceLabel: string;
    propertyLabel: string | null;
    agentName: string | null;
    createdAt: string;
    qualified: boolean;
    stageLabel?: string;
  }>;
  filterOptions: {
    listings: Array<{ id: string; label: string }>;
    campaigns: Array<{ id: string; name: string }>;
    agents: Array<{ id: string; name: string }>;
  };
};

type Tab = "overview" | "sources" | "campaigns" | "properties" | "website";

const PRESETS = [
  { id: "today", label: "Today" },
  { id: "last_7", label: "Last 7 days" },
  { id: "this_month", label: "This month" },
  { id: "last_month", label: "Last month" },
  { id: "custom", label: "Custom" },
] as const;

const DEAL_SIDES = [
  { id: "", label: "All sides" },
  { id: "buy_side", label: "Buyer" },
  { id: "sell_side", label: "Seller" },
  { id: "landlord_side", label: "Landlord" },
  { id: "tenant_side", label: "Tenant" },
];

function formatMins(n: number | null): string {
  if (n == null) return "—";
  if (n < 60) return `${Math.round(n)} min`;
  const h = Math.floor(n / 60);
  const m = Math.round(n % 60);
  return m ? `${h}h ${m}m` : `${h}h`;
}

function spendLabel(kind: CampaignRow["spendKind"]): string {
  if (kind === "synced") return "Synced spend";
  if (kind === "reported") return "Reported spend";
  return "Spend";
}

function platformLabel(p: string): string {
  if (p === "facebook") return "Facebook Ads";
  if (p === "instagram") return "Instagram Ads";
  if (p === "website") return "Website";
  return "Other";
}

function FunnelBlock({ funnel, rates }: { funnel: Funnel; rates: Dashboard["rates"] }) {
  const steps = [
    { label: "Inquiries", value: funnel.inquiries },
    { label: "Qualified", value: funnel.qualified, rate: rates.inquiryToQualified },
    { label: "Viewings", value: funnel.viewings, rate: rates.qualifiedToViewing },
    { label: "Offers", value: funnel.offers, rate: rates.viewingToOffer },
    { label: "Accepted offers", value: funnel.accepted, rate: rates.offerToAccepted },
  ];
  return (
    <div className="rounded-[10px] border border-sales-border-subtle p-4">
      <p className="text-[13px] font-semibold text-sales-text-primary">Acquisition cohort funnel</p>
      <p className="mt-0.5 text-[12px] text-sales-text-muted">
        Same inquiries, tracked through qualification, viewing and offer.
      </p>
      <ol className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-5">
        {steps.map((s, i) => (
          <li key={s.label} className="min-w-0">
            <p className="text-[22px] font-semibold tabular-nums tracking-[-0.03em]">{s.value}</p>
            <p className="text-[12px] text-sales-text-secondary">{s.label}</p>
            {i > 0 ? (
              <p className="mt-1 text-[11px] text-sales-text-muted">{formatConversionPct(s.rate ?? null)}</p>
            ) : null}
          </li>
        ))}
      </ol>
      <p className="mt-3 text-[12px] text-sales-text-secondary">
        Accepted offer conversion {formatConversionPct(rates.inquiryToAccepted)}
      </p>
    </div>
  );
}

export function RealEstateMarketingWorkspace({
  clientId,
}: {
  clientId: string;
  clientName?: string;
}) {
  const [tab, setTab] = useState<Tab>("overview");
  const [preset, setPreset] = useState("this_month");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [source, setSource] = useState("");
  const [campaign, setCampaign] = useState("");
  const [listing, setListing] = useState("");
  const [agent, setAgent] = useState("");
  const [dealSide, setDealSide] = useState("");
  const [data, setData] = useState<Dashboard | null>(null);
  const [loading, setLoading] = useState(true);
  const [openCampaign, setOpenCampaign] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  const query = useMemo(() => {
    const p = new URLSearchParams({ preset });
    if (preset === "custom" && from) p.set("from", from);
    if (preset === "custom" && to) p.set("to", to);
    if (source) p.set("source", source);
    if (campaign) p.set("campaign", campaign);
    if (listing) p.set("listing", listing);
    if (agent) p.set("agent", agent);
    if (dealSide) p.set("deal_side", dealSide);
    return p.toString();
  }, [preset, from, to, source, campaign, listing, agent, dealSide]);

  const load = useCallback(async () => {
    setLoading(true);
    const res = await fetch(`/api/clients/${clientId}/marketing/attribution?${query}`);
    const json = (await res.json()) as Dashboard;
    setData(json);
    setLoading(false);
  }, [clientId, query]);

  useEffect(() => {
    void load();
  }, [load]);

  const kpis = data
    ? [
        { label: "Inquiries", value: data.kpis.inquiries },
        { label: "Qualified", value: data.kpis.qualified },
        { label: "Viewings", value: data.kpis.viewings },
        { label: "Offers", value: data.kpis.offers },
        { label: "Accepted", value: data.kpis.accepted },
        ...(data.kpis.costPerInquiry != null
          ? [{ label: "Cost / inquiry", value: `US$${data.kpis.costPerInquiry}` }]
          : []),
        ...(data.kpis.costPerQualified != null
          ? [{ label: "Cost / qualified", value: `US$${data.kpis.costPerQualified}` }]
          : []),
      ]
    : [];

  const selectedCampaign = data?.campaigns.find((c) => c.id === openCampaign) ?? null;

  return (
    <div className="min-w-0 w-full max-w-full space-y-3">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 flex-wrap gap-2">
        {PRESETS.map((p) => (
          <button
            key={p.id}
            type="button"
            onClick={() => setPreset(p.id)}
            className={`h-9 rounded-[10px] px-3 text-[12px] font-medium ${
              preset === p.id
                ? "border border-sales-brand-border bg-sales-brand-soft text-sales-text-primary"
                : "border border-sales-border text-sales-text-secondary"
            }`}
          >
            {p.label}
          </button>
        ))}
        {preset === "custom" ? (
          <>
            <input type="date" className={filterClass} value={from} onChange={(e) => setFrom(e.target.value)} />
            <input type="date" className={filterClass} value={to} onChange={(e) => setTo(e.target.value)} />
          </>
        ) : null}
        </div>
        <div className="flex min-w-0 flex-wrap items-center gap-2 sm:justify-end">
        <select className={filterClass} value={source} onChange={(e) => setSource(e.target.value)}>
          <option value="">All sources</option>
          {RE_SOURCE_TYPES.map((s) => (
            <option key={s} value={s}>
              {RE_SOURCE_LABEL[s]}
            </option>
          ))}
        </select>
        <select className={filterClass} value={campaign} onChange={(e) => setCampaign(e.target.value)}>
          <option value="">All campaigns</option>
          {(data?.filterOptions.campaigns ?? []).map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
        <select className={filterClass} value={listing} onChange={(e) => setListing(e.target.value)}>
          <option value="">All properties</option>
          {(data?.filterOptions.listings ?? []).map((l) => (
            <option key={l.id} value={l.id}>
              {l.label}
            </option>
          ))}
        </select>
        <select className={filterClass} value={agent} onChange={(e) => setAgent(e.target.value)}>
          <option value="">All agents</option>
          {(data?.filterOptions.agents ?? []).map((a) => (
            <option key={a.id} value={a.id}>
              {a.name}
            </option>
          ))}
        </select>
        <select className={filterClass} value={dealSide} onChange={(e) => setDealSide(e.target.value)}>
          {DEAL_SIDES.map((d) => (
            <option key={d.id} value={d.id}>
              {d.label}
            </option>
          ))}
        </select>
        <a
          className="inline-flex h-9 items-center rounded-[10px] border border-sales-border px-3 text-[12px] font-medium"
          href={`/api/clients/${clientId}/marketing/attribution/export?${query}`}
        >
          Export CSV
        </a>
        </div>
      </div>

      <section className="overflow-hidden workspace-card rounded-[14px] border border-sales-border bg-sales-surface shadow-sales-card">
      <WorkspaceUnderlineTabs
        items={[
          { id: "overview" as Tab, label: "Overview" },
          { id: "sources", label: "Lead sources" },
          { id: "campaigns", label: "Campaigns" },
          { id: "properties", label: "Properties" },
          { id: "website", label: "Website" },
        ]}
        value={tab}
        onChange={setTab}
      />
      <div className="space-y-3 p-4 sm:p-5">

      {loading && !data ? (
        <p className="text-[13px] text-sales-text-muted">Loading marketing…</p>
      ) : null}

      {data ? (
        <>
          <p className="mb-3 text-[12px] text-sales-text-muted">{data.cohortLabel}</p>

          {tab === "overview" || tab === "sources" || tab === "campaigns" || tab === "properties" ? (
            <div className="grid w-full grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
              {kpis.slice(0, 5).map((c) => (
                <CompanyKpiCard
                  key={c.label}
                  item={{
                    id: c.label,
                    label: c.label,
                    value: String(c.value),
                    supporting: data.range.label,
                    icon: c.label.startsWith("Cost") ? "pipeline" : "enquiries",
                  }}
                />
              ))}
            </div>
          ) : null}

          {tab === "overview" ? (
            <div className="space-y-3">
              <FunnelBlock funnel={data.funnel} rates={data.rates} />
              <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
                <div className="rounded-[10px] border border-sales-border-subtle p-4">
                  <p className="text-[13px] font-semibold">Agent handoff</p>
                  <dl className="mt-3 grid grid-cols-2 gap-3 text-[13px]">
                    <div>
                      <dt className="text-sales-text-muted">Assigned</dt>
                      <dd className="font-semibold tabular-nums">{data.handoff.assigned}</dd>
                    </div>
                    <div>
                      <dt className="text-sales-text-muted">Contacted</dt>
                      <dd className="font-semibold tabular-nums">{data.handoff.contacted}</dd>
                    </div>
                    <div>
                      <dt className="text-sales-text-muted">Uncontacted</dt>
                      <dd className="font-semibold tabular-nums">{data.handoff.uncontacted}</dd>
                    </div>
                    <div>
                      <dt className="text-sales-text-muted">Median first response</dt>
                      <dd className="font-semibold tabular-nums">
                        {formatMins(data.handoff.medianFirstResponseMins)}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-sales-text-muted">Within 15 min</dt>
                      <dd className="font-semibold tabular-nums">
                        {formatConversionPct(data.handoff.within15Pct)}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-sales-text-muted">Uncontacted after 24h</dt>
                      <dd className="font-semibold tabular-nums">{data.handoff.uncontactedAfter24h}</dd>
                    </div>
                  </dl>
                  <p className="mt-3 text-[11px] text-sales-text-muted">
                    First response is a logged call, outbound WhatsApp from an agent, or recorded intake. Automatic
                    messages are excluded.
                  </p>
                </div>
                <div className="rounded-[10px] border border-sales-border-subtle p-4">
                  <p className="text-[13px] font-semibold">Latest inquiries</p>
                  {data.latest.length === 0 ? (
                    <p className="mt-3 text-[13px] text-sales-text-muted">
                      Source attribution will appear as new inquiries are captured through connected channels.
                    </p>
                  ) : (
                    <ul className="mt-2 divide-y divide-sales-border-subtle">
                      {data.latest.map((r) => (
                        <li key={r.leadId} className="flex items-center justify-between gap-3 py-2">
                          <div className="min-w-0">
                            <p className="truncate text-[13px] font-medium">{r.name}</p>
                            <p className="truncate text-[12px] text-sales-text-muted">
                              {[r.sourceLabel, r.propertyLabel, r.agentName].filter(Boolean).join(" · ")}
                            </p>
                          </div>
                          <Link
                            href={`/client/leads?lead=${r.leadId}`}
                            className="shrink-0 text-[12px] font-medium underline"
                          >
                            Open inquiry
                          </Link>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>
              <AgentTable rows={data.agents} />
            </div>
          ) : null}

          {tab === "sources" ? (
            data.sources.length === 0 ? (
              <EmptyCard
                title="No source data yet"
                body="Source attribution will appear as new inquiries are captured through connected channels."
              />
            ) : (
              <SourceTable rows={data.sources} />
            )
          ) : null}

          {tab === "campaigns" ? (
            <div className="space-y-4">
              <div className="flex justify-end">
                <button
                  type="button"
                  className="h-9 rounded-[10px] bg-sales-brand px-3 text-[12px] font-semibold"
                  onClick={() => setCreating(true)}
                >
                  Create campaign
                </button>
              </div>
              {data.campaigns.length === 0 ? (
                <EmptyCard
                  title="No campaigns connected yet"
                  body="Connect a lead source or create a campaign to start measuring marketing performance."
                />
              ) : (
                <CampaignTable
                  rows={source ? data.campaigns.filter((c) => c.inquiries > 0) : data.campaigns}
                  onOpen={setOpenCampaign}
                />
              )}
              {selectedCampaign ? (
                <CampaignDetail
                  campaign={selectedCampaign}
                  onClose={() => setOpenCampaign(null)}
                />
              ) : null}
              {creating ? (
                <CampaignForm
                  clientId={clientId}
                  listings={data.filterOptions.listings}
                  agents={data.filterOptions.agents}
                  onClose={() => setCreating(false)}
                  onSaved={() => {
                    setCreating(false);
                    void load();
                  }}
                />
              ) : null}
            </div>
          ) : null}

          {tab === "properties" ? (
            data.properties.length === 0 ? (
              <EmptyCard
                title="No property marketing yet"
                body="Inquiries linked to a listing will appear here with qualification, viewing and offer outcomes."
              />
            ) : (
              <PropertyTable rows={data.properties} />
            )
          ) : null}

          {tab === "website" ? (
            <p className="text-[13px] text-sales-text-secondary">
              Website key, setup and latest website inquiries live on{" "}
              <Link href="/client/marketing/website-leads" className="underline">
                Website Leads
              </Link>
              .
            </p>
          ) : null}
        </>
      ) : null}
        </div>
      </section>
    </div>
  );
}

const filterClass =
  "h-9 rounded-[10px] border border-sales-border bg-sales-surface px-2.5 text-[12px] text-sales-text-primary";

function EmptyCard({ title, body }: { title: string; body: string }) {
  return (
    <div className="px-5 py-10 text-center">
      <p className="text-[15px] font-semibold">{title}</p>
      <p className="mx-auto mt-1 max-w-md text-[13px] text-sales-text-secondary">{body}</p>
    </div>
  );
}

function SourceTable({ rows }: { rows: SourceRow[] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[640px] text-left text-[13px]">
        <thead>
          <tr className="border-b border-sales-border-subtle text-[11px] font-semibold uppercase tracking-wide text-sales-text-muted">
            <th className="px-4 py-3">Source</th>
            <th className="px-4 py-3 text-right">Inquiries</th>
            <th className="px-4 py-3 text-right">Qualified</th>
            <th className="px-4 py-3 text-right">Viewings</th>
            <th className="px-4 py-3 text-right">Offers</th>
            <th className="px-4 py-3 text-right">Accepted</th>
            <th className="px-4 py-3 text-right">Conversion</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-sales-border-subtle">
          {rows.map((r) => (
            <tr key={r.sourceType}>
              <td className="px-4 py-3 font-medium">{r.label}</td>
              <td className="px-4 py-3 text-right tabular-nums">{r.inquiries}</td>
              <td className="px-4 py-3 text-right tabular-nums">{r.qualified}</td>
              <td className="px-4 py-3 text-right tabular-nums">{r.viewings}</td>
              <td className="px-4 py-3 text-right tabular-nums">{r.offers}</td>
              <td className="px-4 py-3 text-right tabular-nums">{r.accepted}</td>
              <td className="px-4 py-3 text-right tabular-nums">{formatConversionPct(r.conversion)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function CampaignTable({
  rows,
  onOpen,
}: {
  rows: CampaignRow[];
  onOpen: (id: string) => void;
}) {
  return (
    <div className="space-y-3">
      <div className="hidden overflow-x-auto md:block">
        <table className="w-full min-w-[800px] text-left text-[13px]">
          <thead>
            <tr className="border-b border-sales-border-subtle text-[11px] font-semibold uppercase tracking-wide text-sales-text-muted">
              <th className="px-4 py-3">Campaign</th>
              <th className="px-4 py-3">Platform</th>
              <th className="px-4 py-3">Property</th>
              <th className="px-4 py-3 text-right">Spend</th>
              <th className="px-4 py-3 text-right">Inquiries</th>
              <th className="px-4 py-3 text-right">Qualified</th>
              <th className="px-4 py-3 text-right">Viewings</th>
              <th className="px-4 py-3 text-right">Offers</th>
              <th className="px-4 py-3 text-right">Accepted</th>
              <th className="px-4 py-3">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-sales-border-subtle">
            {rows.map((r) => (
              <tr key={r.id} className="cursor-pointer hover:bg-sales-surface-hover" onClick={() => onOpen(r.id)}>
                <td className="px-4 py-3 font-medium">{r.name}</td>
                <td className="px-4 py-3">{platformLabel(r.platform)}</td>
                <td className="px-4 py-3">{r.propertyLabel ?? "—"}</td>
                <td className="px-4 py-3 text-right tabular-nums">
                  {r.spend != null ? `US$${r.spend}` : "—"}
                </td>
                <td className="px-4 py-3 text-right tabular-nums">{r.inquiries}</td>
                <td className="px-4 py-3 text-right tabular-nums">{r.qualified}</td>
                <td className="px-4 py-3 text-right tabular-nums">{r.viewings}</td>
                <td className="px-4 py-3 text-right tabular-nums">{r.offers}</td>
                <td className="px-4 py-3 text-right tabular-nums">{r.accepted}</td>
                <td className="px-4 py-3 capitalize">{r.status}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="space-y-3 md:hidden">
        {rows.map((r) => (
          <button
            key={r.id}
            type="button"
            onClick={() => onOpen(r.id)}
            className="w-full rounded-[10px] border border-sales-border-subtle p-4 text-left"
          >
            <p className="font-semibold">{r.name}</p>
            <p className="mt-1 text-[12px] text-sales-text-secondary">
              {platformLabel(r.platform)} · {r.propertyLabel ?? "No property"} · {r.inquiries} inquiries
            </p>
          </button>
        ))}
      </div>
    </div>
  );
}

function CampaignDetail({ campaign, onClose }: { campaign: CampaignRow; onClose: () => void }) {
  const rates = {
    inquiryToQualified: pct(campaign.qualified, campaign.inquiries),
    qualifiedToViewing: pct(campaign.viewings, campaign.qualified),
    viewingToOffer: pct(campaign.offers, campaign.viewings),
    offerToAccepted: pct(campaign.accepted, campaign.offers),
    inquiryToAccepted: pct(campaign.accepted, campaign.inquiries),
  };
  return (
    <div className="rounded-[10px] border border-sales-border-subtle p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-[18px] font-semibold tracking-[-0.02em]">{campaign.name}</h2>
          <p className="mt-1 text-[13px] text-sales-text-secondary">
            {platformLabel(campaign.platform)} · {campaign.propertyLabel ?? "No property mapped"} ·{" "}
            <span className="capitalize">{campaign.status}</span>
          </p>
        </div>
        <button type="button" className="text-[12px] text-sales-text-muted" onClick={onClose}>
          Close
        </button>
      </div>
      {campaign.spend != null ? (
        <p className="mt-3 text-[13px]">
          {spendLabel(campaign.spendKind)}: US${campaign.spend}
          {campaign.costPerInquiry != null ? ` · US$${campaign.costPerInquiry} / inquiry` : ""}
        </p>
      ) : (
        <p className="mt-3 text-[12px] text-sales-text-muted">
          No spend on file. Enter a reported budget on the campaign if you want cost metrics. This is not live Meta
          spend.
        </p>
      )}
      <div className="mt-4">
        <FunnelBlock funnel={campaign} rates={rates} />
      </div>
      {campaign.flags.length > 0 ? (
        <ul className="mt-3 flex flex-wrap gap-2">
          {campaign.flags.map((f) => (
            <li
              key={f.id + f.label}
              className="rounded-full border border-sales-border px-2.5 py-1 text-[11px] text-sales-text-secondary"
            >
              {f.label}
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

function pct(n: number, d: number): number | null {
  if (!d) return null;
  return Math.round((n / d) * 1000) / 10;
}

function PropertyTable({ rows }: { rows: PropertyRow[] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[720px] text-left text-[13px]">
        <thead>
          <tr className="border-b border-sales-border-subtle text-[11px] font-semibold uppercase tracking-wide text-sales-text-muted">
            <th className="px-4 py-3">Property</th>
            <th className="px-4 py-3 text-right">Inquiries</th>
            <th className="px-4 py-3 text-right">Qualified</th>
            <th className="px-4 py-3 text-right">Viewings</th>
            <th className="px-4 py-3 text-right">Offers</th>
            <th className="px-4 py-3 text-right">Accepted</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-sales-border-subtle">
          {rows.map((r) => (
            <tr key={r.listingId}>
              <td className="px-4 py-3">
                <Link href={`/client/listings/${r.listingId}`} className="font-medium hover:underline">
                  {r.propertyLabel}
                </Link>
                <p className="mt-0.5 text-[12px] capitalize text-sales-text-muted">
                  {r.status.replace(/_/g, " ")}
                  {r.campaigns ? ` · ${r.campaigns} campaign${r.campaigns === 1 ? "" : "s"}` : ""}
                  {r.daysListed != null ? ` · ${r.daysListed} days listed` : ""}
                  {r.insight ? ` · ${r.insight}` : ""}
                </p>
              </td>
              <td className="px-4 py-3 text-right tabular-nums">{r.inquiries}</td>
              <td className="px-4 py-3 text-right tabular-nums">{r.qualified}</td>
              <td className="px-4 py-3 text-right tabular-nums">{r.viewings}</td>
              <td className="px-4 py-3 text-right tabular-nums">{r.offers}</td>
              <td className="px-4 py-3 text-right tabular-nums">{r.accepted}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function AgentTable({ rows }: { rows: AgentRow[] }) {
  if (rows.length === 0) return null;
  return (
    <div className="overflow-x-auto">
      <p className="px-4 pt-1 text-[13px] font-semibold">Marketing → agent</p>
      <table className="mt-2 w-full min-w-[640px] text-left text-[13px]">
        <thead>
          <tr className="border-b border-sales-border-subtle text-[11px] font-semibold uppercase tracking-wide text-sales-text-muted">
            <th className="px-4 py-3">Agent</th>
            <th className="px-4 py-3 text-right">Assigned</th>
            <th className="px-4 py-3 text-right">Contacted</th>
            <th className="px-4 py-3 text-right">Qualified</th>
            <th className="px-4 py-3 text-right">Viewings</th>
            <th className="px-4 py-3 text-right">Offers</th>
            <th className="px-4 py-3 text-right">Accepted</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-sales-border-subtle">
          {rows.map((r) => (
            <tr key={r.agentId ?? "unassigned"}>
              <td className="px-4 py-3 font-medium">{r.name}</td>
              <td className="px-4 py-3 text-right tabular-nums">{r.assigned}</td>
              <td className="px-4 py-3 text-right tabular-nums">{r.contacted}</td>
              <td className="px-4 py-3 text-right tabular-nums">{r.qualified}</td>
              <td className="px-4 py-3 text-right tabular-nums">{r.viewings}</td>
              <td className="px-4 py-3 text-right tabular-nums">{r.offers}</td>
              <td className="px-4 py-3 text-right tabular-nums">{r.accepted}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function CampaignForm({
  clientId,
  listings,
  agents,
  onClose,
  onSaved,
}: {
  clientId: string;
  listings: Array<{ id: string; label: string }>;
  agents: Array<{ id: string; name: string }>;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [name, setName] = useState("");
  const [platform, setPlatform] = useState("facebook");
  const [listingId, setListingId] = useState("");
  const [agentId, setAgentId] = useState("");
  const [formId, setFormId] = useState("");
  const [externalId, setExternalId] = useState("");
  const [spend, setSpend] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function save() {
    if (!name.trim()) {
      setError("Name is required.");
      return;
    }
    setBusy(true);
    const res = await fetch(`/api/clients/${clientId}/marketing/acquisition-campaigns`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: name.trim(),
        platform,
        listing_id: listingId || null,
        default_agent_id: agentId || null,
        form_id: formId.trim() || null,
        external_campaign_id: externalId.trim() || null,
        reported_spend: spend ? Number(spend) : null,
      }),
    });
    const json = (await res.json()) as { error?: string };
    setBusy(false);
    if (!res.ok) {
      setError(json.error ?? "Could not save campaign.");
      return;
    }
    onSaved();
  }

  return (
    <div className="workspace-card rounded-[14px] border border-sales-border bg-sales-surface p-5">
      <div className="mb-3 flex items-center justify-between">
        <p className="text-[14px] font-semibold">New property campaign</p>
        <button type="button" className="text-[12px] text-sales-text-muted" onClick={onClose}>
          Cancel
        </button>
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <label className="text-[12px]">
          Name
          <input className={`${filterClass} mt-1 w-full`} value={name} onChange={(e) => setName(e.target.value)} />
        </label>
        <label className="text-[12px]">
          Platform
          <select className={`${filterClass} mt-1 w-full`} value={platform} onChange={(e) => setPlatform(e.target.value)}>
            <option value="facebook">Facebook Ads</option>
            <option value="instagram">Instagram Ads</option>
            <option value="website">Website</option>
            <option value="other">Other</option>
          </select>
        </label>
        <label className="text-[12px]">
          Property
          <select className={`${filterClass} mt-1 w-full`} value={listingId} onChange={(e) => setListingId(e.target.value)}>
            <option value="">None</option>
            {listings.map((l) => (
              <option key={l.id} value={l.id}>
                {l.label}
              </option>
            ))}
          </select>
        </label>
        <label className="text-[12px]">
          Default agent
          <select className={`${filterClass} mt-1 w-full`} value={agentId} onChange={(e) => setAgentId(e.target.value)}>
            <option value="">Unassigned</option>
            {agents.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
          </select>
        </label>
        <label className="text-[12px]">
          Meta form ID
          <input className={`${filterClass} mt-1 w-full`} value={formId} onChange={(e) => setFormId(e.target.value)} />
        </label>
        <label className="text-[12px]">
          External campaign ID
          <input
            className={`${filterClass} mt-1 w-full`}
            value={externalId}
            onChange={(e) => setExternalId(e.target.value)}
          />
        </label>
        <label className="text-[12px]">
          Reported spend (optional)
          <input
            className={`${filterClass} mt-1 w-full`}
            value={spend}
            onChange={(e) => setSpend(e.target.value)}
            inputMode="decimal"
            placeholder="Not live Meta spend"
          />
        </label>
      </div>
      {error ? <p className="mt-2 text-[12px] text-red-700">{error}</p> : null}
      <button
        type="button"
        disabled={busy}
        onClick={() => void save()}
        className="mt-4 h-9 rounded-[10px] bg-sales-brand px-4 text-[12px] font-semibold"
      >
        Save campaign
      </button>
    </div>
  );
}
