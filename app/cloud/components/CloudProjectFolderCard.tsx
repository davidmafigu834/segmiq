"use client";

import Link from "next/link";
import { Folder, Star, ArrowRight, Camera } from "lucide-react";

export type CloudFolderProject = {
  id: string;
  title: string;
  category: string | null;
  location?: string | null;
  is_featured?: boolean;
  updated_at?: string;
  project_media?: { public_url: string; display_order: number }[];
  project_milestones?: { id: string; is_completed: boolean }[];
};

type CloudProjectFolderCardProps = {
  project: CloudFolderProject;
  href: string;
  menu?: React.ReactNode;
  showOpenHint?: boolean;
  relativeTime?: string;
};

function coverUrl(project: CloudFolderProject): string | null {
  const sorted = [...(project.project_media ?? [])].sort(
    (a, b) => a.display_order - b.display_order
  );
  return sorted[0]?.public_url ?? null;
}

function photoCount(project: CloudFolderProject): number {
  return project.project_media?.length ?? 0;
}

export function CloudProjectFolderCard({
  project,
  href,
  menu,
  showOpenHint = false,
  relativeTime,
}: CloudProjectFolderCardProps) {
  const cover = coverUrl(project);
  const count = photoCount(project);
  const milestones = project.project_milestones ?? [];
  const done = milestones.filter((m) => m.is_completed).length;
  const milestonePct = milestones.length
    ? Math.round((done / milestones.length) * 100)
    : null;

  return (
    <article className="cloud-folder-card group min-w-0">
      <div className="cloud-folder-tab-row">
        <div className="cloud-folder-tab">
          <span className="max-w-[72px] truncate text-[9px] font-semibold uppercase tracking-[0.04em] text-[var(--cloud-text-secondary)] sm:max-w-[88px] sm:text-[10px]">
            {project.category || "Project"}
          </span>
        </div>
        <div className="cloud-folder-tab-actions">
          {project.is_featured && (
            <Star
              className="h-3.5 w-3.5 fill-[var(--cloud-accent)] text-[var(--cloud-ink)]"
              aria-label="Featured project"
            />
          )}
          {menu}
        </div>
      </div>

      <Link href={href} className="cloud-folder-body block transition-transform group-hover:-translate-y-0.5">
        <div className="cloud-folder-preview relative overflow-hidden bg-[var(--cloud-surface-muted)]">
          {cover ? (
            <>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={cover}
                alt={project.title}
                loading="lazy"
                decoding="async"
                className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-[var(--cloud-ink)]/20 to-transparent" />
            </>
          ) : (
            <div className="flex h-full flex-col items-center justify-center gap-1.5">
              <Folder
                className="h-7 w-7 text-[var(--cloud-text-disabled)] sm:h-8 sm:w-8"
                strokeWidth={1.4}
              />
              <span className="text-[9px] font-semibold uppercase tracking-wide text-[var(--cloud-text-tertiary)] sm:text-[10px]">
                Empty folder
              </span>
            </div>
          )}

          <span className="cloud-folder-photo-badge">
            <Camera className="h-2.5 w-2.5" strokeWidth={2.2} />
            {count}
          </span>
        </div>

        <div className="cloud-folder-meta">
          <p className="truncate font-cloud-display text-[13px] leading-tight text-[var(--cloud-text-primary)] sm:text-[15px]">
            {project.title}
          </p>

          {milestonePct !== null ? (
            <div className="mt-2">
              <div className="mb-1 flex justify-between">
                <span className="text-[9px] font-semibold text-[var(--cloud-text-tertiary)] sm:text-[10px]">
                  {done}/{milestones.length} milestones
                </span>
                <span className="text-[9px] text-[var(--cloud-text-tertiary)] sm:text-[10px]">
                  {milestonePct}%
                </span>
              </div>
              <div className="h-1 overflow-hidden rounded-full bg-[var(--cloud-surface-muted)]">
                <div
                  className="h-full rounded-full transition-all"
                  style={{
                    width: `${milestonePct}%`,
                    background:
                      milestonePct === 100 ? "var(--cloud-accent)" : "var(--cloud-ink)",
                  }}
                />
              </div>
            </div>
          ) : (
            <div className="mt-1.5 flex items-center gap-1.5 text-[10px] text-[var(--cloud-text-secondary)] sm:text-[11px]">
              {project.location && (
                <span className="min-w-0 truncate">{project.location}</span>
              )}
              {relativeTime && (
                <>
                  {project.location && (
                    <span className="text-[var(--cloud-text-disabled)]">·</span>
                  )}
                  <span className="shrink-0">{relativeTime}</span>
                </>
              )}
              {!project.location && !relativeTime && (
                <span className="flex items-center gap-1 font-medium">
                  {count} photo{count !== 1 ? "s" : ""}
                  <ArrowRight className="h-3 w-3" />
                </span>
              )}
            </div>
          )}

          {showOpenHint && (
            <div className="mt-2.5 flex items-center justify-between">
              <span className="text-[10px] font-semibold text-[var(--cloud-text-secondary)] sm:text-[11px]">
                Open project
              </span>
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-[var(--cloud-surface-muted)] transition-colors group-hover:bg-[var(--cloud-ink)] sm:h-7 sm:w-7">
                <ArrowRight
                  size={12}
                  className="text-[var(--cloud-text-secondary)] transition-colors group-hover:text-[var(--cloud-accent)]"
                />
              </span>
            </div>
          )}
        </div>
      </Link>
    </article>
  );
}

export function CloudProjectFolderNewCard({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="cloud-folder-card cloud-folder-card--new group min-w-0 text-left"
    >
      <div className="cloud-folder-tab-row">
        <div className="cloud-folder-tab cloud-folder-tab--new">
          <span className="text-[9px] font-bold uppercase tracking-[0.04em] text-[var(--cloud-text-tertiary)] sm:text-[10px]">
            New
          </span>
        </div>
      </div>
      <div className="cloud-folder-body cloud-folder-body--new flex min-h-[140px] flex-col items-center justify-center gap-2 px-3 py-6 sm:min-h-[160px]">
        <span className="flex h-10 w-10 items-center justify-center rounded-full border border-dashed border-[var(--cloud-border-hover)] bg-[var(--cloud-surface-muted)] transition-colors group-hover:border-[var(--cloud-ink)] group-hover:bg-[var(--cloud-surface-hover)]">
          <Folder className="h-4 w-4 text-[var(--cloud-text-tertiary)] group-hover:text-[var(--cloud-text-secondary)]" />
        </span>
        <span className="text-[11px] font-medium text-[var(--cloud-text-tertiary)] group-hover:text-[var(--cloud-text-secondary)] sm:text-[12px]">
          New project
        </span>
      </div>
    </button>
  );
}

export const CLOUD_PROJECT_FOLDER_GRID =
  "grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4";
