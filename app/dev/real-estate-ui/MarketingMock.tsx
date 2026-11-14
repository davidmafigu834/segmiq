"use client";

import { useEffect, useMemo, useState } from "react";
import { formatVisitDay, periodVisits } from "./LinkAnalyticsMock";
import { LISTINGS, useMarketingLinks, type LinkRow, type RangeId, type Slice } from "./marketing-links";

const RANGES: { id: RangeId; label: string; phrase: string; days: number }[] = [
  { id: "7", label: "7 days", phrase: "last 7 days", days: 7 },
  { id: "30", label: "30 days", phrase: "last 30 days", days: 30 },
  { id: "90", label: "90 days", phrase: "last 90 days", days: 90 },
];

const rowBtn = "inline-flex h-9 shrink-0 items-center rounded-[8px] border border-sales-border bg-sales-bg px-3 text-[13px] font-semibold transition-colors hover:bg-sales-surface-hover";

function sum(rows: LinkRow[], range: RangeId): Slice {
  return rows.reduce(
    (total, link) => {
      const slice = link.slices[range];
      total.visits += slice.visits;
      total.enquiries += slice.enquiries;
      total.viewings += slice.viewings;
      total.offers += slice.offers;
      total.whatsapp += slice.whatsapp;
      return total;
    },
    { visits: 0, enquiries: 0, viewings: 0, offers: 0, whatsapp: 0 },
  );
}

function counted(n: number, singular: string, plural: string) {
  return `${n} ${n === 1 ? singular : plural}`;
}

function seriesFor(link: LinkRow, range: RangeId, length: number): number[] {
  const seeded = periodVisits(link.id, length);
  const total = link.slices[range].visits;
  if (seeded && seeded.reduce((count, day) => count + day.visits, 0) === total) return seeded.map((day) => day.visits);
  return Array.from({ length }, (_, index) => (index === length - 1 ? total : 0));
}

function linePath(values: number[], width: number, height: number, pad = 2) {
  const max = Math.max(1, ...values);
  return values.map((value, index) => {
    const x = values.length <= 1 ? width / 2 : (index / (values.length - 1)) * width;
    const y = pad + (height - pad * 2) - (value / max) * (height - pad * 2);
    return `${index === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`;
  }).join(" ");
}

export function MarketingMock({ loading, onOpenListing, onPreview, onOpenAnalytics }: { loading: boolean; onOpenListing: (listingId: string) => void; onPreview: (listingId: string) => void; onOpenAnalytics: (linkId: string) => void }) {
  const links = useMarketingLinks();
  const [range, setRange] = useState<RangeId>("30");
  const [query, setQuery] = useState("");
  const [copied, setCopied] = useState<string | null>(null);

  useEffect(() => {
    if (!copied) return;
    const timer = window.setTimeout(() => setCopied(null), 1600);
    return () => window.clearTimeout(timer);
  }, [copied]);

  const period = RANGES.find((item) => item.id === range) ?? RANGES[1];
  const periodLabel = period.phrase.charAt(0).toUpperCase() + period.phrase.slice(1);
  const total = useMemo(() => sum(links, range), [links, range]);
  const needle = query.trim().toLowerCase();
  const visible = links.filter((link) => `${link.address} ${link.suburb} ${link.campaign ?? ""}`.toLowerCase().includes(needle));
  const active = links.filter((link) => !link.revoked);
  const attention = visible.filter((link) => !link.revoked && link.slices[range].visits > 0 && link.slices[range].enquiries === 0);
  const shared = new Set(active.map((link) => link.listingId));
  const unshared = LISTINGS.filter((listing) => !shared.has(listing.id) && `${listing.address} ${listing.suburb}`.toLowerCase().includes(needle));
  const days = useMemo(() => {
    const sample = periodVisits("kingsmead", period.days) ?? [];
    return sample.map((day, index) => ({
      day: day.day,
      visits: links.reduce((count, link) => count + (seriesFor(link, range, period.days)[index] ?? 0), 0),
    }));
  }, [links, period.days, range]);
  const peak = days.reduce((best, day, index) => (day.visits >= days[best].visits ? index : best), 0);
  const max = Math.max(1, ...days.map((day) => day.visits));

  async function copyLink(link: LinkRow) {
    try {
      await navigator.clipboard.writeText(link.path);
    } catch {
      /* The status line still confirms the address that was prepared. */
    }
    setCopied(link.id);
  }

  if (loading) {
    return (
      <div className="re-mkt space-y-5" aria-hidden>
        <span className="re-bone block h-8 w-40 rounded-[6px]" />
        <span className="re-bone block h-40 rounded-[12px]" />
        <span className="re-bone block h-16 rounded-[12px]" />
        <span className="re-bone block h-16 rounded-[12px]" />
      </div>
    );
  }

  const counts: Array<{ label: string; value: number; gloss: string }> = [
    { label: "Active links", value: active.length, gloss: active.length === 1 ? "One page is shared" : "Pages with a live link" },
    { label: "Enquiries", value: total.enquiries, gloss: total.enquiries === 0 ? "None from these pages" : `${total.enquiries} of ${total.visits} visits` },
    { label: "Viewing requests", value: total.viewings, gloss: total.viewings === 0 ? "None requested" : "Not a booking" },
    { label: "WhatsApp taps", value: total.whatsapp, gloss: total.whatsapp === 0 ? "No taps" : "Not a message" },
    { label: "Confirmed WhatsApp leads", value: 0, gloss: "None confirmed" },
  ];

  return (
    <div className="re-mkt space-y-5">
      <header className="min-w-0">
        <h1 className="font-display text-[32px] font-semibold leading-none tracking-[-0.03em]">Marketing</h1>
        <p className="mt-2 max-w-[62ch] text-[14px] text-sales-text-secondary">Every link created from a property. The agency keeps the listing.</p>
      </header>

      <div className="re-bar flex flex-wrap items-center gap-2">
        <div className="re-chips flex gap-2" role="tablist" aria-label="Report period">
          {RANGES.map((item) => (
            <button
              key={item.id}
              type="button"
              role="tab"
              aria-selected={range === item.id}
              onClick={() => setRange(item.id)}
              className={`inline-flex h-9 shrink-0 items-center rounded-full px-3 text-[13px] font-medium ${range === item.id ? "bg-sales-text-primary text-sales-surface" : "border border-sales-border text-sales-text-secondary"}`}
            >
              {item.label}
            </button>
          ))}
        </div>
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search address or suburb"
          aria-label="Search address or suburb"
          className="h-9 min-w-0 flex-1 rounded-[10px] border border-sales-border bg-sales-surface px-3 text-[13px]"
        />
      </div>

      <section className="re-an-hero px-4 pb-4 pt-4" aria-labelledby="desk-visits">
        <div className="re-an-hero-grid">
          <div className="min-w-0">
            <p className="text-[13px] text-sales-text-muted">{periodLabel}</p>
            <p className={`mt-2 font-display text-[40px] font-semibold leading-none tracking-[-0.04em] tabular-nums min-[480px]:text-[48px] ${total.visits === 0 ? "text-sales-text-muted" : ""}`}>{total.visits}</p>
            <p className="mt-2 text-[15px] font-medium">visits across {counted(active.length, "link", "links")}</p>
            <p className="mt-1 text-[14px] text-sales-text-secondary">{total.enquiries === 0 ? "No enquiry yet." : total.enquiries === 1 ? "1 became an enquiry." : `${total.enquiries} became enquiries.`}</p>
            {days[peak] ? (
              <p className="mt-2 text-[13px] text-sales-text-secondary">
                <span className="text-sales-text-muted">Busiest day</span>{" "}
                <span className="font-medium text-sales-text-primary">{formatVisitDay(days[peak].day)}</span>{" "}
                <span className="tabular-nums">{counted(days[peak].visits, "visit", "visits")}</span>
              </p>
            ) : null}
          </div>
          <div className="min-w-0">
            <div className="flex items-baseline justify-between gap-3">
              <h2 id="desk-visits" className="text-[15px] font-semibold tracking-[-0.01em]">Visits by day</h2>
              <p className="flex items-center gap-2 text-[12px] text-sales-text-muted">
                <span className="inline-block h-2 w-2 rounded-full bg-sales-brand" aria-hidden />
                Today
              </p>
            </div>
            <svg viewBox="0 0 640 132" className="mt-2 block h-auto w-full" style={{ aspectRatio: "640 / 132" }} fontFamily="inherit" role="img" aria-label={`${total.visits} visits in the ${period.phrase}`}>
              <line x1="28" x2="628" y1="18" y2="18" stroke="currentColor" className="text-sales-border" />
              <line x1="28" x2="628" y1="96" y2="96" stroke="currentColor" className="text-sales-border" />
              <text x="20" y="22" textAnchor="end" fill="currentColor" className="text-sales-text-muted" fontSize="11">{max}</text>
              <text x="20" y="100" textAnchor="end" fill="currentColor" className="text-sales-text-muted" fontSize="11">0</text>
              <path d={`${linePath(days.map((day) => day.visits), 600, 78)} L600,78 L0,78 Z`} transform="translate(28 18)" fill="currentColor" fillOpacity="0.08" className="text-sales-text-primary" />
              <path d={linePath(days.map((day) => day.visits), 600, 78)} transform="translate(28 18)" fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" className="text-sales-text-primary" />
              <circle cx="628" cy={18 + 2 + 74 - ((days[days.length - 1]?.visits ?? 0) / max) * 74} r="3.5" fill="currentColor" className="text-sales-brand" />
              {days[0] ? <text x="28" y="122" fill="currentColor" className="text-sales-text-muted" fontSize="11">{formatVisitDay(days[0].day)}</text> : null}
              {days.length > 2 ? <text x="328" y="122" textAnchor="middle" fill="currentColor" className="text-sales-text-muted" fontSize="11">{formatVisitDay(days[Math.floor((days.length - 1) / 2)].day)}</text> : null}
              {days.at(-1) ? <text x="628" y="122" textAnchor="end" fill="currentColor" className="text-sales-text-muted" fontSize="11">{formatVisitDay(days[days.length - 1].day)}</text> : null}
            </svg>
          </div>
        </div>
        <p className="mt-3 text-[12px] text-sales-text-muted">Unique visitors are estimated on each link. Preview fetches from WhatsApp or Facebook are not visits.</p>
      </section>

      <dl className="re-an-counts">
        {counts.map((item) => (
          <div key={item.label} className="min-w-0">
            <dt className="text-[12px] text-sales-text-muted">{item.label}</dt>
            <dd className={`mt-1 text-[28px] font-semibold leading-none tracking-[-0.03em] tabular-nums ${item.value === 0 ? "text-sales-text-muted" : ""}`}>{item.value}</dd>
            <p className="mt-1 text-[12px] leading-4 text-sales-text-secondary">{item.gloss}</p>
          </div>
        ))}
      </dl>

      {attention.length ? (
        <section className="overflow-hidden rounded-[12px] border border-sales-border bg-sales-surface" aria-labelledby="needs-you">
          <div className="flex items-baseline justify-between px-4 pb-2 pt-4">
            <h2 id="needs-you" className="text-[15px] font-semibold tracking-[-0.01em]">Needs you</h2>
            <span className="text-[13px] tabular-nums text-sales-text-muted">{attention.length}</span>
          </div>
          <ul>
            {attention.map((link) => (
              <LinkRowView key={link.id} link={link} range={range} length={period.days} copied={copied === link.id} quiet onCopy={() => void copyLink(link)} onPreview={() => onPreview(link.listingId)} onOpen={() => onOpenAnalytics(link.id)} />
            ))}
          </ul>
        </section>
      ) : null}

      <section className="overflow-hidden rounded-[12px] border border-sales-border bg-sales-surface" aria-labelledby="link-list">
        <div className="flex items-baseline justify-between px-4 pb-2 pt-4">
          <h2 id="link-list" className="text-[15px] font-semibold tracking-[-0.01em]">Links</h2>
          <span className="text-[13px] tabular-nums text-sales-text-muted">{visible.length}</span>
        </div>
        <ul>
          {visible.length === 0 ? (
            <li className="border-t border-sales-border-subtle px-4 py-8">
              <p className="text-[15px] font-semibold">No link matches that address.</p>
              <p className="mt-1 text-[13px] text-sales-text-secondary">Try Kingsmead, Stonechat, Brooke, or Kensington.</p>
            </li>
          ) : visible.map((link) => (
            <LinkRowView key={link.id} link={link} range={range} length={period.days} copied={copied === link.id} quiet={false} onCopy={() => void copyLink(link)} onPreview={() => onPreview(link.listingId)} onOpen={() => onOpenAnalytics(link.id)} />
          ))}
        </ul>
      </section>

      {copied ? <p className="text-[13px] text-sales-text-secondary" role="status">Link copied.</p> : null}

      {unshared.length ? (
        <section className="overflow-hidden rounded-[12px] border border-sales-border bg-sales-surface">
          <div className="px-4 pb-2 pt-4">
            <h2 className="text-[15px] font-semibold tracking-[-0.01em]">No link yet</h2>
            <p className="mt-1 text-[13px] text-sales-text-secondary">Create the link on the property. It will show in the list above.</p>
          </div>
          <ul>
            {unshared.map((listing) => (
              <li key={listing.id} className="flex items-center gap-3 border-t border-sales-border-subtle px-4 py-3">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[14px] font-semibold">{listing.address}</p>
                  <p className="truncate text-[12px] text-sales-text-muted">{[listing.suburb, listing.status].join(" · ")}</p>
                </div>
                <button type="button" className={rowBtn} onClick={() => onOpenListing(listing.id)}>Open property</button>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}

function LinkRowView({
  link,
  range,
  length,
  copied,
  quiet,
  onCopy,
  onPreview,
  onOpen,
}: {
  link: LinkRow;
  range: RangeId;
  length: number;
  copied: boolean;
  quiet: boolean;
  onCopy: () => void;
  onPreview: () => void;
  onOpen: () => void;
}) {
  const slice = link.slices[range];
  const values = seriesFor(link, range, length);
  const enquiry = slice.visits === 0 ? "No visits yet." : slice.enquiries === 0 ? "No enquiry yet." : counted(slice.enquiries, "enquiry", "enquiries");
  return (
    <li className="flex flex-wrap items-center gap-3 border-t border-sales-border-subtle px-4 py-3">
      {quiet ? <span className="h-8 w-[3px] shrink-0 rounded-full bg-sales-danger" aria-hidden /> : null}
      <div className="min-w-[140px] flex-1">
        <p className="truncate text-[14px] font-semibold">{link.address}</p>
        <p className="truncate text-[12px] text-sales-text-muted">{[link.revoked ? "Revoked" : "Active", link.campaign ?? "Personal link"].join(" · ")}</p>
        <p className="mt-0.5 truncate text-[13px] text-sales-text-secondary">{enquiry}</p>
      </div>
      <svg viewBox="0 0 88 28" className="h-7 w-[88px] shrink-0 text-sales-text-primary" aria-hidden>
        <path d={linePath(values, 88, 28, 3)} fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" strokeLinecap="round" />
      </svg>
      <div className="w-12 shrink-0 text-right">
        <p className={`text-[22px] font-semibold leading-none tabular-nums tracking-[-0.03em] ${slice.visits === 0 ? "text-sales-text-muted" : ""}`}>{slice.visits}</p>
        <p className="mt-1 text-[12px] text-sales-text-muted">visits</p>
      </div>
      <div className="flex gap-2">
        <button type="button" className={rowBtn} onClick={onCopy}>{copied ? "Copied" : "Copy"}</button>
        <button type="button" className={rowBtn} onClick={onPreview}>Page</button>
        <button type="button" className={rowBtn} onClick={onOpen}>Analytics</button>
      </div>
    </li>
  );
}
