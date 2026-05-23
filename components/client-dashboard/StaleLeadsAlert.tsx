"use client";

import { useEffect, useState } from "react";
import { ScoreBadge } from "@/components/ui/ScoreBadge";
import { openLeadPanel } from "@/store/uiStore";

type StaleLeadRow = {
  id: string;
  name: string | null;
  phone: string | null;
  status: string;
  score: number | null;
  stale_since: string | null;
  assignedToName: string | null;
};

export function StaleLeadsAlert({ clientId }: { clientId: string }) {
  const [staleLeads, setStaleLeads] = useState<StaleLeadRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const res = await fetch(`/api/leads/stale?clientId=${clientId}`);
        if (!res.ok) return;
        const data = (await res.json()) as { staleLeads: StaleLeadRow[] };
        if (!cancelled) setStaleLeads(data.staleLeads ?? []);
      } catch {
        // silent
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [clientId]);

  if (loading || staleLeads.length === 0) return null;

  return (
    <div
      style={{
        marginBottom: 24,
        background: "rgba(255,68,68,0.04)",
        border: "0.5px solid rgba(255,68,68,0.15)",
        borderRadius: 12,
        overflow: "hidden",
      }}
    >
      <button
        type="button"
        onClick={() => setCollapsed((c) => !c)}
        style={{
          width: "100%",
          padding: "14px 20px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          background: "transparent",
          border: "none",
          cursor: "pointer",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <i
            className="ti ti-alert-circle"
            style={{ fontSize: 16, color: "#ff4444", flexShrink: 0 }}
          />
          <p
            style={{
              fontFamily: "var(--ag-font-body)",
              fontSize: 14,
              fontWeight: 600,
              color: "#ff4444",
              margin: 0,
            }}
          >
            {staleLeads.length} stale lead{staleLeads.length !== 1 ? "s" : ""} need attention
          </p>
        </div>
        <i
          className={`ti ${collapsed ? "ti-chevron-down" : "ti-chevron-up"}`}
          style={{ fontSize: 14, color: "#ff4444" }}
        />
      </button>

      {!collapsed && (
        <div style={{ padding: "0 20px 16px" }}>
          <p
            style={{
              fontFamily: "var(--ag-font-body)",
              fontSize: 12,
              color: "var(--ag-text-tertiary)",
              marginBottom: 12,
            }}
          >
            These leads have had no activity for 7 or more days. Click to open and re-engage.
          </p>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {staleLeads.map((lead) => {
              const staleDays = lead.stale_since
                ? Math.round(
                    (Date.now() - new Date(lead.stale_since).getTime()) /
                      (1000 * 60 * 60 * 24)
                  )
                : null;

              return (
                <button
                  key={lead.id}
                  type="button"
                  onClick={() => openLeadPanel(lead.id)}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    padding: "10px 14px",
                    background: "var(--ag-surface)",
                    border: "0.5px solid var(--ag-border)",
                    borderRadius: 8,
                    cursor: "pointer",
                    textAlign: "left",
                    gap: 12,
                  }}
                >
                  <div style={{ minWidth: 0 }}>
                    <p
                      style={{
                        fontFamily: "var(--ag-font-body)",
                        fontSize: 13,
                        fontWeight: 600,
                        color: "var(--ag-text-primary)",
                        margin: "0 0 2px",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {lead.name ?? "—"}
                    </p>
                    <p
                      style={{
                        fontFamily: "var(--ag-font-body)",
                        fontSize: 11,
                        color: "var(--ag-text-muted)",
                        margin: 0,
                      }}
                    >
                      {lead.assignedToName ?? "Unassigned"} ·{" "}
                      {staleDays !== null ? `${staleDays}d stale` : "Stale"}
                    </p>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
                    {lead.score !== null && lead.score !== undefined && (
                      <ScoreBadge score={lead.score} />
                    )}
                    <i
                      className="ti ti-chevron-right"
                      style={{ fontSize: 13, color: "var(--ag-text-muted)" }}
                    />
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
