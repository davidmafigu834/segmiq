"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { NewProjectSlideOver } from "./projects/NewProjectSlideOver";
import { getProjectCardStyles } from "@/app/cloud/components/ProjectCard";

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
  if (bytes === 0) return "0 MB";
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

function getTimeOfDay(): string {
  const h = new Date().getHours();
  if (h < 12) return "morning";
  if (h < 17) return "afternoon";
  return "evening";
}

function getInitials(name: string): string {
  const parts = name.trim().split(" ").filter(Boolean);
  if (parts.length >= 2) return (parts[0]![0]! + parts[parts.length - 1]![0]!).toUpperCase();
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
  return "ME";
}

function cover(p: Project): string | null {
  const sorted = [...(p.project_media ?? [])].sort((a, b) => a.display_order - b.display_order);
  return sorted[0]?.public_url ?? null;
}

export default function CloudDashboardHome() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [projects, setProjects] = useState<Project[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [clientName, setClientName] = useState("");
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
    if (!session?.clientId) return;
    fetch("/api/clients")
      .then((r) => r.json())
      .then((list: unknown) => {
        if (Array.isArray(list) && list.length > 0) {
          const client = (list as { id: string; name: string }[]).find((c) => c.id === session.clientId) ?? (list as { id: string; name: string }[])[0];
          if (client?.name) setClientName(client.name);
        }
      })
      .catch(() => {});
  }, [session?.clientId]);

  useEffect(() => {
    if (!session?.userId) return;
    fetch("/api/cloud/team")
      .then((r) => r.json())
      .then((data: unknown) => { if (Array.isArray(data)) setTeamMembers(data as TeamMember[]); })
      .catch(() => {});
  }, [session?.userId]);

  const storageUsed = stats?.total_bytes ?? 0;
  const storageLimit = 5 * 1024 * 1024 * 1024;
  const percentUsed = (storageUsed / storageLimit) * 100;
  const projectCount = stats?.total_projects ?? 0;
  const photoCount = stats?.total_photos ?? 0;
  const displayName = clientName || session?.user?.name || "Leadstaq Cloud";
  const recentActivity = projects.slice(0, 2).map((p) => ({
    message: `${p.project_media?.length ?? 0} photos · ${p.title}`,
  }));

  if (status === "loading" || loading) {
    return (
      <div style={{ display: "flex", minHeight: "60vh", alignItems: "center", justifyContent: "center", background: "#fff" }}>
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-black/10 border-t-[#0a0a0a]" />
      </div>
    );
  }

  const F = "var(--font-dm-sans), system-ui, sans-serif";
  const S = "var(--font-dm-serif), Georgia, serif";

  return (
    <div style={{ minHeight: "100vh", background: "#fff", fontFamily: F }}>

      {/* Storage card */}
      <div style={{ padding: "0 20px 16px" }}>
        <div style={{ background: "#0a0a0a", borderRadius: 24, padding: "20px 20px 18px", position: "relative", overflow: "hidden" }}>
          <div style={{ position: "absolute", top: -30, right: -30, width: 100, height: 100, borderRadius: "50%", background: "rgba(212,255,79,0.06)" }} />
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 14 }}>
            <div>
              <p style={{ fontSize: 10, color: "rgba(255,255,255,0.65)", textTransform: "uppercase", letterSpacing: "0.08em", margin: "0 0 6px", fontFamily: F }}>Cloud storage</p>
              <p style={{ fontFamily: S, fontSize: 32, color: "#fff", margin: 0, lineHeight: 1 }}>{formatBytes(storageUsed)}</p>
              <p style={{ fontSize: 11, color: "rgba(255,255,255,0.62)", margin: "4px 0 0", fontFamily: F }}>storage used</p>
            </div>
            <span style={{ fontSize: 10, background: "rgba(255,255,255,0.12)", color: "rgba(255,255,255,0.7)", padding: "5px 12px", borderRadius: 20, fontWeight: 600, fontFamily: F }}>Free plan</span>
          </div>
          <div style={{ height: 4, background: "rgba(255,255,255,0.1)", borderRadius: 2, marginBottom: 16 }}>
            <div style={{ height: 4, background: "#D4FF4F", borderRadius: 2, width: `${Math.max(Math.min(percentUsed, 100), 2)}%`, transition: "width 0.6s ease" }} />
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr" }}>
            {([
              { label: "Projects", value: String(projectCount) },
              { label: "Photos", value: String(photoCount) },
              { label: `of ${formatBytes(storageLimit)}`, value: formatBytes(storageUsed), accent: true },
            ] as { label: string; value: string; accent?: boolean }[]).map((stat, i) => (
              <div key={stat.label} style={{ borderRight: i < 2 ? "1px solid rgba(255,255,255,0.08)" : "none", paddingRight: i < 2 ? 12 : 0, paddingLeft: i > 0 ? 12 : 0 }}>
                <p style={{ fontSize: 10, color: "rgba(255,255,255,0.62)", margin: "0 0 4px", fontFamily: F }}>{stat.label}</p>
                <p style={{ fontFamily: S, fontSize: 20, margin: 0, lineHeight: 1, color: stat.accent ? "#D4FF4F" : "#fff" }}>{stat.value}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Recent projects label */}
      <div style={{ padding: "0 20px", marginBottom: 12, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.08em", color: "#999", textTransform: "uppercase", margin: 0, fontFamily: F }}>Recent projects</p>
        {projects.length > 0 && (
          <button onClick={() => router.push("/cloud/dashboard/projects")} style={{ fontSize: 11, color: "#888", background: "none", border: "none", cursor: "pointer", fontFamily: F }}>View all →</button>
        )}
      </div>

      {/* Projects row */}
      {projects.length === 0 ? (
        <div style={{ margin: "0 20px", borderRadius: 20, background: "linear-gradient(135deg, #A8F0CC 0%, #5ECFA0 100%)", border: "0.5px solid rgba(0,180,100,0.3)", padding: "32px 24px", display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center" }}>
          <div style={{ width: 56, height: 56, borderRadius: 16, background: "rgba(255,255,255,0.7)", display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 16, border: "0.5px solid rgba(0,180,100,0.4)" }}>
            <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#00875A" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/>
            </svg>
          </div>
          <p style={{ fontFamily: S, fontSize: 22, color: "#004D30", margin: "0 0 8px", lineHeight: 1.2 }}>Add your first project</p>
          <p style={{ fontSize: 13, color: "#00875A", lineHeight: 1.6, margin: "0 0 24px", fontFamily: F }}>Create a project for a job you are working on, then upload photos straight from your phone.</p>
          <button
            onClick={() => setShowNew(true)}
            style={{ display: "flex", alignItems: "center", gap: 8, height: 48, padding: "0 24px", background: "#D4FF4F", color: "#0a0a0a", fontSize: 14, fontWeight: 700, borderRadius: 12, border: "none", cursor: "pointer", fontFamily: F }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
            Create a project
          </button>
        </div>
      ) : (
        <div style={{ display: "flex", gap: 12, overflowX: "auto", padding: "0 20px 4px", scrollbarWidth: "none" } as React.CSSProperties}>
          {projects.slice(0, 4).map((p) => {
            const cs = getProjectCardStyles(p.category);
            const coverUrl = cover(p);
            const pCount = p.project_media?.length ?? 0;
            return (
              <div key={p.id} onClick={() => router.push(`/cloud/dashboard/projects/${p.id}`)} style={{ minWidth: 130, flexShrink: 0, cursor: "pointer" }}>
                <div style={{ width: 130, height: 170, borderRadius: 16, overflow: "hidden", background: cs.photoFallback, position: "relative" }}>
                  {coverUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={coverUrl} alt={p.title} style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
                  ) : (
                    <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center" }}>
                      <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke={cs.photoIcon} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" opacity="0.4">
                        <rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/>
                      </svg>
                    </div>
                  )}
                  <div style={{ position: "absolute", top: 8, right: 8, background: "#D4FF4F", color: "#0a0a0a", fontSize: 9, fontWeight: 700, padding: "2px 7px", borderRadius: 20, fontFamily: F }}>{pCount}</div>
                </div>
                <div style={{ paddingTop: 8, width: 130 }}>
                  <p style={{ fontFamily: S, fontSize: 13, color: "#0a0a0a", margin: "0 0 2px", lineHeight: 1.2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.title}</p>
                  <p style={{ fontSize: 10, color: "#999", fontFamily: F, margin: 0 }}>{p.category || "Project"} · {pCount} photos</p>
                </div>
              </div>
            );
          })}
          <div onClick={() => setShowNew(true)} style={{ minWidth: 130, flexShrink: 0, cursor: "pointer" }}>
            <div style={{ width: 130, height: 170, borderRadius: 16, border: "1.5px dashed #C8C8C0", background: "#EAEAE4", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 8 }}>
              <div style={{ width: 36, height: 36, borderRadius: "50%", background: "#fff", display: "flex", alignItems: "center", justifyContent: "center", border: "0.5px solid rgba(0,0,0,0.08)" }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#888" strokeWidth="2.5" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
              </div>
            </div>
            <div style={{ paddingTop: 8, width: 130 }}>
              <p style={{ fontFamily: S, fontSize: 13, color: "#999", margin: 0 }}>New project</p>
            </div>
          </div>
        </div>
      )}

      {/* Upload shortcut */}
      <div style={{ margin: "20px 20px 0", borderRadius: 20, background: "linear-gradient(135deg, #A8F0CC 0%, #5ECFA0 100%)", border: "0.5px solid rgba(0,180,100,0.3)", padding: "14px 16px", display: "flex", alignItems: "center", gap: 12 }}>
        <div style={{ width: 42, height: 42, borderRadius: 12, background: "rgba(255,255,255,0.6)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, border: "0.5px solid rgba(0,180,100,0.3)" }}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#00875A" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/>
          </svg>
        </div>
        <div style={{ flex: 1 }}>
          <p style={{ fontSize: 13, fontWeight: 600, color: "#004D30", margin: "0 0 2px", fontFamily: F }}>Upload site photos</p>
          <p style={{ fontSize: 11, color: "#00875A", margin: 0, fontFamily: F }}>Add to an existing project</p>
        </div>
        <button onClick={() => router.push("/cloud/dashboard/upload")} style={{ height: 34, padding: "0 14px", background: "#D4FF4F", color: "#0a0a0a", fontSize: 11, fontWeight: 700, borderRadius: 10, border: "none", cursor: "pointer", flexShrink: 0, fontFamily: F }}>Upload</button>
      </div>

      {/* Team + Activity */}
      <div style={{ padding: "20px 20px 0", display: "grid", gridTemplateColumns: "1fr 1.4fr", gap: 12 }}>
        <div onClick={() => router.push("/cloud/dashboard/team")} style={{ borderRadius: 20, background: "linear-gradient(135deg, #FFE08A 0%, #FFD740 100%)", border: "0.5px solid rgba(255,185,0,0.35)", padding: 16, cursor: "pointer" }}>
          <p style={{ fontSize: 9, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "#BF7020", margin: "0 0 10px", fontFamily: F }}>Team</p>
          {teamMembers.length > 0 ? (
            <div style={{ display: "flex", marginBottom: 10 }}>
              {teamMembers.slice(0, 3).map((m, i) => (
                <div key={m.id} style={{ width: 28, height: 28, borderRadius: "50%", border: "2px solid #FFFBF0", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 9, fontWeight: 700, marginLeft: i === 0 ? 0 : -7, background: i === 0 ? "#0a0a0a" : i === 1 ? "#D4FF4F" : "#FFD080", color: i === 0 ? "#D4FF4F" : "#7A3800", fontFamily: F, zIndex: 3 - i, position: "relative" }}>
                  {getInitials(m.name)}
                </div>
              ))}
            </div>
          ) : (
            <div style={{ marginBottom: 10 }}>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#FFD070" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>
              </svg>
            </div>
          )}
          <p style={{ fontFamily: S, fontSize: 24, color: "#7A3800", margin: "0 0 2px", lineHeight: 1 }}>{teamMembers.length}</p>
          <p style={{ fontSize: 10, color: "#BF7020", margin: "0 0 12px", fontFamily: F }}>members</p>
          <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
            <span style={{ fontSize: 11, fontWeight: 600, color: "#7A3800", fontFamily: F }}>Manage</span>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#7A3800" strokeWidth="2.5" strokeLinecap="round"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>
          </div>
        </div>

        <div onClick={() => router.push("/cloud/dashboard/notifications")} style={{ borderRadius: 20, background: "linear-gradient(135deg, #D4BBFF 0%, #A98EFF 100%)", border: "0.5px solid rgba(148,100,255,0.35)", padding: 16, cursor: "pointer" }}>
          <p style={{ fontSize: 9, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "#7B5EA7", margin: "0 0 10px", fontFamily: F }}>Activity</p>
          <p style={{ fontFamily: S, fontSize: 28, color: "#2D1B6B", margin: "0 0 2px", lineHeight: 1 }}>{photoCount}</p>
          <p style={{ fontSize: 11, color: "#7B5EA7", margin: "0 0 12px", fontFamily: F }}>photos total</p>
          {recentActivity.map((item, i) => (
            <div key={i} style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
              <div style={{ width: 5, height: 5, borderRadius: "50%", background: "#9B7FCC", flexShrink: 0 }} />
              <p style={{ fontSize: 10, color: "#4A2D8B", margin: 0, lineHeight: 1.3, fontFamily: F, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{item.message}</p>
            </div>
          ))}
          {recentActivity.length === 0 && (
            <p style={{ fontSize: 10, color: "#9B7FCC", margin: 0, fontFamily: F }}>No recent activity</p>
          )}
          <div style={{ display: "flex", alignItems: "center", gap: 4, marginTop: 8 }}>
            <span style={{ fontSize: 11, fontWeight: 600, color: "#2D1B6B", fontFamily: F }}>Notifications</span>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#2D1B6B" strokeWidth="2.5" strokeLinecap="round"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>
          </div>
        </div>
      </div>

      <div style={{ height: 100 }} />

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
