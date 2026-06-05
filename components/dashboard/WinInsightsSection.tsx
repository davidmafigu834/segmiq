"use client";

import { useEffect, useState } from "react";
import { Clock, Phone, LayoutGrid, Tag, DollarSign, Trophy, Sparkles, type LucideIcon } from "lucide-react";
import { Card, CardBody } from "@/components/ui/Card";

type WinInsight = {
  totalWins: number;
  avgDaysToClose: number;
  avgCalls: number;
  avgDealValue: number | null;
  portfolioWinRate: number;
  pricingWinRate: number;
  sourceCounts: Record<string, number>;
  topSalesperson: { name: string; count: number } | null;
};

export function WinInsightsSection({ clientId }: { clientId: string }) {
  const [insights, setInsights] = useState<WinInsight | null>(null);
  const [winInsight, setWinInsight] = useState<string | null>(null);

  useEffect(() => {
    fetch(`/api/reports/client/wins?clientId=${clientId}`)
      .then((r) => r.json())
      .then((data: { insights?: WinInsight | null }) => {
        if (data.insights) setInsights(data.insights);
      })
      .catch(() => {});
  }, [clientId]);

  useEffect(() => {
    if (!insights || insights.totalWins < 3) return;
    fetch("/api/reports/client/wins/insight", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ clientId, insights }),
    })
      .then((r) => r.json())
      .then((data: { insight?: string }) => {
        if (data.insight) setWinInsight(data.insight);
      })
      .catch(() => {});
  }, [clientId, insights]);

  if (!insights || insights.totalWins === 0) return null;

  const stats: { label: string; value: string; Icon: LucideIcon; color: string }[] = [
    { label: "Avg days to close", value: `${insights.avgDaysToClose}d`, Icon: Clock, color: "#60a5fa" },
    { label: "Avg calls to close", value: String(insights.avgCalls), Icon: Phone, color: "#3dd68c" },
    { label: "Portfolio sent on wins", value: `${insights.portfolioWinRate}%`, Icon: LayoutGrid, color: "#D4FF4F" },
    { label: "Pricing sent on wins", value: `${insights.pricingWinRate}%`, Icon: Tag, color: "#f5a623" },
    ...(insights.avgDealValue
      ? [
          {
            label: "Avg deal value",
            value: `$${insights.avgDealValue.toLocaleString()}`,
            Icon: DollarSign,
            color: "#a78bfa",
          },
        ]
      : []),
  ];

  return (
    <Card>
      <CardBody>
        <p className="mb-4 text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--text-tertiary)]">
          Win patterns — {insights.totalWins} deals analysed
        </p>

        <div className="mb-5 grid grid-cols-[repeat(auto-fill,minmax(150px,1fr))] gap-3">
          {stats.map(({ label, value, Icon, color }) => (
            <div
              key={label}
              className="rounded-xl border border-[var(--border)] bg-[var(--bg-tertiary)] px-4 py-3.5"
            >
              <div className="mb-2 flex items-center gap-2">
                <Icon className="h-4 w-4 shrink-0" style={{ color }} aria-hidden />
                <p className="m-0 text-[10px] font-semibold uppercase tracking-[0.06em] text-[var(--text-tertiary)]">
                  {label}
                </p>
              </div>
              <p className="m-0 font-display text-[28px] leading-none text-[var(--text-primary)]">{value}</p>
            </div>
          ))}
        </div>

        {insights.topSalesperson && (
          <div className="flex items-center gap-2.5 rounded-xl border border-[rgba(212,255,79,0.15)] bg-[rgba(212,255,79,0.05)] px-4 py-3">
            <Trophy className="h-4 w-4 shrink-0 text-[var(--accent)]" aria-hidden />
            <p className="m-0 text-[13px] text-[var(--text-secondary)]">
              Top performer:{" "}
              <strong className="text-[var(--text-primary)]">{insights.topSalesperson.name}</strong> with{" "}
              {insights.topSalesperson.count} closed deals
            </p>
          </div>
        )}

        {winInsight && (
          <div className="mt-3.5 flex items-start gap-2.5 rounded-xl border border-[rgba(212,255,79,0.12)] bg-[rgba(212,255,79,0.04)] px-4 py-3">
            <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-[var(--accent)]" aria-hidden />
            <p className="m-0 text-[13px] leading-relaxed text-[var(--text-secondary)]">{winInsight}</p>
          </div>
        )}
      </CardBody>
    </Card>
  );
}
