"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { ArrowLeft, Eye, TrendingUp, BarChart2, Loader2 } from "lucide-react";
import Link from "next/link";

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
    <div className="flex h-[120px] items-end gap-[2px] sm:gap-1">
      {recent.map((d, i) => {
        const pct = (d.views / max) * 100;
        const isToday = i === recent.length - 1;
        return (
          <div
            key={d.date}
            className="group relative flex flex-1 flex-col items-center justify-end"
          >
            <div
              className={`w-full rounded-t-sm transition-all ${
                isToday ? "bg-[#D4FF4F]" : d.views > 0 ? "bg-white/30" : "bg-white/[0.05]"
              }`}
              style={{ height: `${Math.max(pct, d.views > 0 ? 4 : 2)}%` }}
            />
            {d.views > 0 && (
              <div className="pointer-events-none absolute bottom-full left-1/2 mb-1 -translate-x-1/2 rounded bg-[#222] px-1.5 py-0.5 text-[11px] text-white opacity-0 group-hover:opacity-100 whitespace-nowrap">
                {d.views}
              </div>
            )}
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
    <div className="px-6 py-6 lg:px-8">
      <div className="mx-auto max-w-2xl">
        <div className="mb-6 flex items-center gap-3">
          <button
            onClick={() => router.back()}
            className="rounded-lg p-1.5 text-white/40 hover:bg-white/10 hover:text-white transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
          </button>
          <div>
            <h1 className="text-[15px] font-semibold text-white">
              Analytics{projectTitle ? ` — ${projectTitle}` : ""}
            </h1>
            <p className="text-[12px] text-white/40">Public page view statistics</p>
          </div>
        </div>

        {loading ? (
          <div className="flex justify-center py-20">
            <Loader2 className="h-5 w-5 animate-spin text-white/30" />
          </div>
        ) : stats ? (
          <div className="space-y-6">
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
              <div className="rounded-2xl border border-white/[0.08] bg-[#111] p-5">
                <div className="mb-2 flex items-center gap-1.5 text-[12px] text-white/40">
                  <Eye className="h-3.5 w-3.5" />
                  Total views
                </div>
                <p className="text-[28px] font-semibold text-white">{stats.total.toLocaleString()}</p>
              </div>
              <div className="rounded-2xl border border-white/[0.08] bg-[#111] p-5">
                <div className="mb-2 flex items-center gap-1.5 text-[12px] text-white/40">
                  <TrendingUp className="h-3.5 w-3.5" />
                  Last 30 days
                </div>
                <p className="text-[28px] font-semibold text-white">{stats.last_30_days.toLocaleString()}</p>
              </div>
              <div className="rounded-2xl border border-white/[0.08] bg-[#111] p-5 col-span-2 sm:col-span-1">
                <div className="mb-2 flex items-center gap-1.5 text-[12px] text-white/40">
                  <BarChart2 className="h-3.5 w-3.5" />
                  Avg / day
                </div>
                <p className="text-[28px] font-semibold text-white">
                  {(stats.last_30_days / 30).toFixed(1)}
                </p>
              </div>
            </div>

            <div className="rounded-2xl border border-white/[0.08] bg-[#111] p-5">
              <p className="mb-4 text-[13px] font-medium text-white/60">Daily views — last 30 days</p>
              {stats.daily.every((d) => d.views === 0) ? (
                <div className="flex h-[120px] flex-col items-center justify-center gap-2 text-white/20">
                  <BarChart2 className="h-6 w-6" strokeWidth={1.5} />
                  <p className="text-[13px]">No views recorded yet</p>
                </div>
              ) : (
                <>
                  <BarChart data={stats.daily} />
                  {xLabels && (
                    <div className="mt-2 flex justify-between text-[11px] text-white/25">
                      <span>{xLabels.first}</span>
                      <span>{xLabels.last}</span>
                    </div>
                  )}
                </>
              )}
            </div>

            <div className="rounded-2xl border border-white/[0.08] bg-[#111] p-5">
              <p className="mb-4 text-[13px] font-medium text-white/60">Share link</p>
              <div className="flex items-center gap-3 rounded-xl bg-white/5 px-4 py-3">
                <p className="flex-1 truncate text-[13px] text-white/50 font-mono">
                  leadstaq.tech/cloud/share/{params.projectId}
                </p>
                <Link
                  href={`/cloud/share/${params.projectId}`}
                  target="_blank"
                  className="text-[12px] font-medium text-[#D4FF4F] hover:underline shrink-0"
                >
                  Open →
                </Link>
              </div>
            </div>
          </div>
        ) : (
          <p className="text-[13px] text-white/40 text-center py-20">
            Could not load analytics. Ensure this project exists.
          </p>
        )}
      </div>
    </div>
  );
}
