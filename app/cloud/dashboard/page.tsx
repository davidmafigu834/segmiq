"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { NewProjectSlideOver } from "./projects/NewProjectSlideOver";
import { getCategoryStyle } from "@/app/cloud/lib/category-styles";
import { Plus, FolderOpen, Camera, Users, UserPlus, Activity, ArrowRight, Globe, ExternalLink } from "lucide-react";
import { SkeletonScrollRow } from "@/app/cloud/components/SkeletonCard";

type MediaItem = { public_url: string; display_order: number };
type Project = {
  id: string;
  title: string;
  category: string | null;
  updated_at: string;
  project_media: MediaItem[];
  project_milestones?: { id: string; is_completed: boolean }[];
};
type Stats = { total_projects: number; total_photos: number; total_bytes: number; plan?: string; limit_bytes?: number };
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

function getGreeting(): string {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  return "Good evening";
}


export default function CloudDashboardHome() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [projects, setProjects] = useState<Project[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [clientName, setClientName] = useState<string>("");

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

  useEffect(() => {
    if (!session?.clientId) return;
    fetch("/api/clients")
      .then((r) => r.json())
      .then((list: unknown) => {
        if (Array.isArray(list) && list.length > 0) {
          const client = (list as { id: string; name: string }[]).find(
            (c) => c.id === session?.clientId
          ) ?? (list as { id: string; name: string }[])[0];
          if (client?.name) setClientName(client.name);
        }
      })
      .catch(() => {});
  }, [session?.clientId]);

  const storageUsed = stats?.total_bytes ?? 0;
  const storageLimit = stats?.limit_bytes ?? 20 * 1024 * 1024 * 1024;
  const percentUsed = Math.round((storageUsed / storageLimit) * 100 * 10) / 10;
  const projectCount = stats?.total_projects ?? 0;
  const photoCount = stats?.total_photos ?? 0;
  const recentActivity = projects.slice(0, 3).map((p) => ({
    message: `Added ${p.project_media?.length ?? 0} photos to ${p.title}`,
    userInitials: getInitials(session?.user?.name ?? "Me"),
    time: formatRelativeTime(p.updated_at),
  }));

  if (status === "loading") {
    return (
      <div style={{ display: "flex", minHeight: "60vh", alignItems: "center", justifyContent: "center", background: "#F7F7F8" }}>
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-black/10 border-t-[#111]" />
      </div>
    );
  }

  const F = "var(--fw-font-body), system-ui, sans-serif";
  const S = "var(--fw-font-display), Georgia, serif";

  return (
    <div style={{ minHeight: "100vh", background: "#F5F5F0", fontFamily: F, paddingBottom: 100, overflowX: "hidden", width: "100%" }}>

      {/* ── GREETING HERO ── */}
      <div style={{ padding: "32px 20px 24px", background: "#F7F4EF" }}>
        <p style={{ fontFamily: F, fontSize: 11, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "#8C7B6B", margin: "0 0 6px" }}>
          {getGreeting()}
        </p>
        <h1 style={{ fontFamily: S, fontSize: "clamp(24px, 5vw, 32px)", color: "#1C1410", margin: "0 0 4px", lineHeight: 1.1, letterSpacing: "-0.01em" }}>
          {clientName || session?.user?.name || ""}
        </h1>
        <p style={{ fontFamily: F, fontSize: 12, color: "#8C7B6B", margin: 0, lineHeight: 1 }}>
          {projectCount > 0
            ? `${projectCount} project${projectCount !== 1 ? 's' : ''} · ${photoCount} photos stored`
            : 'No projects yet · Upload your first job'}
        </p>
      </div>

      {/* ── STORAGE CARD (dark anchor) ── */}
      <div style={{ margin: "0 20px 20px", borderRadius: 24, background: "#1C1410", padding: 20, position: "relative", overflow: "hidden", border: "0.5px solid rgba(255,255,255,0.07)" }}>
        <div style={{ position: "absolute", top: -40, right: -40, width: 120, height: 120, borderRadius: "50%", background: "rgba(212,255,79,0.05)", pointerEvents: "none" }} />
        <div style={{ position: "absolute", bottom: -20, right: 20, width: 80, height: 80, borderRadius: "50%", background: "rgba(212,255,79,0.03)", pointerEvents: "none" }} />
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 16 }}>
          <div>
            <p style={{ fontSize: 9, color: "rgba(255,255,255,0.4)", textTransform: "uppercase", letterSpacing: "0.1em", margin: "0 0 8px", fontFamily: F }}>Cloud storage</p>
            <p style={{ fontFamily: S, fontSize: 36, color: "#FFFFFF", margin: 0, lineHeight: 1 }}>{formatBytes(storageUsed)}</p>
            <p style={{ fontSize: 11, color: "rgba(255,255,255,0.55)", margin: "6px 0 0", fontFamily: F }}>used of {formatBytes(storageLimit)}</p>
          </div>
          <div style={{ position: "relative", width: 64, height: 64, flexShrink: 0 }}>
            <svg width="64" height="64" viewBox="0 0 64 64">
              <circle cx="32" cy="32" r="26" fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="6" />
              <circle cx="32" cy="32" r="26" fill="none" stroke="rgba(255,255,255,0.6)" strokeWidth="6" strokeLinecap="round"
                strokeDasharray={`${2 * Math.PI * 26}`}
                strokeDashoffset={`${2 * Math.PI * 26 * (1 - Math.min(percentUsed / 100, 1))}`}
                transform="rotate(-90 32 32)"
              />
            </svg>
            <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
              <span style={{ fontSize: 11, fontWeight: 700, color: "#FFFFFF", fontFamily: F }}>{percentUsed < 1 ? "<1" : Math.round(percentUsed)}%</span>
            </div>
          </div>
        </div>
        <div style={{ height: 4, background: "rgba(255,255,255,0.08)", borderRadius: 2, marginBottom: 16 }}>
          <div style={{ height: 4, background: "rgba(255,255,255,0.6)", borderRadius: 2, width: `${Math.max(Math.min(percentUsed, 100), 0.5)}%` }} />
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr" }}>
          {([
            { label: "Projects", value: String(projectCount), serif: true },
            { label: "Photos",   value: String(photoCount),   serif: true },
            { label: "Plan",     value: stats?.plan ? stats.plan.charAt(0).toUpperCase() + stats.plan.slice(1) : "Starter", serif: false },
          ] as { label: string; value: string; serif: boolean }[]).map((stat, i) => (
            <div key={stat.label} style={{ borderRight: i < 2 ? "1px solid rgba(255,255,255,0.08)" : "none", paddingRight: i < 2 ? 12 : 0, paddingLeft: i > 0 ? 12 : 0 }}>
              <p style={{ fontSize: 9, color: "rgba(255,255,255,0.45)", margin: "0 0 4px", textTransform: "uppercase", letterSpacing: "0.06em", fontFamily: F }}>{stat.label}</p>
              <p style={{ fontFamily: stat.serif ? S : F, fontSize: stat.serif ? 22 : 13, margin: 0, lineHeight: 1, color: "#FFFFFF", fontWeight: stat.serif ? 400 : 600 }}>{stat.value}</p>
            </div>
          ))}
        </div>
      </div>

      {/* ── QUICK ACTION PILLS ── */}
      <div
        className="pills-scroll"
        style={{ overflowX: "auto", WebkitOverflowScrolling: "touch", scrollbarWidth: "none", padding: "4px 20px 16px", width: "100%", boxSizing: "border-box" } as React.CSSProperties}
      >
        <div style={{ display: "flex", gap: 8, width: "max-content" }}>
        {([
          { label: "New project", Icon: Plus,      bg: "var(--fw-soil)", color: "var(--fw-lime)",          border: "none",                              action: () => setShowNew(true) },
          { label: "Projects",    Icon: FolderOpen, bg: "var(--fw-card)", color: "var(--fw-text-primary)",  border: "0.5px solid var(--fw-border-strong)", href: "/cloud/dashboard/projects" },
          { label: "Upload",      Icon: Camera,     bg: "var(--fw-lime)", color: "var(--fw-soil)",          border: "none",                              href: "/cloud/dashboard/upload" },
          { label: "Invite",      Icon: UserPlus,   bg: "var(--fw-card)", color: "var(--fw-text-primary)",  border: "0.5px solid var(--fw-border-strong)", href: "/cloud/dashboard/team" },
        ] as { label: string; Icon: React.ElementType; bg: string; color: string; border: string; href?: string; action?: () => void }[]).map((a) => (
          <button
            key={a.label}
            onClick={a.action ? a.action : () => router.push(a.href!)}
            style={{ display: "flex", alignItems: "center", gap: 8, height: 40, padding: "0 16px", background: a.bg, color: a.color, borderRadius: 20, border: a.border, cursor: "pointer", flexShrink: 0, fontFamily: F, fontSize: 12, fontWeight: 700, whiteSpace: "nowrap" }}
          >
            <a.Icon size={15} strokeWidth={2.2} aria-hidden="true" />
            {a.label}
          </button>
        ))}
        </div>
      </div>

      {/* ── RECENT PROJECTS ── */}
      <div style={{ padding: "12px 20px 8px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "#8C7B6B", margin: 0, fontFamily: F }}>Recent projects</p>
        {projects.length > 0 && (
          <button onClick={() => router.push("/cloud/dashboard/projects")} style={{ fontSize: 11, color: "#4A3828", background: "none", border: "none", cursor: "pointer", padding: 0, fontFamily: F, fontWeight: 600 }}>View all →</button>
        )}
      </div>

      {loading ? (
        <SkeletonScrollRow />
      ) : projects.length === 0 ? (
        <div style={{ padding: "0 20px" }}>
          <div style={{ background: "var(--fw-card)", border: "0.5px solid var(--fw-border)", borderRadius: 20, padding: "32px 24px", display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center" }}>
            <div style={{ width: 56, height: 56, borderRadius: 16, background: "var(--fw-sunken)", border: "0.5px solid var(--fw-border-strong)", display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 16 }}>
              <Camera size={26} color="var(--fw-text-secondary)" strokeWidth={1.5} />
            </div>
            <p style={{ fontFamily: S, fontSize: 24, color: "var(--fw-text-primary)", margin: "0 0 8px", lineHeight: 1.25 }}>Add your first project</p>
            <p style={{ fontSize: 14, color: "var(--fw-text-tertiary)", lineHeight: 1.6, margin: "0 0 24px", maxWidth: 260, fontFamily: F }}>Create a project for a job you are working on, then upload photos straight from your phone.</p>
            <button onClick={() => setShowNew(true)} style={{ display: "flex", alignItems: "center", gap: 8, height: 44, padding: "0 20px", background: "var(--fw-soil)", color: "var(--fw-lime)", fontSize: 14, fontWeight: 700, borderRadius: 12, border: "none", cursor: "pointer", fontFamily: F }}>
              <Plus size={15} strokeWidth={2.5} />
              Create a project
            </button>
          </div>
        </div>
      ) : (
        <div
          className="pills-scroll"
          style={{ overflowX: "auto", WebkitOverflowScrolling: "touch", scrollbarWidth: "none", padding: "0 20px 12px", paddingRight: 48, scrollSnapType: "x mandatory", width: "100%", boxSizing: "border-box" } as React.CSSProperties}
        >
          <div style={{ display: "flex", gap: 10, width: "max-content" }}>
          {projects.slice(0, 5).map((p) => {
            const cat = getCategoryStyle(p.category);
            const coverPhoto = [...(p.project_media ?? [])].sort((a, b) => a.display_order - b.display_order)[0];
            const pCount = p.project_media?.length ?? 0;
            return (
              <div
                key={p.id}
                onClick={() => router.push(`/cloud/dashboard/projects/${p.id}`)}
                style={{ minWidth: 152, maxWidth: 152, borderRadius: 20, background: "#FFFFFF", border: "0.5px solid rgba(28,20,16,0.08)", overflow: "hidden", flexShrink: 0, cursor: "pointer", scrollSnapAlign: "start" }}
              >
                {/* Image area */}
                <div style={{ height: 108, background: cat.sceneBg, position: "relative", overflow: "hidden" }}>
                  {coverPhoto && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={coverPhoto.public_url} alt={p.title} style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
                  )}
                  {/* Dark gradient overlay */}
                  <div style={{ position: "absolute", inset: 0, background: `linear-gradient(to top, ${cat.overlayFrom} 0%, transparent 55%)` }} />
                  {/* Category badge — top left */}
                  <span style={{ position: "absolute", top: 8, left: 8, background: cat.badge, color: cat.labelColor, fontSize: 8, fontWeight: 700, padding: "2px 7px", borderRadius: 20, letterSpacing: "0.04em", textTransform: "uppercase", fontFamily: F }}>
                    {p.category || "Project"}
                  </span>
                  {/* Photo count badge — top right */}
                  <span style={{ position: "absolute", top: 8, right: 8, background: "#1C1410", color: "#FFFFFF", fontSize: 8, fontWeight: 700, padding: "2px 6px", borderRadius: 20, fontFamily: F }}>
                    {pCount}
                  </span>
                </div>
                {/* Info below */}
                <div style={{ padding: "10px 12px 14px" }}>
                  <p style={{ fontFamily: S, fontSize: 13, color: "#1C1410", lineHeight: 1.2, margin: "0 0 6px", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>{p.title}</p>
                  {p.project_milestones && p.project_milestones.length > 0 ? (() => {
                    const total = p.project_milestones.length;
                    const done = p.project_milestones.filter((m) => m.is_completed).length;
                    const pct = Math.round((done / total) * 100);
                    return (
                      <div style={{ marginBottom: 8 }}>
                        <div style={{ height: 3, background: 'rgba(28,20,16,0.08)', borderRadius: 2, marginBottom: 4 }}>
                          <div style={{ height: 3, borderRadius: 2, background: pct === 100 ? '#D4FF4F' : '#1C1410', width: `${pct}%` }} />
                        </div>
                        <span style={{ fontSize: 8, color: '#8C7B6B', fontFamily: F }}>{done}/{total} milestones</span>
                      </div>
                    );
                  })() : <p style={{ fontSize: 9, color: "#4A3828", margin: "0 0 8px", fontFamily: F }}>In progress</p>}
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                    <span style={{ fontSize: 9, fontWeight: 700, color: "#4A3828", fontFamily: F }}>{pCount} photos</span>
                    <div style={{ width: 22, height: 22, borderRadius: "50%", background: "#EDE9E3", display: "flex", alignItems: "center", justifyContent: "center" }}>
                      <ArrowRight size={11} color="#4A3828" strokeWidth={2} />
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
          {/* New project dashed card */}
          <div
            onClick={() => setShowNew(true)}
            style={{ minWidth: 120, maxWidth: 120, borderRadius: 20, border: "1.5px dashed rgba(28,20,16,0.14)", background: "#EDE9E3", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 8, flexShrink: 0, cursor: "pointer", height: 185 }}
          >
            <div style={{ width: 36, height: 36, borderRadius: "50%", background: "#FFFFFF", border: "0.5px solid rgba(28,20,16,0.1)", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <Plus size={16} color="#4A3828" strokeWidth={2.2} />
            </div>
            <p style={{ fontSize: 11, fontWeight: 500, color: "#8C7B6B", textAlign: "center", lineHeight: 1.4, margin: 0, fontFamily: F }}>New<br />project</p>
          </div>
          </div>
        </div>
      )}

      {/* ── TEAM + ACTIVITY ROW ── */}
      <div style={{ padding: "20px 20px 0", display: "grid", gridTemplateColumns: "minmax(0,1fr) minmax(0,1fr)", gap: 12 }}>

        {/* Team card */}
        <div style={{ minWidth: 0, borderRadius: 20, background: "var(--fw-card)", border: "0.5px solid var(--fw-border)", padding: 20, display: "flex", flexDirection: "column" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
            <p style={{ fontSize: 9, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--fw-text-tertiary)", margin: 0, fontFamily: F }}>Team</p>
            <div style={{ width: 28, height: 28, borderRadius: 8, background: "var(--fw-sunken)", display: "flex", alignItems: "center", justifyContent: "center", border: "0.5px solid var(--fw-border-strong)" }}>
              <Users size={14} color="var(--fw-text-secondary)" strokeWidth={1.8} />
            </div>
          </div>
          <p style={{ fontFamily: S, fontSize: 44, color: "#1C1410", lineHeight: 1, margin: "0 0 4px" }}>{teamMembers.length}</p>
          <p style={{ fontSize: 11, color: "#8C7B6B", margin: "0 0 16px", fontFamily: F }}>{teamMembers.length === 1 ? "team member" : "team members"}</p>
          {teamMembers.length > 0 && (
            <div style={{ display: "flex", marginBottom: 16 }}>
              {teamMembers.slice(0, 4).map((m, i) => (
                <div key={m.id} title={m.name} style={{ width: 32, height: 32, borderRadius: "50%", border: "2px solid var(--fw-card)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, fontWeight: 700, marginLeft: i === 0 ? 0 : -8, background: (["var(--fw-soil)", "var(--fw-lime)", "var(--fw-sunken)", "var(--fw-sunken)"])[i % 4], color: i === 1 ? "var(--fw-soil)" : i === 0 ? "var(--fw-lime)" : "var(--fw-text-secondary)", fontFamily: F, zIndex: 4 - i, position: "relative", flexShrink: 0 }}>
                  {getInitials(m.name)}
                </div>
              ))}
              {teamMembers.length > 4 && (
                <div style={{ width: 32, height: 32, borderRadius: "50%", border: "2px solid var(--fw-card)", background: "var(--fw-sunken)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 9, fontWeight: 700, color: "var(--fw-text-secondary)", marginLeft: -8, zIndex: 0, position: "relative", fontFamily: F, flexShrink: 0 }}>
                  +{teamMembers.length - 4}
                </div>
              )}
            </div>
          )}
          <button onClick={() => router.push("/cloud/dashboard/team")} style={{ marginTop: "auto", height: 38, background: "var(--fw-soil)", border: "none", borderRadius: 12, color: "var(--fw-lime)", fontSize: 12, fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 6, fontFamily: F }}>
            Manage team
            <ArrowRight size={13} strokeWidth={2.5} />
          </button>
        </div>

        {/* Activity card */}
        <div style={{ minWidth: 0, borderRadius: 20, background: "var(--fw-card)", border: "0.5px solid var(--fw-border)", padding: 20, display: "flex", flexDirection: "column" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
            <p style={{ fontSize: 9, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--fw-text-tertiary)", margin: 0, fontFamily: F }}>Activity</p>
            <div style={{ width: 28, height: 28, borderRadius: 8, background: "var(--fw-sunken)", display: "flex", alignItems: "center", justifyContent: "center", border: "0.5px solid var(--fw-border-strong)" }}>
              <Activity size={14} color="var(--fw-text-secondary)" strokeWidth={1.8} />
            </div>
          </div>
          <p style={{ fontFamily: S, fontSize: 44, color: "#1C1410", lineHeight: 1, margin: "0 0 4px" }}>{photoCount}</p>
          <p style={{ fontSize: 11, color: "#8C7B6B", margin: "0 0 16px", fontFamily: F }}>photos uploaded</p>
          <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 16 }}>
            {recentActivity.length > 0 ? recentActivity.slice(0, 3).map((item, i) => (
              <div key={i} style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
                <div style={{ width: 6, height: 6, borderRadius: "50%", flexShrink: 0, marginTop: 5, background: i === 0 ? "var(--fw-lime)" : "var(--fw-text-muted)" }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ fontSize: 10, fontWeight: 600, color: "#1C1410", margin: "0 0 1px", lineHeight: 1.3, fontFamily: F, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{item.message}</p>
                  <p style={{ fontSize: 9, color: "#8C7B6B", margin: 0, fontFamily: F }}>{item.time}</p>
                </div>
              </div>
            )) : (
              <p style={{ fontSize: 12, color: "var(--fw-text-tertiary)", margin: 0, fontFamily: F }}>No activity yet. Upload your first photos to get started.</p>
            )}
          </div>
          <button onClick={() => router.push("/cloud/dashboard/notifications")} style={{ marginTop: "auto", height: 38, background: "var(--fw-sunken)", border: "none", borderRadius: 12, color: "var(--fw-text-primary)", fontSize: 12, fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 6, fontFamily: F }}>
            View all activity
            <ArrowRight size={13} strokeWidth={2.5} />
          </button>
        </div>
      </div>

      {/* ── PUBLIC PROFILE CARD ── */}
      <div style={{ margin: "16px 20px 0", borderRadius: 18, background: "var(--fw-card)", border: "0.5px solid var(--fw-border)", padding: "14px 16px", display: "flex", alignItems: "center", gap: 12 }}>
        <div style={{ width: 40, height: 40, borderRadius: 12, background: "var(--fw-sunken)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, border: "0.5px solid var(--fw-border-strong)" }}>
          <Globe size={20} color="var(--fw-text-primary)" strokeWidth={1.6} />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{ fontFamily: S, fontSize: 15, color: "var(--fw-text-primary)", margin: "0 0 2px", lineHeight: 1.2 }}>Your public profile</p>
          <p style={{ fontSize: 11, color: "var(--fw-text-tertiary)", margin: 0, fontFamily: F, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>Share your projects with clients</p>
        </div>
        <button onClick={() => router.push("/cloud/dashboard/settings")} style={{ height: 32, padding: "0 12px", background: "var(--fw-sunken)", border: "0.5px solid var(--fw-border-strong)", borderRadius: 10, color: "var(--fw-text-primary)", fontSize: 11, fontWeight: 700, cursor: "pointer", flexShrink: 0, fontFamily: F, display: "flex", alignItems: "center", gap: 5 }}>
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
