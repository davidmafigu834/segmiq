"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { NewProjectSlideOver } from "./projects/NewProjectSlideOver";
import { getProjectStyle } from "@/app/cloud/components/ui/projectCardStyles";
import { Plus, FolderOpen, Camera, Users, UserPlus, Activity, ArrowRight, Globe, ExternalLink } from "lucide-react";

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


function formatRelativeTime(dateStr: string): string {
  if (!dateStr) return "recently";
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 2) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
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
  const recentActivity = projects.slice(0, 3).map((p) => ({
    message: `Added ${p.project_media?.length ?? 0} photos to ${p.title}`,
    userInitials: getInitials(session?.user?.name ?? "Me"),
    time: formatRelativeTime(p.updated_at),
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
    <div style={{ minHeight: "100vh", background: "#F5F5F0", fontFamily: F, paddingBottom: 100, overflowX: "hidden" }}>

      {/* ── QUICK ACTION PILLS ── */}
      <div style={{ padding: "12px 20px 16px", display: "flex", gap: 10, overflowX: "auto", scrollbarWidth: "none", width: "100%" } as React.CSSProperties}>
        {([
          { label: "New project",   Icon: Plus,      bg: "#D4FF4F", color: "#0a0a0a", action: () => setShowNew(true) },
          { label: "All projects",  Icon: FolderOpen, bg: "#FFE8A0", color: "#7A3800", href: "/cloud/dashboard/projects" },
          { label: "Upload photos", Icon: Camera,     bg: "#C8FFE0", color: "#004D30", href: "/cloud/dashboard/upload" },
          { label: "Invite team",   Icon: UserPlus,   bg: "#DDD0FF", color: "#2D1B6B", href: "/cloud/dashboard/team" },
        ] as { label: string; Icon: React.ElementType; bg: string; color: string; href?: string; action?: () => void }[]).map((a) => (
          <button
            key={a.label}
            onClick={a.action ? a.action : () => router.push(a.href!)}
            style={{ display: "flex", alignItems: "center", gap: 8, height: 40, padding: "0 16px", background: a.bg, color: a.color, borderRadius: 20, border: "none", cursor: "pointer", flexShrink: 0, fontFamily: F, fontSize: 12, fontWeight: 700, whiteSpace: "nowrap" }}
          >
            <a.Icon size={15} strokeWidth={2.2} aria-hidden="true" />
            {a.label}
          </button>
        ))}
      </div>

      {/* ── STORAGE CARD (dark anchor) ── */}
      <div style={{ margin: "0 20px 20px", borderRadius: 24, background: "#0a0a0a", padding: 20, position: "relative", overflow: "hidden", border: "0.5px solid rgba(255,255,255,0.07)" }}>
        <div style={{ position: "absolute", top: -40, right: -40, width: 120, height: 120, borderRadius: "50%", background: "rgba(212,255,79,0.05)", pointerEvents: "none" }} />
        <div style={{ position: "absolute", bottom: -20, right: 20, width: 80, height: 80, borderRadius: "50%", background: "rgba(212,255,79,0.03)", pointerEvents: "none" }} />
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 16 }}>
          <div>
            <p style={{ fontSize: 9, color: "rgba(255,255,255,0.4)", textTransform: "uppercase", letterSpacing: "0.1em", margin: "0 0 8px", fontFamily: F }}>Cloud storage</p>
            <p style={{ fontFamily: S, fontSize: 36, color: "#FFFFFF", margin: 0, lineHeight: 1 }}>{formatBytes(storageUsed)}</p>
            <p style={{ fontSize: 11, color: "rgba(255,255,255,0.35)", margin: "6px 0 0", fontFamily: F }}>used of {formatBytes(storageLimit)}</p>
          </div>
          <div style={{ position: "relative", width: 64, height: 64, flexShrink: 0 }}>
            <svg width="64" height="64" viewBox="0 0 64 64">
              <circle cx="32" cy="32" r="26" fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="6" />
              <circle cx="32" cy="32" r="26" fill="none" stroke="#D4FF4F" strokeWidth="6" strokeLinecap="round"
                strokeDasharray={`${2 * Math.PI * 26}`}
                strokeDashoffset={`${2 * Math.PI * 26 * (1 - Math.min(percentUsed / 100, 1))}`}
                transform="rotate(-90 32 32)"
              />
            </svg>
            <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
              <span style={{ fontSize: 11, fontWeight: 700, color: "#D4FF4F", fontFamily: F }}>{percentUsed < 1 ? "<1" : Math.round(percentUsed)}%</span>
            </div>
          </div>
        </div>
        <div style={{ height: 4, background: "rgba(255,255,255,0.08)", borderRadius: 2, marginBottom: 16 }}>
          <div style={{ height: 4, background: "#D4FF4F", borderRadius: 2, width: `${Math.max(Math.min(percentUsed, 100), 0.5)}%` }} />
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr" }}>
          {([
            { label: "Projects", value: String(projectCount), serif: true },
            { label: "Photos",   value: String(photoCount),   serif: true },
            { label: "Plan",     value: "Free",               serif: false },
          ] as { label: string; value: string; serif: boolean }[]).map((stat, i) => (
            <div key={stat.label} style={{ borderRight: i < 2 ? "1px solid rgba(255,255,255,0.08)" : "none", paddingRight: i < 2 ? 12 : 0, paddingLeft: i > 0 ? 12 : 0 }}>
              <p style={{ fontSize: 9, color: "rgba(255,255,255,0.35)", margin: "0 0 4px", textTransform: "uppercase", letterSpacing: "0.06em", fontFamily: F }}>{stat.label}</p>
              <p style={{ fontFamily: stat.serif ? S : F, fontSize: stat.serif ? 22 : 13, margin: 0, lineHeight: 1, color: "#FFFFFF", fontWeight: stat.serif ? 400 : 600 }}>{stat.value}</p>
            </div>
          ))}
        </div>
      </div>

      {/* ── RECENT PROJECTS ── */}
      <div style={{ padding: "0 20px 8px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.09em", textTransform: "uppercase", color: "#4B5563", margin: 0, fontFamily: F }}>Recent projects</p>
        {projects.length > 0 && (
          <button onClick={() => router.push("/cloud/dashboard/projects")} style={{ fontSize: 13, color: "#374151", background: "none", border: "none", cursor: "pointer", padding: 0, fontFamily: F, fontWeight: 600 }}>View all →</button>
        )}
      </div>

      {projects.length === 0 ? (
        <div style={{ padding: "0 20px" }}>
          <div style={{ background: "linear-gradient(145deg, #EDFFF6 0%, #D0FFE8 100%)", border: "0.5px solid rgba(0,180,100,0.22)", borderRadius: 20, padding: "32px 24px", display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center" }}>
            <div style={{ width: 56, height: 56, borderRadius: 16, background: "rgba(255,255,255,0.65)", border: "0.5px solid rgba(0,180,100,0.25)", display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 16 }}>
              <Camera size={26} color="#00613A" strokeWidth={1.5} />
            </div>
            <p style={{ fontFamily: S, fontSize: 24, color: "#004D30", margin: "0 0 8px", lineHeight: 1.25 }}>Add your first project</p>
            <p style={{ fontSize: 16, color: "#007A4A", lineHeight: 1.6, margin: "0 0 24px", maxWidth: 260, fontFamily: F }}>Create a project for a job you are working on, then upload photos straight from your phone.</p>
            <button onClick={() => setShowNew(true)} style={{ display: "flex", alignItems: "center", gap: 8, height: 48, padding: "0 24px", background: "#D4FF4F", color: "#111111", fontSize: 16, fontWeight: 700, borderRadius: 12, border: "none", cursor: "pointer", fontFamily: F }}>
              <Plus size={16} strokeWidth={2.5} />
              Create a project
            </button>
          </div>
        </div>
      ) : (
        <div style={{ display: "flex", gap: 12, overflowX: "auto", padding: "0 20px 4px", scrollbarWidth: "none", width: "100%" } as React.CSSProperties}>
          {projects.slice(0, 5).map((p) => {
            const ps = getProjectStyle(p.category);
            const mediaItems = [...(p.project_media ?? [])].sort((a, b) => a.display_order - b.display_order).slice(0, 4);
            const pCount = p.project_media?.length ?? 0;
            return (
              <div key={p.id} onClick={() => router.push(`/cloud/dashboard/projects/${p.id}`)}
                   style={{ background: ps.gradient, border: `0.5px solid ${ps.border}`, borderRadius: 20, overflow: "hidden", minWidth: 160, width: 160, flexShrink: 0, cursor: "pointer" }}>
                <div style={{ margin: "10px 10px 0", borderRadius: 14, overflow: "hidden", position: "relative" }}>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gridTemplateRows: "1fr 1fr", gap: 3, height: 130 }}>
                    {([0, 1, 2, 3] as const).map((idx) => (
                      <div key={idx} style={{ overflow: "hidden", background: ps.photoFallbackBg, opacity: mediaItems[idx] ? 1 : 0.35 }}>
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
                    <div style={{ position: "absolute", bottom: 7, right: 7, background: "#D4FF4F", color: "#0a0a0a", fontSize: 10, fontWeight: 700, padding: "3px 8px", borderRadius: 20, fontFamily: F, lineHeight: 1.4 }}>{pCount} photos</div>
                  )}
                </div>
                <div style={{ padding: "10px 12px 14px" }}>
                  <p style={{ fontFamily: S, fontSize: 14, color: ps.titleColor, margin: "0 0 4px", lineHeight: 1.2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.title}</p>
                  <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: "0.05em", textTransform: "uppercase", color: ps.subtextColor, background: "rgba(255,255,255,0.6)", padding: "2px 7px", borderRadius: 20, fontFamily: F }}>{p.category || "Project"}</span>
                </div>
              </div>
            );
          })}
          <div onClick={() => setShowNew(true)} style={{ minWidth: 110, width: 110, border: "1.5px dashed rgba(0,0,0,0.15)", borderRadius: 20, background: "#EEEEEA", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 8, flexShrink: 0, cursor: "pointer", padding: "24px 0" }}>
            <div style={{ width: 38, height: 38, borderRadius: "50%", background: "#FFFFFF", border: "0.5px solid rgba(0,0,0,0.10)", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <Plus size={18} color="#6B7280" strokeWidth={2.5} />
            </div>
            <p style={{ fontSize: 13, color: "#9CA3AF", fontWeight: 500, textAlign: "center", margin: 0, lineHeight: 1.4, fontFamily: F }}>New<br/>project</p>
          </div>
        </div>
      )}

      {/* ── TEAM + ACTIVITY ROW ── */}
      <div style={{ padding: "20px 20px 0", display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>

        {/* Team card */}
        <div style={{ borderRadius: 20, background: "linear-gradient(160deg, #FFFBF0 0%, #FFF3D0 60%, #FFE8A0 100%)", border: "0.5px solid rgba(255,208,112,0.4)", padding: 20, display: "flex", flexDirection: "column" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
            <p style={{ fontSize: 9, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "#BF7020", margin: 0, fontFamily: F }}>Team</p>
            <div style={{ width: 28, height: 28, borderRadius: 8, background: "rgba(255,255,255,0.6)", display: "flex", alignItems: "center", justifyContent: "center", border: "0.5px solid rgba(255,180,50,0.3)" }}>
              <Users size={14} color="#BF7020" strokeWidth={1.8} />
            </div>
          </div>
          <p style={{ fontFamily: S, fontSize: 48, color: "#7A3800", margin: "0 0 4px", lineHeight: 1 }}>{teamMembers.length}</p>
          <p style={{ fontSize: 12, color: "#BF7020", margin: "0 0 16px", fontFamily: F }}>{teamMembers.length === 1 ? "team member" : "team members"}</p>
          {teamMembers.length > 0 && (
            <div style={{ display: "flex", marginBottom: 16 }}>
              {teamMembers.slice(0, 4).map((m, i) => (
                <div key={m.id} title={m.name} style={{ width: 32, height: 32, borderRadius: "50%", border: "2px solid #FFFBF0", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, fontWeight: 700, marginLeft: i === 0 ? 0 : -8, background: (["#0a0a0a", "#D4FF4F", "#FFD080", "#E8C0A0"])[i % 4], color: i === 1 ? "#7A3800" : i === 0 ? "#D4FF4F" : "#7A3800", fontFamily: F, zIndex: 4 - i, position: "relative", flexShrink: 0 }}>
                  {getInitials(m.name)}
                </div>
              ))}
              {teamMembers.length > 4 && (
                <div style={{ width: 32, height: 32, borderRadius: "50%", border: "2px solid #FFFBF0", background: "#FFE0A0", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 9, fontWeight: 700, color: "#7A3800", marginLeft: -8, zIndex: 0, position: "relative", fontFamily: F, flexShrink: 0 }}>
                  +{teamMembers.length - 4}
                </div>
              )}
            </div>
          )}
          <button onClick={() => router.push("/cloud/dashboard/team")} style={{ marginTop: "auto", height: 38, background: "rgba(255,255,255,0.7)", border: "0.5px solid rgba(255,180,50,0.4)", borderRadius: 12, color: "#7A3800", fontSize: 12, fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 6, fontFamily: F }}>
            Manage team
            <ArrowRight size={13} strokeWidth={2.5} />
          </button>
        </div>

        {/* Activity card */}
        <div style={{ borderRadius: 20, background: "linear-gradient(160deg, #F5F0FF 0%, #EDE5FF 60%, #DDD0FF 100%)", border: "0.5px solid rgba(196,168,255,0.4)", padding: 20, display: "flex", flexDirection: "column" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
            <p style={{ fontSize: 9, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "#7B5EA7", margin: 0, fontFamily: F }}>Activity</p>
            <div style={{ width: 28, height: 28, borderRadius: 8, background: "rgba(255,255,255,0.5)", display: "flex", alignItems: "center", justifyContent: "center", border: "0.5px solid rgba(180,140,255,0.3)" }}>
              <Activity size={14} color="#7B5EA7" strokeWidth={1.8} />
            </div>
          </div>
          <p style={{ fontFamily: S, fontSize: 48, color: "#2D1B6B", margin: "0 0 4px", lineHeight: 1 }}>{photoCount}</p>
          <p style={{ fontSize: 12, color: "#7B5EA7", margin: "0 0 16px", fontFamily: F }}>photos uploaded</p>
          <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 16 }}>
            {recentActivity.length > 0 ? recentActivity.slice(0, 3).map((item, i) => (
              <div key={i} style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
                <div style={{ width: 28, height: 28, borderRadius: "50%", flexShrink: 0, background: (["rgba(255,255,255,0.7)", "rgba(212,255,79,0.3)", "rgba(255,220,100,0.4)"])[i % 3], border: "0.5px solid rgba(180,140,255,0.3)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 9, fontWeight: 700, color: "#2D1B6B", fontFamily: F }}>
                  {item.userInitials}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ fontSize: 11, color: "#2D1B6B", fontWeight: 600, margin: "0 0 1px", lineHeight: 1.3, fontFamily: F, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{item.message}</p>
                  <p style={{ fontSize: 10, color: "#9B7FCC", margin: 0, fontFamily: F }}>{item.time}</p>
                </div>
              </div>
            )) : (
              <p style={{ fontSize: 12, color: "#9B7FCC", margin: 0, fontFamily: F }}>No activity yet. Upload your first photos to get started.</p>
            )}
          </div>
          <button onClick={() => router.push("/cloud/dashboard/notifications")} style={{ marginTop: "auto", height: 38, background: "rgba(255,255,255,0.6)", border: "0.5px solid rgba(180,140,255,0.4)", borderRadius: 12, color: "#2D1B6B", fontSize: 12, fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 6, fontFamily: F }}>
            View all activity
            <ArrowRight size={13} strokeWidth={2.5} />
          </button>
        </div>
      </div>

      {/* ── PUBLIC PROFILE CARD ── */}
      <div style={{ margin: "16px 20px 0", borderRadius: 20, background: "linear-gradient(160deg, #FFF8F0 0%, #FFEEDD 60%, #FFE0C0 100%)", border: "0.5px solid rgba(255,180,100,0.3)", padding: "18px 20px", display: "flex", alignItems: "center", gap: 16 }}>
        <div style={{ width: 44, height: 44, borderRadius: 14, background: "rgba(255,255,255,0.6)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, border: "0.5px solid rgba(255,160,60,0.3)" }}>
          <Globe size={22} color="#BF5000" strokeWidth={1.6} />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{ fontFamily: S, fontSize: 16, color: "#7A3000", margin: "0 0 3px", lineHeight: 1.2 }}>Your public profile</p>
          <p style={{ fontSize: 11, color: "#BF7020", margin: 0, fontFamily: F, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>Share your projects with clients</p>
        </div>
        <button onClick={() => router.push("/cloud/dashboard/settings")} style={{ height: 34, padding: "0 14px", background: "rgba(255,255,255,0.7)", border: "0.5px solid rgba(255,160,60,0.3)", borderRadius: 10, color: "#7A3000", fontSize: 11, fontWeight: 700, cursor: "pointer", flexShrink: 0, fontFamily: F, display: "flex", alignItems: "center", gap: 5 }}>
          Manage
          <ExternalLink size={11} strokeWidth={2} />
        </button>
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
