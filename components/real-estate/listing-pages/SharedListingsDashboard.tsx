"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { fillVisitDays, formatVisitDay, type DailyPoint } from "@/lib/real-estate/agent-listing-pages/analytics";

type ShareRow = {
  id: string;
  listingId?: string;
  publicUrl?: string;
  status?: string;
  campaignLabel?: string | null;
  agentName?: string | null;
  listing?: { address?: string | null; suburb?: string | null; status?: string | null; hasAuthorisedPhoto?: boolean };
};

type SharePeriod = {
  shareId: string;
  visits: number;
  enquiries: number;
  viewingRequests: number;
  whatsappClicks: number;
  series: DailyPoint[];
};

type Summary = {
  from?: string;
  to?: string;
  totals: {
    visits: number;
    enquiries: number;
    viewingRequests: number;
    whatsappClicks: number;
    confirmedWhatsappLeads: number;
    linkToEnquiryRate: number | null;
  };
  activeLinks: number;
  listingsMarketed: number;
  series?: DailyPoint[];
  byShare?: SharePeriod[];
  unlinked?: Array<{ id: string; address: string | null; suburb: string | null }>;
  insights: string[];
  byAgent: Array<{ agentId: string; agentName: string | null; links: number }>;
};

const rowBtn = "inline-flex h-9 shrink-0 items-center rounded-[8px] border border-sales-border bg-sales-bg px-3 text-[13px] font-semibold text-sales-text-primary transition-colors hover:bg-sales-surface-hover motion-reduce:transition-none";

function counted(n: number, singular: string, plural: string) {
  return `${n} ${n === 1 ? singular : plural}`;
}

function linePath(values: number[], width: number, height: number, pad = 2) {
  const max = Math.max(1, ...values);
  return values.map((value, index) => {
    const x = values.length <= 1 ? width / 2 : (index / (values.length - 1)) * width;
    const y = pad + (height - pad * 2) - (value / max) * (height - pad * 2);
    return `${index === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`;
  }).join(" ");
}

export function SharedListingsDashboard({ clientId, mode }: { clientId: string; mode: "agent" | "manager" }) {
  const [preset, setPreset] = useState("30d");
  const [query, setQuery] = useState("");
  const [shares, setShares] = useState<ShareRow[]>([]);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState<string | null>(null);
  const base = mode === "manager" ? "/client/listing-pages" : "/sales/shared-listings";
  const listingBase = mode === "manager" ? "/client/listings" : "/sales/listings";

  useEffect(() => {
    const timer = window.setTimeout(() => {
      const params = new URLSearchParams({ preset, limit: "100" });
      if (query.trim()) params.set("q", query.trim());
      setLoading(true);
      Promise.all([
        fetch(`/api/clients/${clientId}/listing-shares?${params.toString()}`, { cache: "no-store" }).then((response) => response.json()),
        fetch(`/api/clients/${clientId}/listing-shares/summary?preset=${preset}`, { cache: "no-store" }).then((response) => response.json()),
      ]).then(([list, totals]) => {
        if (list.error) setError(list.error);
        else {
          setError(null);
          setShares(list.shares ?? []);
        }
        if (!totals.error) setSummary(totals);
      }).catch(() => setError("Could not load marketing links.")).finally(() => setLoading(false));
    }, 250);
    return () => window.clearTimeout(timer);
  }, [clientId, preset, query]);

  const periods = summary?.byShare ?? [];
  const periodFor = (id: string) => periods.find((row) => row.shareId === id);
  const days = useMemo(() => fillVisitDays(summary?.from, summary?.to, summary?.series ?? []), [summary]);
  const visits = days.map((day) => day.visits);
  const max = Math.max(1, ...visits);
  const peak = days.reduce((best, day, index) => (day.visits > days[best].visits ? index : best), 0);
  const phrase = preset === "7d" ? "last 7 days" : preset === "90d" ? "last 90 days" : "last 30 days";
  const periodLabel = phrase.charAt(0).toUpperCase() + phrase.slice(1);
  const totals = summary?.totals;
  const needle = query.trim().toLowerCase();
  const unlinked = (summary?.unlinked ?? []).filter((listing) => {
    if (!needle) return true;
    return `${listing.address ?? ""} ${listing.suburb ?? ""}`.toLowerCase().includes(needle);
  });
  const quiet = shares.filter((share) => {
    const period = periodFor(share.id);
    return share.status !== "revoked" && (period?.visits ?? 0) > 0 && (period?.enquiries ?? 0) === 0;
  });

  async function copy(share: ShareRow) {
    if (!share.publicUrl) return;
    await navigator.clipboard.writeText(share.publicUrl);
    setCopied(share.id);
    window.setTimeout(() => setCopied((current) => (current === share.id ? null : current)), 1600);
  }

  async function revoke(shareId: string) {
    const response = await fetch(`/api/clients/${clientId}/listing-shares/${shareId}/revoke`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reason: null }),
    });
    const body = await response.json();
    if (!response.ok) {
      setError(body.error ?? "Could not revoke the link.");
      return;
    }
    setShares((current) => current.map((share) => (share.id === shareId ? { ...share, status: "revoked" } : share)));
  }

  const counts = totals
    ? [
        { label: "Active links", value: summary?.activeLinks ?? 0, gloss: (summary?.activeLinks ?? 0) === 1 ? "One page is shared" : "Pages with a live link" },
        { label: "Enquiries", value: totals.enquiries, gloss: totals.enquiries === 0 ? "None from these pages" : `${totals.enquiries} of ${totals.visits} visits` },
        { label: "Viewing requests", value: totals.viewingRequests, gloss: totals.viewingRequests === 0 ? "None requested" : "Not a booking" },
        { label: "WhatsApp taps", value: totals.whatsappClicks, gloss: totals.whatsappClicks === 0 ? "No taps" : "Not a message" },
        { label: "Confirmed WhatsApp leads", value: totals.confirmedWhatsappLeads, gloss: totals.confirmedWhatsappLeads === 0 ? "None confirmed" : "A confirmed conversation" },
      ]
    : [];

  return (
    <div className="space-y-5">
      <header className="min-w-0">
        <h1 className="font-display text-[32px] font-semibold leading-none tracking-[-0.03em] text-sales-text-primary">Marketing</h1>
        <p className="mt-2 max-w-[62ch] text-[14px] text-sales-text-secondary">Every link created from a property. The agency keeps the listing.</p>
      </header>

      <div className="flex flex-wrap items-center gap-2">
        <div className="flex gap-2" role="tablist" aria-label="Report period">
          {[["7d", "7 days"], ["30d", "30 days"], ["90d", "90 days"]].map(([id, label]) => (
            <button
              key={id}
              type="button"
              role="tab"
              aria-selected={preset === id}
              onClick={() => setPreset(id)}
              className={`inline-flex h-9 shrink-0 items-center rounded-full px-3 text-[13px] font-medium ${preset === id ? "bg-sales-text-primary text-sales-surface" : "border border-sales-border text-sales-text-secondary"}`}
            >
              {label}
            </button>
          ))}
        </div>
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search address or suburb"
          aria-label="Search address or suburb"
          className="h-9 min-w-0 flex-1 rounded-[10px] border border-sales-border bg-sales-surface px-3 text-[13px] text-sales-text-primary"
        />
      </div>

      {error ? <p className="text-[14px] text-sales-danger-fg">{error}</p> : null}

      {loading && !summary ? (
        <div className="h-48 animate-pulse rounded-[12px] border border-sales-border bg-sales-surface" />
      ) : totals ? (
        <section className="rounded-[12px] border border-sales-border bg-sales-surface px-4 pb-4 pt-4" aria-labelledby="desk-visits">
          <div className="grid gap-3 min-[1100px]:grid-cols-[minmax(180px,220px)_minmax(0,1fr)] min-[1100px]:items-end">
            <div className="min-w-0">
              <p className="text-[13px] text-sales-text-muted">{periodLabel}</p>
              <p className={`mt-2 font-display text-[40px] font-semibold leading-none tracking-[-0.04em] tabular-nums text-sales-text-primary min-[480px]:text-[48px] ${totals.visits === 0 ? "text-sales-text-muted" : ""}`}>{totals.visits}</p>
              <p className="mt-2 text-[15px] font-medium text-sales-text-primary">visits across {counted(summary?.activeLinks ?? 0, "link", "links")}</p>
              <p className="mt-1 text-[14px] text-sales-text-secondary">{totals.enquiries === 0 ? "No enquiry yet." : totals.enquiries === 1 ? "1 became an enquiry." : `${totals.enquiries} became enquiries.`}</p>
              {days[peak] && totals.visits > 0 ? (
                <p className="mt-2 text-[13px] text-sales-text-secondary">
                  <span className="text-sales-text-muted">Busiest day</span>{" "}
                  <span className="font-medium text-sales-text-primary">{formatVisitDay(days[peak].day)}</span>{" "}
                  <span className="tabular-nums">{counted(days[peak].visits, "visit", "visits")}</span>
                </p>
              ) : null}
            </div>
            <div className="min-w-0">
              <div className="flex items-baseline justify-between gap-3">
                <h2 id="desk-visits" className="text-[15px] font-semibold tracking-[-0.01em] text-sales-text-primary">Visits by day</h2>
                <p className="flex items-center gap-2 text-[12px] text-sales-text-muted">
                  <span className="inline-block h-2 w-2 rounded-full bg-sales-brand" aria-hidden />
                  Today
                </p>
              </div>
              {days.length === 0 ? (
                <p className="mt-6 text-[14px] text-sales-text-secondary">The line stays empty until a person opens a link.</p>
              ) : (
                <svg viewBox="0 0 640 132" className="mt-2 block h-auto w-full text-sales-text-primary" style={{ aspectRatio: "640 / 132" }} fontFamily="inherit" role="img" aria-label={`${totals.visits} visits in the ${phrase}`}>
                  <line x1="28" x2="628" y1="18" y2="18" stroke="currentColor" className="text-sales-border" />
                  <line x1="28" x2="628" y1="96" y2="96" stroke="currentColor" className="text-sales-border" />
                  <text x="20" y="22" textAnchor="end" fill="currentColor" className="text-sales-text-muted" fontSize="11">{max}</text>
                  <text x="20" y="100" textAnchor="end" fill="currentColor" className="text-sales-text-muted" fontSize="11">0</text>
                  <path d={`${linePath(visits, 600, 78)} L600,78 L0,78 Z`} transform="translate(28 18)" fill="currentColor" fillOpacity="0.08" />
                  <path d={linePath(visits, 600, 78)} transform="translate(28 18)" fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
                  <circle cx="628" cy={18 + 2 + 74 - ((days[days.length - 1]?.visits ?? 0) / max) * 74} r="3.5" fill="currentColor" className="text-sales-brand" />
                  <text x="28" y="122" fill="currentColor" className="text-sales-text-muted" fontSize="11">{formatVisitDay(days[0].day)}</text>
                  {days.length > 2 ? <text x="328" y="122" textAnchor="middle" fill="currentColor" className="text-sales-text-muted" fontSize="11">{formatVisitDay(days[Math.floor((days.length - 1) / 2)].day)}</text> : null}
                  <text x="628" y="122" textAnchor="end" fill="currentColor" className="text-sales-text-muted" fontSize="11">{formatVisitDay(days[days.length - 1].day)}</text>
                </svg>
              )}
            </div>
          </div>
          <p className="mt-3 text-[12px] text-sales-text-muted">Unique visitors are estimated on each link. Preview fetches from WhatsApp or Facebook are not visits.</p>
        </section>
      ) : null}

      {counts.length ? (
        <dl className="grid grid-cols-2 gap-x-6 gap-y-4 min-[1100px]:grid-cols-5">
          {counts.map((item) => (
            <div key={item.label} className="min-w-0">
              <dt className="text-[12px] text-sales-text-muted">{item.label}</dt>
              <dd className={`mt-1 text-[28px] font-semibold leading-none tracking-[-0.03em] tabular-nums ${item.value === 0 ? "text-sales-text-muted" : "text-sales-text-primary"}`}>{item.value}</dd>
              <p className="mt-1 text-[12px] leading-4 text-sales-text-secondary">{item.gloss}</p>
            </div>
          ))}
        </dl>
      ) : null}

      {mode === "manager" && summary?.byAgent?.length ? (
        <section className="rounded-[12px] border border-sales-border bg-sales-surface px-4 py-4">
          <h2 className="text-[15px] font-semibold tracking-[-0.01em] text-sales-text-primary">Links by agent</h2>
          <ul className="mt-2 space-y-1 text-[13px] text-sales-text-secondary">
            {summary.byAgent.map((agent) => <li key={agent.agentId}>{agent.agentName ?? "Agent"} · {agent.links} active</li>)}
          </ul>
        </section>
      ) : null}

      {quiet.length ? (
        <section className="overflow-hidden rounded-[12px] border border-sales-border bg-sales-surface" aria-labelledby="needs-you">
          <div className="flex items-baseline justify-between px-4 pb-2 pt-4">
            <h2 id="needs-you" className="text-[15px] font-semibold tracking-[-0.01em] text-sales-text-primary">Needs you</h2>
            <span className="text-[13px] tabular-nums text-sales-text-muted">{quiet.length}</span>
          </div>
          <ul>
            {quiet.map((share) => (
              <ShareRowView key={share.id} share={share} period={periodFor(share.id)} days={days} copied={copied === share.id} quiet listingBase={listingBase} analyticsHref={`${base}/${share.id}`} canRevoke={mode === "manager"} onCopy={() => void copy(share)} onRevoke={() => void revoke(share.id)} />
            ))}
          </ul>
        </section>
      ) : null}

      <section className="overflow-hidden rounded-[12px] border border-sales-border bg-sales-surface" aria-labelledby="link-list">
        <div className="flex items-baseline justify-between px-4 pb-2 pt-4">
          <h2 id="link-list" className="text-[15px] font-semibold tracking-[-0.01em] text-sales-text-primary">Links</h2>
          <span className="text-[13px] tabular-nums text-sales-text-muted">{shares.length}</span>
        </div>
        <ul>
          {shares.length === 0 ? (
            <li className="border-t border-sales-border-subtle px-4 py-8">
              <p className="text-[15px] font-semibold text-sales-text-primary">{query.trim() ? "No link matches that address." : "No link yet."}</p>
              <p className="mt-1 text-[13px] text-sales-text-secondary">{query.trim() ? "Try another address or suburb." : "Create the link on a property. It will show in this list."}</p>
            </li>
          ) : shares.map((share) => (
            <ShareRowView key={share.id} share={share} period={periodFor(share.id)} days={days} copied={copied === share.id} quiet={false} listingBase={listingBase} analyticsHref={`${base}/${share.id}`} canRevoke={mode === "manager"} onCopy={() => void copy(share)} onRevoke={() => void revoke(share.id)} />
          ))}
        </ul>
      </section>

      {copied ? <p className="text-[13px] text-sales-text-secondary" role="status">Link copied.</p> : null}

      {mode === "agent" && unlinked.length ? (
        <section className="overflow-hidden rounded-[12px] border border-sales-border bg-sales-surface">
          <div className="px-4 pb-2 pt-4">
            <h2 className="text-[15px] font-semibold tracking-[-0.01em] text-sales-text-primary">No link yet</h2>
            <p className="mt-1 text-[13px] text-sales-text-secondary">Create the link on the property. It will show in the list above.</p>
          </div>
          <ul>
            {unlinked.map((listing) => (
              <li key={listing.id} className="flex items-center gap-3 border-t border-sales-border-subtle px-4 py-3">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[14px] font-semibold text-sales-text-primary">{listing.address ?? "Property"}</p>
                  {listing.suburb ? <p className="truncate text-[12px] text-sales-text-muted">{listing.suburb}</p> : null}
                </div>
                <Link href={`${listingBase}/${listing.id}`} className={rowBtn}>Open property</Link>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}

function ShareRowView({
  share,
  period,
  days,
  copied,
  quiet,
  listingBase,
  analyticsHref,
  canRevoke,
  onCopy,
  onRevoke,
}: {
  share: ShareRow;
  period: SharePeriod | undefined;
  days: DailyPoint[];
  copied: boolean;
  quiet: boolean;
  listingBase: string;
  analyticsHref: string;
  canRevoke: boolean;
  onCopy: () => void;
  onRevoke: () => void;
}) {
  const counts = new Map((period?.series ?? []).map((point) => [point.day.slice(0, 10), point.visits]));
  const values = (days.length ? days : period?.series ?? []).map((point) => counts.get(point.day.slice(0, 10)) ?? (days.length ? 0 : point.visits));
  const visits = period?.visits ?? 0;
  const enquiries = period?.enquiries ?? 0;
  const enquiry = visits === 0 ? "No visits yet." : enquiries === 0 ? "No enquiry yet." : counted(enquiries, "enquiry", "enquiries");
  const listingId = share.listingId;
  return (
    <li className="flex flex-wrap items-center gap-3 border-t border-sales-border-subtle px-4 py-3">
      {quiet ? <span className="h-8 w-[3px] shrink-0 rounded-full bg-sales-danger" aria-hidden /> : null}
      <div className="min-w-[140px] flex-1">
        <p className="truncate text-[14px] font-semibold text-sales-text-primary">{share.listing?.address ?? "Property"}</p>
        <p className="truncate text-[12px] text-sales-text-muted">{[share.status === "revoked" ? "Revoked" : "Active", share.campaignLabel || "Personal link", share.agentName].filter(Boolean).join(" · ")}</p>
        <p className="mt-0.5 truncate text-[13px] text-sales-text-secondary">{enquiry}</p>
      </div>
      {values.length ? (
        <svg viewBox="0 0 88 28" className="h-7 w-[88px] shrink-0 text-sales-text-primary" aria-hidden>
          <path d={linePath(values, 88, 28, 3)} fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" strokeLinecap="round" />
        </svg>
      ) : null}
      <div className="w-12 shrink-0 text-right">
        <p className={`text-[22px] font-semibold leading-none tabular-nums tracking-[-0.03em] ${visits === 0 ? "text-sales-text-muted" : "text-sales-text-primary"}`}>{visits}</p>
        <p className="mt-1 text-[12px] text-sales-text-muted">visits</p>
      </div>
      <div className="flex flex-wrap gap-2">
        {share.publicUrl ? <button type="button" className={rowBtn} onClick={onCopy}>{copied ? "Copied" : "Copy"}</button> : null}
        {share.publicUrl ? <a className={rowBtn} href={share.publicUrl} target="_blank" rel="noreferrer">Page</a> : null}
        <Link href={analyticsHref} className={rowBtn}>Analytics</Link>
        {listingId ? <Link href={`${listingBase}/${listingId}`} className={rowBtn}>Property</Link> : null}
        {canRevoke && share.status !== "revoked" ? <button type="button" className={rowBtn} onClick={onRevoke}>Revoke</button> : null}
      </div>
    </li>
  );
}
