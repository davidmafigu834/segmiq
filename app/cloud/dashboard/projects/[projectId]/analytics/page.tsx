"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { ArrowLeft, Eye, TrendingUp, BarChart2 } from "lucide-react";
import Link from "next/link";
import { SkeletonAnalytics } from "@/app/cloud/components/SkeletonCard";

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
    <div className="cloud-page">

      {/* Back + title */}
      <div className="mb-4 flex items-center gap-3">
        <button
          type="button"
          onClick={() => router.back()}
          className="cloud-icon-btn cloud-card !h-11 !w-11 shrink-0"
          aria-label="Back"
        >
          <ArrowLeft size={16} />
        </button>
        <div className="min-w-0">
          {projectTitle && (
            <p className="truncate font-cloud-display text-[18px] leading-tight text-[var(--cloud-text-primary)]">
              {projectTitle}
            </p>
          )}
          <p className="text-[12px] text-[var(--cloud-text-tertiary)]">Analytics</p>
        </div>
      </div>

      {loading ? (
        <SkeletonAnalytics />
      ) : stats ? (
        <div className="flex flex-col gap-3">

          {/* Stat cards */}
          <div className="grid grid-cols-1 gap-3 min-[420px]:grid-cols-3">
            {([
              { label: "Total views",  value: stats.total.toLocaleString(),           Icon: Eye },
              { label: "Last 30 days", value: stats.last_30_days.toLocaleString(),    Icon: TrendingUp },
              { label: "Avg / day",    value: (stats.last_30_days / 30).toFixed(1),   Icon: BarChart2 },
            ] as { label: string; value: string; Icon: React.ElementType }[]).map((s) => (
              <div key={s.label} className="cloud-card p-4">
                <div className="mb-3 flex h-8 w-8 items-center justify-center rounded-lg bg-[var(--cloud-surface-muted)]">
                  <s.Icon size={14} className="text-[var(--cloud-text-secondary)]" strokeWidth={1.8} />
                </div>
                <p className="font-cloud-display text-[22px] leading-none text-[var(--cloud-text-primary)]">{s.value}</p>
                <p className="mt-1 text-[10px] text-[var(--cloud-text-tertiary)]">{s.label}</p>
              </div>
            ))}
          </div>

          {/* Daily chart */}
          <div className="cloud-card p-5">
            <p className="cloud-section-label">Daily views — last 30 days</p>
            {stats.daily.every((d) => d.views === 0) ? (
              <div className="flex h-[120px] flex-col items-center justify-center gap-2">
                <BarChart2 size={24} className="text-[var(--cloud-text-secondary)]" strokeWidth={1.5} />
                <p className="text-[13px] text-[var(--cloud-text-tertiary)]">No views recorded yet</p>
              </div>
            ) : (
              <>
                <BarChart data={stats.daily} />
                {xLabels && (
                  <div className="mt-2 flex justify-between text-[11px] text-[var(--cloud-text-tertiary)]">
                    <span>{xLabels.first}</span>
                    <span>{xLabels.last}</span>
                  </div>
                )}
              </>
            )}
          </div>

          {/* Share link */}
          <div className="cloud-card p-5">
            <p className="cloud-section-label">Share link</p>
            <div className="flex items-center gap-3 rounded-[12px] bg-[var(--cloud-surface-muted)] px-4 py-3">
              <p className="min-w-0 flex-1 truncate text-[12px] text-[var(--cloud-text-secondary)]">
                leadstaq.tech/cloud/share/{params.projectId}
              </p>
              <Link
                href={`/cloud/share/${params.projectId}`}
                target="_blank"
                className="shrink-0 text-[12px] font-semibold text-[var(--cloud-text-primary)]"
              >
                Open →
              </Link>
            </div>
          </div>

        </div>
      ) : (
        <p className="px-5 py-20 text-center text-[13px] text-[var(--cloud-text-tertiary)]">
          Could not load analytics. Ensure this project exists.
        </p>
      )}
    </div>
  );
}
