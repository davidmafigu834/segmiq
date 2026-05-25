"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { Globe, Loader2, Upload, Check } from "lucide-react";

type ProfileRow = {
  id: string;
  slug: string;
  headline: string | null;
  subheadline: string | null;
  hero_image_url: string | null;
  cta_text: string | null;
  form_title: string | null;
  is_published: boolean;
};

export function ProfileSettings({
  clientId,
  clientName,
  clientSlug,
  accentColor,
  initialProfile,
}: {
  clientId: string;
  clientName: string;
  clientSlug: string;
  accentColor: string;
  initialProfile: ProfileRow | null;
}) {
  const router = useRouter();
  const [form, setForm] = useState({
    slug: initialProfile?.slug ?? clientSlug,
    headline: initialProfile?.headline ?? "",
    subheadline: initialProfile?.subheadline ?? "",
    hero_image_url: initialProfile?.hero_image_url ?? "",
    cta_text: initialProfile?.cta_text ?? "Get a Free Quote",
    form_title: initialProfile?.form_title ?? "Start Your Project",
    is_published: initialProfile?.is_published ?? false,
  });
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [saveError, setSaveError] = useState(false);
  const [savedIsPublished, setSavedIsPublished] = useState(initialProfile?.is_published ?? false);
  const [heroUploading, setHeroUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  async function handleHeroUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setHeroUploading(true);
    try {
      const res = await fetch("/api/storage/presign", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ filename: file.name, contentType: file.type, clientId, purpose: "hero" }),
      });
      if (!res.ok) throw new Error("Failed to get upload URL");
      const { uploadUrl, publicUrl } = await res.json() as { uploadUrl: string; publicUrl: string };
      await fetch(uploadUrl, { method: "PUT", headers: { "Content-Type": file.type }, body: file });
      setForm((f) => ({ ...f, hero_image_url: publicUrl }));
    } finally {
      setHeroUploading(false);
    }
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setSaveError(false);
    try {
      const res = await fetch(`/api/clients/${clientId}/profile`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      if (res.ok) {
        setSaved(true);
        setSavedIsPublished(form.is_published);
        setTimeout(() => setSaved(false), 2500);
        router.refresh();
      } else {
        setSaveError(true);
        setTimeout(() => setSaveError(false), 4000);
      }
    } catch {
      setSaveError(true);
      setTimeout(() => setSaveError(false), 4000);
    } finally {
      setSaving(false);
    }
  }

  const publicUrl = `/p/${form.slug}`;

  return (
    <div className="max-w-2xl">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h2 className="font-display text-2xl tracking-display text-ink-primary">Profile Page</h2>
          <p className="mt-1 text-sm text-ink-secondary">{clientName}</p>
        </div>
        {savedIsPublished && (
          <a
            href={publicUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 rounded-lg border border-border bg-surface-card px-3 py-1.5 text-sm font-medium text-ink-primary hover:bg-surface-card-alt"
          >
            <Globe className="h-4 w-4" strokeWidth={1.5} /> View live
          </a>
        )}
      </div>

      <form onSubmit={handleSave} className="space-y-7">
        <section>
          <p className="mb-4 font-mono text-[11px] uppercase tracking-[0.12em] text-ink-tertiary">01 / Publish</p>
          <label className="flex cursor-pointer items-center justify-between rounded-xl border border-border bg-surface-card p-5">
            <div>
              <p className="font-medium text-ink-primary">Profile page is {form.is_published ? "live" : "hidden"}</p>
              <p className="mt-0.5 text-sm text-ink-secondary">
                {form.is_published
                  ? savedIsPublished
                    ? `Visible at ${publicUrl}`
                    : `Save changes below to publish`
                  : "Turn on to make it publicly accessible"}
              </p>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={form.is_published}
              onClick={() => setForm((f) => ({ ...f, is_published: !f.is_published }))}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${form.is_published ? "bg-[var(--accent)]" : "bg-border"}`}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${form.is_published ? "translate-x-6" : "translate-x-1"}`}
              />
            </button>
          </label>
        </section>

        <section>
          <p className="mb-4 font-mono text-[11px] uppercase tracking-[0.12em] text-ink-tertiary">02 / URL</p>
          <div>
            <label className="mb-1.5 block text-sm font-medium text-ink-primary">Page slug</label>
            <div className="flex rounded-lg border border-border bg-surface-card focus-within:border-[var(--accent)]">
              <span className="flex items-center border-r border-border bg-surface-card-alt px-3 text-sm text-ink-tertiary rounded-l-lg">leadstaq.tech/p/</span>
              <input
                type="text"
                value={form.slug}
                onChange={(e) => setForm((f) => ({ ...f, slug: e.target.value.replace(/[^a-z0-9-]/g, "").toLowerCase() }))}
                className="flex-1 bg-transparent px-3 py-2.5 text-sm text-ink-primary focus:outline-none"
                placeholder={clientSlug}
              />
            </div>
          </div>
        </section>

        <section>
          <p className="mb-4 font-mono text-[11px] uppercase tracking-[0.12em] text-ink-tertiary">03 / Hero</p>
          <div className="space-y-4">
            <div>
              <label className="mb-1.5 block text-sm font-medium text-ink-primary">Headline</label>
              <input
                type="text"
                value={form.headline}
                onChange={(e) => setForm((f) => ({ ...f, headline: e.target.value }))}
                placeholder={`${clientName} — Quality you can trust`}
                className="w-full rounded-lg border border-border bg-surface-card px-4 py-2.5 text-sm focus:border-[var(--accent)] focus:outline-none"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-ink-primary">Subheadline</label>
              <textarea
                rows={2}
                value={form.subheadline}
                onChange={(e) => setForm((f) => ({ ...f, subheadline: e.target.value }))}
                placeholder="One sentence about what you do"
                className="w-full resize-none rounded-lg border border-border bg-surface-card px-4 py-2.5 text-sm focus:border-[var(--accent)] focus:outline-none"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-ink-primary">Hero background image</label>
              {form.hero_image_url && (
                <div className="mb-3 overflow-hidden rounded-lg">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={form.hero_image_url} alt="Hero" className="h-32 w-full object-cover" />
                </div>
              )}
              <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleHeroUpload} />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={heroUploading}
                className="flex items-center gap-2 rounded-lg border border-border bg-surface-card px-4 py-2.5 text-sm font-medium text-ink-primary hover:bg-surface-card-alt disabled:opacity-60"
              >
                {heroUploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" strokeWidth={1.5} />}
                {heroUploading ? "Uploading…" : form.hero_image_url ? "Replace image" : "Upload image"}
              </button>
            </div>
          </div>
        </section>

        <section>
          <p className="mb-4 font-mono text-[11px] uppercase tracking-[0.12em] text-ink-tertiary">04 / CTA</p>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="mb-1.5 block text-sm font-medium text-ink-primary">Button text</label>
              <input
                type="text"
                value={form.cta_text}
                onChange={(e) => setForm((f) => ({ ...f, cta_text: e.target.value }))}
                placeholder="Get a Free Quote"
                className="w-full rounded-lg border border-border bg-surface-card px-4 py-2.5 text-sm focus:border-[var(--accent)] focus:outline-none"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-ink-primary">Form heading</label>
              <input
                type="text"
                value={form.form_title}
                onChange={(e) => setForm((f) => ({ ...f, form_title: e.target.value }))}
                placeholder="Start Your Project"
                className="w-full rounded-lg border border-border bg-surface-card px-4 py-2.5 text-sm focus:border-[var(--accent)] focus:outline-none"
              />
            </div>
          </div>
        </section>

        <div className="flex items-center gap-4 pt-2">
          <button
            type="submit"
            disabled={saving}
            className="flex items-center gap-2 rounded-lg px-6 py-3 text-sm font-semibold text-[#0a0a0a] transition-opacity hover:opacity-90 disabled:opacity-60"
            style={{ backgroundColor: accentColor }}
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : saved ? <Check className="h-4 w-4" /> : null}
            {saving ? "Saving…" : saved ? "Saved!" : "Save changes"}
          </button>
          {savedIsPublished && (
            <a href={publicUrl} target="_blank" rel="noopener noreferrer" className="text-sm text-ink-secondary hover:text-ink-primary underline underline-offset-4">
              View live page →
            </a>
          )}
          {saveError && (
            <p className="text-sm text-red-500">Save failed — please try again.</p>
          )}
        </div>
      </form>
    </div>
  );
}
