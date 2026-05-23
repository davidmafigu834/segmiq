"use client";

import { useEffect, useState } from "react";

type Props = {
  leadId: string;
};

export function LeadBriefing({ leadId }: Props) {
  const [briefing, setBriefing] = useState("");
  const [suggestion, setSuggestion] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/leads/${leadId}/briefing`)
      .then((r) => r.json())
      .then((data: { briefing?: string; suggestion?: string }) => {
        if (cancelled) return;
        if (data.briefing) setBriefing(data.briefing);
        if (data.suggestion) setSuggestion(data.suggestion);
      })
      .catch(() => {
        if (!cancelled) setError(true);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [leadId]);

  if (error) return null;

  return (
    <div
      style={{
        background: "var(--ag-surface)",
        border: "0.5px solid var(--ag-border)",
        borderRadius: 12,
        padding: 16,
        marginBottom: 20,
      }}
    >
      {/* Header */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          marginBottom: 12,
        }}
      >
        <div
          style={{
            width: 24,
            height: 24,
            borderRadius: 6,
            background: "rgba(212,255,79,0.1)",
            border: "0.5px solid rgba(212,255,79,0.2)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <i className="ti ti-sparkles" style={{ fontSize: 12, color: "#D4FF4F" }} />
        </div>
        <p
          style={{
            fontFamily: "var(--ag-font-body)",
            fontSize: 11,
            fontWeight: 600,
            textTransform: "uppercase",
            letterSpacing: "0.08em",
            color: "var(--ag-text-tertiary)",
            margin: 0,
          }}
        >
          AI briefing
        </p>
      </div>

      {loading ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {[90, 70, 50].map((w, i) => (
            <div
              key={i}
              style={{
                height: 13,
                width: `${w}%`,
                background: "var(--ag-surface-2)",
                borderRadius: 4,
                animation: "skeleton-shimmer 1.5s ease-in-out infinite",
              }}
            />
          ))}
        </div>
      ) : (
        <>
          {briefing && (
            <p
              style={{
                fontFamily: "var(--ag-font-body)",
                fontSize: 13,
                color: "var(--ag-text-secondary)",
                margin: "0 0 12px",
                lineHeight: 1.65,
              }}
            >
              {briefing}
            </p>
          )}

          {suggestion && (
            <div
              style={{
                display: "flex",
                alignItems: "flex-start",
                gap: 8,
                padding: "10px 12px",
                background: "rgba(212,255,79,0.05)",
                border: "0.5px solid rgba(212,255,79,0.15)",
                borderRadius: 8,
              }}
            >
              <i
                className="ti ti-arrow-right"
                style={{
                  fontSize: 13,
                  color: "#D4FF4F",
                  flexShrink: 0,
                  marginTop: 1,
                }}
              />
              <p
                style={{
                  fontFamily: "var(--ag-font-body)",
                  fontSize: 13,
                  color: "var(--ag-text-primary)",
                  margin: 0,
                  lineHeight: 1.5,
                }}
              >
                {suggestion}
              </p>
            </div>
          )}
        </>
      )}
    </div>
  );
}
