"use client";

import { Footprints, Globe2, MoreHorizontal, UserRoundPlus } from "lucide-react";
import { SiFacebook, SiWhatsapp } from "react-icons/si";
import { CardShell } from "@/components/dashboard/sales/KpiCard";
import type { CompanyLeadSourceItem } from "./types";

const BRAND_COLORS: Record<CompanyLeadSourceItem["brand"], string> = {
  whatsapp: "#25D366",
  facebook: "#1877F2",
  referral: "#64748B",
  website: "#0EA5E9",
  walkin: "#78716C",
  other: "#94A3B8",
};

function SourceIcon({ brand }: { brand: CompanyLeadSourceItem["brand"] }) {
  if (brand === "whatsapp") {
    return <SiWhatsapp size={14} className="text-[#25D366]" aria-hidden />;
  }
  if (brand === "facebook") {
    return <SiFacebook size={14} className="text-[#1877F2]" aria-hidden />;
  }
  if (brand === "referral") {
    return <UserRoundPlus size={14} strokeWidth={2} className="text-sales-text-primary" aria-hidden />;
  }
  if (brand === "walkin") {
    return <Footprints size={14} strokeWidth={2} className="text-sales-text-primary" aria-hidden />;
  }
  if (brand === "website") {
    return <Globe2 size={14} strokeWidth={2} className="text-sales-text-primary" aria-hidden />;
  }
  return <MoreHorizontal size={14} strokeWidth={2} className="text-sales-text-secondary" aria-hidden />;
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
    <CardShell
      title="Top Lead Sources"
      action={<span className="text-[12px] font-medium text-sales-text-muted">This month</span>}
    >
      <div className="px-4 py-4 sm:px-5">
        {empty || sources.length === 0 ? (
          <p className="py-6 text-center text-[13px] text-sales-text-muted">
            No Lead source data yet
          </p>
        ) : (
          <ul className="space-y-3.5" aria-label="Lead sources this month">
            {sources.map((s) => (
              <li key={s.id}>
                <div className="mb-1.5 flex items-center justify-between gap-3 text-[12px]">
                  <span className="inline-flex min-w-0 items-center gap-2 text-sales-text-primary">
                    <SourceIcon brand={s.brand} />
                    <span className="truncate font-medium">{s.label}</span>
                  </span>
                  <span className="shrink-0 tabular-nums text-sales-text-secondary">
                    {s.count} · {s.pct}%
                  </span>
                </div>
                <div className="h-1.5 overflow-hidden rounded-full bg-sales-neutral-100">
                  <div
                    className="h-full rounded-full transition-[width] duration-300"
                    style={{
                      width: `${Math.max(4, Math.round((s.count / max) * 100))}%`,
                      backgroundColor: BRAND_COLORS[s.brand],
                    }}
                  />
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </CardShell>
  );
}
