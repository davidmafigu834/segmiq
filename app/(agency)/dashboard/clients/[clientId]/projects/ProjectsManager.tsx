"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { Plus, MoreHorizontal, Camera, Star, Share2, Trash2, Pencil } from "lucide-react";

type ProjectMedia = { id: string; public_url: string; display_order: number };
type Project = {
  id: string;
  title: string;
  category: string | null;
  location: string | null;
  completion_date: string | null;
  is_featured: boolean;
  is_public: boolean;
  slug: string;
  display_order: number;
  project_media: ProjectMedia[];
};

const CATEGORIES = ["Construction", "Solar", "Renovation", "Fencing", "Electrical", "Plumbing", "Landscaping", "Other"];

export function ProjectsManager({
  clientId,
  clientName,
  initialProjects,
}: {
  clientId: string;
  clientName: string;
  initialProjects: Project[];
}) {
  const router = useRouter();
  const [projects, setProjects] = useState<Project[]>(initialProjects);
  const [slideoverOpen, setSlideoverOpen] = useState(false);
  const [menuOpenId, setMenuOpenId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);
  const [form, setForm] = useState({
    title: "",
    category: "",
    location: "",
    completion_date: "",
    description: "",
    is_featured: false,
    is_public: true,
  });
  const menuRef = useRef<HTMLDivElement | null>(null);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!form.title.trim()) return;
    setCreating(true);
    try {
      const res = await fetch(`/api/clients/${clientId}/projects`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      if (res.ok) {
        const newProject = await res.json() as Project;
        setSlideoverOpen(false);
        setForm({ title: "", category: "", location: "", completion_date: "", description: "", is_featured: false, is_public: true });
        router.push(`/dashboard/clients/${clientId}/projects/${newProject.id}`);
      }
    } finally {
      setCreating(false);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("Delete this project and all its photos?")) return;
    const res = await fetch(`/api/clients/${clientId}/projects/${id}`, { method: "DELETE" });
    if (!res.ok) {
      const body = await res.json().catch(() => null) as { error?: string } | null;
      alert(body?.error || "Could not delete project");
      return;
    }
    setProjects((p) => p.filter((x) => x.id !== id));
    setMenuOpenId(null);
  }

  async function handleToggleFeatured(project: Project) {
    const res = await fetch(`/api/clients/${clientId}/projects/${project.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ is_featured: !project.is_featured }),
    });
    if (res.ok) {
      const updated = await res.json() as Project;
      setProjects((p) => p.map((x) => (x.id === project.id ? { ...x, is_featured: updated.is_featured } : x)));
    }
    setMenuOpenId(null);
  }

  function handleShare(project: Project) {
    const shareUrl = `${window.location.origin}/share/projects/${project.slug}`;
    void navigator.clipboard.writeText(shareUrl).then(() => {
      setCopied(project.id);
      setTimeout(() => setCopied(null), 2000);
    });
    setMenuOpenId(null);
  }

  return (
    <div>
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h2 className="font-display text-2xl tracking-display text-ink-primary">Projects</h2>
          <p className="mt-1 text-sm text-ink-secondary">{clientName}</p>
        </div>
        <button
          type="button"
          onClick={() => setSlideoverOpen(true)}
          className="btn-primary flex items-center gap-2 px-4 py-2 text-sm font-medium"
        >
          <Plus className="h-4 w-4" strokeWidth={1.5} />
          New Project
        </button>
      </div>

      {projects.length === 0 ? (
        <div className="flex min-h-[400px] flex-col items-center justify-center gap-4 rounded-xl border border-dashed border-border px-8 py-16 text-center">
          <Camera className="h-12 w-12 text-ink-tertiary" strokeWidth={1.25} />
          <div>
            <p className="text-lg font-medium text-ink-primary">No projects yet</p>
            <p className="mt-1 text-sm text-ink-secondary">Add your first project to showcase your work</p>
          </div>
          <button
            type="button"
            onClick={() => setSlideoverOpen(true)}
            className="btn-primary mt-2 flex items-center gap-2 px-4 py-2 text-sm font-medium"
          >
            <Plus className="h-4 w-4" strokeWidth={1.5} />
            New Project
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {projects.map((project) => {
            const sortedMedia = [...project.project_media].sort((a, b) => a.display_order - b.display_order);
            const coverUrl = sortedMedia[0]?.public_url;
            return (
              <div key={project.id} className="group relative overflow-hidden rounded-xl border border-border bg-surface-card transition-shadow hover:shadow-md">
                <a href={`/dashboard/clients/${clientId}/projects/${project.id}`} className="block">
                  <div className="relative aspect-[4/3] overflow-hidden bg-surface-card-alt">
                    {coverUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={coverUrl} alt={project.title} className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105" />
                    ) : (
                      <div className="flex h-full items-center justify-center text-ink-tertiary">
                        <Camera className="h-12 w-12" strokeWidth={1} />
                      </div>
                    )}
                    {project.is_featured && (
                      <span className="absolute left-3 top-3 flex items-center gap-1 rounded-full bg-[var(--accent)] px-2 py-0.5 text-[11px] font-semibold text-[var(--accent-ink)]">
                        <Star className="h-2.5 w-2.5 fill-current" />
                        Featured
                      </span>
                    )}
                  </div>
                  <div className="p-4">
                    <p className="font-semibold text-ink-primary">{project.title}</p>
                    <div className="mt-1 flex flex-wrap items-center gap-2">
                      {project.category && (
                        <span className="rounded-sm bg-surface-card-alt px-2 py-0.5 font-mono text-[10px] uppercase tracking-wide text-ink-tertiary">
                          {project.category}
                        </span>
                      )}
                    </div>
                    <div className="mt-1.5 text-xs text-ink-tertiary">
                      {project.location && <span>{project.location}</span>}
                      {project.location && project.completion_date && <span> · </span>}
                      {project.completion_date && (
                        <span>{new Date(project.completion_date).toLocaleDateString("en-US", { month: "short", year: "numeric" })}</span>
                      )}
                    </div>
                  </div>
                </a>

                <div className="absolute right-3 top-[calc(56%+0.75rem)]" ref={menuOpenId === project.id ? menuRef : undefined}>
                  <button
                    type="button"
                    onClick={(e) => { e.preventDefault(); setMenuOpenId(menuOpenId === project.id ? null : project.id); }}
                    className="flex h-7 w-7 items-center justify-center rounded-md bg-surface-card text-ink-secondary shadow-sm hover:bg-surface-card-alt"
                  >
                    <MoreHorizontal className="h-4 w-4" strokeWidth={1.5} />
                  </button>
                  {menuOpenId === project.id && (
                    <div className="absolute right-0 top-8 z-30 min-w-[160px] overflow-hidden rounded-lg border border-border bg-surface-card shadow-lg">
                      <button
                        type="button"
                        onClick={() => router.push(`/dashboard/clients/${clientId}/projects/${project.id}`)}
                        className="flex w-full items-center gap-2 px-3 py-2 text-sm text-ink-primary hover:bg-surface-card-alt"
                      >
                        <Pencil className="h-3.5 w-3.5" strokeWidth={1.5} /> Edit
                      </button>
                      <button
                        type="button"
                        onClick={() => handleShare(project)}
                        className="flex w-full items-center gap-2 px-3 py-2 text-sm text-ink-primary hover:bg-surface-card-alt"
                      >
                        <Share2 className="h-3.5 w-3.5" strokeWidth={1.5} />
                        {copied === project.id ? "Copied!" : "Share link"}
                      </button>
                      <button
                        type="button"
                        onClick={() => handleToggleFeatured(project)}
                        className="flex w-full items-center gap-2 px-3 py-2 text-sm text-ink-primary hover:bg-surface-card-alt"
                      >
                        <Star className="h-3.5 w-3.5" strokeWidth={1.5} />
                        {project.is_featured ? "Unfeature" : "Feature"}
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDelete(project.id)}
                        className="flex w-full items-center gap-2 px-3 py-2 text-sm text-red-500 hover:bg-surface-card-alt"
                      >
                        <Trash2 className="h-3.5 w-3.5" strokeWidth={1.5} /> Delete
                      </button>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {slideoverOpen && (
        <>
          <div className="fixed inset-0 z-40 bg-black/40" onClick={() => setSlideoverOpen(false)} />
          <div className="fixed inset-y-0 right-0 z-50 flex w-full max-w-md flex-col bg-surface-canvas shadow-2xl">
            <div className="flex shrink-0 items-center justify-between border-b border-border px-6 py-4">
              <h3 className="font-display text-lg tracking-display text-ink-primary">New Project</h3>
              <button type="button" onClick={() => setSlideoverOpen(false)} className="text-ink-secondary hover:text-ink-primary text-2xl leading-none">&times;</button>
            </div>
            <form onSubmit={handleCreate} className="flex flex-1 flex-col gap-5 overflow-y-auto px-6 py-6">
              <div>
                <label className="mb-1.5 block text-sm font-medium text-ink-primary">Title <span className="text-red-500">*</span></label>
                <input
                  type="text"
                  value={form.title}
                  onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                  placeholder="e.g. Northside Solar Installation"
                  className="w-full rounded-lg border border-border bg-surface-card px-4 py-2.5 text-sm focus:border-[var(--accent)] focus:outline-none"
                  required
                />
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium text-ink-primary">Category</label>
                <select
                  value={form.category}
                  onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))}
                  className="w-full rounded-lg border border-border bg-surface-card px-4 py-2.5 text-sm focus:border-[var(--accent)] focus:outline-none"
                >
                  <option value="">Select category…</option>
                  {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-ink-primary">Location</label>
                  <input
                    type="text"
                    value={form.location}
                    onChange={(e) => setForm((f) => ({ ...f, location: e.target.value }))}
                    placeholder="e.g. Harare"
                    className="w-full rounded-lg border border-border bg-surface-card px-4 py-2.5 text-sm focus:border-[var(--accent)] focus:outline-none"
                  />
                </div>
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-ink-primary">Completion date</label>
                  <input
                    type="date"
                    value={form.completion_date}
                    onChange={(e) => setForm((f) => ({ ...f, completion_date: e.target.value }))}
                    className="w-full rounded-lg border border-border bg-surface-card px-4 py-2.5 text-sm focus:border-[var(--accent)] focus:outline-none"
                  />
                </div>
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium text-ink-primary">Description</label>
                <textarea
                  rows={3}
                  value={form.description}
                  onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                  placeholder="Brief overview of the project…"
                  className="w-full resize-none rounded-lg border border-border bg-surface-card px-4 py-2.5 text-sm focus:border-[var(--accent)] focus:outline-none"
                />
              </div>
              <div className="flex items-center gap-6">
                <label className="flex cursor-pointer items-center gap-2 text-sm text-ink-primary">
                  <input
                    type="checkbox"
                    checked={form.is_featured}
                    onChange={(e) => setForm((f) => ({ ...f, is_featured: e.target.checked }))}
                    className="h-4 w-4 rounded accent-[var(--accent)]"
                  />
                  Featured
                </label>
                <label className="flex cursor-pointer items-center gap-2 text-sm text-ink-primary">
                  <input
                    type="checkbox"
                    checked={form.is_public}
                    onChange={(e) => setForm((f) => ({ ...f, is_public: e.target.checked }))}
                    className="h-4 w-4 rounded accent-[var(--accent)]"
                  />
                  Public
                </label>
              </div>
              <div className="mt-auto pt-4">
                <button
                  type="submit"
                  disabled={creating || !form.title.trim()}
                  className="btn-primary w-full py-3 text-sm font-medium disabled:opacity-60"
                >
                  {creating ? "Creating…" : "Create & Add Photos →"}
                </button>
              </div>
            </form>
          </div>
        </>
      )}
    </div>
  );
}
