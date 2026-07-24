"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { NewProjectSlideOver } from "./projects/NewProjectSlideOver";
import { getCategoryStyle } from "@/app/cloud/lib/category-styles";
import { CloudPage } from "@/app/cloud/components/CloudPage";
import {
  Plus, FolderOpen, Camera, Users, UserPlus, Activity, ArrowRight, Globe, ExternalLink,
} from "lucide-react";
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
  const planLabel = stats?.plan
    ? stats.plan.charAt(0).toUpperCase() + stats.plan.slice(1)
    : "Starter";
  const recentActivity = projects.slice(0, 3).map((p) => ({
    message: `Updated ${p.title}`,
    meta: `${p.project_media?.length ?? 0} photos · ${formatRelativeTime(p.updated_at)}`,
  }));

  if (status === "loading") {
    return (
      <CloudPage className="flex min-h-[60vh] items-center justify-center">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-black/10 border-t-[var(--cloud-ink)]" />
      </CloudPage>
    );
  }

  return (
    <CloudPage className="overflow-x-hidden">
      {/* Hero */}
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          <p className="mb-1.5 text-[11px] font-bold uppercase tracking-[0.1em] text-[var(--cloud-text-tertiary)]">
            {getGreeting()}
          </p>
          <h1 className="font-cloud-display text-[clamp(26px,4vw,34px)] leading-[1.1] tracking-[-0.02em] text-[var(--cloud-text-primary)]">
            {clientName || session?.user?.name || "Your workspace"}
          </h1>
          <p className="mt-2 text-[13px] text-[var(--cloud-text-secondary)]">
            {projectCount > 0
              ? `${projectCount} project${projectCount !== 1 ? "s" : ""} · ${photoCount} photos in the cloud`
              : "Create a project and upload your first job photos"}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button type="button" onClick={() => setShowNew(true)} className="cloud-btn-ink">
            <Plus size={15} strokeWidth={2.5} />
            New project
          </button>
          <button
            type="button"
            onClick={() => router.push("/cloud/dashboard/upload")}
            className="cloud-btn-primary"
          >
            <Camera size={15} strokeWidth={2.2} />
            Upload
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="cloud-stat-grid mb-6">
        <div className="cloud-card--ink cloud-card relative overflow-hidden p-5 sm:col-span-2">
          <div
            className="pointer-events-none absolute -right-8 -top-10 h-32 w-32 rounded-full"
            style={{ background: "rgba(212,255,79,0.08)" }}
          />
          <div className="relative flex items-start justify-between gap-4">
            <div>
              <p className="mb-2 text-[10px] font-bold uppercase tracking-[0.1em] text-white/45">
                Cloud storage
              </p>
              <p className="font-cloud-display text-[34px] leading-none text-white">
                {formatBytes(storageUsed)}
              </p>
              <p className="mt-2 text-[12px] text-white/55">
                of {formatBytes(storageLimit)} · {planLabel} plan
              </p>
            </div>
            <div className="relative h-14 w-14 shrink-0">
              <svg width="56" height="56" viewBox="0 0 56 56">
                <circle cx="28" cy="28" r="22" fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth="5" />
                <circle
                  cx="28" cy="28" r="22" fill="none" stroke="var(--cloud-accent)" strokeWidth="5"
                  strokeLinecap="round"
                  strokeDasharray={`${2 * Math.PI * 22}`}
                  strokeDashoffset={`${2 * Math.PI * 22 * (1 - Math.min(percentUsed / 100, 1))}`}
                  transform="rotate(-90 28 28)"
                />
              </svg>
              <div className="absolute inset-0 flex items-center justify-center">
                <span className="text-[11px] font-bold text-white">
                  {percentUsed < 1 ? "<1" : Math.round(percentUsed)}%
                </span>
              </div>
            </div>
          </div>
          <div className="relative mt-4 h-1.5 overflow-hidden rounded-full bg-white/10">
            <div
              className="h-full rounded-full bg-[var(--cloud-accent)]"
              style={{ width: `${Math.max(Math.min(percentUsed, 100), 0.5)}%` }}
            />
          </div>
        </div>

        {[
          { label: "Projects", value: String(projectCount), href: "/cloud/dashboard/projects" },
          { label: "Photos", value: String(photoCount), href: "/cloud/dashboard/upload" },
        ].map((stat) => (
          <button
            key={stat.label}
            type="button"
            onClick={() => router.push(stat.href)}
            className="cloud-card p-5 text-left transition-transform hover:-translate-y-0.5"
          >
            <p className="mb-3 text-[10px] font-bold uppercase tracking-[0.1em] text-[var(--cloud-text-tertiary)]">
              {stat.label}
            </p>
            <p className="font-cloud-display text-[32px] leading-none text-[var(--cloud-text-primary)]">
              {stat.value}
            </p>
          </button>
        ))}
      </div>

      {/* Quick actions */}
      <div className="mb-8 grid grid-cols-2 gap-2 sm:grid-cols-4">
        {([
          { label: "New project", Icon: Plus, action: () => setShowNew(true), primary: true },
          { label: "All projects", Icon: FolderOpen, href: "/cloud/dashboard/projects" },
          { label: "Upload photos", Icon: Camera, href: "/cloud/dashboard/upload" },
          { label: "Invite team", Icon: UserPlus, href: "/cloud/dashboard/team" },
        ] as { label: string; Icon: React.ElementType; href?: string; action?: () => void; primary?: boolean }[]).map((a) => (
          <button
            key={a.label}
            type="button"
            onClick={a.action ? a.action : () => router.push(a.href!)}
            className={`flex h-12 items-center justify-center gap-2 rounded-[12px] text-[13px] font-semibold transition-colors ${
              a.primary
                ? "bg-[var(--cloud-ink)] text-[var(--cloud-accent)]"
                : "cloud-card text-[var(--cloud-text-primary)] hover:bg-[var(--cloud-surface-hover)]"
            }`}
          >
            <a.Icon size={15} strokeWidth={2.2} />
            {a.label}
          </button>
        ))}
      </div>

      {/* Recent projects */}
      <div className="mb-3 flex items-center justify-between">
        <p className="cloud-section-label mb-0">Recent projects</p>
        {projects.length > 0 && (
          <button
            type="button"
            onClick={() => router.push("/cloud/dashboard/projects")}
            className="text-[12px] font-semibold text-[var(--cloud-text-secondary)] transition-colors hover:text-[var(--cloud-text-primary)]"
          >
            View all →
          </button>
        )}
      </div>

      {loading ? (
        <SkeletonScrollRow />
      ) : projects.length === 0 ? (
        <div className="cloud-card flex flex-col items-center px-6 py-10 text-center">
          <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-[var(--cloud-surface-muted)]">
            <Camera size={24} className="text-[var(--cloud-text-secondary)]" strokeWidth={1.6} />
          </div>
          <p className="font-cloud-display text-[24px] text-[var(--cloud-text-primary)]">
            Add your first project
          </p>
          <p className="mt-2 max-w-[280px] text-[14px] leading-relaxed text-[var(--cloud-text-secondary)]">
            Create a project for a job, then upload photos from your phone or desktop.
          </p>
          <button type="button" onClick={() => setShowNew(true)} className="cloud-btn-ink mt-6">
            <Plus size={15} strokeWidth={2.5} />
            Create a project
          </button>
        </div>
      ) : (
        <div className="mb-8 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {projects.slice(0, 6).map((p) => {
            const cat = getCategoryStyle(p.category);
            const coverPhoto = [...(p.project_media ?? [])].sort((a, b) => a.display_order - b.display_order)[0];
            const pCount = p.project_media?.length ?? 0;
            const milestones = p.project_milestones ?? [];
            const done = milestones.filter((m) => m.is_completed).length;
            const pct = milestones.length ? Math.round((done / milestones.length) * 100) : null;

            return (
              <button
                key={p.id}
                type="button"
                onClick={() => router.push(`/cloud/dashboard/projects/${p.id}`)}
                className="cloud-card overflow-hidden text-left transition-transform hover:-translate-y-0.5"
              >
                <div
                  className="relative h-[140px] overflow-hidden"
                  style={{ background: cat.sceneBg }}
                >
                  {coverPhoto && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={coverPhoto.public_url}
                      alt={p.title}
                      className="h-full w-full object-cover"
                    />
                  )}
                  <div
                    className="absolute inset-0"
                    style={{ background: `linear-gradient(to top, ${cat.overlayFrom} 0%, transparent 55%)` }}
                  />
                  <span className="absolute left-3 top-3 rounded-full bg-white/95 px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.04em] text-[var(--cloud-text-primary)]">
                    {p.category || "Project"}
                  </span>
                  <span className="absolute right-3 top-3 rounded-full bg-[var(--cloud-ink)] px-2 py-1 text-[10px] font-bold text-white">
                    {pCount}
                  </span>
                </div>
                <div className="p-4">
                  <p className="font-cloud-display text-[16px] leading-snug text-[var(--cloud-text-primary)] line-clamp-2">
                    {p.title}
                  </p>
                  {pct !== null ? (
                    <div className="mt-3">
                      <div className="mb-1.5 h-1 overflow-hidden rounded-full bg-[var(--cloud-surface-muted)]">
                        <div
                          className="h-full rounded-full"
                          style={{
                            width: `${pct}%`,
                            background: pct === 100 ? "var(--cloud-accent)" : "var(--cloud-ink)",
                          }}
                        />
                      </div>
                      <p className="text-[11px] text-[var(--cloud-text-tertiary)]">
                        {done}/{milestones.length} milestones
                      </p>
                    </div>
                  ) : (
                    <p className="mt-2 text-[12px] text-[var(--cloud-text-secondary)]">
                      {pCount} photos · {formatRelativeTime(p.updated_at)}
                    </p>
                  )}
                  <div className="mt-3 flex items-center justify-between">
                    <span className="text-[12px] font-semibold text-[var(--cloud-text-secondary)]">
                      Open project
                    </span>
                    <span className="flex h-7 w-7 items-center justify-center rounded-full bg-[var(--cloud-surface-muted)]">
                      <ArrowRight size={13} className="text-[var(--cloud-text-secondary)]" />
                    </span>
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      )}

      {/* Team + activity */}
      <div className="mt-8 grid grid-cols-1 gap-3 md:grid-cols-2">
        <div className="cloud-card flex flex-col p-5">
          <div className="mb-4 flex items-center justify-between">
            <p className="cloud-section-label mb-0">Team</p>
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[var(--cloud-surface-muted)]">
              <Users size={15} className="text-[var(--cloud-text-secondary)]" />
            </div>
          </div>
          <p className="font-cloud-display text-[40px] leading-none text-[var(--cloud-text-primary)]">
            {teamMembers.length}
          </p>
          <p className="mt-1 mb-4 text-[12px] text-[var(--cloud-text-secondary)]">
            {teamMembers.length === 1 ? "team member" : "team members"}
          </p>
          {teamMembers.length > 0 && (
            <div className="mb-5 flex">
              {teamMembers.slice(0, 4).map((m, i) => (
                <div
                  key={m.id}
                  title={m.name}
                  className="flex h-8 w-8 items-center justify-center rounded-full border-2 border-white text-[10px] font-bold"
                  style={{
                    marginLeft: i === 0 ? 0 : -8,
                    zIndex: 4 - i,
                    background: i === 1 ? "var(--cloud-accent)" : "var(--cloud-ink)",
                    color: i === 1 ? "var(--cloud-ink)" : "var(--cloud-accent)",
                  }}
                >
                  {getInitials(m.name)}
                </div>
              ))}
              {teamMembers.length > 4 && (
                <div
                  className="flex h-8 w-8 items-center justify-center rounded-full border-2 border-white bg-[var(--cloud-surface-muted)] text-[10px] font-bold text-[var(--cloud-text-secondary)]"
                  style={{ marginLeft: -8 }}
                >
                  +{teamMembers.length - 4}
                </div>
              )}
            </div>
          )}
          <button
            type="button"
            onClick={() => router.push("/cloud/dashboard/team")}
            className="cloud-btn-ink mt-auto h-[38px] w-full"
          >
            Manage team
            <ArrowRight size={13} strokeWidth={2.5} />
          </button>
        </div>

        <div className="cloud-card flex flex-col p-5">
          <div className="mb-4 flex items-center justify-between">
            <p className="cloud-section-label mb-0">Activity</p>
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[var(--cloud-surface-muted)]">
              <Activity size={15} className="text-[var(--cloud-text-secondary)]" />
            </div>
          </div>
          <div className="mb-5 flex flex-1 flex-col gap-3">
            {recentActivity.length > 0 ? recentActivity.map((item, i) => (
              <div key={i} className="flex items-start gap-3">
                <div
                  className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full"
                  style={{ background: i === 0 ? "var(--cloud-accent)" : "var(--cloud-text-disabled)" }}
                />
                <div className="min-w-0">
                  <p className="truncate text-[13px] font-semibold text-[var(--cloud-text-primary)]">
                    {item.message}
                  </p>
                  <p className="text-[11px] text-[var(--cloud-text-tertiary)]">{item.meta}</p>
                </div>
              </div>
            )) : (
              <p className="text-[13px] text-[var(--cloud-text-secondary)]">
                No activity yet. Upload photos to get started.
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={() => router.push("/cloud/dashboard/notifications")}
            className="cloud-btn-ghost mt-auto h-[38px] w-full"
          >
            View activity
            <ArrowRight size={13} strokeWidth={2.5} />
          </button>
        </div>
      </div>

      {/* Public profile */}
      <div className="cloud-card mt-3 flex items-center gap-3 p-4">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[var(--cloud-surface-muted)]">
          <Globe size={20} className="text-[var(--cloud-text-primary)]" strokeWidth={1.6} />
        </div>
        <div className="min-w-0 flex-1">
          <p className="font-cloud-display text-[16px] text-[var(--cloud-text-primary)]">
            Your public profile
          </p>
          <p className="truncate text-[12px] text-[var(--cloud-text-tertiary)]">
            Share projects with clients from one link
          </p>
        </div>
        <button
          type="button"
          onClick={() => router.push("/cloud/dashboard/settings")}
          className="cloud-btn-ghost h-9 shrink-0 px-3 text-[12px]"
        >
          Manage
          <ExternalLink size={12} strokeWidth={2} />
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
    </CloudPage>
  );
}
