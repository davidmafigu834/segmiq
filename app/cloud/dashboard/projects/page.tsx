"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { Plus, Folder, Star, MoreVertical, Search, Copy, Trash2, Edit2, ArrowRight } from "lucide-react";
import { NewProjectSlideOver } from "./NewProjectSlideOver";
import { getProjectCardStyles } from "@/app/cloud/components/ProjectCard";
import ProjectSceneIllustration from "@/app/cloud/components/ProjectSceneIllustration";

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

  const fetchProjects = useCallback(() => {
    if (!session?.clientId) { setLoading(false); return; }
    setLoading(true);
    fetch(`/api/clients/${session.clientId}/projects`)
      .then((r) => r.json())
      .then((data: unknown) => {
        if (Array.isArray(data)) setProjects(data as Project[]);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [session?.clientId]);

  useEffect(() => { fetchProjects(); }, [fetchProjects]);

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
    const url = `${window.location.origin}/cloud/share/${p.id}`;
    void navigator.clipboard.writeText(url);
    showToast("Share link copied!");
    setMenuOpen(null);
  }

  if (status === "loading" || loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center bg-[#F5F5F0]">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-black/10 border-t-[#0a0a0a]" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F5F5F0] font-cloud-body px-5 py-4 lg:px-8">
      {/* Top bar */}
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative flex-1 max-w-sm">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#999990]" strokeWidth={1.8} />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search projects…"
            className="w-full rounded-xl border border-black/[0.08] bg-white py-2.5 pl-9 pr-4 text-[13px] text-[#0a0a0a] placeholder-[#999990] outline-none focus:border-black/[0.2] font-cloud-body"
          />
        </div>
        <div className="flex items-center gap-2">
          <select
            value={sortKey}
            onChange={(e) => setSortKey(e.target.value as SortKey)}
            className="rounded-xl border border-black/[0.08] bg-white px-3 py-2.5 text-[13px] text-[#666660] outline-none font-cloud-body"
          >
            <option value="newest">Newest first</option>
            <option value="oldest">Oldest first</option>
            <option value="most_photos">Most photos</option>
            <option value="alpha">Alphabetical</option>
          </select>
          <button
            onClick={() => setShowNew(true)}
            className="flex items-center gap-1.5 rounded-xl bg-[#D4FF4F] px-4 py-2.5 text-[13px] font-bold text-black transition-colors hover:bg-[#C8F244] font-cloud-body"
          >
            <Plus className="h-3.5 w-3.5" />
            New project
          </button>
        </div>
      </div>

      {/* Category filter pills */}
      {allCategories.length > 0 && (
        <div className="mb-4 flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
          <button
            onClick={() => setActiveCategory(null)}
            className={`flex-shrink-0 rounded-full px-3.5 py-1.5 text-[12px] font-semibold transition-colors font-cloud-body ${
              activeCategory === null
                ? "bg-[#0a0a0a] text-white"
                : "border border-black/[0.08] bg-white text-[#666660] hover:border-black/[0.15]"
            }`}
          >
            All
          </button>
          {allCategories.map((cat) => {
            const s = getProjectCardStyles(cat);
            const isAct = activeCategory === cat;
            return (
              <button
                key={cat}
                onClick={() => setActiveCategory(activeCategory === cat ? null : cat)}
                className={`flex-shrink-0 rounded-full px-3.5 py-1.5 text-[12px] font-semibold transition-colors font-cloud-body border ${
                  isAct ? `${s.gradient} ${s.border} ${s.text}` : "border-black/[0.08] bg-white text-[#666660] hover:border-black/[0.15]"
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
          {search || activeCategory ? (
            <>
              <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-white border border-black/[0.07]">
                <Search className="h-6 w-6 text-[#999990]" strokeWidth={1.5} />
              </div>
              <p className="font-cloud-display text-[18px] text-[#0a0a0a] mb-1">No results</p>
              <p className="text-[13px] text-[#999990] font-cloud-body">No projects match your search.</p>
            </>
          ) : (
            <>
              <ProjectSceneIllustration className="mb-4 opacity-80" width={200} height={148} />
              <p className="font-cloud-display text-[20px] text-[#0a0a0a] mb-2">No projects yet</p>
              <p className="text-[13px] text-[#999990] font-cloud-body mb-6 max-w-[220px]">
                Create your first project, then upload photos straight from your phone.
              </p>
              <button
                onClick={() => setShowNew(true)}
                className="rounded-xl bg-[#D4FF4F] px-5 py-3 text-[14px] font-bold text-black font-cloud-body hover:bg-[#C8F244] transition-colors"
              >
                Create your first project
              </button>
            </>
          )}
        </div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, padding: "0 20px" }}>
          {filtered.map((p) => {
            return (
              <div key={p.id} style={{ minWidth: 0 }}>
                <div style={{ borderRadius: 18, background: "var(--fw-card)", border: "0.5px solid var(--fw-border)", overflow: "hidden", cursor: "pointer", position: "relative" }}>
                  {/* Top row: category badge + three-dot menu */}
                  <div className="flex items-center justify-between px-3.5 pt-3.5 pb-1">
                    {p.category ? (
                      <span className="rounded-full px-2.5 py-0.5 text-[11px] font-semibold font-cloud-body" style={{ background: "var(--fw-sunken)", color: "var(--fw-text-secondary)" }}>
                        {p.category}
                      </span>
                    ) : <span />}
                    {p.is_featured && (
                      <span className="flex items-center gap-1 rounded-full bg-white/60 px-2 py-0.5 text-[11px] font-semibold text-[#5C7A00] font-cloud-body">
                        <Star className="h-2.5 w-2.5" />
                        Featured
                      </span>
                    )}
                    <div className="relative ml-auto">
                      <button
                        onClick={() => setMenuOpen(menuOpen === p.id ? null : p.id)}
                        className="rounded-lg p-1.5 transition-colors"
                        style={{ background: "var(--fw-sunken)" }}
                      >
                        <MoreVertical className="h-4 w-4" style={{ color: "var(--fw-text-secondary)" }} />
                      </button>
                      {menuOpen === p.id && (
                        <div className="absolute right-0 top-8 z-20 w-44 rounded-xl border border-black/[0.08] bg-white py-1.5 shadow-xl">
                          <Link
                            href={`/cloud/dashboard/projects/${p.id}`}
                            className="flex items-center gap-2.5 px-4 py-2 text-[13px] text-[#666660] hover:bg-[#F5F5F0] hover:text-[#0a0a0a]"
                            onClick={() => setMenuOpen(null)}
                          >
                            <Edit2 className="h-3.5 w-3.5" />
                            Edit details
                          </Link>
                          <button
                            onClick={() => copyShareLink(p)}
                            className="flex w-full items-center gap-2.5 px-4 py-2 text-[13px] text-[#666660] hover:bg-[#F5F5F0] hover:text-[#0a0a0a]"
                          >
                            <Copy className="h-3.5 w-3.5" />
                            Copy share link
                          </button>
                          <button
                            onClick={() => void handleToggleFeatured(p)}
                            className="flex w-full items-center gap-2.5 px-4 py-2 text-[13px] text-[#666660] hover:bg-[#F5F5F0] hover:text-[#0a0a0a]"
                          >
                            <Star className="h-3.5 w-3.5" />
                            {p.is_featured ? "Unfeature" : "Set as featured"}
                          </button>
                          <hr className="my-1 border-black/[0.06]" />
                          <button
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

                  {/* Cover photo */}
                  <Link href={`/cloud/dashboard/projects/${p.id}`}>
                    <div className="overflow-hidden" style={{ height: 120, background: "var(--fw-sunken)" }}>
                      {cover(p) ? (
                        /* eslint-disable-next-line @next/next/no-img-element */
                        <img
                          src={cover(p)!}
                          alt={p.title}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="flex h-full items-center justify-center">
                          <Folder className="h-8 w-8" style={{ color: "var(--fw-text-muted)" }} />
                        </div>
                      )}
                    </div>

                    {/* Info */}
                    <div className="px-3.5 py-3">
                      <p className="font-cloud-display text-[15px] leading-tight truncate" style={{ color: "var(--fw-text-primary)" }}>{p.title}</p>
                      <div className="mt-1 flex items-center gap-2 text-[11px] font-cloud-body" style={{ color: "var(--fw-text-tertiary)" }}>
                        {p.location && <span className="truncate">{p.location}</span>}
                        <span className="ml-auto flex items-center gap-1">
                          {p.project_media?.length ?? 0} photos
                          <ArrowRight className="h-3 w-3" />
                        </span>
                      </div>
                    </div>
                  </Link>
                </div>
              </div>
            );
          })}

          {/* New project dashed card */}
          <button
            onClick={() => setShowNew(true)}
            style={{ borderRadius: 18, border: "1.5px dashed rgba(28,20,16,0.14)", background: "var(--fw-sunken)", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 8, cursor: "pointer", padding: "24px 12px", gridColumn: "span 2", minHeight: 80, maxHeight: 100, width: "100%" }}
          >
            <Plus className="w-4 h-4" style={{ color: "var(--fw-text-muted)" }} />
            <span className="text-[12px] font-cloud-body" style={{ color: "var(--fw-text-tertiary)" }}>New project</span>
          </button>
        </div>
      )}

      {/* Click outside to close menu */}
      {menuOpen && (
        <div className="fixed inset-0 z-10" onClick={() => setMenuOpen(null)} />
      )}

      {/* Toast */}
      {toastMsg && (
        <div className="fixed bottom-24 left-1/2 z-50 -translate-x-1/2 rounded-full bg-[#0a0a0a]/90 px-5 py-2.5 text-[13px] text-white backdrop-blur-md font-cloud-body lg:bottom-8">
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
    </div>
  );
}
