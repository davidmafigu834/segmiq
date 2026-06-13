"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ExternalLink, Loader2, Pencil, Plus, Search, Star, Trash2 } from "lucide-react";
import { CATEGORY_LABELS, FILTERS, type PostCategory } from "@/lib/blog-types";
import { SITE } from "@/lib/seo";
import type { BlogPostRow } from "@/lib/blog-admin";

const inputCls =
  "w-full rounded-xl border border-[var(--border)] bg-[var(--bg-secondary)] px-3 py-2.5 text-[13px] text-[var(--text-primary)] outline-none focus:border-[var(--accent)] transition-colors";

function StatusBadge({ status }: { status: string }) {
  if (status === "published") {
    return (
      <span className="inline-flex rounded-full px-2.5 py-0.5 text-[11px] font-bold" style={{ background: "rgba(46,125,94,0.12)", color: "#2E7D5E" }}>
        Published
      </span>
    );
  }
  return (
    <span className="inline-flex rounded-full px-2.5 py-0.5 text-[11px] font-bold" style={{ background: "rgba(0,0,0,0.06)", color: "#999990" }}>
      Draft
    </span>
  );
}

function formatDate(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

export function BlogManager({ initialPosts }: { initialPosts: BlogPostRow[] }) {
  const router = useRouter();
  const [posts, setPosts] = useState(initialPosts);
  const [statusFilter, setStatusFilter] = useState<"all" | "draft" | "published">("all");
  const [categoryFilter, setCategoryFilter] = useState<"all" | PostCategory>("all");
  const [search, setSearch] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return posts.filter((p) => {
      if (statusFilter !== "all" && p.status !== statusFilter) return false;
      if (categoryFilter !== "all" && p.category !== categoryFilter) return false;
      if (q && !p.title.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [posts, statusFilter, categoryFilter, search]);

  async function patchPost(id: string, body: Record<string, unknown>) {
    setBusyId(id);
    setError(null);
    try {
      const res = await fetch(`/api/blog/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Request failed");
      setPosts((list) => list.map((p) => (p.id === id ? (data as BlogPostRow) : p)));
      if (data.featured) {
        setPosts((list) => list.map((p) => (p.id !== id && p.featured ? { ...p, featured: false } : p)));
      }
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setBusyId(null);
    }
  }

  async function deletePost(id: string, title: string) {
    if (!confirm(`Delete "${title}"? This cannot be undone.`)) return;
    setBusyId(id);
    setError(null);
    try {
      const res = await fetch(`/api/blog/${id}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Delete failed");
      setPosts((list) => list.filter((p) => p.id !== id));
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Delete failed");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm text-[var(--text-secondary)]">Create, publish, and manage posts on the public marketing blog.</p>
        </div>
        <Link
          href="/dashboard/blog/new"
          className="inline-flex items-center justify-center gap-2 rounded-xl bg-[var(--accent)] px-4 py-2.5 text-[13px] font-semibold text-[#0A0B0D] hover:opacity-90"
        >
          <Plus className="h-4 w-4" /> New post
        </Link>
      </div>

      {error ? (
        <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">{error}</div>
      ) : null}

      <div className="rounded-xl border border-[var(--border)] bg-[var(--surface-card)] p-5 space-y-4">
        <div className="grid gap-3 md:grid-cols-3">
          <div className="relative md:col-span-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--text-tertiary)]" />
            <input
              className={`${inputCls} pl-9`}
              placeholder="Search by title…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <select className={inputCls} value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as typeof statusFilter)}>
            <option value="all">All statuses</option>
            <option value="draft">Draft</option>
            <option value="published">Published</option>
          </select>
          <select className={inputCls} value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value as typeof categoryFilter)}>
            <option value="all">All categories</option>
            {FILTERS.filter((f) => f.key !== "all").map((f) => (
              <option key={f.key} value={f.key}>{f.label}</option>
            ))}
          </select>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] text-left text-[13px]">
            <thead>
              <tr className="border-b border-[var(--border)] text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--text-tertiary)]">
                <th className="pb-3 pr-4">Title</th>
                <th className="pb-3 pr-4">Category</th>
                <th className="pb-3 pr-4">Status</th>
                <th className="pb-3 pr-4">Published</th>
                <th className="pb-3 pr-4">Featured</th>
                <th className="pb-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border)]">
              {filtered.map((post) => {
                const busy = busyId === post.id;
                return (
                  <tr key={post.id} className="text-[var(--text-primary)]">
                    <td className="py-3 pr-4">
                      <div className="font-medium">{post.title}</div>
                      <div className="text-[11px] text-[var(--text-tertiary)]">{SITE.blogUrl.replace("https://", "")}/{post.slug}</div>
                    </td>
                    <td className="py-3 pr-4 text-[var(--text-secondary)]">{CATEGORY_LABELS[post.category]}</td>
                    <td className="py-3 pr-4"><StatusBadge status={post.status} /></td>
                    <td className="py-3 pr-4 text-[var(--text-secondary)]">{formatDate(post.published_at)}</td>
                    <td className="py-3 pr-4">
                      {post.featured ? (
                        <span className="inline-flex items-center gap-1 text-[var(--accent)]"><Star className="h-3.5 w-3.5 fill-current" /> Yes</span>
                      ) : (
                        <span className="text-[var(--text-tertiary)]">—</span>
                      )}
                    </td>
                    <td className="py-3">
                      <div className="flex items-center justify-end gap-2">
                        {post.status === "published" ? (
                          <a href={`${SITE.blogUrl}/${post.slug}`} target="_blank" rel="noopener noreferrer" className="rounded-lg border border-[var(--border)] p-2 text-[var(--text-tertiary)] hover:text-[var(--text-primary)]" title="View live">
                            <ExternalLink className="h-4 w-4" />
                          </a>
                        ) : null}
                        <Link href={`/dashboard/blog/${post.id}`} className="rounded-lg border border-[var(--border)] p-2 text-[var(--text-tertiary)] hover:text-[var(--text-primary)]" title="Edit">
                          <Pencil className="h-4 w-4" />
                        </Link>
                        {post.status === "published" ? (
                          <button type="button" disabled={busy} onClick={() => patchPost(post.id, { action: "unpublish" })} className="rounded-lg border border-[var(--border)] px-2.5 py-1.5 text-[12px] font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)] disabled:opacity-50">
                            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : "Unpublish"}
                          </button>
                        ) : (
                          <button type="button" disabled={busy} onClick={() => patchPost(post.id, { action: "publish" })} className="rounded-lg bg-[var(--accent)] px-2.5 py-1.5 text-[12px] font-semibold text-[#0A0B0D] hover:opacity-90 disabled:opacity-50">
                            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : "Publish"}
                          </button>
                        )}
                        <button type="button" disabled={busy} onClick={() => deletePost(post.id, post.title)} className="rounded-lg border border-red-500/30 p-2 text-red-400 hover:bg-red-500/10 disabled:opacity-50" title="Delete">
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {filtered.length === 0 ? (
            <p className="py-8 text-center text-sm text-[var(--text-tertiary)]">No posts match your filters.</p>
          ) : null}
        </div>
      </div>
    </div>
  );
}
