"use client";

import { useEffect, useState } from "react";

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

  const stats = [
    {
      label: "Avg days to close",
      value: `${insights.avgDaysToClose}d`,
      icon: "ti-clock",
      color: "#60a5fa",
    },
    {
      label: "Avg calls to close",
      value: String(insights.avgCalls),
      icon: "ti-phone",
      color: "#3dd68c",
    },
    {
      label: "Portfolio sent on wins",
      value: `${insights.portfolioWinRate}%`,
      icon: "ti-layout-grid",
      color: "#D4FF4F",
    },
    {
      label: "Pricing sent on wins",
      value: `${insights.pricingWinRate}%`,
      icon: "ti-tag",
      color: "#f5a623",
    },
    ...(insights.avgDealValue
      ? [
          {
            label: "Avg deal value",
            value: `$${insights.avgDealValue.toLocaleString()}`,
            icon: "ti-currency-dollar",
            color: "#a78bfa",
          },
        ]
      : []),
  ];

  return (
    <section
      style={{
        background: "var(--ag-surface)",
        border: "0.5px solid var(--ag-border)",
        borderRadius: 12,
        padding: 24,
        marginTop: 20,
      }}
    >
      <p
        style={{
          fontFamily: "var(--ag-font-body)",
          fontSize: 11,
          fontWeight: 600,
          textTransform: "uppercase",
          letterSpacing: "0.08em",
          color: "var(--ag-text-tertiary)",
          margin: "0 0 16px",
        }}
      >
        Win patterns — {insights.totalWins} deals analysed
      </p>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))",
          gap: 12,
          marginBottom: 20,
        }}
      >
        {stats.map((stat) => (
          <div
            key={stat.label}
            style={{
              background: "var(--ag-surface-2)",
              border: "0.5px solid var(--ag-border)",
              borderRadius: 10,
              padding: "14px 16px",
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                marginBottom: 8,
              }}
            >
              <i className={`ti ${stat.icon}`} style={{ fontSize: 14, color: stat.color }} />
              <p
                style={{
                  fontFamily: "var(--ag-font-body)",
                  fontSize: 10,
                  fontWeight: 600,
                  textTransform: "uppercase",
                  letterSpacing: "0.06em",
                  color: "var(--ag-text-tertiary)",
                  margin: 0,
                }}
              >
                {stat.label}
              </p>
            </div>
            <p
              style={{
                fontFamily: "var(--ag-font-display)",
                fontSize: 28,
                color: "var(--ag-text-primary)",
                margin: 0,
                lineHeight: 1,
              }}
            >
              {stat.value}
            </p>
          </div>
        ))}
      </div>

      {insights.topSalesperson && (
        <div
          style={{
            padding: "12px 16px",
            background: "rgba(212,255,79,0.05)",
            border: "0.5px solid rgba(212,255,79,0.15)",
            borderRadius: 10,
            display: "flex",
            alignItems: "center",
            gap: 10,
          }}
        >
          <i className="ti ti-trophy" style={{ fontSize: 16, color: "#D4FF4F" }} />
          <p
            style={{
              fontFamily: "var(--ag-font-body)",
              fontSize: 13,
              color: "var(--ag-text-secondary)",
              margin: 0,
            }}
          >
            Top performer:{" "}
            <strong style={{ color: "var(--ag-text-primary)" }}>
              {insights.topSalesperson.name}
            </strong>{" "}
            with {insights.topSalesperson.count} closed deals
          </p>
        </div>
      )}

      {winInsight && (
        <div
          style={{
            marginTop: 14,
            padding: "12px 16px",
            background: "rgba(212,255,79,0.04)",
            border: "0.5px solid rgba(212,255,79,0.12)",
            borderRadius: 10,
            display: "flex",
            alignItems: "flex-start",
            gap: 10,
          }}
        >
          <i
            className="ti ti-sparkles"
            style={{ fontSize: 14, color: "#D4FF4F", flexShrink: 0, marginTop: 1 }}
          />
          <p
            style={{
              fontFamily: "var(--ag-font-body)",
              fontSize: 13,
              color: "var(--ag-text-secondary)",
              margin: 0,
              lineHeight: 1.65,
            }}
          >
            {winInsight}
          </p>
        </div>
      )}
    </section>
  );
}
