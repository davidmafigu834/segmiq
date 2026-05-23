"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

type PulseData = {
  totalClients: number;
  leadsThisWeek: number;
  dealsWonThisWeek: number;
  avgContactRate: number;
};

type ClientStat = {
  id: string;
  name: string;
  industry: string;
  leadsThisWeek: number;
  contactRate: number | null;
  dealsWon: number;
  staleLeads: number;
  salespeopleCount: number;
  fbConnected: boolean;
  fbExpired: boolean;
  fbExpiringSoon: boolean;
  alerts: string[];
  hasAlerts: boolean;
};

type Alert = {
  clientId: string;
  clientName: string;
  message: string;
  severity: "error" | "warning";
};

type ActivityEvent = {
  id: string;
  event_type: string;
  actor_name: string;
  event_data: Record<string, unknown>;
  created_at: string;
  client_id: string;
};

type DashboardData = {
  pulse: PulseData;
  clients: ClientStat[];
  alerts: Alert[];
  recentActivity: ActivityEvent[];
};

// ============================================
// HELPERS
// ============================================

function getContactRateColor(rate: number | null): {
  text: string;
  bg: string;
  border: string;
} {
  if (rate === null)
    return { text: "var(--ag-text-muted)", bg: "transparent", border: "transparent" };
  if (rate >= 70)
    return { text: "#3dd68c", bg: "rgba(61,214,140,0.08)", border: "rgba(61,214,140,0.2)" };
  if (rate >= 40)
    return { text: "#f5a623", bg: "rgba(245,166,35,0.08)", border: "rgba(245,166,35,0.2)" };
  return { text: "#ff4444", bg: "rgba(255,68,68,0.08)", border: "rgba(255,68,68,0.2)" };
}

function formatEventType(type: string, data: Record<string, unknown>): string {
  const map: Record<string, (d: Record<string, unknown>) => string> = {
    LEAD_CREATED: (d) => `New lead from ${(d.source as string) || "unknown"}`,
    LEAD_REASSIGNED: (d) => `Lead reassigned to ${d.to_name as string}`,
    STATUS_CHANGED: (d) => `Lead moved to ${d.to_status as string}`,
    CALL_LOGGED: (d) => `Call logged — ${d.outcome as string}`,
    DOCUMENT_SENT: (d) => `${d.document_name as string} sent to prospect`,
    FOLLOW_UP_SET: () => `Follow-up scheduled`,
  };
  return map[type]?.(data) ?? type.replace(/_/g, " ").toLowerCase();
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);
  if (mins < 60) return `${mins}m ago`;
  if (hours < 24) return `${hours}h ago`;
  return `${days}d ago`;
}

// ============================================
// MAIN COMPONENT
// ============================================

export function AgencyDashboardClient() {
  const router = useRouter();
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/agency/dashboard")
      .then(async (r) => {
        if (!r.ok) {
          const body = await r.text().catch(() => "(no body)");
          console.error(`[dashboard] API error ${r.status}:`, body);
          throw new Error(`API ${r.status}`);
        }
        return r.json() as Promise<DashboardData>;
      })
      .then(setData)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const pulse = data?.pulse;
  const clients = data?.clients ?? [];
  const alerts = data?.alerts ?? [];
  const activity = data?.recentActivity ?? [];

  return (
    <div
      style={{
        fontFamily: "var(--ag-font-body)",
        padding: "28px 32px",
      }}
    >
      {/* ============================================
          PAGE HEADER
          ============================================ */}
      <div
        style={{
          display: "flex",
          alignItems: "flex-start",
          justifyContent: "space-between",
          marginBottom: 28,
          flexWrap: "wrap",
          gap: 16,
        }}
      >
        <div>
          <p
            style={{
              fontSize: 11,
              fontWeight: 700,
              letterSpacing: "0.1em",
              textTransform: "uppercase",
              color: "var(--ag-text-tertiary)",
              margin: "0 0 4px",
            }}
          >
            {new Date().toLocaleDateString("en-GB", {
              weekday: "long",
              day: "numeric",
              month: "long",
            })}
          </p>
          <h1
            style={{
              fontFamily: "var(--ag-font-display)",
              fontSize: 28,
              color: "var(--ag-text-primary)",
              margin: 0,
              lineHeight: 1.1,
              letterSpacing: "-0.3px",
            }}
          >
            Agency overview
          </h1>
        </div>

        {/* Quick actions */}
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {(
            [
              {
                label: "Add client",
                icon: "ti-building-plus",
                href: "/dashboard/clients/new",
                primary: true,
              },
              {
                label: "Invite admin",
                icon: "ti-user-plus",
                href: "/dashboard/settings",
                primary: false,
              },
              {
                label: "All leads",
                icon: "ti-users",
                href: "/dashboard/leads",
                primary: false,
              },
            ] as const
          ).map((action) => (
            <button
              key={action.label}
              onClick={() => router.push(action.href)}
              style={{
                height: 36,
                padding: "0 16px",
                background: action.primary ? "var(--ag-lime)" : "var(--ag-surface-2)",
                color: action.primary ? "var(--ag-lime-fg)" : "var(--ag-text-secondary)",
                border: action.primary ? "none" : "0.5px solid var(--ag-border)",
                borderRadius: 8,
                fontSize: 12,
                fontWeight: 700,
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                gap: 6,
                transition: "all 0.15s ease",
              }}
            >
              <i className={`ti ${action.icon}`} style={{ fontSize: 13 }} />
              {action.label}
            </button>
          ))}
        </div>
      </div>

      {/* ============================================
          PULSE STRIP — 4 vital signs
          ============================================ */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(4, 1fr)",
          gap: 12,
          marginBottom: 20,
        }}
      >
        {(
          [
            {
              label: "Active clients",
              value: loading ? "—" : (pulse?.totalClients ?? 0),
              icon: "ti-building",
              color: "#60a5fa",
              suffix: "",
            },
            {
              label: "Leads this week",
              value: loading ? "—" : (pulse?.leadsThisWeek ?? 0),
              icon: "ti-user-plus",
              color: "#D4FF4F",
              suffix: "",
            },
            {
              label: "Deals won",
              value: loading ? "—" : (pulse?.dealsWonThisWeek ?? 0),
              icon: "ti-trophy",
              color: "#3dd68c",
              suffix: "",
            },
            {
              label: "Avg contact rate",
              value: loading ? "—" : (pulse?.avgContactRate ?? 0),
              icon: "ti-phone",
              color:
                (pulse?.avgContactRate ?? 0) >= 70
                  ? "#3dd68c"
                  : (pulse?.avgContactRate ?? 0) >= 40
                  ? "#f5a623"
                  : "#ff4444",
              suffix: "%",
            },
          ] as const
        ).map((stat) => (
          <div
            key={stat.label}
            style={{
              background: "var(--ag-surface)",
              border: "0.5px solid var(--ag-border)",
              borderRadius: 12,
              padding: "18px 20px",
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                marginBottom: 12,
              }}
            >
              <p
                style={{
                  fontSize: 11,
                  fontWeight: 600,
                  textTransform: "uppercase",
                  letterSpacing: "0.08em",
                  color: "var(--ag-text-tertiary)",
                  margin: 0,
                }}
              >
                {stat.label}
              </p>
              <i className={`ti ${stat.icon}`} style={{ fontSize: 16, color: stat.color }} />
            </div>
            <p
              style={{
                fontFamily: "var(--ag-font-display)",
                fontSize: 42,
                color: "var(--ag-text-primary)",
                margin: 0,
                lineHeight: 1,
                letterSpacing: "-0.5px",
              }}
            >
              {stat.value}
              {typeof stat.value === "number" ? stat.suffix : ""}
            </p>
          </div>
        ))}
      </div>

      {/* ============================================
          ALERTS BANNER
          ============================================ */}
      {!loading && alerts.length > 0 && (
        <div style={{ marginBottom: 20, display: "flex", flexDirection: "column", gap: 8 }}>
          {alerts.slice(0, 5).map((alert, i) => (
            <div
              key={i}
              onClick={() => router.push(`/dashboard/clients/${alert.clientId}/settings`)}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 12,
                padding: "12px 16px",
                background:
                  alert.severity === "error"
                    ? "rgba(255,68,68,0.06)"
                    : "rgba(245,166,35,0.06)",
                border: `0.5px solid ${
                  alert.severity === "error" ? "rgba(255,68,68,0.2)" : "rgba(245,166,35,0.2)"
                }`,
                borderRadius: 10,
                cursor: "pointer",
                transition: "opacity 0.15s ease",
              }}
            >
              <i
                className={
                  alert.severity === "error" ? "ti ti-alert-circle" : "ti ti-alert-triangle"
                }
                style={{
                  fontSize: 15,
                  color: alert.severity === "error" ? "#ff4444" : "#f5a623",
                  flexShrink: 0,
                }}
              />
              <p
                style={{
                  fontSize: 13,
                  color: alert.severity === "error" ? "#ff4444" : "#f5a623",
                  margin: 0,
                }}
              >
                <strong>{alert.clientName}</strong> — {alert.message}
              </p>
              <i
                className="ti ti-chevron-right"
                style={{
                  fontSize: 13,
                  color: "var(--ag-text-muted)",
                  marginLeft: "auto",
                  flexShrink: 0,
                }}
              />
            </div>
          ))}
          {alerts.length > 5 && (
            <p
              style={{
                fontSize: 12,
                color: "var(--ag-text-muted)",
                textAlign: "center",
                margin: 0,
              }}
            >
              +{alerts.length - 5} more alerts
            </p>
          )}
        </div>
      )}

      {/* ============================================
          MAIN CONTENT — CLIENT GRID + ACTIVITY
          ============================================ */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 320px",
          gap: 20,
          alignItems: "start",
        }}
      >
        {/* CLIENT HEALTH GRID */}
        <div>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              marginBottom: 14,
            }}
          >
            <p
              style={{
                fontSize: 11,
                fontWeight: 700,
                textTransform: "uppercase",
                letterSpacing: "0.08em",
                color: "var(--ag-text-tertiary)",
                margin: 0,
              }}
            >
              Client health — this week
            </p>
            <button
              onClick={() => router.push("/dashboard/clients")}
              style={{
                fontSize: 12,
                color: "var(--ag-lime)",
                background: "none",
                border: "none",
                cursor: "pointer",
                fontFamily: "var(--ag-font-body)",
                fontWeight: 600,
              }}
            >
              View all →
            </button>
          </div>

          {loading ? (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {[1, 2, 3, 4].map((i) => (
                <div
                  key={i}
                  style={{
                    height: 72,
                    background: "var(--ag-surface)",
                    border: "0.5px solid var(--ag-border)",
                    borderRadius: 12,
                    animation: "ag-fade-in 0.4s ease forwards",
                  }}
                />
              ))}
            </div>
          ) : clients.length === 0 ? (
            <div
              style={{
                padding: "48px 24px",
                background: "var(--ag-surface)",
                border: "0.5px solid var(--ag-border)",
                borderRadius: 12,
                textAlign: "center",
              }}
            >
              <i
                className="ti ti-building"
                style={{
                  fontSize: 32,
                  color: "var(--ag-text-muted)",
                  display: "block",
                  marginBottom: 12,
                }}
              />
              <p
                style={{
                  fontFamily: "var(--ag-font-display)",
                  fontSize: 16,
                  color: "var(--ag-text-primary)",
                  margin: "0 0 6px",
                }}
              >
                No clients yet
              </p>
              <p
                style={{
                  fontSize: 13,
                  color: "var(--ag-text-tertiary)",
                  margin: "0 0 20px",
                }}
              >
                Add your first client to start tracking performance.
              </p>
              <button
                onClick={() => router.push("/dashboard/clients/new")}
                style={{
                  height: 36,
                  padding: "0 20px",
                  background: "var(--ag-lime)",
                  color: "var(--ag-lime-fg)",
                  border: "none",
                  borderRadius: 8,
                  fontSize: 13,
                  fontWeight: 700,
                  cursor: "pointer",
                }}
              >
                Add first client
              </button>
            </div>
          ) : (
            <div
              style={{
                background: "var(--ag-surface)",
                border: "0.5px solid var(--ag-border)",
                borderRadius: 12,
                overflow: "hidden",
              }}
            >
              {/* Table header */}
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 80px 80px 70px 70px 100px 36px",
                  padding: "10px 16px",
                  borderBottom: "0.5px solid var(--ag-border)",
                }}
              >
                {["Client", "Leads", "Contact %", "Won", "Stale", "Facebook", ""].map(
                  (col, i) => (
                    <p
                      key={i}
                      style={{
                        fontSize: 10,
                        fontWeight: 700,
                        textTransform: "uppercase",
                        letterSpacing: "0.08em",
                        color: "var(--ag-text-muted)",
                        margin: 0,
                        textAlign: i > 0 ? "center" : "left",
                      }}
                    >
                      {col}
                    </p>
                  )
                )}
              </div>

              {/* Client rows */}
              {clients.map((client, index) => {
                const rateColors = getContactRateColor(client.contactRate);
                return (
                  <div
                    key={client.id}
                    onClick={() => router.push(`/dashboard/clients/${client.id}`)}
                    className="ag-row-hover"
                    style={{
                      display: "grid",
                      gridTemplateColumns: "1fr 80px 80px 70px 70px 100px 36px",
                      padding: "14px 16px",
                      borderBottom:
                        index < clients.length - 1 ? "0.5px solid var(--ag-border)" : "none",
                      cursor: "pointer",
                      alignItems: "center",
                    }}
                  >
                    {/* Client name + industry */}
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      {client.hasAlerts && (
                        <div
                          style={{
                            width: 6,
                            height: 6,
                            borderRadius: "50%",
                            background: client.fbExpired ? "#ff4444" : "#f5a623",
                            flexShrink: 0,
                          }}
                        />
                      )}
                      <div>
                        <p
                          style={{
                            fontSize: 13,
                            fontWeight: 600,
                            color: "var(--ag-text-primary)",
                            margin: "0 0 2px",
                          }}
                        >
                          {client.name}
                        </p>
                        <p style={{ fontSize: 11, color: "var(--ag-text-muted)", margin: 0 }}>
                          {client.industry || "No industry set"}
                          {" · "}
                          {client.salespeopleCount} rep
                          {client.salespeopleCount !== 1 ? "s" : ""}
                        </p>
                      </div>
                    </div>

                    {/* Leads */}
                    <p
                      style={{
                        fontFamily: "var(--ag-font-display)",
                        fontSize: 20,
                        color: "var(--ag-text-primary)",
                        margin: 0,
                        textAlign: "center",
                      }}
                    >
                      {client.leadsThisWeek}
                    </p>

                    {/* Contact rate */}
                    <div style={{ textAlign: "center" }}>
                      {client.contactRate !== null ? (
                        <span
                          style={{
                            display: "inline-flex",
                            alignItems: "center",
                            height: 24,
                            padding: "0 10px",
                            background: rateColors.bg,
                            border: `0.5px solid ${rateColors.border}`,
                            borderRadius: 20,
                            fontSize: 12,
                            fontWeight: 700,
                            color: rateColors.text,
                          }}
                        >
                          {client.contactRate}%
                        </span>
                      ) : (
                        <span style={{ fontSize: 12, color: "var(--ag-text-muted)" }}>—</span>
                      )}
                    </div>

                    {/* Won */}
                    <p
                      style={{
                        fontFamily: "var(--ag-font-display)",
                        fontSize: 20,
                        color: client.dealsWon > 0 ? "#3dd68c" : "var(--ag-text-muted)",
                        margin: 0,
                        textAlign: "center",
                      }}
                    >
                      {client.dealsWon}
                    </p>

                    {/* Stale */}
                    <p
                      style={{
                        fontFamily: "var(--ag-font-display)",
                        fontSize: 20,
                        color: client.staleLeads > 0 ? "#ff4444" : "var(--ag-text-muted)",
                        margin: 0,
                        textAlign: "center",
                      }}
                    >
                      {client.staleLeads}
                    </p>

                    {/* Facebook status */}
                    <div style={{ textAlign: "center" }}>
                      {!client.fbConnected ? (
                        <span
                          style={{
                            fontSize: 10,
                            color: "var(--ag-text-muted)",
                            fontWeight: 600,
                          }}
                        >
                          Not connected
                        </span>
                      ) : client.fbExpired ? (
                        <span
                          style={{
                            display: "inline-flex",
                            alignItems: "center",
                            gap: 4,
                            fontSize: 10,
                            color: "#ff4444",
                            fontWeight: 700,
                          }}
                        >
                          <i className="ti ti-alert-circle" style={{ fontSize: 11 }} />
                          Expired
                        </span>
                      ) : client.fbExpiringSoon ? (
                        <span
                          style={{
                            display: "inline-flex",
                            alignItems: "center",
                            gap: 4,
                            fontSize: 10,
                            color: "#f5a623",
                            fontWeight: 700,
                          }}
                        >
                          <i className="ti ti-alert-triangle" style={{ fontSize: 11 }} />
                          Expiring
                        </span>
                      ) : (
                        <span
                          style={{
                            display: "inline-flex",
                            alignItems: "center",
                            gap: 4,
                            fontSize: 10,
                            color: "#3dd68c",
                            fontWeight: 700,
                          }}
                        >
                          <i className="ti ti-circle-check" style={{ fontSize: 11 }} />
                          Active
                        </span>
                      )}
                    </div>

                    {/* Arrow */}
                    <i
                      className="ti ti-chevron-right"
                      style={{
                        fontSize: 14,
                        color: "var(--ag-text-muted)",
                        display: "block",
                        textAlign: "center",
                      }}
                    />
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* ACTIVITY FEED */}
        <div
          style={{
            background: "var(--ag-surface)",
            border: "0.5px solid var(--ag-border)",
            borderRadius: 12,
            overflow: "hidden",
            position: "sticky",
            top: 24,
          }}
        >
          <div
            style={{
              padding: "16px 16px 12px",
              borderBottom: "0.5px solid var(--ag-border)",
            }}
          >
            <p
              style={{
                fontSize: 11,
                fontWeight: 700,
                textTransform: "uppercase",
                letterSpacing: "0.08em",
                color: "var(--ag-text-tertiary)",
                margin: 0,
              }}
            >
              Live activity
            </p>
          </div>

          <div style={{ maxHeight: 520, overflowY: "auto" }}>
            {loading ? (
              <div style={{ padding: 16 }}>
                {[1, 2, 3, 4, 5].map((i) => (
                  <div key={i} style={{ display: "flex", gap: 10, marginBottom: 16 }}>
                    <div
                      style={{
                        width: 28,
                        height: 28,
                        borderRadius: "50%",
                        background: "var(--ag-surface-2)",
                        flexShrink: 0,
                      }}
                    />
                    <div style={{ flex: 1 }}>
                      <div
                        style={{
                          height: 11,
                          width: "70%",
                          background: "var(--ag-surface-2)",
                          borderRadius: 4,
                          marginBottom: 6,
                        }}
                      />
                      <div
                        style={{
                          height: 10,
                          width: "40%",
                          background: "var(--ag-surface-3)",
                          borderRadius: 4,
                        }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            ) : activity.length === 0 ? (
              <div style={{ padding: "32px 16px", textAlign: "center" }}>
                <i
                  className="ti ti-activity"
                  style={{
                    fontSize: 24,
                    color: "var(--ag-text-muted)",
                    display: "block",
                    marginBottom: 8,
                  }}
                />
                <p style={{ fontSize: 12, color: "var(--ag-text-muted)", margin: 0 }}>
                  No activity yet
                </p>
              </div>
            ) : (
              <div style={{ padding: "8px 0" }}>
                {activity.map((event, i) => {
                  const client = clients.find((c) => c.id === event.client_id);
                  return (
                    <div
                      key={event.id}
                      style={{
                        display: "flex",
                        gap: 10,
                        padding: "10px 16px",
                        borderBottom:
                          i < activity.length - 1 ? "0.5px solid var(--ag-border)" : "none",
                      }}
                    >
                      <div
                        style={{
                          width: 28,
                          height: 28,
                          borderRadius: "50%",
                          background: "var(--ag-surface-3)",
                          border: "0.5px solid var(--ag-border)",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          fontSize: 10,
                          fontWeight: 700,
                          color: "var(--ag-text-tertiary)",
                          flexShrink: 0,
                        }}
                      >
                        {(event.actor_name || "S").slice(0, 1).toUpperCase()}
                      </div>

                      <div style={{ flex: 1, minWidth: 0 }}>
                        <p
                          style={{
                            fontSize: 12,
                            color: "var(--ag-text-secondary)",
                            margin: "0 0 2px",
                            lineHeight: 1.4,
                          }}
                        >
                          <strong
                            style={{ color: "var(--ag-text-primary)", fontWeight: 600 }}
                          >
                            {event.actor_name || "System"}
                          </strong>{" "}
                          {formatEventType(event.event_type, event.event_data ?? {})}
                        </p>
                        <p style={{ fontSize: 10, color: "var(--ag-text-muted)", margin: 0 }}>
                          {client?.name ?? "Unknown client"} · {timeAgo(event.created_at)}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
