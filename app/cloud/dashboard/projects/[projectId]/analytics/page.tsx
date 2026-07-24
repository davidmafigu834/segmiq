"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { ArrowLeft, Eye, TrendingUp, BarChart2 } from "lucide-react";
import Link from "next/link";

const F = "var(--fw-font-body), system-ui, sans-serif";
const S = "var(--fw-font-display), Georgia, serif";

type DailyView = { date: string; views: number };
type ViewStats = {
  total: number;
  last_30_days: number;
  daily: DailyView[];
};

function BarChart({ data }: { data: DailyView[] }) {
  if (!data.length) return null;
  const max = Math.max(...data.map((d) => d.views), 1);
  const recent = data.slice(-30);

  return (
    <div style={{ display: "flex", height: 120, alignItems: "flex-end", gap: 2 }}>
      {recent.map((d, i) => {
        const pct = (d.views / max) * 100;
        const isToday = i === recent.length - 1;
        return (
          <div
            key={d.date}
            title={d.views > 0 ? `${d.views} view${d.views !== 1 ? "s" : ""}` : undefined}
            style={{
              flex: 1,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "flex-end",
              height: "100%",
            }}
          >
            <div
              style={{
                width: "100%",
                borderRadius: "2px 2px 0 0",
                height: `${Math.max(pct, d.views > 0 ? 4 : 2)}%`,
                background: isToday ? "#1C1410" : d.views > 0 ? "rgba(28,20,16,0.25)" : "rgba(28,20,16,0.06)",
                transition: "height 0.3s ease",
              }}
            />
          </div>
        );
      })}
    </div>
  );
}

export default function ProjectAnalyticsPage() {
  const params = useParams<{ projectId: string }>();
  const { data: session } = useSession();
  const router = useRouter();

  const [stats, setStats] = useState<ViewStats | null>(null);
  const [projectTitle, setProjectTitle] = useState("");
  const [loading, setLoading] = useState(true);

  const fetchStats = useCallback(() => {
    if (!params.projectId) return;
    setLoading(true);
    Promise.all([
      fetch(`/api/cloud/projects/${params.projectId}/views`).then((r) => r.json()),
      fetch(`/api/clients/${session?.clientId ?? "me"}/projects`).then((r) => r.json()),
    ])
      .then(([viewData, projects]: [ViewStats, unknown]) => {
        setStats(viewData);
        if (Array.isArray(projects)) {
          const p = (projects as { id: string; title: string }[]).find(
            (x) => x.id === params.projectId
          );
          if (p) setProjectTitle(p.title);
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [params.projectId, session?.clientId]);

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  const xLabels = stats?.daily
    ? (() => {
        const d = stats.daily;
        const first = new Date(d[0]?.date ?? "").toLocaleDateString("en-US", { month: "short", day: "numeric" });
        const last = new Date(d[d.length - 1]?.date ?? "").toLocaleDateString("en-US", { month: "short", day: "numeric" });
        return { first, last };
      })()
    : null;

  return (
    <div className="cloud-page" style={{ fontFamily: F }}>

      {/* Back + title */}
      <div style={{ padding: "16px 20px 0", display: "flex", alignItems: "center", gap: 12 }}>
        <button
          onClick={() => router.back()}
          style={{ width: 36, height: 36, borderRadius: 10, background: "#FFFFFF", border: "0.5px solid rgba(28,20,16,0.08)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, cursor: "pointer" }}
        >
          <ArrowLeft size={16} color="#1C1410" />
        </button>
        <div>
          {projectTitle && <p style={{ fontFamily: S, fontSize: 15, color: "#1C1410", margin: 0, lineHeight: 1.2 }}>{projectTitle}</p>}
        </div>
      </div>

      {loading ? (
        <div style={{ display: "flex", justifyContent: "center", padding: "80px 0" }}>
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-black/10 border-t-[#1C1410]" />
        </div>
      ) : stats ? (
        <div style={{ padding: "16px 20px 0", display: "flex", flexDirection: "column", gap: 12 }}>

          {/* Stat cards */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 }}>
            {([
              { label: "Total views",  value: stats.total.toLocaleString(),           Icon: Eye },
              { label: "Last 30 days", value: stats.last_30_days.toLocaleString(),    Icon: TrendingUp },
              { label: "Avg / day",    value: (stats.last_30_days / 30).toFixed(1),   Icon: BarChart2 },
            ] as { label: string; value: string; Icon: React.ElementType }[]).map((s) => (
              <div key={s.label} style={{ background: "#FFFFFF", borderRadius: 18, border: "0.5px solid rgba(28,20,16,0.08)", padding: "14px 12px" }}>
                <div style={{ width: 30, height: 30, borderRadius: 8, background: "#F7F4EF", display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 10 }}>
                  <s.Icon size={14} color="#4A3828" strokeWidth={1.8} />
                </div>
                <p style={{ fontFamily: S, fontSize: 22, color: "#1C1410", margin: "0 0 2px", lineHeight: 1 }}>{s.value}</p>
                <p style={{ fontFamily: F, fontSize: 10, color: "#8C7B6B", margin: 0 }}>{s.label}</p>
              </div>
            ))}
          </div>

          {/* Daily chart */}
          <div style={{ background: "#FFFFFF", borderRadius: 20, border: "0.5px solid rgba(28,20,16,0.08)", padding: 20 }}>
            <p style={{ fontFamily: F, fontSize: 10, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "#8C7B6B", margin: "0 0 16px" }}>Daily views — last 30 days</p>
            {stats.daily.every((d) => d.views === 0) ? (
              <div style={{ height: 120, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 8 }}>
                <BarChart2 size={24} color="#6B7280" strokeWidth={1.5} />
                <p style={{ fontFamily: F, fontSize: 13, color: "#8C7B6B", margin: 0 }}>No views recorded yet</p>
              </div>
            ) : (
              <>
                <BarChart data={stats.daily} />
                {xLabels && (
                  <div style={{ marginTop: 8, display: "flex", justifyContent: "space-between", fontFamily: F, fontSize: 11, color: "#6B7280" }}>
                    <span>{xLabels.first}</span>
                    <span>{xLabels.last}</span>
                  </div>
                )}
              </>
            )}
          </div>

          {/* Share link */}
          <div style={{ background: "#FFFFFF", borderRadius: 20, border: "0.5px solid rgba(28,20,16,0.08)", padding: 20 }}>
            <p style={{ fontFamily: F, fontSize: 10, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "#8C7B6B", margin: "0 0 12px" }}>Share link</p>
            <div style={{ display: "flex", alignItems: "center", gap: 12, background: "#F7F4EF", borderRadius: 12, padding: "12px 16px" }}>
              <p style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontFamily: F, fontSize: 12, color: "#4A3828", margin: 0 }}>
                leadstaq.tech/cloud/share/{params.projectId}
              </p>
              <Link
                href={`/cloud/share/${params.projectId}`}
                target="_blank"
                style={{ fontFamily: F, fontSize: 12, fontWeight: 700, color: "#1C1410", textDecoration: "none", flexShrink: 0 }}
              >
                Open →
              </Link>
            </div>
          </div>

        </div>
      ) : (
        <p style={{ fontFamily: F, fontSize: 13, color: "#8C7B6B", textAlign: "center", padding: "80px 20px" }}>
          Could not load analytics. Ensure this project exists.
        </p>
      )}
    </div>
  );
}
