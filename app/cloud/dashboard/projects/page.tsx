"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { Plus, Folder, Star, MoreVertical, Search, Copy, Trash2, Edit2, ArrowRight } from "lucide-react";
import { NewProjectSlideOver } from "./NewProjectSlideOver";
import { SkeletonPhotoGrid } from "@/app/cloud/components/SkeletonCard";
import ProjectSceneIllustration from "@/app/cloud/components/ProjectSceneIllustration";
import { buildProjectShareUrl } from "@/app/cloud/lib/project-share-url";
import { CloudPage } from "@/app/cloud/components/CloudPage";

type MediaItem = { public_url: string; display_order: number };
type Project = {
  id: string;
  title: string;
  slug: string;
  category: string | null;
  location: string | null;
  is_featured: boolean;
  updated_at: string;
  created_at: string;
  project_media: MediaItem[];
  project_milestones?: { id: string; is_completed: boolean }[];
};

type SortKey = "newest" | "oldest" | "most_photos" | "alpha";

export default function CloudProjectsPage() {
  const { data: session, status } = useSession();
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(false);
  const [sortKey, setSortKey] = useState<SortKey>("newest");
  const [search, setSearch] = useState("");
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [showNew, setShowNew] = useState(false);
  const [menuOpen, setMenuOpen] = useState<string | null>(null);
  const [toastMsg, setToastMsg] = useState("");
  const [fetchError, setFetchError] = useState("");
  const [profileSlug, setProfileSlug] = useState<string | null>(null);

  const fetchProjects = useCallback(() => {
    if (!session?.clientId) { setLoading(false); return; }
    setLoading(true);
    setFetchError("");
    fetch(`/api/clients/${session.clientId}/projects`)
      .then(async (r) => {
        const data = (await r.json()) as Project[] | { error?: string };
        if (!r.ok) {
          setFetchError((data as { error?: string }).error ?? "Could not load projects.");
          setProjects([]);
          return;
        }
        if (Array.isArray(data)) setProjects(data);
        else setProjects([]);
      })
      .catch(() => {
        setFetchError("Could not load projects. Check your connection and try again.");
        setProjects([]);
      })
      .finally(() => setLoading(false));
  }, [session?.clientId]);

  useEffect(() => { fetchProjects(); }, [fetchProjects]);

  useEffect(() => {
    if (!session?.clientId) return;
    fetch(`/api/clients/${session.clientId}/profile`)
      .then((r) => r.json())
      .then((data: { slug?: string | null; is_published?: boolean | null }) => {
        if (data?.slug && data.is_published) setProfileSlug(data.slug);
      })
      .catch(() => {});
  }, [session?.clientId]);

  function cover(p: Project): string | null {
    const sorted = [...(p.project_media ?? [])].sort((a, b) => a.display_order - b.display_order);
    return sorted[0]?.public_url ?? null;
  }

  function sorted(list: Project[]): Project[] {
    return [...list].sort((a, b) => {
      if (sortKey === "newest") return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      if (sortKey === "oldest") return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
      if (sortKey === "most_photos") return (b.project_media?.length ?? 0) - (a.project_media?.length ?? 0);
      return a.title.localeCompare(b.title);
    });
  }

  const allCategories = Array.from(new Set(projects.map((p) => p.category).filter(Boolean))) as string[];

  const filtered = sorted(
    projects.filter((p) => {
      const matchesSearch = p.title.toLowerCase().includes(search.toLowerCase());
      const matchesCategory = !activeCategory || p.category === activeCategory;
      return matchesSearch && matchesCategory;
    })
  );

  function showToast(msg: string) {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(""), 2500);
  }

  async function handleDelete(p: Project) {
    if (!confirm(`Delete "${p.title}"? This cannot be undone.`)) return;
    await fetch(`/api/clients/${session!.clientId!}/projects/${p.id}`, { method: "DELETE" });
    setProjects((prev) => prev.filter((x) => x.id !== p.id));
    setMenuOpen(null);
  }

  async function handleToggleFeatured(p: Project) {
    await fetch(`/api/clients/${session!.clientId!}/projects/${p.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ is_featured: !p.is_featured }),
    });
    setProjects((prev) => prev.map((x) => x.id === p.id ? { ...x, is_featured: !x.is_featured } : x));
    setMenuOpen(null);
  }

  function copyShareLink(p: Project) {
    const url = buildProjectShareUrl(window.location.origin, p.id, profileSlug);
    void navigator.clipboard.writeText(url);
    showToast("Case study link copied!");
    setMenuOpen(null);
  }

  if (status === "loading" || loading) {
    return (
      <CloudPage>
        <div className="mb-4">
          <div
            className="h-11 max-w-sm rounded-[12px]"
            style={{
              background: "linear-gradient(90deg, var(--cloud-surface-muted) 25%, #e4e6eb 50%, var(--cloud-surface-muted) 75%)",
              backgroundSize: "200% 100%",
              animation: "skeleton-shimmer 1.5s infinite",
            }}
          />
        </div>
        <SkeletonPhotoGrid />
      </CloudPage>
    );
  }

  return (
    <CloudPage>
      {/* Top bar */}
      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative max-w-sm flex-1">
          <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--cloud-text-tertiary)]" strokeWidth={1.8} />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search projects…"
            className="cloud-input pl-10"
          />
        </div>
        <div className="flex items-center gap-2">
          <select
            value={sortKey}
            onChange={(e) => setSortKey(e.target.value as SortKey)}
            className="cloud-input w-auto min-w-[120px]"
          >
            <option value="newest">Newest first</option>
            <option value="oldest">Oldest first</option>
            <option value="most_photos">Most photos</option>
            <option value="alpha">Alphabetical</option>
          </select>
          <button type="button" onClick={() => setShowNew(true)} className="cloud-btn-primary">
            <Plus className="h-3.5 w-3.5" />
            New project
          </button>
        </div>
      </div>

      {fetchError && (
        <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-[13px] text-red-700 font-cloud-body">
          {fetchError}
          <button
            type="button"
            onClick={() => fetchProjects()}
            className="ml-3 font-semibold underline"
          >
            Retry
          </button>
        </div>
      )}

      {/* Category filter pills */}
      {allCategories.length > 0 && (
        <div className="cloud-scroll-x mb-4 flex items-center gap-2 py-1">
          <button
            type="button"
            onClick={() => setActiveCategory(null)}
            className={`h-9 shrink-0 rounded-full px-4 text-[12px] font-semibold transition-colors ${
              activeCategory === null
                ? "bg-[var(--cloud-ink)] text-white"
                : "cloud-card text-[var(--cloud-text-secondary)] hover:bg-[var(--cloud-surface-hover)]"
            }`}
          >
            All
          </button>
          {allCategories.map((cat) => {
            const isAct = activeCategory === cat;
            return (
              <button
                key={cat}
                type="button"
                onClick={() => setActiveCategory(activeCategory === cat ? null : cat)}
                className={`h-9 shrink-0 rounded-full px-4 text-[12px] font-semibold transition-colors ${
                  isAct
                    ? "bg-[var(--cloud-ink)] text-white"
                    : "cloud-card text-[var(--cloud-text-secondary)] hover:bg-[var(--cloud-surface-hover)]"
                }`}
              >
                {cat}
              </button>
            );
          })}
        </div>
      )}

      {filtered.length === 0 && !loading ? (
        <div className="flex min-h-[40vh] flex-col items-center justify-center text-center">
          {fetchError ? (
            <>
              <p className="mb-1 font-cloud-display text-[18px] text-[var(--cloud-text-primary)]">Projects unavailable</p>
              <p className="max-w-[280px] text-[13px] text-[var(--cloud-text-secondary)]">{fetchError}</p>
            </>
          ) : search || activeCategory ? (
            <>
              <div className="cloud-card mb-4 flex h-14 w-14 items-center justify-center">
                <Search className="h-6 w-6 text-[var(--cloud-text-secondary)]" strokeWidth={1.5} />
              </div>
              <p className="mb-1 font-cloud-display text-[18px] text-[var(--cloud-text-primary)]">No results</p>
              <p className="text-[13px] text-[var(--cloud-text-secondary)]">No projects match your search.</p>
            </>
          ) : (
            <>
              <ProjectSceneIllustration className="mb-4 opacity-80" width={200} height={148} />
              <p className="mb-2 font-cloud-display text-[20px] text-[var(--cloud-text-primary)]">No projects yet</p>
              <p className="mb-6 max-w-[220px] text-[13px] text-[var(--cloud-text-secondary)]">
                Create your first project, then upload photos straight from your phone.
              </p>
              <button type="button" onClick={() => setShowNew(true)} className="cloud-btn-primary h-11 px-5">
                Create your first project
              </button>
            </>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {filtered.map((p) => {
            return (
              <div key={p.id} className="min-w-0">
                <div className="cloud-card relative overflow-hidden">
                  <div className="flex items-center justify-between gap-1 px-3.5 pb-1 pt-3.5">
                    {p.category ? (
                      <span className="max-w-[60%] truncate rounded-full bg-[var(--cloud-surface-muted)] px-2 py-0.5 text-[10px] font-semibold text-[var(--cloud-text-secondary)]">
                        {p.category}
                      </span>
                    ) : <span className="flex-1" />}
                    <div className="flex flex-shrink-0 items-center gap-1">
                      {p.is_featured && (
                        <Star className="h-3.5 w-3.5 flex-shrink-0 fill-[var(--cloud-accent)] text-[var(--cloud-ink)]" />
                      )}
                      <div className="relative">
                        <button
                          type="button"
                          onClick={() => setMenuOpen(menuOpen === p.id ? null : p.id)}
                          className="rounded-lg bg-[var(--cloud-surface-muted)] p-1.5 transition-colors"
                        >
                          <MoreVertical className="h-4 w-4 text-[var(--cloud-text-secondary)]" />
                        </button>
                        {menuOpen === p.id && (
                          <div className="absolute right-0 top-8 z-20 w-44 rounded-xl border border-[var(--cloud-border)] bg-white py-1.5 shadow-[var(--cloud-shadow-elevated)]">
                            <Link
                              href={`/cloud/dashboard/projects/${p.id}`}
                              className="flex items-center gap-2.5 px-4 py-2 text-[13px] text-[var(--cloud-text-secondary)] hover:bg-[var(--cloud-surface-muted)] hover:text-[var(--cloud-text-primary)]"
                              onClick={() => setMenuOpen(null)}
                            >
                              <Edit2 className="h-3.5 w-3.5" />
                              Edit details
                            </Link>
                            <button
                              type="button"
                              onClick={() => copyShareLink(p)}
                              className="flex w-full items-center gap-2.5 px-4 py-2 text-[13px] text-[var(--cloud-text-secondary)] hover:bg-[var(--cloud-surface-muted)] hover:text-[var(--cloud-text-primary)]"
                            >
                              <Copy className="h-3.5 w-3.5" />
                              Copy share link
                            </button>
                            <button
                              type="button"
                              onClick={() => void handleToggleFeatured(p)}
                              className="flex w-full items-center gap-2.5 px-4 py-2 text-[13px] text-[var(--cloud-text-secondary)] hover:bg-[var(--cloud-surface-muted)] hover:text-[var(--cloud-text-primary)]"
                            >
                              <Star className="h-3.5 w-3.5" />
                              {p.is_featured ? "Unfeature" : "Set as featured"}
                            </button>
                            <hr className="my-1 border-[var(--cloud-border)]" />
                            <button
                              type="button"
                              onClick={() => void handleDelete(p)}
                              className="flex w-full items-center gap-2.5 px-4 py-2 text-[13px] text-red-500 hover:bg-red-50"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                              Delete
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  <Link href={`/cloud/dashboard/projects/${p.id}`}>
                    <div className="aspect-square w-full overflow-hidden bg-[var(--cloud-surface-muted)]">
                      {cover(p) ? (
                        /* eslint-disable-next-line @next/next/no-img-element */
                        <img
                          src={cover(p)!}
                          alt={p.title}
                          loading="eager"
                          decoding="async"
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <div className="flex h-full items-center justify-center">
                          <Folder className="h-8 w-8 text-[var(--cloud-text-disabled)]" />
                        </div>
                      )}
                    </div>

                    <div className="px-3 pb-3.5 pt-2.5">
                      <p className="truncate font-cloud-display text-[15px] leading-tight text-[var(--cloud-text-primary)]">
                        {p.title}
                      </p>
                      <div className="mt-1.5 flex items-center gap-2 text-[11px] text-[var(--cloud-text-secondary)]">
                        {p.location && <span className="truncate">{p.location}</span>}
                        <span className="ml-auto flex items-center gap-1 font-medium">
                          {p.project_media?.length ?? 0} photos
                          <ArrowRight className="h-3 w-3" />
                        </span>
                      </div>
                      {p.project_milestones && p.project_milestones.length > 0 && (() => {
                        const total = p.project_milestones.length;
                        const done = p.project_milestones.filter((m) => m.is_completed).length;
                        const pct = Math.round((done / total) * 100);
                        return (
                          <div className="mt-2.5">
                            <div className="mb-1 flex justify-between">
                              <span className="text-[10px] font-semibold text-[var(--cloud-text-tertiary)]">
                                {done}/{total} milestones
                              </span>
                              <span className="text-[10px] text-[var(--cloud-text-tertiary)]">{pct}%</span>
                            </div>
                            <div className="h-1 overflow-hidden rounded-full bg-[var(--cloud-surface-muted)]">
                              <div
                                className="h-full rounded-full transition-all"
                                style={{
                                  width: `${pct}%`,
                                  background: pct === 100 ? "var(--cloud-accent)" : "var(--cloud-ink)",
                                }}
                              />
                            </div>
                          </div>
                        );
                      })()}
                    </div>
                  </Link>
                </div>
              </div>
            );
          })}

          <button
            type="button"
            onClick={() => setShowNew(true)}
            className="col-span-2 flex min-h-[88px] flex-col items-center justify-center gap-2 rounded-[var(--cloud-radius-lg)] border border-dashed border-[var(--cloud-border-hover)] bg-[var(--cloud-surface-muted)] px-3 py-6 transition-colors hover:bg-[var(--cloud-surface-hover)] sm:col-span-1"
          >
            <Plus className="h-4 w-4 text-[var(--cloud-text-tertiary)]" />
            <span className="text-[12px] font-medium text-[var(--cloud-text-tertiary)]">New project</span>
          </button>
        </div>
      )}

      {menuOpen && (
        <div className="fixed inset-0 z-10" onClick={() => setMenuOpen(null)} />
      )}

      {toastMsg && (
        <div className="fixed bottom-24 left-1/2 z-50 -translate-x-1/2 rounded-full bg-[var(--cloud-ink)]/90 px-5 py-2.5 text-[13px] text-white backdrop-blur-md lg:bottom-8">
          {toastMsg}
        </div>
      )}

      {session?.clientId && (
        <NewProjectSlideOver
          clientId={session.clientId}
          open={showNew}
          onClose={() => setShowNew(false)}
          onCreated={() => { setShowNew(false); fetchProjects(); }}
          redirectOnCreate
        />
      )}
    </CloudPage>
  );
}
