"use client";

import Link from "next/link";
import type { MarketingDesk } from "@/lib/real-estate/agent-listing-pages/desk";

function summaryLine(desk: MarketingDesk): string {
  if (desk.activeLinks === 0) return "No marketing links yet.";
  const visitWord = desk.visits === 1 ? "visit" : "visits";
  const linkWord = desk.activeLinks === 1 ? "link" : "links";
  const enquiryWord = desk.enquiries === 1 ? "1 became an enquiry" : `${desk.enquiries} became enquiries`;
  const viewing =
    desk.viewingRequests <= 0
      ? ""
      : desk.viewingRequests === 1
        ? " 1 viewing was requested."
        : ` ${desk.viewingRequests} viewings were requested.`;
  return `${desk.visits} ${visitWord} across ${desk.activeLinks} ${linkWord}. ${enquiryWord}.${viewing}`;
}

export function MarketingDeskCard({ desk }: { desk: MarketingDesk | null }) {
  if (!desk) return null;
  if (desk.activeLinks === 0 && desk.quiet.length === 0 && desk.unlinked.length === 0) return null;
  const rows = [...desk.quiet, ...desk.unlinked];

  return (
    <section className="space-y-3" aria-labelledby="marketing-desk">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[11px] font-medium uppercase tracking-[0.16em] text-sales-text-muted">Marketing</p>
          <h2 id="marketing-desk" className="mt-1 font-display text-[22px] font-semibold leading-none tracking-[-0.03em] text-sales-text-primary">
            What the links did
          </h2>
        </div>
        <Link
          href="/sales/shared-listings"
          className="inline-flex h-11 items-center rounded-[10px] border border-sales-border bg-sales-surface px-4 text-[14px] font-semibold text-sales-text-primary transition-colors hover:bg-sales-surface-hover focus-visible:outline-none focus-visible:shadow-[var(--sales-focus-ring)]"
        >
          Open marketing
        </Link>
      </div>
      <article className="overflow-hidden rounded-[16px] border border-sales-border border-t-[3px] border-t-sales-brand bg-sales-surface">
        <div className="px-5 pb-4 pt-4">
          <p className="max-w-[62ch] text-[14px] leading-6 text-sales-text-secondary">{summaryLine(desk)}</p>
          {desk.activeLinks > 0 ? (
            <p className="mt-1 text-[12px] text-sales-text-muted">Last 30 days. WhatsApp taps are not messages.</p>
          ) : null}
          {desk.viewingRequests > 0 ? (
            <p className="mt-1 text-[12px] text-sales-text-muted">A viewing request is not a confirmed booking.</p>
          ) : null}
        </div>
        {rows.length > 0 ? (
          <ul>
            {rows.map((row) => (
              <li key={row.id} className="flex items-center gap-3 border-t border-sales-border-subtle px-5 py-3">
                {row.attention ? <span className="h-8 w-[3px] shrink-0 rounded-full bg-sales-danger" aria-hidden /> : null}
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[14px] font-semibold text-sales-text-primary">{row.title}</p>
                  {row.meta ? <p className="truncate text-[12px] text-sales-text-muted">{row.meta}</p> : null}
                  <p className="mt-0.5 text-[13px] text-sales-text-secondary">{row.line}</p>
                </div>
                <Link
                  href={row.href}
                  className="inline-flex h-11 shrink-0 items-center rounded-[8px] border border-sales-border bg-sales-bg px-3 text-[13px] font-semibold text-sales-text-primary transition-colors hover:bg-sales-surface-hover focus-visible:outline-none focus-visible:shadow-[var(--sales-focus-ring)]"
                >
                  Open
                </Link>
              </li>
            ))}
          </ul>
        ) : null}
      </article>
    </section>
  );
}
