"use client";

import { useEffect, useState } from "react";
import { formatConversionPct } from "@/lib/real-estate/marketing";

type ListingMarketing = {
  funnel: {
    inquiries: number;
    qualified: number;
    viewings: number;
    offers: number;
    accepted: number;
  };
  sources: Array<{ sourceType: string; label: string; inquiries: number }>;
  campaigns: Array<{ id: string; name: string; inquiries: number }>;
  row: { insight: string | null } | null;
};

export function ListingMarketingSection({
  clientId,
  listingId,
}: {
  clientId: string;
  listingId: string;
}) {
  const [data, setData] = useState<ListingMarketing | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/clients/${clientId}/listings/${listingId}/marketing`)
      .then((r) => r.json())
      .then((j: ListingMarketing & { error?: string }) => {
        if (!cancelled && !j.error) setData(j);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [clientId, listingId]);

  if (!data) return null;
  const f = data.funnel;
  const total = f.inquiries;

  return (
    <div className="workspace-card rounded-[14px] border border-sales-border bg-sales-surface p-5">
      <h3 className="text-[16px] font-semibold tracking-[-0.02em]">Marketing performance</h3>
      {total === 0 ? (
        <p className="mt-2 text-[13px] text-sales-text-secondary">
          No inquiries have been attributed to this listing yet.
        </p>
      ) : (
        <>
          <ul className="mt-3 space-y-1.5 text-[13px]">
            {data.sources.map((s) => (
              <li key={s.sourceType} className="flex justify-between">
                <span>{s.label}</span>
                <span className="tabular-nums text-sales-text-secondary">{s.inquiries} inquiries</span>
              </li>
            ))}
          </ul>
          <p className="mt-3 text-[13px] text-sales-text-secondary">
            {f.inquiries} total inquiries · {f.viewings} viewings · {f.offers} offers · {f.accepted} accepted
            {f.inquiries > 0
              ? ` · ${formatConversionPct(
                  Math.round((f.accepted / f.inquiries) * 1000) / 10
                )} accepted offer conversion`
              : ""}
          </p>
          {data.campaigns.length > 0 ? (
            <p className="mt-2 text-[12px] text-sales-text-muted">
              Campaigns: {data.campaigns.map((c) => c.name).join(", ")}
            </p>
          ) : null}
          {data.row?.insight ? (
            <p className="mt-2 text-[12px] text-sales-text-secondary">{data.row.insight}</p>
          ) : null}
        </>
      )}
    </div>
  );
}
