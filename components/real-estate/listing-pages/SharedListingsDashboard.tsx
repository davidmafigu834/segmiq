"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

type ShareRow = {
  id: string;
  publicUrl?: string;
  status?: string;
  campaignLabel?: string | null;
  agentName?: string | null;
  listing?: { address?: string | null; suburb?: string | null; status?: string | null; hasAuthorisedPhoto?: boolean };
};

type Summary = {
  activeLinks?: number;
  listingsMarketed?: number;
  totals?: { visits: number; uniqueVisitors: number | null; enquiries: number; viewingRequests: number; whatsappClicks: number; confirmedWhatsappLeads: number; linkToEnquiryRate: number | null };
  insights?: string[];
  byAgent?: Array<{ agentId: string; agentName: string | null; links: number }>;
};

export function SharedListingsDashboard({ clientId, mode }: { clientId: string; mode: "agent" | "manager" }) {
  const [preset, setPreset] = useState("30d");
  const [query, setQuery] = useState("");
  const [rows, setRows] = useState<ShareRow[]>([]);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [error, setError] = useState<string | null>(null);
  const base = mode === "agent" ? "/sales/shared-listings" : "/client/listing-pages";

  useEffect(() => {
    const params = new URLSearchParams({ preset, q: query });
    void Promise.all([
      fetch(`/api/clients/${clientId}/listing-shares?${params}`).then((response) => response.json()),
      fetch(`/api/clients/${clientId}/listing-shares/summary?preset=${preset}`).then((response) => response.json()),
    ]).then(([list, totals]) => {
      if (list.error) setError(list.error);
      setRows(list.shares ?? []);
      setSummary(totals.ok ? totals : null);
    }).catch(() => setError("Could not load marketing links"));
  }, [clientId, preset, query]);

  async function revoke(shareId: string) {
    const response = await fetch(`/api/clients/${clientId}/listing-shares/${shareId}/revoke`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "{}",
    });
    const json = (await response.json()) as { ok?: boolean; error?: string };
    if (!json.ok) {
      setError(json.error || "Could not revoke the link");
      return;
    }
    setRows((current) => current.map((row) => (row.id === shareId ? { ...row, status: "revoked" } : row)));
  }

  const totals = summary?.totals;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        {["7d", "30d", "90d"].map((value) => (
          <button key={value} type="button" className="h-9 rounded-[10px] border border-sales-border px-3 text-[13px]" onClick={() => setPreset(value)} aria-pressed={preset === value}>{value === "7d" ? "7 days" : value === "30d" ? "30 days" : "90 days"}</button>
        ))}
        <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search address or suburb" className="h-9 min-w-[180px] flex-1 rounded-[10px] border border-sales-border bg-transparent px-3 text-[13px]" />
      </div>
      {error ? <p className="text-[13px] text-sales-text-secondary">{error}</p> : null}
      <div className="grid gap-3 sm:grid-cols-3">
        <Metric label="Active links" value={summary?.activeLinks ?? 0} />
        <Metric label="Visits" value={totals?.visits ?? 0} />
        <Metric label="Enquiries" value={totals?.enquiries ?? 0} />
        <Metric label="Viewing requests" value={totals?.viewingRequests ?? 0} />
        <Metric label="WhatsApp taps" value={totals?.whatsappClicks ?? 0} />
        <Metric label="Link to enquiry" value={totals?.linkToEnquiryRate == null ? "—" : `${totals.linkToEnquiryRate}%`} />
      </div>
      <p className="text-[12px] text-sales-text-muted">Unique visitors are estimated on each link. WhatsApp taps are not messages sent. Confirmed WhatsApp leads: {totals?.confirmedWhatsappLeads ?? 0}.</p>
      {(summary?.insights ?? []).map((line) => <p key={line} className="text-[13px] text-sales-text-secondary">{line}</p>)}
      {mode === "manager" && summary?.byAgent?.length ? (
        <section className="rounded-[14px] border border-sales-border bg-sales-surface p-4">
          <h2 className="text-[15px] font-semibold">Links by agent</h2>
          <ul className="mt-2 space-y-1 text-[13px]">{summary.byAgent.map((row) => <li key={row.agentId}>{row.agentName || "Agent"} · {row.links} active links</li>)}</ul>
        </section>
      ) : null}
      <div className="grid gap-3">
        {rows.length === 0 ? <p className="text-[13px] text-sales-text-muted">No marketing links in this view yet.</p> : null}
        {rows.map((row) => (
          <article key={row.id} className="rounded-[14px] border border-sales-border bg-sales-surface p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 className="text-[16px] font-semibold text-sales-text-primary">{row.listing?.address || row.listing?.suburb || "Property"}</h2>
                <p className="text-[12px] text-sales-text-muted">{[mode === "manager" ? row.agentName : null, row.listing?.suburb, row.listing?.status, row.status, row.campaignLabel].filter(Boolean).join(" · ")}</p>
              </div>
              <div className="flex flex-wrap gap-2 text-[13px]">
                <button type="button" className="h-9 rounded-[10px] border border-sales-border px-3" onClick={() => row.publicUrl && void navigator.clipboard.writeText(row.publicUrl)}>Copy link</button>
                <Link className="inline-flex h-9 items-center rounded-[10px] border border-sales-border px-3" href={`${base}/${row.id}`}>Analytics</Link>
                {mode === "manager" && row.status !== "revoked" ? (
                  <button type="button" className="h-9 rounded-[10px] border border-sales-border px-3 text-sales-text-secondary" onClick={() => void revoke(row.id)}>Revoke</button>
                ) : null}
              </div>
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="rounded-[14px] border border-sales-border bg-sales-surface p-4">
      <p className="text-[12px] text-sales-text-muted">{label}</p>
      <p className="mt-1 text-[22px] font-semibold tabular-nums text-sales-text-primary">{value}</p>
    </div>
  );
}
