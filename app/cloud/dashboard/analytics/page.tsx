"use client";

import { useCallback, useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";

type MediaItem = { public_url: string; display_order: number };
type Project = {
  id: string;
  title: string;
  slug: string;
  category: string | null;
  created_at: string;
  updated_at: string;
  project_media: MediaItem[];
};

const F = "var(--fw-font-body), system-ui, sans-serif";
const S = "var(--fw-font-display), Georgia, serif";

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function ShareRow({ project, origin }: { project: Project; origin: string }) {
  const [copied, setCopied] = useState(false);
  const shareUrl = `${origin}/cloud/share/${project.id}`;
  const photoCount = project.project_media?.length ?? 0;

  function copy() {
    navigator.clipboard.writeText(shareUrl).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 0", borderBottom: "0.5px solid rgba(0,0,0,0.06)" }}>
      {/* Folder icon */}
      <div style={{ width: 40, height: 40, borderRadius: 12, background: "#F7F4EF", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#4A3828" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
          <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>
        </svg>
      </div>
      {/* Info */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ fontSize: 15, fontWeight: 600, color: "#1C1410", margin: "0 0 2px", fontFamily: F, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{project.title}</p>
        <p style={{ fontSize: 12, color: "#8C7B6B", margin: 0, fontFamily: F, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{shareUrl.replace("https://", "")}</p>
      </div>
      {/* Meta */}
      <div style={{ textAlign: "right", flexShrink: 0 }}>
        <p style={{ fontSize: 13, fontWeight: 600, color: "#4A3828", margin: "0 0 2px", fontFamily: F }}>{photoCount} photo{photoCount !== 1 ? "s" : ""}</p>
        <p style={{ fontSize: 11, color: "#8C7B6B", margin: 0, fontFamily: F }}>{formatDate(project.updated_at)}</p>
      </div>
      {/* Copy button */}
      <button
        onClick={copy}
        style={{ height: 34, padding: "0 14px", background: copied ? "#D4FF4F" : "#F7F4EF", color: copied ? "#1C1410" : "#4A3828", fontSize: 13, fontWeight: 600, borderRadius: 9, border: "none", cursor: "pointer", flexShrink: 0, fontFamily: F, transition: "background 0.2s" }}
      >
        {copied ? "Copied!" : "Copy"}
      </button>
    </div>
  );
}

export default function AnalyticsPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [origin, setOrigin] = useState("");

  useEffect(() => {
    setOrigin(window.location.origin);
  }, []);

  const fetchProjects = useCallback(() => {
    if (!session?.clientId) { setLoading(false); return; }
    fetch(`/api/clients/${session.clientId}/projects`)
      .then((r) => r.json())
      .then((data: unknown) => { if (Array.isArray(data)) setProjects(data as Project[]); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [session?.clientId]);

  useEffect(() => { fetchProjects(); }, [fetchProjects]);

  if (status === "loading" || loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-black/10 border-t-[#1C1410]" />
      </div>
    );
  }

  const totalPhotos = projects.reduce((n, p) => n + (p.project_media?.length ?? 0), 0);

  // Category breakdown
  const categoryMap = new Map<string, number>();
  projects.forEach((p) => {
    const cat = p.category || "Other";
    categoryMap.set(cat, (categoryMap.get(cat) ?? 0) + 1);
  });
  const categories = Array.from(categoryMap.entries()).sort((a, b) => b[1] - a[1]);
  const maxCatCount = categories[0]?.[1] ?? 1;

  const catColors: Record<string, string> = {
    Construction: "#F97316", Solar: "#FBBF24", Landscaping: "#34D399",
    Electrical: "#60A5FA", Roofing: "#A78BFA", Plumbing: "#38BDF8",
    "Interior Design": "#F472B6", Fencing: "#4ADE80", Events: "#FB923C",
    Other: "#94A3B8",
  };

  return (
    <div style={{ minHeight: "100vh", background: "#F5F5F0", fontFamily: F, paddingBottom: 100 }}>

      {/* ── SUMMARY STATS ── */}
      <div style={{ padding: "16px 20px 0" }}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 }}>
          {([
            { label: "Projects", value: String(projects.length), icon: "M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z", color: "#3B82F6" },
            { label: "Photos", value: String(totalPhotos), icon: "M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z M12 13 m-4 0 a4 4 0 1 0 8 0 a4 4 0 1 0-8 0", color: "#10B981" },
            { label: "Shared links", value: String(projects.length), icon: "M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71 M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71", color: "#8B5CF6" },
          ] as { label: string; value: string; icon: string; color: string }[]).map((s) => (
            <div key={s.label} style={{ background: "#FFFFFF", borderRadius: 18, border: "0.5px solid rgba(28,20,16,0.08)", padding: "14px 12px" }}>
              <div style={{ width: 32, height: 32, borderRadius: 9, background: "#F7F4EF", display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 10 }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#4A3828" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <path d={s.icon}/>
                </svg>
              </div>
              <p style={{ fontFamily: S, fontSize: 24, color: "#1C1410", margin: "0 0 2px", lineHeight: 1 }}>{s.value}</p>
              <p style={{ fontSize: 11, color: "#8C7B6B", margin: 0, fontFamily: F }}>{s.label}</p>
            </div>
          ))}
        </div>
      </div>

      {/* ── SHARED LINKS ── */}
      <div style={{ padding: "20px 20px 0" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
          <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "#8C7B6B", margin: 0, fontFamily: F }}>Shared project links</p>
          {projects.length > 0 && (
            <span style={{ fontSize: 12, color: "#8C7B6B", fontFamily: F }}>{projects.length} total</span>
          )}
        </div>
        <div style={{ background: "#FFFFFF", borderRadius: 20, border: "0.5px solid rgba(28,20,16,0.08)", padding: "0 16px" }}>
          {projects.length === 0 ? (
            <div style={{ padding: "32px 0", textAlign: "center" }}>
              <p style={{ fontSize: 15, color: "#8C7B6B", margin: 0, fontFamily: F }}>No projects yet</p>
            </div>
          ) : (
            projects.map((p, i) => (
              <div key={p.id} style={{ borderBottom: i < projects.length - 1 ? undefined : "none" }}>
                <ShareRow project={p} origin={origin} />
              </div>
            ))
          )}
        </div>
      </div>

      {/* ── CATEGORY BREAKDOWN ── */}
      {categories.length > 0 && (
        <div style={{ padding: "20px 20px 0" }}>
          <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "#8C7B6B", margin: "0 0 12px", fontFamily: F }}>Projects by category</p>
          <div style={{ background: "#FFFFFF", borderRadius: 20, border: "0.5px solid rgba(28,20,16,0.08)", padding: "16px" }}>
            {categories.map(([cat, count]) => {
              const color = catColors[cat] ?? "#94A3B8";
              const pct = Math.round((count / projects.length) * 100);
              return (
                <div key={cat} style={{ marginBottom: 14 }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <div style={{ width: 8, height: 8, borderRadius: 2, background: color, flexShrink: 0 }} />
                      <span style={{ fontSize: 14, fontWeight: 600, color: "#1C1410", fontFamily: F }}>{cat}</span>
                    </div>
                    <span style={{ fontSize: 13, color: "#8C7B6B", fontFamily: F }}>{count} project{count !== 1 ? "s" : ""} · {pct}%</span>
                  </div>
                  <div style={{ height: 6, background: "#EDE9E3", borderRadius: 3 }}>
                    <div style={{ height: 6, background: color, borderRadius: 3, width: `${Math.round((count / maxCatCount) * 100)}%`, transition: "width 0.6s ease" }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── TOP PROJECTS BY PHOTOS ── */}
      {projects.length > 0 && (
        <div style={{ padding: "20px 20px 0" }}>
          <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "#8C7B6B", margin: "0 0 12px", fontFamily: F }}>Top projects by photos</p>
          <div style={{ background: "#FFFFFF", borderRadius: 20, border: "0.5px solid rgba(28,20,16,0.08)", padding: "16px" }}>
            {[...projects]
              .sort((a, b) => (b.project_media?.length ?? 0) - (a.project_media?.length ?? 0))
              .slice(0, 5)
              .map((p, i) => {
                const count = p.project_media?.length ?? 0;
                const maxCount = projects.reduce((m, x) => Math.max(m, x.project_media?.length ?? 0), 1);
                return (
                  <div key={p.id} onClick={() => router.push(`/cloud/dashboard/projects/${p.id}`)}
                       style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: i < 4 ? 12 : 0, cursor: "pointer" }}>
                    <span style={{ fontFamily: S, fontSize: 18, color: "#B4A898", width: 20, textAlign: "right", flexShrink: 0 }}>{i + 1}</span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 4 }}>
                        <span style={{ fontSize: 14, fontWeight: 600, color: "#1C1410", fontFamily: F, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.title}</span>
                        <span style={{ fontSize: 13, color: "#8C7B6B", fontFamily: F, flexShrink: 0, marginLeft: 8 }}>{count}</span>
                      </div>
                      <div style={{ height: 4, background: "#EDE9E3", borderRadius: 2 }}>
                        <div style={{ height: 4, background: "#D4FF4F", borderRadius: 2, width: `${Math.round((count / maxCount) * 100)}%` }} />
                      </div>
                    </div>
                  </div>
                );
              })}
          </div>
        </div>
      )}
    </div>
  );
}
