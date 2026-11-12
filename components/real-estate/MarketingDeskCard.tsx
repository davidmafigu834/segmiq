"use client";

import Link from "next/link";
import type { MouseEvent } from "react";
import { formatVisitDay } from "@/lib/real-estate/agent-listing-pages/analytics";
import type { MarketingDesk, MarketingDeskRow } from "@/lib/real-estate/agent-listing-pages/desk";
import { VisitStrip } from "@/components/real-estate/listing-pages/VisitLine";

const ROW_LIMIT = 3;

const lineBtn =
  "inline-flex min-h-11 shrink-0 items-center rounded-[8px] border border-sales-border px-3 text-[13px] font-semibold layout:min-h-9 text-sales-text-primary transition-colors hover:bg-sales-surface-hover focus-visible:outline-none focus-visible:shadow-[var(--sales-focus-ring)] motion-reduce:transition-none";
const rowBtn =
  "inline-flex h-11 shrink-0 items-center rounded-[8px] border border-sales-border bg-sales-bg px-3 text-[13px] font-semibold text-sales-text-primary transition-colors hover:bg-sales-surface-hover focus-visible:outline-none focus-visible:shadow-[var(--sales-focus-ring)] motion-reduce:transition-none layout:h-9";

function counted(n: number, singular: string, plural: string) {
  return `${n} ${n === 1 ? singular : plural}`;
}

export function MarketingDeskCard({
  desk,
  marketingHref = "/sales/shared-listings",
  onNavigate,
}: {
  desk: MarketingDesk | null;
  marketingHref?: string;
  onNavigate?: (href: string) => void;
}) {
  if (!desk) return null;
  if (desk.activeLinks === 0 && desk.quiet.length === 0 && desk.unlinked.length === 0) return null;
  const rows = [...desk.quiet, ...desk.unlinked];
  const shown = rows.slice(0, ROW_LIMIT);
  const hidden = rows.length - shown.length;
  const days = desk.series ?? [];
  const whatsappClicks = desk.whatsappClicks ?? 0;

  function go(href: string) {
    return (event: MouseEvent<HTMLAnchorElement>) => {
      if (!onNavigate) return;
      event.preventDefault();
      onNavigate(href);
    };
  }

  const counts = [
    { label: "Enquiries", value: desk.enquiries },
    { label: "Viewing requests", value: desk.viewingRequests },
    { label: "WhatsApp taps", value: whatsappClicks },
  ];

  return (
    <section aria-labelledby="marketing-desk">
      <div className="mb-3 flex items-end justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[11px] font-medium uppercase tracking-[0.16em] text-sales-text-muted">Marketing</p>
          <h2 id="marketing-desk" className="mt-1 font-display text-[18px] font-semibold leading-tight tracking-[-0.02em] text-sales-text-primary">
            What the links did
          </h2>
        </div>
        <Link href={marketingHref} onClick={go(marketingHref)} className={lineBtn}>
          Open marketing
        </Link>
      </div>

      <article className="overflow-hidden rounded-[var(--re-radius-card,12px)] border border-[var(--sales-card-border,var(--sales-border-subtle))] bg-sales-surface">
        {desk.activeLinks > 0 ? (
          <div className="px-5 pb-4 pt-4">
            <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-3">
              <div className="min-w-0">
                <p className="flex items-baseline gap-2">
                  <span className={`font-display text-[32px] font-semibold leading-none tracking-[-0.04em] tabular-nums ${desk.visits === 0 ? "text-sales-text-muted" : "text-sales-text-primary"}`}>
                    {desk.visits}
                  </span>
                  <span className="text-[14px] font-medium text-sales-text-primary">{desk.visits === 1 ? "visit" : "visits"}</span>
                </p>
                <p className="mt-1 text-[12px] text-sales-text-muted">
                  {counted(desk.activeLinks, "link", "links")}, last 30 days, people only
                </p>
              </div>
              <dl className="flex gap-5">
                {counts.map((item) => (
                  <div key={item.label} className="flex min-w-0 flex-col-reverse">
                    <dt className="mt-1 whitespace-nowrap text-[12px] text-sales-text-muted">{item.label}</dt>
                    <dd className={`text-[18px] font-semibold leading-none tracking-[-0.02em] tabular-nums ${item.value === 0 ? "text-sales-text-muted" : "text-sales-text-primary"}`}>
                      {item.value}
                    </dd>
                  </div>
                ))}
              </dl>
            </div>
            {desk.visits > 0 && days.length > 1 ? (
              <div className="mt-3">
                <VisitStrip days={days} label={`${desk.visits} visits in the last 30 days`} />
                <div className="mt-1 flex justify-between text-[11px] text-sales-text-muted">
                  <span>{formatVisitDay(days[0].day)}</span>
                  <span className="flex items-center gap-1.5">
                    <span className="inline-block h-1.5 w-1.5 rounded-full bg-sales-brand" aria-hidden />
                    Today
                  </span>
                </div>
              </div>
            ) : (
              <p className="mt-3 text-[13px] text-sales-text-secondary">The line starts when a person opens one of your links.</p>
            )}
          </div>
        ) : (
          <div className="px-5 py-4">
            <p className="text-[15px] font-semibold text-sales-text-primary">No marketing links yet.</p>
            <p className="mt-1 text-[14px] text-sales-text-secondary">Create a personal link on a property. Visits show here.</p>
          </div>
        )}

        {shown.length > 0 ? (
          <ul className="border-t border-sales-border-subtle">
            {shown.map((row) => (
              <DeskRow key={row.id} row={row} onClick={go(row.href)} />
            ))}
          </ul>
        ) : null}

        {hidden > 0 ? (
          <Link
            href={marketingHref}
            onClick={go(marketingHref)}
            className="flex min-h-11 items-center border-t border-sales-border-subtle px-5 text-[13px] font-semibold text-sales-text-primary transition-colors hover:bg-sales-surface-hover focus-visible:outline-none focus-visible:shadow-[var(--sales-focus-ring)] motion-reduce:transition-none"
          >
            {counted(hidden, "more needs you", "more need you")} in marketing
          </Link>
        ) : null}
      </article>
    </section>
  );
}

function DeskRow({ row, onClick }: { row: MarketingDeskRow; onClick: (event: MouseEvent<HTMLAnchorElement>) => void }) {
  const status = row.attention
    ? `${counted(row.visits ?? 0, "visit", "visits")}, no enquiry yet`
    : row.line.replace(/\.$/, "");
  return (
    <li className="flex items-center gap-3 border-t border-sales-border-subtle px-5 py-2.5 first:border-t-0">
      <span className={`h-7 w-[3px] shrink-0 rounded-full ${row.attention ? "bg-sales-danger" : "bg-sales-border"}`} aria-hidden />
      <div className="min-w-0 flex-1">
        <p className="truncate text-[14px] font-semibold text-sales-text-primary">{row.title}</p>
        <p className="truncate text-[12px] text-sales-text-secondary">
          {row.meta ? <span className="text-sales-text-muted">{row.meta} · </span> : null}
          {status}
        </p>
      </div>
      <Link href={row.href} onClick={onClick} className={rowBtn}>
        {row.action ?? "Open"}
      </Link>
    </li>
  );
}
