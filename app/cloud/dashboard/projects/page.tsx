"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { Plus, Star, MoreVertical, Search, Copy, Trash2, Edit2 } from "lucide-react";
import { NewProjectSlideOver } from "./NewProjectSlideOver";
import { SkeletonPhotoGrid, SkeletonProjectsToolbar } from "@/app/cloud/components/SkeletonCard";
import ProjectSceneIllustration from "@/app/cloud/components/ProjectSceneIllustration";
import { buildProjectShareUrl } from "@/app/cloud/lib/project-share-url";
import { CloudPage } from "@/app/cloud/components/CloudPage";
import {
  CloudProjectFolderCard,
  CloudProjectFolderNewCard,
  CLOUD_PROJECT_FOLDER_GRID,
} from "@/app/cloud/components/CloudProjectFolderCard";

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
  const [loading, setLoading] = useState(true);
  const [sortKey, setSortKey] = useState<SortKey>("newest");
  const [search, setSearch] = useState("");
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [showNew, setShowNew] = useState(false);
  const [menuOpen, setMenuOpen] = useState<string | null>(null);
  const [toastMsg, setToastMsg] = useState("");
  const [fetchError, setFetchError] = useState("");
  const [profileSlug, setProfileSlug] = useState<string | null>(null);

  const fetchProjects = useCallback(() => {
    if (!session?.clientId) {
      if (status !== "loading") setLoading(false);
      return;
    }
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
  }, [session?.clientId, status]);

  useEffect(() => {
    if (status === "loading") return;
    fetchProjects();
  }, [status, fetchProjects]);

  useEffect(() => {
    if (!session?.clientId) return;
    fetch(`/api/clients/${session.clientId}/profile`)
      .then((r) => r.json())
      .then((data: { slug?: string | null; is_published?: boolean | null }) => {
        if (data?.slug && data.is_published) setProfileSlug(data.slug);
      })
      .catch(() => {});
  }, [session?.clientId]);

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
    setMenuOpen(null);
    const res = await fetch(`/api/clients/${session!.clientId!}/projects/${p.id}`, { method: "DELETE" });
    if (!res.ok) {
      const body = await res.json().catch(() => null) as { error?: string } | null;
      showToast(body?.error || "Could not delete project");
      return;
    }
    setProjects((prev) => prev.filter((x) => x.id !== p.id));
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
        <SkeletonProjectsToolbar />
        <SkeletonPhotoGrid />
      </CloudPage>
    );
  }

  return (
    <CloudPage>
      <div className="cloud-toolbar mb-5">
        <div className="cloud-toolbar-search">
          <Search
            className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--cloud-text-tertiary)]"
            strokeWidth={1.8}
          />
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search projects…"
            className="cloud-input"
            aria-label="Search projects"
          />
        </div>
        <div className="cloud-toolbar-actions">
          <select
            value={sortKey}
            onChange={(e) => setSortKey(e.target.value as SortKey)}
            className="cloud-select"
            aria-label="Sort projects"
          >
            <option value="newest">Newest first</option>
            <option value="oldest">Oldest first</option>
            <option value="most_photos">Most photos</option>
            <option value="alpha">Alphabetical</option>
          </select>
          <button type="button" onClick={() => setShowNew(true)} className="cloud-btn-primary">
            <Plus className="h-3.5 w-3.5 shrink-0" strokeWidth={2.2} />
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
        <div className={CLOUD_PROJECT_FOLDER_GRID}>
          {filtered.map((p) => (
            <CloudProjectFolderCard
              key={p.id}
              project={p}
              href={`/cloud/dashboard/projects/${p.id}`}
              menu={
                <div className={`relative ${menuOpen === p.id ? "z-30" : ""}`}>
                  <button
                    type="button"
                    onClick={() => setMenuOpen(menuOpen === p.id ? null : p.id)}
                    className="cloud-icon-btn !h-8 !w-8 bg-white/90 shadow-sm backdrop-blur-sm"
                    aria-label="Project actions"
                  >
                    <MoreVertical className="h-4 w-4" />
                  </button>
                  {menuOpen === p.id && (
                    <>
                      <div className="fixed inset-0 z-10" onClick={() => setMenuOpen(null)} />
                      <div className="absolute right-0 top-9 z-20 w-44 rounded-xl border border-[var(--cloud-border)] bg-white py-1.5 shadow-[var(--cloud-shadow-elevated)]">
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
                    </>
                  )}
                </div>
              }
            />
          ))}

          <CloudProjectFolderNewCard onClick={() => setShowNew(true)} />
        </div>
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
