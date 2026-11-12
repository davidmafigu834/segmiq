"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { fillVisitDays, formatVisitDay, type DailyPoint } from "@/lib/real-estate/agent-listing-pages/analytics";

type Totals = {
  visits: number;
  uniqueVisitors: number | null;
  enquiries: number;
  viewingRequests: number;
  whatsappClicks: number;
  confirmedWhatsappLeads: number;
};

type LinkInfo = {
  address: string | null;
  suburb: string | null;
  listingId: string;
  campaignLabel: string | null;
  status: string;
  publicUrl: string | null;
};

type Payload = {
  from?: string;
  to?: string;
  totals: Totals;
  series: DailyPoint[];
  insights: string[];
  outcomeNote: string | null;
  sources?: Array<{ source: string; label: string; visits: number }>;
  link?: LinkInfo;
};

const lineBtn = "inline-flex h-11 items-center rounded-[8px] border border-sales-border bg-sales-bg px-3 text-[13px] font-semibold text-sales-text-primary transition-colors hover:bg-sales-surface-hover motion-reduce:transition-none";

function counted(n: number, singular: string, plural: string) {
  return `${n} ${n === 1 ? singular : plural}`;
}

const VB_W = 640;
const VB_H = 168;
const PAD = { l: 36, r: 12, t: 16, b: 28 };

function xAt(index: number, length: number) {
  const width = VB_W - PAD.l - PAD.r;
  if (length <= 1) return PAD.l + width / 2;
  return PAD.l + (index / (length - 1)) * width;
}

function yAt(value: number, max: number) {
  const height = VB_H - PAD.t - PAD.b;
  return PAD.t + height - (value / Math.max(1, max)) * height;
}

export function LinkAnalyticsView({
  clientId,
  shareId,
  homeHref = "/sales/shared-listings",
  listingBase = "/sales/listings",
}: {
  clientId: string;
  shareId: string;
  homeHref?: string;
  listingBase?: string;
}) {
  const [preset, setPreset] = useState("30d");
  const [data, setData] = useState<Payload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);
  const [index, setIndex] = useState<number | null>(null);
  const [confirming, setConfirming] = useState(false);

  useEffect(() => {
    setLoading(true);
    setIndex(null);
    fetch(`/api/clients/${clientId}/listing-shares/${shareId}/analytics?preset=${preset}`, { cache: "no-store" })
      .then((response) => response.json())
      .then((body) => {
        if (body.error) setError(body.error);
        else {
          setError(null);
          setData(body);
        }
      })
      .catch(() => setError("Could not load analytics."))
      .finally(() => setLoading(false));
  }, [clientId, shareId, preset]);

  const days = useMemo(() => fillVisitDays(data?.from, data?.to, data?.series ?? []), [data]);
  const totals = data?.totals;
  const max = Math.max(1, ...days.map((day) => day.visits));
  const peak = days.reduce((best, day, cursor) => (day.visits > days[best].visits ? cursor : best), 0);
  const selectedIndex = index ?? peak;
  const selected = days[selectedIndex];
  const phrase = preset === "7d" ? "last 7 days" : preset === "90d" ? "last 90 days" : "last 30 days";
  const periodLabel = phrase.charAt(0).toUpperCase() + phrase.slice(1);
  const link = data?.link;
  const quiet = Boolean(totals && totals.visits > 0 && totals.enquiries === 0);
  const sources = data?.sources ?? [];
  const sourceMax = Math.max(1, ...sources.map((source) => source.visits));

  function selectAt(clientX: number, node: HTMLElement) {
    const box = node.getBoundingClientRect();
    const ratio = box.width <= 0 ? 0 : (clientX - box.left) / box.width;
    const plotStart = PAD.l / VB_W;
    const plotEnd = (VB_W - PAD.r) / VB_W;
    const t = Math.min(1, Math.max(0, (ratio - plotStart) / (plotEnd - plotStart)));
    setIndex(Math.round(t * Math.max(0, days.length - 1)));
  }

  async function copy() {
    if (!link?.publicUrl) return;
    await navigator.clipboard.writeText(link.publicUrl);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1600);
  }

  async function revoke() {
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
    setData((current) => (current?.link ? { ...current, link: { ...current.link, status: "revoked" } } : current));
    setConfirming(false);
  }

  const line = days.map((day, cursor) => `${cursor === 0 ? "M" : "L"}${xAt(cursor, days.length).toFixed(1)},${yAt(day.visits, max).toFixed(1)}`).join(" ");
  const area = days.length
    ? `${line} L${xAt(days.length - 1, days.length).toFixed(1)},${yAt(0, max).toFixed(1)} L${xAt(0, days.length).toFixed(1)},${yAt(0, max).toFixed(1)} Z`
    : "";
  const labelAt = days.length <= 2 ? days.map((_, cursor) => cursor) : [0, Math.floor((days.length - 1) / 2), days.length - 1];

  const counts = totals
    ? [
        { label: "Unique visitors", value: totals.uniqueVisitors == null ? "n/a" : String(totals.uniqueVisitors), quiet: totals.uniqueVisitors == null, gloss: "Estimated from this link" },
        { label: "Enquiries", value: String(totals.enquiries), quiet: totals.enquiries === 0, gloss: totals.enquiries === 0 ? "None from this page" : `${totals.enquiries} of ${totals.visits} visits` },
        { label: "Viewing requests", value: String(totals.viewingRequests), quiet: totals.viewingRequests === 0, gloss: totals.viewingRequests === 0 ? "None requested" : "Not a booking" },
        { label: "WhatsApp taps", value: String(totals.whatsappClicks), quiet: totals.whatsappClicks === 0, gloss: totals.whatsappClicks === 0 ? "No taps" : "Not a message" },
        { label: "Confirmed WhatsApp leads", value: String(totals.confirmedWhatsappLeads), quiet: totals.confirmedWhatsappLeads === 0, gloss: totals.confirmedWhatsappLeads === 0 ? "None confirmed" : "A confirmed conversation" },
      ]
    : [];

  return (
    <div className="space-y-5">
      <div>
        <Link href={homeHref} className="text-[13px] font-medium text-sales-text-secondary">Marketing</Link>
        <h1 className="mt-1 font-display text-[32px] font-semibold leading-none tracking-[-0.03em] text-sales-text-primary">{link?.address ?? "This link"}</h1>
        <p className="mt-2 text-[13px] text-sales-text-muted">{[link?.suburb, link?.status === "revoked" ? "Revoked" : link ? "Active" : null, link?.campaignLabel || (link ? "Personal link" : null)].filter(Boolean).join(" · ")}</p>
      </div>

      <div className="flex flex-wrap gap-2">
        {link?.publicUrl ? <a className={lineBtn} href={link.publicUrl} target="_blank" rel="noreferrer">View page</a> : null}
        {link?.publicUrl ? <button type="button" className={lineBtn} onClick={() => void copy()}>{copied ? "Copied" : "Copy link"}</button> : null}
        {link?.listingId ? <Link href={`${listingBase}/${link.listingId}`} className={lineBtn}>Open property</Link> : null}
      </div>

      <div className="flex gap-2" role="tablist" aria-label="Report period">
        {[["7d", "7 days"], ["30d", "30 days"], ["90d", "90 days"]].map(([id, label]) => (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={preset === id}
            onClick={() => { setPreset(id); setConfirming(false); }}
            className={`inline-flex h-9 shrink-0 items-center rounded-full px-3 text-[13px] font-medium ${preset === id ? "bg-sales-text-primary text-sales-surface" : "border border-sales-border text-sales-text-secondary"}`}
          >
            {label}
          </button>
        ))}
      </div>

      {error ? <p className="text-[14px] text-sales-danger-fg">{error}</p> : null}
      {loading && !data ? <div className="h-48 animate-pulse rounded-[12px] border border-sales-border bg-sales-surface" /> : null}

      {totals ? (
        <section className={`rounded-[12px] border border-sales-border bg-sales-surface px-4 pb-4 pt-4 ${quiet ? "border-l-[3px] border-l-sales-danger" : ""}`} aria-labelledby="visit-chart">
          <div className="grid gap-3 min-[1100px]:grid-cols-[minmax(180px,220px)_minmax(0,1fr)] min-[1100px]:items-end">
            <div className="min-w-0">
              <p className="text-[13px] text-sales-text-muted">{periodLabel}</p>
              <p className={`mt-2 font-display text-[40px] font-semibold leading-none tracking-[-0.04em] tabular-nums text-sales-text-primary min-[480px]:text-[48px] ${totals.visits === 0 ? "text-sales-text-muted" : ""}`}>{totals.visits}</p>
              <p className="mt-2 text-[15px] font-medium text-sales-text-primary">visits in the {phrase}</p>
              <p className="mt-1 text-[14px] text-sales-text-secondary">
                {totals.visits === 0 ? "No human visits in this period." : totals.enquiries === 0 ? "No enquiry yet." : totals.enquiries === 1 ? "1 became an enquiry." : `${totals.enquiries} became enquiries.`}
              </p>
              {totals.visits > 0 && selected ? (
                <p className="mt-2 text-[13px] text-sales-text-secondary">
                  <span className="text-sales-text-muted">{selectedIndex === peak ? "Busiest day" : "Selected day"}</span>{" "}
                  <span className="font-medium text-sales-text-primary">{formatVisitDay(selected.day)}</span>{" "}
                  <span className="tabular-nums">{counted(selected.visits, "visit", "visits")}</span>
                </p>
              ) : null}
            </div>
            <div className="min-w-0">
              <div className="flex items-baseline justify-between gap-3">
                <h2 id="visit-chart" className="text-[15px] font-semibold tracking-[-0.01em] text-sales-text-primary">Visits by day</h2>
                {totals.visits > 0 ? (
                  <p className="flex items-center gap-2 text-[12px] text-sales-text-muted">
                    <span className="inline-block h-2 w-2 rounded-full bg-sales-brand" aria-hidden />
                    Today
                  </p>
                ) : null}
              </div>
              {totals.visits === 0 || days.length === 0 ? (
                <p className="mt-6 border-t border-sales-border-subtle pt-4 text-[14px] text-sales-text-secondary">The line stays empty until a person opens this link.</p>
              ) : (
                <div
                  className="relative mt-4 cursor-pointer touch-pan-y outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sales-text-primary"
                  tabIndex={0}
                  role="slider"
                  aria-valuemin={0}
                  aria-valuemax={days.length - 1}
                  aria-valuenow={selectedIndex}
                  aria-valuetext={`${formatVisitDay(selected.day)}, ${counted(selected.visits, "visit", "visits")}`}
                  aria-label="Visits by day"
                  aria-orientation="horizontal"
                  onKeyDown={(event) => {
                    if (event.key === "ArrowRight" || event.key === "ArrowUp") {
                      event.preventDefault();
                      setIndex(Math.min(days.length - 1, selectedIndex + 1));
                    } else if (event.key === "ArrowLeft" || event.key === "ArrowDown") {
                      event.preventDefault();
                      setIndex(Math.max(0, selectedIndex - 1));
                    } else if (event.key === "Home") {
                      event.preventDefault();
                      setIndex(0);
                    } else if (event.key === "End") {
                      event.preventDefault();
                      setIndex(days.length - 1);
                    }
                  }}
                  onPointerDown={(event) => {
                    event.currentTarget.setPointerCapture(event.pointerId);
                    selectAt(event.clientX, event.currentTarget);
                  }}
                  onPointerMove={(event) => {
                    if (event.currentTarget.hasPointerCapture(event.pointerId)) selectAt(event.clientX, event.currentTarget);
                  }}
                >
                  <svg viewBox={`0 0 ${VB_W} ${VB_H}`} className="block h-auto w-full text-sales-text-primary" style={{ aspectRatio: `${VB_W} / ${VB_H}` }} fontFamily="inherit" role="presentation" aria-hidden>
                    <line x1={PAD.l} x2={VB_W - PAD.r} y1={yAt(max, max)} y2={yAt(max, max)} stroke="currentColor" className="text-sales-border" />
                    <line x1={PAD.l} x2={VB_W - PAD.r} y1={yAt(0, max)} y2={yAt(0, max)} stroke="currentColor" className="text-sales-border" />
                    <text x={PAD.l - 8} y={yAt(max, max) + 4} textAnchor="end" fill="currentColor" className="text-sales-text-muted" fontSize="11">{max}</text>
                    <text x={PAD.l - 8} y={yAt(0, max) + 4} textAnchor="end" fill="currentColor" className="text-sales-text-muted" fontSize="11">0</text>
                    <path d={area} fill="currentColor" fillOpacity="0.08" />
                    <path d={line} fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
                    <line x1={xAt(selectedIndex, days.length)} x2={xAt(selectedIndex, days.length)} y1={yAt(max, max)} y2={yAt(0, max)} stroke="currentColor" className="text-sales-border" />
                    {days.map((day, cursor) => {
                      const today = cursor === days.length - 1;
                      if (day.visits === 0 && !today) return null;
                      return (
                        <circle
                          key={day.day}
                          cx={xAt(cursor, days.length)}
                          cy={yAt(day.visits, max)}
                          r={cursor === selectedIndex ? 4.5 : 3}
                          fill="currentColor"
                          className={today ? "text-sales-brand" : "text-sales-text-primary"}
                        />
                      );
                    })}
                    <circle cx={xAt(selectedIndex, days.length)} cy={yAt(selected.visits, max)} r="8" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-sales-text-primary" />
                    {labelAt.map((cursor) => (
                      <text
                        key={days[cursor].day}
                        x={xAt(cursor, days.length)}
                        y={VB_H - 8}
                        textAnchor={cursor === 0 ? "start" : cursor === days.length - 1 ? "end" : "middle"}
                        fill="currentColor"
                        className="text-sales-text-muted"
                        fontSize="11"
                      >
                        {formatVisitDay(days[cursor].day)}
                      </text>
                    ))}
                  </svg>
                </div>
              )}
            </div>
          </div>
          <div className="mt-4 space-y-1 border-t border-sales-border-subtle pt-3">
            {totals.viewingRequests > 0 ? <p className="text-[13px] text-sales-text-secondary">{counted(totals.viewingRequests, "viewing was requested", "viewings were requested")}. None of these are confirmed bookings.</p> : null}
            {totals.whatsappClicks > 0 ? <p className="text-[13px] text-sales-text-muted">{counted(totals.whatsappClicks, "person tapped WhatsApp", "people tapped WhatsApp")}. A tap is not a message sent.</p> : null}
            {data?.outcomeNote ? <p className="text-[13px] text-sales-text-secondary">{data.outcomeNote}</p> : null}
            <p className="text-[12px] text-sales-text-muted">Preview fetches from WhatsApp or Facebook are not visits.</p>
          </div>
        </section>
      ) : null}

      {counts.length ? (
        <dl className="grid grid-cols-2 gap-x-6 gap-y-4 min-[1100px]:grid-cols-5">
          {counts.map((item) => (
            <div key={item.label} className="min-w-0">
              <dt className="text-[12px] text-sales-text-muted">{item.label}</dt>
              <dd className={`mt-1 text-[28px] font-semibold leading-none tracking-[-0.03em] tabular-nums ${item.quiet ? "text-sales-text-muted" : "text-sales-text-primary"}`}>{item.value}</dd>
              <p className="mt-1 text-[12px] leading-4 text-sales-text-secondary">{item.gloss}</p>
            </div>
          ))}
        </dl>
      ) : null}

      {data ? (
        <section aria-labelledby="visit-sources">
          <h2 id="visit-sources" className="text-[15px] font-semibold tracking-[-0.01em] text-sales-text-primary">Where the visits came from</h2>
          {sources.length === 0 ? (
            <p className="mt-2 text-[13px] text-sales-text-secondary">No identifiable source in this period.</p>
          ) : (
            <ul className="mt-3 max-w-xl">
              {sources.map((source) => (
                <li key={source.source} className="border-t border-sales-border-subtle py-3">
                  <div className="flex items-baseline justify-between gap-3">
                    <span className="text-[14px] font-medium text-sales-text-primary">{source.label}</span>
                    <span className="tabular-nums text-[14px] text-sales-text-primary">{source.visits}</span>
                  </div>
                  <span className="mt-2 block h-[2px] bg-sales-text-primary" style={{ width: `${Math.max(2, Math.round((source.visits / sourceMax) * 100))}%` }} aria-hidden />
                </li>
              ))}
            </ul>
          )}
        </section>
      ) : null}

      {link?.status === "revoked" ? (
        <p className="text-[14px] text-sales-text-secondary">Link revoked. Past visits stay on this page.</p>
      ) : link && confirming ? (
        <div className="rounded-[12px] border border-sales-border bg-sales-surface px-4 py-4">
          <p className="text-[14px] font-semibold text-sales-text-primary">Revoke the {link.address ?? "property"} link?</p>
          <p className="mt-1 text-[13px] text-sales-text-secondary">The page stops opening from this link. Past visits stay.</p>
          <div className="mt-4 flex flex-wrap gap-2">
            <button type="button" className={lineBtn} onClick={() => void revoke()}>Revoke link</button>
            <button type="button" className={lineBtn} onClick={() => setConfirming(false)}>Keep the link</button>
          </div>
        </div>
      ) : link ? (
        <button type="button" className={lineBtn} onClick={() => setConfirming(true)}>Revoke link</button>
      ) : null}
    </div>
  );
}
