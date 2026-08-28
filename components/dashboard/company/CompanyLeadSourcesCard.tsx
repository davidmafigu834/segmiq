"use client";

import { Footprints, Globe2, MoreHorizontal, UserRoundPlus } from "lucide-react";
import { SiFacebook, SiWhatsapp } from "react-icons/si";
import { CompanyDashCard, CompanyDashEmpty, PeriodChip } from "./CompanyDashCard";
import type { CompanyLeadSourceItem } from "./types";

const BRAND_COLORS: Record<CompanyLeadSourceItem["brand"], string> = {
  whatsapp: "#25D366",
  facebook: "#1877F2",
  referral: "#9366FF",
  website: "#38BDF8",
  walkin: "#64748B",
  other: "#7B8BA8",
};

const BRAND_TINT: Record<CompanyLeadSourceItem["brand"], string> = {
  whatsapp: "bg-[rgba(37,211,102,0.12)]",
  facebook: "bg-[rgba(24,119,242,0.12)]",
  referral: "bg-sales-purple-soft",
  website: "bg-sales-info-soft",
  walkin: "bg-sales-warning-soft",
  other: "bg-sales-neutral-100",
};

function SourceIcon({ brand }: { brand: CompanyLeadSourceItem["brand"] }) {
  if (brand === "whatsapp") return <SiWhatsapp size={13} className="text-[#25D366]" aria-hidden />;
  if (brand === "facebook") return <SiFacebook size={13} className="text-[#1877F2]" aria-hidden />;
  if (brand === "referral") return <UserRoundPlus size={13} strokeWidth={2} className="text-[#9366FF]" aria-hidden />;
  if (brand === "walkin") return <Footprints size={13} strokeWidth={2} aria-hidden />;
  if (brand === "website") return <Globe2 size={13} strokeWidth={2} className="text-[#38BDF8]" aria-hidden />;
  return <MoreHorizontal size={13} strokeWidth={2} aria-hidden />;
}

export function CompanyLeadSourcesCard({
  sources,
  empty,
}: {
  sources: CompanyLeadSourceItem[];
  empty: boolean;
}) {
  const max = Math.max(...sources.map((s) => s.count), 1);

  return (
    <CompanyDashCard
      title="Top Lead sources"
      className="dashboard-panel--analytics"
      action={<PeriodChip>This month</PeriodChip>}
    >
      {empty || sources.length === 0 ? (
        <CompanyDashEmpty title="No Lead source data yet" description="Sources will appear as enquiries arrive from WhatsApp, Facebook, website and referrals." />
      ) : (
        <ul className="space-y-2.5 px-4 py-3" aria-label="Lead sources this month">
          {sources.map((source) => (
            <li key={source.id} className="flex items-center gap-3">
              <span
                className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-[7px] ${BRAND_TINT[source.brand]}`}
              >
                <SourceIcon brand={source.brand} />
              </span>
              <div className="min-w-0 flex-1">
                <div className="mb-1.5 flex items-center justify-between gap-3">
                  <span className="truncate text-[12px] font-semibold text-sales-text-primary">
                    {source.label}
                  </span>
                  <span className="shrink-0 text-[12px] tabular-nums text-sales-text-secondary">
                    {source.count}
                    <span className="text-sales-text-muted"> · {source.pct}%</span>
                  </span>
                </div>
                <div className="h-1.5 overflow-hidden rounded-full bg-sales-neutral-100">
                  <div
                    className="h-full rounded-full"
                    style={{
                      width: `${Math.max(6, Math.round((source.count / max) * 100))}%`,
                      backgroundColor: BRAND_COLORS[source.brand],
                    }}
                  />
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </CompanyDashCard>
  );
}
