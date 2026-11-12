"use client";

import { useEffect, useMemo, useState } from "react";
import { LISTINGS, revokeLink, useMarketingLinks, type LinkRow, type RangeId, type Slice } from "./marketing-links";

const RANGES: { id: RangeId; label: string; kicker: string }[] = [
  { id: "7", label: "7 days", kicker: "Last 7 days" },
  { id: "30", label: "30 days", kicker: "Last 30 days" },
  { id: "90", label: "90 days", kicker: "Last 90 days" },
];

const rowBtn = "h-9 shrink-0 rounded-[8px] border border-sales-border bg-sales-bg px-3 text-[13px] font-semibold transition-colors hover:bg-sales-surface-hover";
const lineBtn = "re-fill inline-flex h-11 items-center justify-center rounded-[10px] border border-sales-border bg-sales-bg px-4 text-[14px] font-semibold transition-colors hover:bg-sales-surface-hover";
const backBtn = "inline-flex h-9 items-center rounded-[8px] border border-sales-border bg-sales-surface px-3 text-[13px] font-semibold transition-colors hover:bg-sales-surface-hover";

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

function counted(n: number, singular: string, plural: string): string {
  return `${n} ${n === 1 ? singular : plural}`;
}

function periodSentence(total: Slice, linkCount: number): string {
  const enquiry = total.enquiries === 1 ? "1 became an enquiry" : `${total.enquiries} became enquiries`;
  const offer = total.offers === 0 ? "None is an offer yet." : total.offers === 1 ? "1 of those is now an offer." : `${total.offers} of those are now offers.`;
  return `${total.visits} visits across ${counted(linkCount, "link", "links")}. ${enquiry}. ${offer}`;
}

export function MarketingMock({ loading, onOpenListing, onPreview }: { loading: boolean; onOpenListing: (listingId: string) => void; onPreview: (listingId: string) => void }) {
  const links = useMarketingLinks();
  const [range, setRange] = useState<RangeId>("30");
  const [query, setQuery] = useState("");
  const [openId, setOpenId] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);

  useEffect(() => {
    document.querySelector(".re-scroll")?.scrollTo({ top: 0 });
  }, [openId]);

  useEffect(() => {
    if (!copied) return;
    const timer = window.setTimeout(() => setCopied(null), 1600);
    return () => window.clearTimeout(timer);
  }, [copied]);

  const period = RANGES.find((item) => item.id === range) ?? RANGES[1];
  const total = useMemo(() => sum(links, range), [links, range]);
  const needle = query.trim().toLowerCase();
  const visible = links.filter((link) => `${link.address} ${link.suburb} ${link.campaign ?? ""}`.toLowerCase().includes(needle));
  const open = links.find((link) => link.id === openId) ?? null;
  const sources = links.filter((link) => link.source && link.slices[range].enquiries > 0);
  const sourceMax = Math.max(1, ...sources.map((link) => link.slices[range].enquiries));
  const confirmedWhatsapp = links.filter((link) => link.source === "WhatsApp").reduce((count, link) => count + link.slices[range].enquiries, 0);
  const attention = visible.filter((link) => !link.revoked && link.slices[range].visits > 0 && link.slices[range].enquiries === 0);
  const shared = new Set(links.filter((link) => !link.revoked).map((link) => link.listingId));
  const unshared = LISTINGS.filter((listing) => !shared.has(listing.id) && `${listing.address} ${listing.suburb}`.toLowerCase().includes(needle));

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
        <div>
          <span className="re-bone block h-3 w-24 rounded-[4px]" />
          <span className="re-bone mt-3 block h-8 w-40 rounded-[4px]" />
          <span className="re-bone mt-3 block h-4 w-full max-w-md rounded-[4px]" />
        </div>
        <section className="overflow-hidden rounded-[12px] border border-sales-border bg-sales-surface">
          <Bone /><Bone /><Bone />
        </section>
      </div>
    );
  }

  if (open) {
    const slice = open.slices[range];
    const isRevoked = open.revoked;
    return (
      <div className="re-mkt re-in space-y-5">
        <button type="button" className={backBtn} onClick={() => { setOpenId(null); setConfirming(false); }}>Back</button>
        <header>
          <p className="text-[13px] font-medium text-sales-text-muted">Link · {period.kicker}</p>
          <h1 className="mt-1 break-words font-display text-[32px] font-semibold leading-none tracking-[-0.03em]">{open.address}</h1>
          <p className="mt-2 text-[14px] text-sales-text-secondary">{isRevoked ? "Revoked" : "Active link"} · {open.campaign ?? "No campaign label"}</p>
        </header>
        <section className="overflow-hidden rounded-[12px] border border-sales-border bg-sales-surface">
          <div className="px-4 pb-3 pt-4">
            <h2 className="text-[15px] font-semibold tracking-[-0.01em]">This link</h2>
            <p className="mt-2 break-all text-[13px] text-sales-text-secondary">{open.path}</p>
          </div>
          <dl className="grid gap-x-6 gap-y-3 border-t border-sales-border-subtle px-4 py-3 sm:grid-cols-3">
            <Stat label="Visits" value={slice.visits} />
            <Stat label="Enquiries" value={slice.enquiries} />
            <Stat label="Viewing requests" value={slice.viewings} />
            <Stat label="Offers" value={slice.offers} />
            <Stat label="WhatsApp taps" value={slice.whatsapp} />
            <div>
              <dt className="text-[12px] text-sales-text-muted">Outcome</dt>
              <dd className="text-[14px] font-medium">{open.outcome}</dd>
            </div>
          </dl>
          <p className="border-t border-sales-border-subtle px-4 py-3 text-[13px] text-sales-text-secondary">{open.note} WhatsApp taps are not messages sent.</p>
        </section>
        {copied === open.id ? <p className="text-[13px] text-sales-text-secondary" role="status">Link copied.</p> : null}
        {isRevoked ? (
          <p className="text-[14px] text-sales-text-secondary">Link revoked. Past enquiries stay on the desk.</p>
        ) : confirming ? (
          <div className="rounded-[12px] border border-sales-border bg-sales-surface px-4 py-4">
            <p className="text-[14px] font-semibold">Revoke the {open.address} link?</p>
            <p className="mt-1 text-[13px] text-sales-text-secondary">The page stops opening from this link. Past enquiries stay.</p>
            <div className="re-actions mt-4 flex flex-wrap gap-2">
              <button
                type="button"
                className={lineBtn}
                onClick={() => {
                  revokeLink(open.id);
                  setConfirming(false);
                }}
              >
                Revoke link
              </button>
              <button type="button" className={backBtn} onClick={() => setConfirming(false)}>Keep the link</button>
            </div>
          </div>
        ) : (
          <div className="re-actions flex flex-wrap gap-2">
            <button type="button" className={lineBtn} onClick={() => onPreview(open.listingId)}>View page</button>
            <button type="button" className={lineBtn} onClick={() => void copyLink(open)}>Copy link</button>
            <button type="button" className={lineBtn} onClick={() => onOpenListing(open.listingId)}>Open property</button>
            <button type="button" className={lineBtn} onClick={() => setConfirming(true)}>Revoke link</button>
          </div>
        )}
      </div>
    );
  }

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
          placeholder="Search address"
          aria-label="Search address"
          className="h-9 min-w-0 flex-1 rounded-[10px] border border-sales-border bg-sales-surface px-3 text-[13px]"
        />
      </div>

      <div className="re-mkt-grid grid items-start gap-4">
        <div className="re-mkt-links space-y-4">
          {attention.length ? (
            <section className="overflow-hidden rounded-[12px] border border-sales-border bg-sales-surface">
              <div className="flex items-baseline justify-between px-4 pb-2 pt-4">
                <h2 className="text-[15px] font-semibold tracking-[-0.01em]">Needs you</h2>
                <span className="text-[13px] tabular-nums text-sales-text-muted">{attention.length}</span>
              </div>
              <ul>
                {attention.map((link) => (
                  <li key={link.id} className="flex items-center gap-3 border-t border-sales-border-subtle px-4 py-3">
                    <span className="h-8 w-[3px] shrink-0 rounded-full bg-sales-danger" aria-hidden />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[14px] font-semibold">{link.address}</p>
                      <p className="truncate text-[12px] text-sales-text-muted">{link.campaign ?? "Personal link"} · {counted(link.slices[range].visits, "visit", "visits")}</p>
                      <p className="mt-0.5 truncate text-[13px] text-sales-text-secondary">No enquiry yet. Share the link again.</p>
                    </div>
                    <button type="button" className={rowBtn} onClick={() => void copyLink(link)}>{copied === link.id ? "Copied" : "Share"}</button>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}

          <section className="overflow-hidden rounded-[12px] border border-sales-border bg-sales-surface">
            <div className="flex items-baseline justify-between px-4 pb-2 pt-4">
              <h2 className="text-[15px] font-semibold tracking-[-0.01em]">Links</h2>
              <span className="text-[13px] tabular-nums text-sales-text-muted">{visible.length}</span>
            </div>
            <ul>
              {visible.length === 0 ? (
                <li className="border-t border-sales-border-subtle px-4 py-8">
                  <p className="text-[15px] font-semibold">No link matches that address.</p>
                  <p className="mt-1 text-[13px] text-sales-text-secondary">Try Kingsmead, Stonechat, Brooke, or Kensington.</p>
                </li>
              ) : visible.map((link) => {
                const slice = link.slices[range];
                const isRevoked = link.revoked;
                return (
                  <li key={link.id} className="re-in flex items-center gap-3 border-t border-sales-border-subtle px-4 py-3">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[14px] font-semibold">{link.address}</p>
                      <p className="truncate text-[12px] text-sales-text-muted">{[isRevoked ? "Revoked" : "Active", link.campaign ?? "Personal link", counted(slice.visits, "visit", "visits")].join(" · ")}</p>
                      <p className="mt-0.5 truncate text-[13px] text-sales-text-secondary">{counted(slice.enquiries, "enquiry", "enquiries")} · {link.outcome}</p>
                    </div>
                    <button type="button" className={rowBtn} onClick={() => onPreview(link.listingId)}>Page</button>
                    <button type="button" className={rowBtn} onClick={() => { setConfirming(false); setOpenId(link.id); }}>Open</button>
                  </li>
                );
              })}
            </ul>
          </section>

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

        <div className="re-mkt-report space-y-4">
          <section className="rounded-[12px] border border-sales-border bg-sales-surface px-4 py-4">
            <h2 className="text-[15px] font-semibold tracking-[-0.01em]">This period</h2>
            <p className="mt-1 text-[13px] text-sales-text-muted">{period.kicker}</p>
            <p className="mt-2 text-[14px] text-sales-text-secondary">{periodSentence(total, links.length)}</p>
            <dl className="mt-4 grid grid-cols-1 gap-x-4 gap-y-3 min-[480px]:grid-cols-2">
              <Stat label="Visits" value={total.visits} />
              <Stat label="Enquiries" value={total.enquiries} />
              <Stat label="Viewing requests" value={total.viewings} />
              <Stat label="Offers" value={total.offers} />
              <Stat label="WhatsApp taps" value={total.whatsapp} />
              <Stat label="Confirmed WhatsApp leads" value={confirmedWhatsapp} />
            </dl>
            <p className="mt-4 text-[12px] leading-5 text-sales-text-muted">Unique visitors are estimated on each link. WhatsApp taps are not messages sent.</p>
          </section>

          <section className="rounded-[12px] border border-sales-border bg-sales-surface px-4 py-4">
            <h2 className="text-[15px] font-semibold tracking-[-0.01em]">Where enquiries came from</h2>
            {sources.length === 0 ? (
              <p className="mt-2 text-[13px] text-sales-text-secondary">No enquiry in this period.</p>
            ) : (
              <ul className="mt-3 space-y-3">
                {sources.map((link) => {
                  const count = link.slices[range].enquiries;
                  return (
                    <li key={link.id}>
                      <div className="flex items-baseline justify-between gap-3 text-[13px]">
                        <span className="font-medium">{link.source}</span>
                        <span className="tabular-nums text-sales-text-muted">{count}</span>
                      </div>
                      <p className="mt-0.5 truncate text-[12px] text-sales-text-muted">{link.address}</p>
                      <div className="re-mkt-bar mt-1.5" aria-hidden>
                        <span style={{ width: `${Math.round((count / sourceMax) * 100)}%` }} />
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="min-w-0">
      <dt className="text-[12px] text-sales-text-muted">{label}</dt>
      <dd className="text-[20px] font-semibold tabular-nums tracking-[-0.03em]">{value}</dd>
    </div>
  );
}

function Bone() {
  return (
    <div className="flex items-center gap-3 border-t border-sales-border-subtle px-4 py-3">
      <div className="min-w-0 flex-1 space-y-1.5">
        <span className="re-bone block h-3.5 w-36 max-w-[46%] rounded-[4px]" />
        <span className="re-bone block h-3 w-28 max-w-[36%] rounded-[4px]" />
        <span className="re-bone block h-3 w-52 max-w-[70%] rounded-[4px]" />
      </div>
      <span className="re-bone h-9 w-16 shrink-0 rounded-[8px]" />
    </div>
  );
}
