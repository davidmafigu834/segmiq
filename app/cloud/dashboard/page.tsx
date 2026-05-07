"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { NewProjectSlideOver } from "./projects/NewProjectSlideOver";
import { getProjectStyle } from "@/app/cloud/components/ui/projectCardStyles";

type MediaItem = { public_url: string; display_order: number };
type Project = {
  id: string;
  title: string;
  category: string | null;
  updated_at: string;
  project_media: MediaItem[];
};
type Stats = { total_projects: number; total_photos: number; total_bytes: number };
type TeamMember = { id: string; name: string; email: string };

function formatBytes(bytes: number): string {
  if (!bytes || bytes === 0) return "0 MB";
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

function getInitials(name: string): string {
  const parts = (name || "").trim().split(" ").filter(Boolean);
  if (parts.length >= 2) return (parts[0]![0]! + parts[parts.length - 1]![0]!).toUpperCase();
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
  return "LC";
}


export default function CloudDashboardHome() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [projects, setProjects] = useState<Project[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);

  const fetchProjects = useCallback(() => {
    if (!session?.clientId) { setLoading(false); return; }
    setLoading(true);
    Promise.all([
      fetch(`/api/clients/${session.clientId}/projects`).then((r) => r.json()),
      fetch(`/api/cloud/stats`).then((r) => r.json()),
    ])
      .then(([projectData, statsData]: [unknown, unknown]) => {
        if (Array.isArray(projectData)) setProjects(projectData as Project[]);
        if (statsData && typeof statsData === "object" && "total_projects" in (statsData as object)) {
          setStats(statsData as Stats);
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [session?.clientId]);

  useEffect(() => { fetchProjects(); }, [fetchProjects]);

  useEffect(() => {
    if (!session?.userId) return;
    fetch("/api/cloud/team")
      .then((r) => r.json())
      .then((data: unknown) => { if (Array.isArray(data)) setTeamMembers(data as TeamMember[]); })
      .catch(() => {});
  }, [session?.userId]);

  const storageUsed = stats?.total_bytes ?? 0;
  const storageLimit = 5 * 1024 * 1024 * 1024;
  const percentUsed = Math.round((storageUsed / storageLimit) * 100 * 10) / 10;
  const projectCount = stats?.total_projects ?? 0;
  const photoCount = stats?.total_photos ?? 0;
  const recentActivity = projects.slice(0, 2).map((p) => ({
    message: `${p.project_media?.length ?? 0} photos · ${p.title}`,
  }));

  if (status === "loading" || loading) {
    return (
      <div style={{ display: "flex", minHeight: "60vh", alignItems: "center", justifyContent: "center", background: "#F7F7F8" }}>
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-black/10 border-t-[#111]" />
      </div>
    );
  }

  const F = "var(--font-dm-sans), system-ui, sans-serif";
  const S = "var(--font-dm-serif), Georgia, serif";

  return (
    <div style={{ minHeight: "100vh", background: "#F7F7F8", fontFamily: F, paddingBottom: 100 }}>

      {/* ── STORAGE CARD (dark anchor) ── */}
      <div style={{ padding: "16px 20px 0" }}>
        <div style={{
          background: "#111111", borderRadius: 24,
          padding: "20px 20px 18px", position: "relative", overflow: "hidden",
          border: "0.5px solid rgba(255,255,255,0.07)",
        }}>
          <div style={{ position: "absolute", top: -40, right: -40, width: 120, height: 120, borderRadius: "50%", background: "rgba(212,255,79,0.06)", pointerEvents: "none" }} />
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 16 }}>
            <div>
              <p style={{ fontSize: 12, textTransform: "uppercase", letterSpacing: "0.09em", color: "rgba(255,255,255,0.38)", margin: "0 0 6px", fontFamily: F }}>Cloud storage</p>
              <p style={{ fontFamily: S, fontSize: 34, color: "#FFFFFF", margin: 0, lineHeight: 1 }}>{formatBytes(storageUsed)}</p>
              <p style={{ fontSize: 14, color: "rgba(255,255,255,0.32)", margin: "5px 0 0", fontFamily: F }}>used of {formatBytes(storageLimit)}</p>
            </div>
            <span style={{ fontSize: 12, fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", background: "rgba(255,255,255,0.10)", color: "rgba(255,255,255,0.65)", padding: "5px 12px", borderRadius: 20, fontFamily: F, flexShrink: 0 }}>FREE</span>
          </div>
          <div style={{ height: 4, background: "rgba(255,255,255,0.10)", borderRadius: 2, marginBottom: 18 }}>
            <div style={{ height: 4, background: "#D4FF4F", borderRadius: 2, width: `${Math.min(percentUsed, 100)}%`, transition: "width 0.6s ease" }} />
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr" }}>
            {([
              { label: "Projects", value: String(projectCount) },
              { label: "Photos", value: String(photoCount) },
              { label: "Storage", value: formatBytes(storageUsed), lime: true },
            ] as { label: string; value: string; lime?: boolean }[]).map((stat, i) => (
              <div key={stat.label} style={{ borderRight: i < 2 ? "0.5px solid rgba(255,255,255,0.08)" : "none", paddingRight: i < 2 ? 12 : 0, paddingLeft: i > 0 ? 12 : 0 }}>
                <p style={{ fontSize: 12, color: "rgba(255,255,255,0.35)", margin: "0 0 4px", fontFamily: F }}>{stat.label}</p>
                <p style={{ fontFamily: S, fontSize: 20, margin: 0, lineHeight: 1, color: stat.lime ? "#D4FF4F" : "#FFFFFF" }}>{stat.value}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── RECENT PROJECTS ── */}
      <div style={{ padding: "20px 20px 8px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <p style={{ fontSize: 12, fontWeight: 700, letterSpacing: "0.09em", textTransform: "uppercase", color: "#4B5563", margin: 0, fontFamily: F }}>Recent projects</p>
        {projects.length > 0 && (
          <button onClick={() => router.push("/cloud/dashboard/projects")} style={{ fontSize: 14, color: "#374151", background: "none", border: "none", cursor: "pointer", padding: 0, fontFamily: F }}>View all →</button>
        )}
      </div>

      {projects.length === 0 ? (
        <div style={{ padding: "0 20px" }}>
          <div style={{ background: "linear-gradient(145deg, #EDFFF6 0%, #D0FFE8 100%)", border: "0.5px solid rgba(0,180,100,0.22)", borderRadius: 20, padding: "32px 24px", display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center" }}>
            <div style={{ width: 56, height: 56, borderRadius: 16, background: "rgba(255,255,255,0.65)", border: "0.5px solid rgba(0,180,100,0.25)", display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 16 }}>
              <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#00613A" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/>
              </svg>
            </div>
            <p style={{ fontFamily: S, fontSize: 24, color: "#004D30", margin: "0 0 8px", lineHeight: 1.25 }}>Add your first project</p>
            <p style={{ fontSize: 16, color: "#007A4A", lineHeight: 1.6, margin: "0 0 24px", maxWidth: 260, fontFamily: F }}>Create a project for a job you are working on, then upload photos straight from your phone.</p>
            <button onClick={() => setShowNew(true)} style={{ display: "flex", alignItems: "center", gap: 8, height: 48, padding: "0 24px", background: "#D4FF4F", color: "#111111", fontSize: 16, fontWeight: 700, borderRadius: 12, border: "none", cursor: "pointer", fontFamily: F }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
              Create a project
            </button>
          </div>
        </div>
      ) : (
        <div style={{ display: "flex", gap: 12, overflowX: "auto", padding: "0 20px 4px", scrollbarWidth: "none" } as React.CSSProperties}>
          {projects.slice(0, 5).map((p) => {
            const ps = getProjectStyle(p.category);
            const mediaItems = [...(p.project_media ?? [])].sort((a, b) => a.display_order - b.display_order).slice(0, 4);
            const pCount = p.project_media?.length ?? 0;
            return (
              <div key={p.id} onClick={() => router.push(`/cloud/dashboard/projects/${p.id}`)}
                   style={{ background: ps.gradient, border: `0.5px solid ${ps.border}`, borderRadius: 20, padding: 10, overflow: "hidden", minWidth: 160, width: 160, flexShrink: 0, cursor: "pointer", display: "flex", flexDirection: "column" }}>
                {/* Folder body */}
                <div style={{ background: "#FFFFFF", borderRadius: 14, border: "0.5px solid rgba(0,0,0,0.06)", boxShadow: "0 1px 4px rgba(0,0,0,0.06)", padding: 7, height: 130, position: "relative", overflow: "hidden" }}>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gridTemplateRows: "1fr 1fr", gap: 4, height: "100%" }}>
                    {([0, 1, 2, 3] as const).map((idx) => (
                      <div key={idx} style={{ borderRadius: 8, overflow: "hidden", background: ps.photoFallbackBg, opacity: mediaItems[idx] ? 1 : 0.35 }}>
                        {mediaItems[idx] ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={mediaItems[idx]!.public_url} alt="" style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
                        ) : (
                          <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center" }}>
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={ps.photoIconColor} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                              <rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/>
                            </svg>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                  {pCount > 0 && (
                    <div style={{ position: "absolute", bottom: 8, right: 8, background: "#D4FF4F", color: "#111111", fontSize: 10, fontWeight: 700, padding: "2px 6px", borderRadius: 20, fontFamily: F, lineHeight: 1.4 }}>{pCount}</div>
                  )}
                </div>
                {/* Details below folder */}
                <div style={{ paddingTop: 8 }}>
                  <p style={{ fontFamily: S, fontSize: 14, color: ps.titleColor, margin: "0 0 2px", lineHeight: 1.25, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.title}</p>
                  <p style={{ fontSize: 11, color: ps.subtextColor, margin: 0, fontFamily: F }}>{p.category || "Project"} · {pCount} photo{pCount !== 1 ? "s" : ""}</p>
                </div>
              </div>
            );
          })}
          <div onClick={() => setShowNew(true)} style={{ minWidth: 110, width: 110, border: "1.5px dashed rgba(0,0,0,0.15)", borderRadius: 20, background: "#EEEEEA", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 8, flexShrink: 0, cursor: "pointer", padding: "24px 0" }}>
            <div style={{ width: 38, height: 38, borderRadius: "50%", background: "#FFFFFF", border: "0.5px solid rgba(0,0,0,0.10)", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#6B7280" strokeWidth="2.5" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
            </div>
            <p style={{ fontSize: 13, color: "#9CA3AF", fontWeight: 500, textAlign: "center", margin: 0, lineHeight: 1.4, fontFamily: F }}>New<br/>project</p>
          </div>
        </div>
      )}

      {/* ── UPLOAD SHORTCUT ── */}
      <div style={{ padding: "20px 20px 0" }}>
        <div style={{ background: "linear-gradient(160deg, #F0FFF8 0%, #E0FFF0 60%, #C8FFE0 100%)", border: "0.5px solid rgba(96,232,160,0.3)", borderRadius: 20, padding: "14px 16px", display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{ width: 44, height: 44, borderRadius: 12, flexShrink: 0, background: "rgba(0,135,90,0.10)", border: "0.5px solid rgba(0,135,90,0.18)", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#00875A" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/>
            </svg>
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <p style={{ fontSize: 16, fontWeight: 600, color: "#004D30", margin: "0 0 2px", fontFamily: F }}>Upload site photos</p>
            <p style={{ fontSize: 14, color: "#00875A", margin: 0, fontFamily: F }}>Add to an existing project</p>
          </div>
          <button onClick={() => router.push("/cloud/dashboard/upload")} style={{ height: 36, padding: "0 18px", background: "#D4FF4F", color: "#0a0a0a", fontSize: 14, fontWeight: 700, borderRadius: 10, border: "none", cursor: "pointer", flexShrink: 0, fontFamily: F }}>Upload</button>
        </div>
      </div>

      {/* ── TEAM + ACTIVITY ROW ── */}
      <div style={{ padding: "16px 20px 0", display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        {/* Team card */}
        <div onClick={() => router.push("/cloud/dashboard/team")} style={{ background: "linear-gradient(160deg, #FFFBF0 0%, #FFF3D0 60%, #FFE8A0 100%)", border: "0.5px solid rgba(255,208,112,0.35)", borderRadius: 20, padding: 16, cursor: "pointer", display: "flex", flexDirection: "column" }}>
          <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.10em", textTransform: "uppercase", color: "#BF7020", margin: "0 0 14px", fontFamily: F }}>Team</p>
          {/* Large icon */}
          <div style={{ width: 50, height: 50, borderRadius: 15, background: "rgba(191,112,32,0.10)", border: "0.5px solid rgba(191,112,32,0.18)", display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 14 }}>
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#BF7020" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/>
              <path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>
            </svg>
          </div>
          <p style={{ fontFamily: S, fontSize: 30, color: "#7A3800", margin: "0 0 2px", lineHeight: 1 }}>{teamMembers.length}</p>
          <p style={{ fontSize: 13, color: "#BF7020", margin: "0 0 14px", fontFamily: F }}>{teamMembers.length === 1 ? "member" : "members"}</p>
          {teamMembers.length > 0 && (
            <div style={{ display: "flex", marginBottom: 14 }}>
              {teamMembers.slice(0, 3).map((m, i) => (
                <div key={m.id} style={{ width: 26, height: 26, borderRadius: "50%", border: "2px solid #FFE8A0", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 9, fontWeight: 700, marginLeft: i === 0 ? 0 : -7, background: i === 0 ? "#7A3800" : i === 1 ? "#BF7020" : "#FFD580", color: "#FFFFFF", fontFamily: F, position: "relative", zIndex: 3 - i, flexShrink: 0 }}>
                  {getInitials(m.name)}
                </div>
              ))}
            </div>
          )}
          <div style={{ flex: 1 }} />
          <button style={{ height: 36, background: "rgba(255,255,255,0.6)", border: "0.5px solid rgba(255,180,50,0.3)", borderRadius: 10, padding: "0 16px", fontSize: 12, fontWeight: 600, color: "#7A3800", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 6, fontFamily: F }}>
            Manage team
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#7A3800" strokeWidth="2.5" strokeLinecap="round"><polyline points="9 18 15 12 9 6"/></svg>
          </button>
        </div>

        {/* Activity card */}
        <div onClick={() => router.push("/cloud/dashboard/notifications")} style={{ background: "linear-gradient(160deg, #F5F0FF 0%, #EDE5FF 60%, #DDD0FF 100%)", border: "0.5px solid rgba(196,168,255,0.35)", borderRadius: 20, padding: 16, cursor: "pointer", display: "flex", flexDirection: "column" }}>
          <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.10em", textTransform: "uppercase", color: "#7B5EA7", margin: "0 0 14px", fontFamily: F }}>Activity</p>
          {/* Large violet-tinted icon */}
          <div style={{ width: 50, height: 50, borderRadius: 15, background: "rgba(123,94,167,0.10)", border: "0.5px solid rgba(123,94,167,0.18)", display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 14 }}>
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#7B5EA7" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>
            </svg>
          </div>
          <p style={{ fontFamily: S, fontSize: 30, color: "#2D1B6B", margin: "0 0 2px", lineHeight: 1 }}>{photoCount}</p>
          <p style={{ fontSize: 13, color: "#7B5EA7", margin: "0 0 12px", fontFamily: F }}>photos uploaded</p>
          {recentActivity.slice(0, 2).map((item, i) => (
            <div key={i} style={{ display: "flex", alignItems: "flex-start", gap: 6, marginBottom: 5 }}>
              <div style={{ width: 4, height: 4, borderRadius: "50%", background: "rgba(123,94,167,0.55)", marginTop: 5, flexShrink: 0 }} />
              <p style={{ fontSize: 12, color: "#4B3680", margin: 0, lineHeight: 1.4, fontFamily: F, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{item.message}</p>
            </div>
          ))}
          {recentActivity.length === 0 && (
            <p style={{ fontSize: 12, color: "#9B85C8", margin: 0, fontFamily: F }}>No recent activity</p>
          )}
          <div style={{ flex: 1 }} />
          <button style={{ marginTop: 14, height: 36, background: "rgba(255,255,255,0.6)", border: "0.5px solid rgba(180,140,255,0.3)", borderRadius: 10, padding: "0 16px", fontSize: 12, fontWeight: 600, color: "#2D1B6B", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 6, fontFamily: F }}>
            View activity
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#2D1B6B" strokeWidth="2.5" strokeLinecap="round"><polyline points="9 18 15 12 9 6"/></svg>
          </button>
        </div>
      </div>

      {/* ── STATS CARD ── */}
      <div style={{ padding: "16px 20px 0" }}>
        <div style={{ background: "linear-gradient(160deg, #F0F8FF 0%, #E0F0FF 60%, #C8E4FF 100%)", border: "0.5px solid rgba(128,200,255,0.3)", borderRadius: 20, padding: 18 }}>
          {/* Header row */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 18 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <div style={{ width: 40, height: 40, borderRadius: 12, background: "rgba(21,101,192,0.10)", border: "0.5px solid rgba(21,101,192,0.18)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#1565C0" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/>
                </svg>
              </div>
              <div>
                <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.10em", textTransform: "uppercase", color: "#1565C0", margin: 0, fontFamily: F }}>Analytics</p>
                <p style={{ fontSize: 14, fontWeight: 600, color: "#0D3070", margin: 0, fontFamily: F }}>Your overview</p>
              </div>
            </div>
            <button onClick={() => router.push("/cloud/dashboard/analytics")} style={{ height: 34, padding: "0 16px", background: "#D4FF4F", color: "#0a0a0a", fontSize: 13, fontWeight: 700, borderRadius: 10, border: "none", cursor: "pointer", flexShrink: 0, fontFamily: F, display: "flex", alignItems: "center", gap: 4 }}>
              View stats
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#0a0a0a" strokeWidth="2.5" strokeLinecap="round"><polyline points="9 18 15 12 9 6"/></svg>
            </button>
          </div>
          {/* Stats row */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 }}>
            {([
              { label: "Projects", value: String(projectCount), bar: Math.min((projectCount / 20) * 100, 100), color: "#1565C0" },
              { label: "Photos", value: String(photoCount), bar: Math.min((photoCount / 500) * 100, 100), color: "#1565C0" },
              { label: "Storage", value: `${percentUsed.toFixed(1)}%`, bar: Math.min(percentUsed, 100), color: "#1565C0" },
            ] as { label: string; value: string; bar: number; color: string }[]).map((s) => (
              <div key={s.label}>
                <p style={{ fontSize: 11, color: "#1565C0", margin: "0 0 4px", fontFamily: F }}>{s.label}</p>
                <p style={{ fontFamily: S, fontSize: 22, color: "#0D3070", margin: "0 0 8px", lineHeight: 1 }}>{s.value}</p>
                <div style={{ height: 4, background: "rgba(21,101,192,0.12)", borderRadius: 2 }}>
                  <div style={{ height: 4, background: s.color, borderRadius: 2, width: `${Math.max(s.bar, 3)}%`, transition: "width 0.6s ease" }} />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {session?.clientId && (
        <NewProjectSlideOver
          clientId={session.clientId}
          open={showNew}
          onClose={() => setShowNew(false)}
          onCreated={() => { setShowNew(false); fetchProjects(); }}
        />
      )}
    </div>
  );
}
