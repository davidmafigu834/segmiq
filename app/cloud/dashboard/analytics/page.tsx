"use client";

import { useCallback, useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { CloudAdminGate } from "@/app/cloud/components/CloudAdminGate";
import { CloudPage } from "@/app/cloud/components/CloudPage";
import { Folder, Camera, Link2 } from "lucide-react";

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
    <div className="flex items-center gap-3 border-b border-[var(--cloud-border)] py-3 last:border-b-0">
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[var(--cloud-surface-muted)]">
        <Folder size={18} className="text-[var(--cloud-text-secondary)]" strokeWidth={1.6} />
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-[14px] font-semibold text-[var(--cloud-text-primary)]">{project.title}</p>
        <p className="truncate text-[12px] text-[var(--cloud-text-tertiary)]">
          {shareUrl.replace("https://", "")}
        </p>
      </div>
      <div className="shrink-0 text-right">
        <p className="text-[13px] font-semibold text-[var(--cloud-text-secondary)]">
          {photoCount} photo{photoCount !== 1 ? "s" : ""}
        </p>
        <p className="text-[11px] text-[var(--cloud-text-tertiary)]">{formatDate(project.updated_at)}</p>
      </div>
      <button
        type="button"
        onClick={copy}
        className={`h-9 shrink-0 rounded-[9px] px-3.5 text-[13px] font-semibold transition-colors ${
          copied
            ? "bg-[var(--cloud-accent)] text-[var(--cloud-ink)]"
            : "bg-[var(--cloud-surface-muted)] text-[var(--cloud-text-secondary)]"
        }`}
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
      <CloudPage className="flex min-h-[60vh] items-center justify-center">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-black/10 border-t-[var(--cloud-ink)]" />
      </CloudPage>
    );
  }

  const totalPhotos = projects.reduce((n, p) => n + (p.project_media?.length ?? 0), 0);

  const categoryMap = new Map<string, number>();
  projects.forEach((p) => {
    const cat = p.category || "Other";
    categoryMap.set(cat, (categoryMap.get(cat) ?? 0) + 1);
  });
  const categories = Array.from(categoryMap.entries()).sort((a, b) => b[1] - a[1]);
  const maxCatCount = categories[0]?.[1] ?? 1;

  const stats = [
    { label: "Projects", value: String(projects.length), Icon: Folder },
    { label: "Photos", value: String(totalPhotos), Icon: Camera },
    { label: "Shared links", value: String(projects.length), Icon: Link2 },
  ];

  return (
    <CloudAdminGate>
    <CloudPage>
      <div className="grid grid-cols-3 gap-3">
        {stats.map((s) => (
          <div key={s.label} className="cloud-card p-4">
            <div className="mb-3 flex h-8 w-8 items-center justify-center rounded-lg bg-[var(--cloud-surface-muted)]">
              <s.Icon size={16} className="text-[var(--cloud-text-secondary)]" strokeWidth={1.8} />
            </div>
            <p className="font-cloud-display text-[24px] leading-none text-[var(--cloud-text-primary)]">
              {s.value}
            </p>
            <p className="mt-1 text-[11px] text-[var(--cloud-text-tertiary)]">{s.label}</p>
          </div>
        ))}
      </div>

      <div className="mt-6">
        <div className="mb-3 flex items-center justify-between">
          <p className="cloud-section-label mb-0">Shared project links</p>
          {projects.length > 0 && (
            <span className="text-[12px] text-[var(--cloud-text-tertiary)]">{projects.length} total</span>
          )}
        </div>
        <div className="cloud-card px-4">
          {projects.length === 0 ? (
            <div className="py-10 text-center">
              <p className="text-[14px] text-[var(--cloud-text-secondary)]">No projects yet</p>
            </div>
          ) : (
            projects.map((p) => <ShareRow key={p.id} project={p} origin={origin} />)
          )}
        </div>
      </div>

      {categories.length > 0 && (
        <div className="mt-6">
          <p className="cloud-section-label">Projects by category</p>
          <div className="cloud-card space-y-3.5 p-4">
            {categories.map(([cat, count]) => {
              const pct = Math.round((count / projects.length) * 100);
              return (
                <div key={cat}>
                  <div className="mb-1.5 flex items-center justify-between">
                    <span className="text-[14px] font-semibold text-[var(--cloud-text-primary)]">{cat}</span>
                    <span className="text-[12px] text-[var(--cloud-text-tertiary)]">
                      {count} · {pct}%
                    </span>
                  </div>
                  <div className="h-1.5 overflow-hidden rounded-full bg-[var(--cloud-surface-muted)]">
                    <div
                      className="h-full rounded-full bg-[var(--cloud-ink)]"
                      style={{ width: `${Math.round((count / maxCatCount) * 100)}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {projects.length > 0 && (
        <div className="mt-6">
          <p className="cloud-section-label">Top projects by photos</p>
          <div className="cloud-card space-y-3 p-4">
            {[...projects]
              .sort((a, b) => (b.project_media?.length ?? 0) - (a.project_media?.length ?? 0))
              .slice(0, 5)
              .map((p, i) => {
                const count = p.project_media?.length ?? 0;
                const maxCount = projects.reduce((m, x) => Math.max(m, x.project_media?.length ?? 0), 1);
                return (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => router.push(`/cloud/dashboard/projects/${p.id}`)}
                    className="flex w-full items-center gap-3 text-left"
                  >
                    <span className="w-5 shrink-0 text-right font-cloud-display text-[18px] text-[var(--cloud-text-tertiary)]">
                      {i + 1}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="mb-1 flex items-center justify-between gap-2">
                        <span className="truncate text-[14px] font-semibold text-[var(--cloud-text-primary)]">
                          {p.title}
                        </span>
                        <span className="shrink-0 text-[13px] text-[var(--cloud-text-tertiary)]">{count}</span>
                      </div>
                      <div className="h-1 overflow-hidden rounded-full bg-[var(--cloud-surface-muted)]">
                        <div
                          className="h-full rounded-full bg-[var(--cloud-accent)]"
                          style={{ width: `${Math.round((count / maxCount) * 100)}%` }}
                        />
                      </div>
                    </div>
                  </button>
                );
              })}
          </div>
        </div>
      )}
    </CloudPage>
    </CloudAdminGate>
  );
}
