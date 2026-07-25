"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { Activity, ArrowRight, Camera, FolderOpen } from "lucide-react";
import { CloudPage } from "@/app/cloud/components/CloudPage";
import { SkeletonListRows } from "@/app/cloud/components/SkeletonCard";

type MediaItem = { public_url: string; display_order: number };
type Project = {
  id: string;
  title: string;
  category: string | null;
  updated_at: string;
  project_media: MediaItem[];
};

function formatRelativeTime(dateStr: string): string {
  if (!dateStr) return "recently";
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 2) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(dateStr).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export default function CloudActivityPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchProjects = useCallback(() => {
    if (!session?.clientId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    fetch(`/api/clients/${session.clientId}/projects`)
      .then((r) => r.json())
      .then((data: unknown) => {
        if (!Array.isArray(data)) return;
        const sorted = [...(data as Project[])].sort(
          (a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()
        );
        setProjects(sorted);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [session?.clientId]);

  useEffect(() => {
    if (status === "authenticated") fetchProjects();
  }, [status, fetchProjects]);

  return (
    <CloudPage>
      <div className="mb-6">
        <p className="cloud-section-label">Workspace</p>
        <h1 className="font-cloud-display text-[clamp(26px,4vw,34px)] leading-[1.1] tracking-[-0.02em] text-[var(--cloud-text-primary)]">
          Activity
        </h1>
        <p className="mt-2 max-w-xl text-[13px] text-[var(--cloud-text-secondary)]">
          Recent project updates across your workspace.
        </p>
      </div>

      {status === "loading" || loading ? (
        <SkeletonListRows count={6} />
      ) : projects.length === 0 ? (
        <div className="cloud-card flex flex-col items-center px-6 py-14 text-center">
          <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-[var(--cloud-surface-muted)]">
            <Activity className="h-6 w-6 text-[var(--cloud-text-secondary)]" strokeWidth={1.6} />
          </div>
          <p className="font-cloud-display text-[20px] text-[var(--cloud-text-primary)]">
            No activity yet
          </p>
          <p className="mt-2 max-w-[280px] text-[13px] text-[var(--cloud-text-secondary)]">
            Create a project and upload photos — updates will show up here.
          </p>
          <button
            type="button"
            onClick={() => router.push("/cloud/dashboard/projects")}
            className="cloud-btn-primary mt-6"
          >
            <FolderOpen className="h-3.5 w-3.5" strokeWidth={2.2} />
            Go to projects
          </button>
        </div>
      ) : (
        <div className="space-y-2">
          {projects.map((p, i) => {
            const photoCount = p.project_media?.length ?? 0;
            return (
              <button
                key={p.id}
                type="button"
                onClick={() => router.push(`/cloud/dashboard/projects/${p.id}`)}
                className="cloud-card flex w-full items-start gap-3 px-4 py-4 text-left transition-transform hover:-translate-y-0.5"
              >
                <div
                  className="mt-1.5 h-2 w-2 shrink-0 rounded-full"
                  style={{
                    background: i === 0 ? "var(--cloud-accent)" : "var(--cloud-text-disabled)",
                    boxShadow: i === 0 ? "0 0 0 3px var(--cloud-accent-muted)" : undefined,
                  }}
                />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[14px] font-semibold tracking-[-0.01em] text-[var(--cloud-text-primary)]">
                    Updated {p.title}
                  </p>
                  <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[12px] text-[var(--cloud-text-tertiary)]">
                    <span className="inline-flex items-center gap-1">
                      <Camera className="h-3 w-3" strokeWidth={1.8} />
                      {photoCount} photo{photoCount !== 1 ? "s" : ""}
                    </span>
                    {p.category ? (
                      <>
                        <span aria-hidden>·</span>
                        <span>{p.category}</span>
                      </>
                    ) : null}
                    <span aria-hidden>·</span>
                    <span>{formatRelativeTime(p.updated_at)}</span>
                  </div>
                </div>
                <ArrowRight className="mt-1 h-4 w-4 shrink-0 text-[var(--cloud-text-tertiary)]" strokeWidth={1.8} />
              </button>
            );
          })}
        </div>
      )}
    </CloudPage>
  );
}
