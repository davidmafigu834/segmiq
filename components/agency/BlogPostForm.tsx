"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, CheckCircle2, Loader2, Upload } from "lucide-react";
import { BlogMarkdown } from "@/components/blog/BlogMarkdown";
import { CATEGORY_LABELS, FILTERS, type PostCategory } from "@/lib/blog-types";
import { estimateReadMinutes, slugifyTitle, type BlogPostRow } from "@/lib/blog-admin";
import { SITE } from "@/lib/seo";
import { resolveImageContentType } from "@/lib/storage/logo-upload";

const inputCls =
  "w-full rounded-xl border border-[var(--border)] bg-[var(--bg-secondary)] px-3 py-2.5 text-[13px] text-[var(--text-primary)] outline-none focus:border-[var(--accent)] transition-colors";
const labelCls = "mb-1 block text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--text-tertiary)]";

type FormState = {
  title: string;
  slug: string;
  excerpt: string;
  body: string;
  category: PostCategory;
  cover_image: string;
  read_minutes: number;
  featured: boolean;
  status: "draft" | "published";
};

function toForm(post?: BlogPostRow | null): FormState {
  return {
    title: post?.title ?? "",
    slug: post?.slug ?? "",
    excerpt: post?.excerpt ?? "",
    body: post?.body ?? "",
    category: post?.category ?? "insight",
    cover_image: post?.cover_image ?? "",
    read_minutes: post?.read_minutes ?? 5,
    featured: post?.featured ?? false,
    status: post?.status ?? "draft",
  };
}

export function BlogPostForm({ post }: { post?: BlogPostRow | null }) {
  const router = useRouter();
  const isEdit = !!post?.id;
  const [form, setForm] = useState<FormState>(() => toForm(post));
  const [slugTouched, setSlugTouched] = useState(!!post?.slug);
  const [readTouched, setReadTouched] = useState(!!post?.read_minutes);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [coverPreview, setCoverPreview] = useState<string | null>(null);
  const [coverMessage, setCoverMessage] = useState<{ type: "error" | "success"; text: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showPreview, setShowPreview] = useState(true);
  const coverInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    return () => {
      if (coverPreview?.startsWith("blob:")) URL.revokeObjectURL(coverPreview);
    };
  }, [coverPreview]);

  useEffect(() => {
    if (!readTouched && form.body) {
      setForm((f) => ({ ...f, read_minutes: estimateReadMinutes(f.body) }));
    }
  }, [form.body, readTouched]);

  function update<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((f) => {
      const next = { ...f, [key]: value };
      if (key === "title" && !slugTouched) {
        next.slug = slugifyTitle(String(value));
      }
      return next;
    });
  }

  async function uploadCover(file: File) {
    const contentType = resolveImageContentType(file.name, file.type);
    if (!contentType || !["image/jpeg", "image/png", "image/webp"].includes(contentType)) {
      setCoverMessage({ type: "error", text: "Use a JPEG, PNG, or WEBP image." });
      return;
    }

    if (coverPreview?.startsWith("blob:")) URL.revokeObjectURL(coverPreview);
    const localPreview = URL.createObjectURL(file);
    setCoverPreview(localPreview);
    setUploading(true);
    setCoverMessage(null);
    setError(null);

    try {
      const body = new FormData();
      body.append("file", file);

      const uploadRes = await fetch("/api/blog/cover/upload", {
        method: "POST",
        body,
      });
      const result = (await uploadRes.json()) as { publicUrl?: string; error?: string };
      if (!uploadRes.ok) throw new Error(result.error ?? "Upload failed");

      update("cover_image", result.publicUrl!);
      setCoverPreview(null);
      URL.revokeObjectURL(localPreview);
      setCoverMessage({ type: "success", text: "Cover uploaded. Save the post to keep it." });
    } catch (e) {
      setCoverPreview(null);
      URL.revokeObjectURL(localPreview);
      const message = e instanceof Error ? e.message : "Upload failed";
      setCoverMessage({ type: "error", text: message });
      setError(message);
    } finally {
      setUploading(false);
      if (coverInputRef.current) coverInputRef.current.value = "";
    }
  }

  async function save(publish = false) {
    setSaving(true);
    setError(null);
    try {
      const payload = {
        ...form,
        cover_image: form.cover_image || null,
        publish,
        status: publish ? "published" : form.status,
      };

      const res = await fetch(isEdit ? `/api/blog/${post!.id}` : "/api/blog", {
        method: isEdit ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Save failed");

      router.push("/dashboard/blog");
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-5">
      <Link href="/dashboard/blog" className="inline-flex items-center gap-1.5 text-[13px] text-[var(--text-secondary)] hover:text-[var(--text-primary)]">
        <ArrowLeft className="h-4 w-4" /> Back to blog
      </Link>

      {error ? (
        <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">{error}</div>
      ) : null}

      <div className="grid gap-5 xl:grid-cols-2">
        <div className="space-y-5">
          <div className="rounded-xl border border-[var(--border)] bg-[var(--surface-card)] p-5 space-y-4">
            <div>
              <label className={labelCls}>Title</label>
              <input className={inputCls} value={form.title} onChange={(e) => update("title", e.target.value)} required />
            </div>
            <div>
              <label className={labelCls}>Slug</label>
              <input
                className={inputCls}
                value={form.slug}
                onChange={(e) => { setSlugTouched(true); update("slug", slugifyTitle(e.target.value)); }}
                required
              />
              <p className="mt-1 text-[11px] text-[var(--text-tertiary)]">Public URL: {SITE.blogUrl}/{form.slug || "…"}</p>
            </div>
            <div>
              <label className={labelCls}>Excerpt</label>
              <textarea className={`${inputCls} min-h-[80px]`} value={form.excerpt} onChange={(e) => update("excerpt", e.target.value)} required />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className={labelCls}>Category</label>
                <select className={inputCls} value={form.category} onChange={(e) => update("category", e.target.value as PostCategory)}>
                  {FILTERS.filter((f) => f.key !== "all").map((f) => (
                    <option key={f.key} value={f.key}>{CATEGORY_LABELS[f.key as PostCategory]}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className={labelCls}>Read time (minutes)</label>
                <input
                  type="number"
                  min={1}
                  max={120}
                  className={inputCls}
                  value={form.read_minutes}
                  onChange={(e) => { setReadTouched(true); update("read_minutes", Number(e.target.value)); }}
                />
              </div>
            </div>
          </div>

          <div className="rounded-xl border border-[var(--border)] bg-[var(--surface-card)] p-5 space-y-4">
            <label className={labelCls}>Cover image</label>
            {(coverPreview || form.cover_image) ? (
              <div className="relative h-40 overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--bg-secondary)]">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={coverPreview ?? form.cover_image}
                  alt="Cover preview"
                  className="h-full w-full object-cover"
                />
                {uploading ? (
                  <div className="absolute inset-0 flex items-center justify-center bg-black/40">
                    <Loader2 className="h-6 w-6 animate-spin text-white" />
                  </div>
                ) : null}
              </div>
            ) : null}
            {coverMessage ? (
              <div
                className={`flex items-center gap-2 rounded-lg px-3 py-2 text-[12px] ${
                  coverMessage.type === "error"
                    ? "border border-red-500/30 bg-red-500/10 text-red-300"
                    : "border border-emerald-500/30 bg-emerald-500/10 text-emerald-300"
                }`}
              >
                {coverMessage.type === "success" ? <CheckCircle2 className="h-4 w-4 shrink-0" /> : null}
                {coverMessage.text}
              </div>
            ) : null}
            <div className="flex flex-col gap-3 sm:flex-row">
              <label className="inline-flex cursor-pointer items-center justify-center gap-2 rounded-xl border border-[var(--border)] px-4 py-2.5 text-[13px] font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)]">
                {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                {uploading ? "Uploading…" : "Upload to R2"}
                <input
                  ref={coverInputRef}
                  type="file"
                  accept="image/jpeg,image/jpg,image/png,image/webp,.jpg,.jpeg,.png,.webp"
                  className="hidden"
                  disabled={uploading}
                  onChange={(e) => { const f = e.target.files?.[0]; if (f) void uploadCover(f); }}
                />
              </label>
            </div>
            <input
              className={inputCls}
              placeholder="Or paste image URL"
              value={form.cover_image}
              onChange={(e) => {
                setCoverMessage(null);
                if (coverPreview?.startsWith("blob:")) URL.revokeObjectURL(coverPreview);
                setCoverPreview(null);
                update("cover_image", e.target.value);
              }}
            />
          </div>

          <div className="rounded-xl border border-[var(--border)] bg-[var(--surface-card)] p-5 space-y-4">
            <div className="flex items-center justify-between gap-3">
              <label className="flex items-center gap-2 text-[13px] text-[var(--text-primary)]">
                <input type="checkbox" checked={form.featured} onChange={(e) => update("featured", e.target.checked)} className="h-4 w-4 rounded border-[var(--border)]" />
                Featured post
              </label>
              <span className="text-[11px] text-[var(--text-tertiary)]">Only one featured at a time</span>
            </div>
            <div>
              <label className={labelCls}>Status</label>
              <select className={inputCls} value={form.status} onChange={(e) => update("status", e.target.value as FormState["status"])}>
                <option value="draft">Draft</option>
                <option value="published">Published</option>
              </select>
            </div>
          </div>
        </div>

        <div className="space-y-5">
          <div className="rounded-xl border border-[var(--border)] bg-[var(--surface-card)] p-5">
            <div className="mb-3 flex items-center justify-between">
              <label className={labelCls}>Body (markdown)</label>
              <button type="button" onClick={() => setShowPreview((v) => !v)} className="text-[12px] font-medium text-[var(--accent)]">
                {showPreview ? "Hide preview" : "Show preview"}
              </button>
            </div>
            <textarea
              className={`${inputCls} min-h-[320px] font-mono text-[12px]`}
              value={form.body}
              onChange={(e) => update("body", e.target.value)}
              placeholder="Write in markdown…"
            />
            {showPreview ? (
              <div className="mt-4 rounded-xl border border-[var(--border)] bg-[var(--bg-secondary)] p-4">
                <div className="mb-2 text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--text-tertiary)]">Preview</div>
                {form.body.trim() ? (
                  <BlogMarkdown body={form.body} variant="portal" />
                ) : (
                  <p className="text-sm text-[var(--text-tertiary)]">Start writing to see a preview.</p>
                )}
              </div>
            ) : null}
          </div>

          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              disabled={saving}
              onClick={() => void save(false)}
              className="rounded-xl border border-[var(--border)] px-5 py-2.5 text-[13px] font-semibold text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)] disabled:opacity-50"
            >
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save"}
            </button>
            <button
              type="button"
              disabled={saving}
              onClick={() => void save(true)}
              className="rounded-xl bg-[var(--accent)] px-5 py-2.5 text-[13px] font-semibold text-[#0A0B0D] hover:opacity-90 disabled:opacity-50"
            >
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Publish"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
