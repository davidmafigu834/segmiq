"use client";

import { useEffect, useState } from "react";
import { listingById, revokeLink, useMarketingLinks, type RangeId } from "./marketing-links";

const RANGES: { id: RangeId; label: string; phrase: string; days: number }[] = [
  { id: "7", label: "7 days", phrase: "last 7 days", days: 7 },
  { id: "30", label: "30 days", phrase: "last 30 days", days: 30 },
  { id: "90", label: "90 days", phrase: "last 90 days", days: 90 },
];

const PERIOD_END = Date.UTC(2026, 10, 9);
const VB_W = 640;
const VB_H = 208;
const PAD = { l: 36, r: 12, t: 18, b: 32 };

const lineBtn = "inline-flex h-11 items-center justify-center rounded-[10px] border border-sales-border bg-sales-bg px-4 text-[14px] font-semibold transition-colors hover:bg-sales-surface-hover";
const backBtn = "inline-flex h-9 items-center rounded-[8px] border border-sales-border bg-sales-surface px-3 text-[13px] font-semibold transition-colors hover:bg-sales-surface-hover";

type Day = { day: string; visits: number };
type Source = { label: string; visits: number };

function paint(marks: Record<number, number>): number[] {
  const out = Array.from({ length: 90 }, () => 0);
  for (const [index, count] of Object.entries(marks)) out[Number(index)] = count;
  return out;
}

const SERIES: Record<string, number[]> = {
  kingsmead: paint({ 8: 1, 19: 1, 27: 1, 34: 1, 41: 1, 48: 1, 55: 1, 63: 1, 66: 2, 67: 1, 71: 1, 75: 2, 76: 1, 80: 1, 85: 1, 88: 1 }),
  kensington: paint({ 6: 1, 18: 1, 29: 1, 40: 1, 52: 1, 64: 1, 75: 1, 83: 1, 85: 1, 87: 1, 89: 1 }),
  stonechat: paint({ 4: 1, 14: 1, 24: 1, 33: 1, 44: 1, 53: 1, 60: 1, 63: 1, 65: 1, 68: 1, 71: 1, 74: 1, 80: 1, 86: 1 }),
  brooke: paint({ 10: 1, 22: 1, 36: 1, 50: 1, 65: 1, 76: 1, 83: 1, 86: 1, 88: 1 }),
};

const UNIQUE: Record<string, Record<RangeId, number>> = {
  kingsmead: { "7": 2, "30": 8, "90": 14 },
  kensington: { "7": 3, "30": 5, "90": 8 },
  stonechat: { "7": 1, "30": 6, "90": 11 },
  brooke: { "7": 2, "30": 4, "90": 7 },
};

const SOURCES: Record<string, Record<RangeId, Source[]>> = {
  kingsmead: {
    "7": [{ label: "WhatsApp", visits: 1 }, { label: "Direct open", visits: 1 }],
    "30": [{ label: "WhatsApp", visits: 6 }, { label: "Direct open", visits: 3 }, { label: "Facebook", visits: 2 }],
    "90": [{ label: "WhatsApp", visits: 9 }, { label: "Direct open", visits: 5 }, { label: "Facebook", visits: 4 }],
  },
  kensington: {
    "7": [{ label: "Direct open", visits: 3 }, { label: "Facebook", visits: 1 }],
    "30": [{ label: "Direct open", visits: 4 }, { label: "Facebook", visits: 2 }],
    "90": [{ label: "Direct open", visits: 6 }, { label: "Facebook", visits: 3 }, { label: "Instagram", visits: 2 }],
  },
  stonechat: {
    "7": [{ label: "Direct open", visits: 1 }],
    "30": [{ label: "Direct open", visits: 5 }, { label: "Facebook", visits: 2 }, { label: "Instagram", visits: 1 }],
    "90": [{ label: "Direct open", visits: 8 }, { label: "Facebook", visits: 4 }, { label: "Instagram", visits: 2 }],
  },
  brooke: {
    "7": [{ label: "WhatsApp", visits: 2 }, { label: "Direct open", visits: 1 }],
    "30": [{ label: "WhatsApp", visits: 2 }, { label: "Direct open", visits: 2 }, { label: "Instagram", visits: 1 }],
    "90": [{ label: "WhatsApp", visits: 4 }, { label: "Direct open", visits: 3 }, { label: "Instagram", visits: 2 }],
  },
};

function dayKey(offsetFromEnd: number) {
  return new Date(PERIOD_END - offsetFromEnd * 86_400_000).toISOString().slice(0, 10);
}

function dayLabel(day: string) {
  const [year, month, date] = day.split("-").map(Number);
  if (!year || !month || !date) return day;
  return new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", timeZone: "UTC" }).format(new Date(Date.UTC(year, month - 1, date)));
}

export function periodVisits(linkId: string, length: number): Day[] | null {
  const all = SERIES[linkId];
  if (!all || length < 1 || length > all.length) return null;
  return all.slice(all.length - length).map((visits, index) => ({ day: dayKey(length - 1 - index), visits }));
}

export function formatVisitDay(day: string) {
  return dayLabel(day);
}

function windowOf(all: number[] | undefined, length: number, total: number): Day[] {
  const seeded = all ? all.slice(all.length - length) : [];
  const counts = seeded.length === length && seeded.reduce((sum, count) => sum + count, 0) === total
    ? seeded
    : Array.from({ length }, (_, index) => (index === length - 1 ? total : 0));
  return counts.map((visits, index) => ({ day: dayKey(length - 1 - index), visits }));
}

function xAt(index: number, count: number) {
  const width = VB_W - PAD.l - PAD.r;
  if (count <= 1) return PAD.l + width / 2;
  return PAD.l + (index / (count - 1)) * width;
}

function yAt(visits: number, max: number) {
  const height = VB_H - PAD.t - PAD.b;
  return PAD.t + height - (visits / max) * height;
}

function peakIndex(days: Day[]) {
  let index = 0;
  days.forEach((day, cursor) => {
    if (day.visits >= days[index].visits) index = cursor;
  });
  return index;
}

function counted(n: number, singular: string, plural: string) {
  return `${n} ${n === 1 ? singular : plural}`;
}

export function LinkAnalyticsMock({
  loading,
  linkId,
  onBack,
  onOpenLink,
  onOpenListing,
  onPreview,
}: {
  loading: boolean;
  linkId: string;
  onBack: () => void;
  onOpenLink: (id: string) => void;
  onOpenListing: (listingId: string) => void;
  onPreview: (listingId: string) => void;
}) {
  const links = useMarketingLinks();
  const [range, setRange] = useState<RangeId>("30");
  const [pick, setPick] = useState<{ key: string; index: number } | null>(null);
  const [copied, setCopied] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const link = links.find((item) => item.id === linkId) ?? links.find((item) => item.id === "kingsmead") ?? null;

  useEffect(() => {
    if (!copied) return;
    const timer = window.setTimeout(() => setCopied(false), 1600);
    return () => window.clearTimeout(timer);
  }, [copied]);

  if (loading || !link) {
    return (
      <div className="re-an space-y-5" aria-hidden>
        <span className="re-bone block h-8 w-24 rounded-[6px]" />
        <span className="re-bone block h-10 w-72 max-w-full rounded-[6px]" />
        <span className="re-bone block h-[280px] rounded-[12px]" />
        <span className="re-bone block h-16 rounded-[12px]" />
      </div>
    );
  }

  const period = RANGES.find((item) => item.id === range) ?? RANGES[1];
  const periodLabel = period.phrase.charAt(0).toUpperCase() + period.phrase.slice(1);
  const slice = link.slices[range];
  const days = windowOf(SERIES[link.id], period.days, slice.visits);
  const max = Math.max(1, ...days.map((day) => day.visits));
  const peak = peakIndex(days);
  const key = `${link.id}:${range}`;
  const index = pick?.key === key ? Math.min(pick.index, days.length - 1) : peak;
  const selected = days[index] ?? days[0];
  const listing = listingById(link.listingId);
  const quiet = slice.visits > 0 && slice.enquiries === 0;
  const sources = (SOURCES[link.id]?.[range] ?? []).filter((source) => source.visits > 0);
  const sourceMax = Math.max(1, ...sources.map((source) => source.visits));
  const unique = UNIQUE[link.id]?.[range] ?? (slice.visits === 0 ? 0 : null);
  const line = days.map((day, cursor) => `${cursor === 0 ? "M" : "L"}${xAt(cursor, days.length).toFixed(1)},${yAt(day.visits, max).toFixed(1)}`).join(" ");
  const area = `${line} L${xAt(days.length - 1, days.length).toFixed(1)},${yAt(0, max).toFixed(1)} L${xAt(0, days.length).toFixed(1)},${yAt(0, max).toFixed(1)} Z`;
  const labelAt = [0, Math.floor((days.length - 1) / 2), days.length - 1].filter((value, cursor, all) => all.indexOf(value) === cursor);

  function selectAt(clientX: number, target: HTMLElement) {
    const rect = target.getBoundingClientRect();
    if (rect.width === 0) return;
    const x = ((clientX - rect.left) / rect.width) * VB_W;
    let best = 0;
    let dist = Infinity;
    days.forEach((_, cursor) => {
      const delta = Math.abs(xAt(cursor, days.length) - x);
      if (delta < dist) {
        dist = delta;
        best = cursor;
      }
    });
    setPick({ key, index: best });
  }

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(link.path);
    } catch {
      /* The path stays on the page. */
    }
    setCopied(true);
  }

  const enquiryLine = slice.enquiries === 0 ? "No enquiry yet." : slice.enquiries === 1 ? "1 became an enquiry." : `${slice.enquiries} became enquiries.`;
  const viewingLine = slice.viewings === 0
    ? null
    : slice.viewings === 1
      ? "1 viewing was requested. That is not a confirmed booking."
      : `${slice.viewings} viewings were requested. None of these are confirmed bookings.`;
  const whatsappLine = slice.whatsapp === 0
    ? null
    : `${counted(slice.whatsapp, "person tapped WhatsApp", "people tapped WhatsApp")}. A tap is not a message sent.`;

  const counts: Array<{ label: string; value: string; gloss: string; quiet: boolean }> = [
    { label: "Estimated unique visitors", value: unique == null ? "n/a" : String(unique), gloss: "One person can open it more than once", quiet: unique === 0 },
    {
      label: "Enquiries",
      value: String(slice.enquiries),
      gloss: slice.enquiries === 0 ? "None from this page" : `${slice.enquiries} of ${slice.visits} visits`,
      quiet: slice.enquiries === 0,
    },
    { label: "Viewing requests", value: String(slice.viewings), gloss: slice.viewings === 0 ? "None requested" : "Not a booking", quiet: slice.viewings === 0 },
    { label: "WhatsApp taps", value: String(slice.whatsapp), gloss: slice.whatsapp === 0 ? "No taps" : "Not a message", quiet: slice.whatsapp === 0 },
    { label: "Confirmed WhatsApp leads", value: "0", gloss: "None confirmed", quiet: true },
  ];

  return (
    <div className="re-an re-in space-y-5">
      <button type="button" className={backBtn} onClick={onBack}>All links</button>
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div className="min-w-0">
          {listing?.seller ? <p className="text-[13px] font-medium text-sales-text-muted">{listing.seller}</p> : null}
          <h1 className="mt-1 font-display text-[32px] font-semibold leading-none tracking-[-0.03em]">{link.address}</h1>
          <p className="mt-2 text-[14px] text-sales-text-secondary">{[link.suburb, link.revoked ? "Revoked" : "Active", link.campaign ?? "Personal link"].join(" · ")}</p>
        </div>
        <div className="re-actions flex flex-wrap gap-2">
          <button type="button" className={lineBtn} onClick={() => onPreview(link.listingId)}>View page</button>
          {link.revoked ? null : <button type="button" className={lineBtn} onClick={() => void copyLink()}>{copied ? "Copied" : "Copy link"}</button>}
          <button type="button" className={lineBtn} onClick={() => onOpenListing(link.listingId)}>Open property</button>
        </div>
      </header>
      {copied ? <p className="text-[13px] text-sales-text-secondary" role="status">Link copied.</p> : null}
      <p className="break-all text-[13px] text-sales-text-muted">{link.path}</p>

      <div className="re-bar flex flex-wrap items-center gap-2">
        <div className="re-chips flex gap-2" role="tablist" aria-label="Report period">
          {RANGES.map((item) => (
            <button
              key={item.id}
              type="button"
              role="tab"
              aria-selected={range === item.id}
              onClick={() => { setRange(item.id); setConfirming(false); }}
              className={`inline-flex h-9 shrink-0 items-center rounded-full px-3 text-[13px] font-medium ${range === item.id ? "bg-sales-text-primary text-sales-surface" : "border border-sales-border text-sales-text-secondary"}`}
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>

      <div className="flex flex-wrap gap-2" role="tablist" aria-label="Links">
        {links.filter((item) => !item.revoked || item.id === link.id).map((item) => (
          <button
            key={item.id}
            type="button"
            role="tab"
            aria-selected={item.id === link.id}
            onClick={() => { setCopied(false); setConfirming(false); onOpenLink(item.id); }}
            className={`inline-flex h-9 max-w-full items-center rounded-full px-3 text-[13px] font-medium ${item.id === link.id ? "bg-sales-text-primary text-sales-surface" : "border border-sales-border text-sales-text-secondary"}`}
          >
            <span className="truncate">{item.address}</span>
          </button>
        ))}
      </div>

      <section className={`re-an-hero px-4 pb-4 pt-4 ${quiet ? "is-quiet" : ""}`} aria-labelledby="visit-chart">
        <div className="re-an-hero-grid">
          <div className="min-w-0">
            <p className="text-[13px] text-sales-text-muted">{periodLabel}</p>
            <p className={`mt-2 font-display text-[40px] font-semibold leading-none tracking-[-0.04em] tabular-nums min-[480px]:text-[48px] ${slice.visits === 0 ? "text-sales-text-muted" : ""}`}>{slice.visits}</p>
            <p className="mt-2 text-[15px] font-medium">visits in the {period.phrase}</p>
            {slice.visits > 0 ? <p className="mt-1 text-[14px] text-sales-text-secondary">{enquiryLine}</p> : <p className="mt-1 text-[14px] text-sales-text-secondary">No human visits in this period.</p>}
            {slice.visits > 0 && selected ? (
              <p className="mt-2 text-[13px] text-sales-text-secondary">
                <span className="text-sales-text-muted">{index === peak ? "Busiest day" : "Selected day"}</span>
                {" "}
                <span className="font-medium text-sales-text-primary">{dayLabel(selected.day)}</span>
                {" "}
                <span className="tabular-nums">{counted(selected.visits, "visit", "visits")}</span>
              </p>
            ) : null}
          </div>
          <div className="min-w-0">
            <div className="flex items-baseline justify-between gap-3">
              <h2 id="visit-chart" className="text-[15px] font-semibold tracking-[-0.01em]">Visits by day</h2>
              {slice.visits > 0 ? (
                <p className="flex items-center gap-2 text-[12px] text-sales-text-muted">
                  <span className="inline-block h-2 w-2 rounded-full bg-sales-brand" aria-hidden />
                  Today
                </p>
              ) : null}
            </div>

        {slice.visits === 0 ? (
          <p className="mt-6 border-t border-sales-border-subtle pt-4 text-[14px] text-sales-text-secondary">The line stays empty until a person opens this link.</p>
        ) : (
          <div
            className="re-an-chart relative mt-4 outline-none"
            tabIndex={0}
            role="slider"
            aria-valuemin={0}
            aria-valuemax={days.length - 1}
            aria-valuenow={index}
            aria-valuetext={`${dayLabel(selected.day)}, ${counted(selected.visits, "visit", "visits")}`}
            aria-label="Visits by day"
            aria-orientation="horizontal"
            onKeyDown={(event) => {
              if (event.key === "ArrowRight" || event.key === "ArrowUp") {
                event.preventDefault();
                setPick({ key, index: Math.min(days.length - 1, index + 1) });
              } else if (event.key === "ArrowLeft" || event.key === "ArrowDown") {
                event.preventDefault();
                setPick({ key, index: Math.max(0, index - 1) });
              } else if (event.key === "Home") {
                event.preventDefault();
                setPick({ key, index: 0 });
              } else if (event.key === "End") {
                event.preventDefault();
                setPick({ key, index: days.length - 1 });
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
            <svg viewBox={`0 0 ${VB_W} ${VB_H}`} className="block h-auto w-full" style={{ aspectRatio: `${VB_W} / ${VB_H}` }} fontFamily="inherit" role="presentation" aria-hidden>
              <line x1={PAD.l} x2={VB_W - PAD.r} y1={yAt(max, max)} y2={yAt(max, max)} stroke="currentColor" className="text-sales-border" />
              <line x1={PAD.l} x2={VB_W - PAD.r} y1={yAt(0, max)} y2={yAt(0, max)} stroke="currentColor" className="text-sales-border" />
              <text x={PAD.l - 8} y={yAt(max, max) + 4} textAnchor="end" fill="currentColor" className="text-sales-text-muted" fontSize="11">{max}</text>
              <text x={PAD.l - 8} y={yAt(0, max) + 4} textAnchor="end" fill="currentColor" className="text-sales-text-muted" fontSize="11">0</text>
              <path d={area} fill="currentColor" fillOpacity="0.08" className="text-sales-text-primary" />
              <path d={line} fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" className="text-sales-text-primary" />
              <line x1={xAt(index, days.length)} x2={xAt(index, days.length)} y1={yAt(max, max)} y2={yAt(0, max)} stroke="currentColor" className="text-sales-border" />
              {days.map((day, cursor) => {
                const today = cursor === days.length - 1;
                if (day.visits === 0 && !today) return null;
                const cx = xAt(cursor, days.length);
                const cy = yAt(day.visits, max);
                return (
                  <circle
                    key={day.day}
                    cx={cx}
                    cy={cy}
                    r={cursor === index ? 4.5 : 3}
                    fill="currentColor"
                    className={today ? "text-sales-brand" : "text-sales-text-primary"}
                  />
                );
              })}
              <circle className="re-an-ring" cx={xAt(index, days.length)} cy={yAt(selected.visits, max)} r="8" fill="none" stroke="currentColor" strokeWidth="1.5" />
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
                  {dayLabel(days[cursor].day)}
                </text>
              ))}
            </svg>
          </div>
        )}
          </div>
        </div>
        <div className="mt-4 space-y-1 border-t border-sales-border-subtle pt-3">
          {viewingLine ? <p className="text-[13px] text-sales-text-secondary">{viewingLine}</p> : null}
          {whatsappLine ? <p className="text-[13px] text-sales-text-muted">{whatsappLine}</p> : null}
          <p className="text-[13px] text-sales-text-secondary">{link.note}</p>
          <p className="text-[12px] text-sales-text-muted">Preview fetches from WhatsApp or Facebook are not visits.</p>
        </div>
      </section>

      <dl className="re-an-counts">
        {counts.map((item) => (
          <div key={item.label} className="min-w-0">
            <dt className="text-[12px] text-sales-text-muted">{item.label}</dt>
            <dd className={`mt-1 text-[28px] font-semibold leading-none tracking-[-0.03em] tabular-nums ${item.quiet ? "text-sales-text-muted" : ""}`}>{item.value}</dd>
            <p className="mt-1 text-[12px] leading-4 text-sales-text-secondary">{item.gloss}</p>
          </div>
        ))}
      </dl>

      <section aria-labelledby="visit-sources">
        <h2 id="visit-sources" className="text-[15px] font-semibold tracking-[-0.01em]">Where the visits came from</h2>
        {sources.length === 0 ? (
          <p className="mt-2 text-[13px] text-sales-text-secondary">No identifiable source in this period.</p>
        ) : (
          <ul className="mt-3 max-w-xl">
            {sources.map((source) => (
              <li key={source.label} className="border-t border-sales-border-subtle py-3">
                <div className="flex items-baseline justify-between gap-3">
                  <span className="text-[14px] font-medium">{source.label}</span>
                  <span className="tabular-nums text-[14px]">{source.visits}</span>
                </div>
                <span
                  className="mt-2 block h-[2px] bg-sales-text-primary"
                  style={{ width: `${Math.max(2, Math.round((source.visits / sourceMax) * 100))}%` }}
                  aria-hidden
                />
              </li>
            ))}
          </ul>
        )}
      </section>

      {link.revoked ? (
        <p className="text-[14px] text-sales-text-secondary">Link revoked. Past visits stay on this page.</p>
      ) : confirming ? (
        <div className="rounded-[12px] border border-sales-border bg-sales-surface px-4 py-4">
          <p className="text-[14px] font-semibold">Revoke the {link.address} link?</p>
          <p className="mt-1 text-[13px] text-sales-text-secondary">The page stops opening from this link. Past visits stay.</p>
          <div className="re-actions mt-4 flex flex-wrap gap-2">
            <button type="button" className={lineBtn} onClick={() => { revokeLink(link.id); setConfirming(false); }}>Revoke link</button>
            <button type="button" className={backBtn} onClick={() => setConfirming(false)}>Keep the link</button>
          </div>
        </div>
      ) : (
        <button type="button" className={backBtn} onClick={() => setConfirming(true)}>Revoke link</button>
      )}
    </div>
  );
}
