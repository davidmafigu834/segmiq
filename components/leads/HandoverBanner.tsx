"use client";

import { useEffect, useState } from "react";
import type { HandoverSummary } from "@/lib/handover-summary";

type ApiResponse = {
  isRecentlyReassigned: boolean;
  summary: HandoverSummary | null;
};

type Props = {
  leadId: string;
};

const OUTCOME_LABELS: Record<string, string> = {
  ANSWERED: "Answered",
  NO_ANSWER: "No answer",
  FOLLOW_UP: "Follow-up needed",
  WON: "Won",
  LOST: "Lost",
  NOT_QUALIFIED: "Not qualified",
};

export function HandoverBanner({ leadId }: Props) {
  const [data, setData] = useState<ApiResponse | null>(null);
  const [expanded, setExpanded] = useState(true);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/leads/${leadId}/handover-summary`)
      .then((r) => r.json())
      .then((json: ApiResponse) => {
        if (!cancelled) setData(json);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [leadId]);

  if (!data?.isRecentlyReassigned || !data.summary) return null;

  const { summary } = data;

  return (
    <div
      style={{
        background: "rgba(245,166,35,0.06)",
        border: "0.5px solid rgba(245,166,35,0.2)",
        borderRadius: 12,
        marginBottom: 20,
        overflow: "hidden",
      }}
    >
      {/* Header */}
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        style={{
          width: "100%",
          padding: "14px 16px",
          background: "none",
          border: "none",
          cursor: "pointer",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 10,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <i className="ti ti-transfer" style={{ fontSize: 15, color: "#f5a623" }} />
          <p
            style={{
              fontFamily: "var(--ag-font-body)",
              fontSize: 13,
              fontWeight: 600,
              color: "#f5a623",
              margin: 0,
            }}
          >
            Handover briefing
            {summary.previousSalesperson ? ` from ${summary.previousSalesperson}` : ""}
          </p>
        </div>
        <i
          className={`ti ${expanded ? "ti-chevron-up" : "ti-chevron-down"}`}
          style={{ fontSize: 14, color: "#f5a623" }}
        />
      </button>

      {expanded && (
        <div style={{ padding: "0 16px 16px" }}>
          {/* Key stats row */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(3, 1fr)",
              gap: 8,
              marginBottom: 14,
            }}
          >
            {[
              { label: "Days active", value: `${summary.daysActive}d` },
              { label: "Total calls", value: String(summary.totalCalls) },
              { label: "Status", value: summary.currentStatus },
            ].map((stat) => (
              <div
                key={stat.label}
                style={{
                  background: "rgba(245,166,35,0.06)",
                  borderRadius: 8,
                  padding: "10px 12px",
                }}
              >
                <p
                  style={{
                    fontFamily: "var(--ag-font-body)",
                    fontSize: 10,
                    fontWeight: 600,
                    textTransform: "uppercase",
                    letterSpacing: "0.06em",
                    color: "rgba(245,166,35,0.6)",
                    margin: "0 0 4px",
                  }}
                >
                  {stat.label}
                </p>
                <p
                  style={{
                    fontFamily: "var(--ag-font-display)",
                    fontSize: 18,
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

          {/* Last call */}
          {summary.lastCallOutcome && (
            <div style={{ marginBottom: 10 }}>
              <p
                style={{
                  fontFamily: "var(--ag-font-body)",
                  fontSize: 11,
                  fontWeight: 600,
                  textTransform: "uppercase",
                  letterSpacing: "0.06em",
                  color: "var(--ag-text-tertiary)",
                  margin: "0 0 4px",
                }}
              >
                Last call outcome
              </p>
              <p
                style={{
                  fontFamily: "var(--ag-font-body)",
                  fontSize: 13,
                  color: "var(--ag-text-secondary)",
                  margin: 0,
                }}
              >
                {OUTCOME_LABELS[summary.lastCallOutcome] ?? summary.lastCallOutcome}
                {summary.lastCallNotes ? ` — "${summary.lastCallNotes}"` : ""}
              </p>
            </div>
          )}

          {/* Follow-up date */}
          {summary.nextFollowUp && (
            <div style={{ marginBottom: 10 }}>
              <p
                style={{
                  fontFamily: "var(--ag-font-body)",
                  fontSize: 11,
                  fontWeight: 600,
                  textTransform: "uppercase",
                  letterSpacing: "0.06em",
                  color: "var(--ag-text-tertiary)",
                  margin: "0 0 4px",
                }}
              >
                Next follow-up
              </p>
              <p
                style={{
                  fontFamily: "var(--ag-font-body)",
                  fontSize: 13,
                  color: "#f5a623",
                  margin: 0,
                  display: "flex",
                  alignItems: "center",
                  gap: 5,
                }}
              >
                <i className="ti ti-calendar" style={{ fontSize: 12 }} />
                {new Date(summary.nextFollowUp).toLocaleDateString("en-GB", {
                  weekday: "long",
                  day: "numeric",
                  month: "long",
                })}
              </p>
            </div>
          )}

          {/* Assets sent */}
          {summary.assetsSent.length > 0 && (
            <div style={{ marginBottom: 10 }}>
              <p
                style={{
                  fontFamily: "var(--ag-font-body)",
                  fontSize: 11,
                  fontWeight: 600,
                  textTransform: "uppercase",
                  letterSpacing: "0.06em",
                  color: "var(--ag-text-tertiary)",
                  margin: "0 0 6px",
                }}
              >
                Already sent to prospect
              </p>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                {summary.assetsSent.map((asset, i) => (
                  <span
                    key={i}
                    style={{
                      height: 24,
                      padding: "0 10px",
                      background: "var(--ag-surface-2)",
                      border: "0.5px solid var(--ag-border)",
                      borderRadius: 12,
                      fontSize: 11,
                      color: "var(--ag-text-secondary)",
                      display: "inline-flex",
                      alignItems: "center",
                      fontFamily: "var(--ag-font-body)",
                    }}
                  >
                    {asset}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Handover notes */}
          {summary.handoverNotes && (
            <div
              style={{
                padding: "12px 14px",
                background: "rgba(245,166,35,0.08)",
                border: "0.5px solid rgba(245,166,35,0.2)",
                borderRadius: 10,
                marginTop: 6,
              }}
            >
              <p
                style={{
                  fontFamily: "var(--ag-font-body)",
                  fontSize: 11,
                  fontWeight: 600,
                  textTransform: "uppercase",
                  letterSpacing: "0.06em",
                  color: "#f5a623",
                  margin: "0 0 6px",
                }}
              >
                Notes from {summary.previousSalesperson ?? "previous rep"}
              </p>
              <p
                style={{
                  fontFamily: "var(--ag-font-body)",
                  fontSize: 13,
                  color: "var(--ag-text-secondary)",
                  margin: 0,
                  lineHeight: 1.6,
                }}
              >
                {summary.handoverNotes}
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
