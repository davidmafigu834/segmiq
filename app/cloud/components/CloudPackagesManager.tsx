"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Loader2, Plus, MoreVertical, X, Tag, Globe, Star, ExternalLink, Trash2, Pencil,
} from "lucide-react";
import { slugifyPackageName } from "@/lib/pricing/package-slug";
import { isPackagePublic } from "@/lib/pricing/public-packages";
import { SkeletonListRows } from "@/app/cloud/components/SkeletonCard";

export type PricingPackage = {
  id: string;
  name: string;
  slug: string | null;
  description: string | null;
  tagline: string | null;
  price_from: number | null;
  price_to: number | null;
  price_label: string | null;
  price_note: string | null;
  currency: string;
  includes: string[] | null;
  is_featured: boolean;
  is_public: boolean;
  display_order: number;
  valid_until: string | null;
};

type PackageForm = {
  name: string;
  tagline: string;
  description: string;
  price_from: string;
  price_to: string;
  price_label: string;
  price_note: string;
  currency: string;
  includes: string;
  is_featured: boolean;
  is_public: boolean;
  slug: string;
  valid_until: string;
};

const emptyForm = (): PackageForm => ({
  name: "",
  tagline: "",
  description: "",
  price_from: "",
  price_to: "",
  price_label: "",
  price_note: "",
  currency: "USD",
  includes: "",
  is_featured: false,
  is_public: true,
  slug: "",
  valid_until: "",
});

function pkgToForm(pkg: PricingPackage): PackageForm {
  return {
    name: pkg.name,
    tagline: pkg.tagline ?? "",
    description: pkg.description ?? "",
    price_from: pkg.price_from != null ? String(pkg.price_from) : "",
    price_to: pkg.price_to != null ? String(pkg.price_to) : "",
    price_label: pkg.price_label ?? "",
    price_note: pkg.price_note ?? "",
    currency: pkg.currency,
    includes: (pkg.includes ?? []).join("\n"),
    is_featured: pkg.is_featured,
    is_public: pkg.is_public,
    slug: pkg.slug ?? "",
    valid_until: pkg.valid_until ?? "",
  };
}

function formatPrice(pkg: PricingPackage): string {
  if (pkg.price_label) return pkg.price_label;
  if (pkg.price_from != null) {
    const from = `${pkg.currency} ${Number(pkg.price_from).toLocaleString()}`;
    if (pkg.price_to != null) return `${from} – ${Number(pkg.price_to).toLocaleString()}`;
    return from;
  }
  return "Price on request";
}

const labelCls =
  "mb-1.5 block text-[10px] font-bold uppercase tracking-[0.08em] text-[#6B7280] font-cloud-body";
const inputCls =
  "w-full rounded-xl border border-black/[0.1] bg-[#F5F5F0] px-4 py-3 text-[13px] text-[#0a0a0a] outline-none focus:border-black/25 font-cloud-body";

function PackageEditorSlideOver({
  open,
  editing,
  form,
  setForm,
  saving,
  onClose,
  onSave,
}: {
  open: boolean;
  editing: PricingPackage | null;
  form: PackageForm;
  setForm: React.Dispatch<React.SetStateAction<PackageForm>>;
  saving: boolean;
  onClose: () => void;
  onSave: () => void;
}) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[80] flex items-end bg-black/40 md:items-stretch md:justify-end">
      <button type="button" className="absolute inset-0 md:hidden" aria-label="Close" onClick={onClose} />
      <div className="cloud-sheet relative z-10 bg-white font-cloud-body">
        <div className="mx-auto mt-2 h-1 w-10 shrink-0 rounded-full bg-black/10 md:hidden" aria-hidden />
        <div className="flex items-center justify-between border-b border-[var(--cloud-border)] px-5 py-4">
          <h2 className="font-cloud-display text-[20px] text-[var(--cloud-text-primary)]">
            {editing ? "Edit package" : "New package"}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="cloud-icon-btn"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="cloud-scroll-y flex-1 space-y-4 px-5 py-5">
          <div>
            <label className={labelCls}>Package name *</label>
            <input
              className={inputCls}
              value={form.name}
              onChange={(e) => {
                const name = e.target.value;
                setForm((f) => ({
                  ...f,
                  name,
                  slug: f.slug || slugifyPackageName(name),
                }));
              }}
              placeholder="Premium Home Solar"
            />
          </div>

          <div>
            <label className={labelCls}>Tagline</label>
            <input
              className={inputCls}
              value={form.tagline}
              onChange={(e) => setForm((f) => ({ ...f, tagline: e.target.value }))}
              placeholder="Short line shown on your public profile"
            />
          </div>

          <div>
            <label className={labelCls}>Description</label>
            <textarea
              className={`${inputCls} min-h-[88px] resize-none`}
              value={form.description}
              onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
              placeholder="What's included in this package?"
            />
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div>
              <label className={labelCls}>From</label>
              <input
                type="number"
                className={inputCls}
                value={form.price_from}
                onChange={(e) => setForm((f) => ({ ...f, price_from: e.target.value }))}
                placeholder="4850"
              />
            </div>
            <div>
              <label className={labelCls}>To</label>
              <input
                type="number"
                className={inputCls}
                value={form.price_to}
                onChange={(e) => setForm((f) => ({ ...f, price_to: e.target.value }))}
                placeholder="Optional"
              />
            </div>
            <div>
              <label className={labelCls}>Currency</label>
              <input
                className={inputCls}
                value={form.currency}
                onChange={(e) => setForm((f) => ({ ...f, currency: e.target.value }))}
                placeholder="USD"
              />
            </div>
          </div>

          <div>
            <label className={labelCls}>Price label</label>
            <input
              className={inputCls}
              value={form.price_label}
              onChange={(e) => setForm((f) => ({ ...f, price_label: e.target.value }))}
              placeholder='Overrides numbers — e.g. "From $4,850"'
            />
          </div>

          <div>
            <label className={labelCls}>Price note</label>
            <input
              className={inputCls}
              value={form.price_note}
              onChange={(e) => setForm((f) => ({ ...f, price_note: e.target.value }))}
              placeholder="e.g. Installed price · subject to site survey"
            />
          </div>

          <div>
            <label className={labelCls}>What&apos;s included</label>
            <span className="ml-1 text-[10px] text-[#9CA3AF]">One item per line</span>
            <textarea
              className={`${inputCls} mt-1 min-h-[96px] resize-none`}
              value={form.includes}
              onChange={(e) => setForm((f) => ({ ...f, includes: e.target.value }))}
              placeholder={"Site assessment\nInstallation\n10 year warranty"}
            />
          </div>

          <div>
            <label className={labelCls}>URL slug</label>
            <input
              className={inputCls}
              value={form.slug}
              onChange={(e) =>
                setForm((f) => ({ ...f, slug: slugifyPackageName(e.target.value) }))
              }
              placeholder="premium-home-solar"
              disabled={!form.is_public}
            />
            {!form.is_public && (
              <p className="mt-1 text-[11px] text-[#6B7280]">
                Enable public profile to set a slug.
              </p>
            )}
          </div>

          <div>
            <label className={labelCls}>Valid until</label>
            <input
              type="date"
              className={inputCls}
              value={form.valid_until}
              onChange={(e) => setForm((f) => ({ ...f, valid_until: e.target.value }))}
            />
          </div>

          <div className="space-y-3 rounded-[16px] border border-black/[0.06] bg-[#F5F5F0] p-4">
            <label className="flex items-center justify-between gap-3">
              <span className="text-[13px] font-semibold text-[#0a0a0a]">Show on public profile</span>
              <input
                type="checkbox"
                checked={form.is_public}
                onChange={(e) =>
                  setForm((f) => ({
                    ...f,
                    is_public: e.target.checked,
                    slug: e.target.checked && !f.slug ? slugifyPackageName(f.name) : f.slug,
                  }))
                }
                className="h-4 w-4 accent-[#0a0a0a]"
              />
            </label>
            <label className="flex items-center justify-between gap-3">
              <span className="text-[13px] font-semibold text-[#0a0a0a]">Featured package</span>
              <input
                type="checkbox"
                checked={form.is_featured}
                onChange={(e) => setForm((f) => ({ ...f, is_featured: e.target.checked }))}
                className="h-4 w-4 accent-[#0a0a0a]"
              />
            </label>
          </div>
        </div>

        <div className="cloud-sheet-footer border-t border-[var(--cloud-border)] px-5 pt-4">
          <button
            type="button"
            disabled={saving || !form.name.trim()}
            onClick={onSave}
            className="cloud-btn-primary h-12 w-full disabled:opacity-50"
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            {editing ? "Save changes" : "Create package"}
          </button>
        </div>
      </div>
    </div>
  );
}

export function CloudPackagesManager({
  clientId,
  profileSlug,
}: {
  clientId: string;
  profileSlug: string | null;
}) {
  const [packages, setPackages] = useState<PricingPackage[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [menuOpen, setMenuOpen] = useState<string | null>(null);
  const [editorOpen, setEditorOpen] = useState(false);
  const [editing, setEditing] = useState<PricingPackage | null>(null);
  const [form, setForm] = useState<PackageForm>(emptyForm());

  const fetchPackages = useCallback(() => {
    if (!clientId) return;
    setLoading(true);
    fetch(`/api/clients/${clientId}/packages`)
      .then((r) => r.json())
      .then((data: { packages?: PricingPackage[] }) => {
        setPackages(data.packages ?? []);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [clientId]);

  useEffect(() => {
    fetchPackages();
  }, [fetchPackages]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 3000);
    return () => clearTimeout(t);
  }, [toast]);

  function openCreate() {
    setEditing(null);
    setForm(emptyForm());
    setEditorOpen(true);
  }

  function openEdit(pkg: PricingPackage) {
    setEditing(pkg);
    setForm(pkgToForm(pkg));
    setEditorOpen(true);
    setMenuOpen(null);
  }

  function closeEditor() {
    setEditorOpen(false);
    setEditing(null);
    setForm(emptyForm());
  }

  function buildPayload(f: PackageForm) {
    return {
      name: f.name.trim(),
      tagline: f.tagline.trim() || null,
      description: f.description.trim() || null,
      price_from: f.price_from ? Number(f.price_from) : null,
      price_to: f.price_to ? Number(f.price_to) : null,
      price_label: f.price_label.trim() || null,
      price_note: f.price_note.trim() || null,
      currency: f.currency.trim() || "USD",
      includes: f.includes.trim()
        ? f.includes.split("\n").map((s) => s.trim()).filter(Boolean)
        : [],
      is_featured: f.is_featured,
      is_public: f.is_public,
      slug: f.is_public ? f.slug.trim() || slugifyPackageName(f.name) : null,
      valid_until: f.valid_until || null,
    };
  }

  async function savePackage() {
    if (!form.name.trim()) return;
    setSaving(true);
    try {
      const body = buildPayload(form);
      if (editing) {
        const res = await fetch(`/api/clients/${clientId}/packages/${editing.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        const json = (await res.json()) as { package?: PricingPackage; error?: string };
        if (!res.ok) {
          setToast(json.error ?? "Could not save package");
          return;
        }
        if (json.package) {
          setPackages((prev) => prev.map((p) => (p.id === editing.id ? json.package! : p)));
          setToast("Package updated");
          closeEditor();
        }
      } else {
        const res = await fetch(`/api/clients/${clientId}/packages`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        const json = (await res.json()) as { package?: PricingPackage; error?: string };
        if (!res.ok) {
          setToast(json.error ?? "Could not create package");
          return;
        }
        if (json.package) {
          setPackages((prev) => [...prev, json.package!]);
          setToast("Package created");
          closeEditor();
        }
      }
    } finally {
      setSaving(false);
    }
  }

  async function deletePackage(id: string) {
    if (!window.confirm("Remove this package?")) return;
    await fetch(`/api/clients/${clientId}/packages/${id}`, { method: "DELETE" });
    setPackages((prev) => prev.filter((p) => p.id !== id));
    setMenuOpen(null);
    setToast("Package removed");
  }

  async function toggleField(id: string, field: "is_featured" | "is_public", value: boolean) {
    const res = await fetch(`/api/clients/${clientId}/packages/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ [field]: value }),
    });
    const json = (await res.json()) as { package?: PricingPackage; error?: string };
    if (res.ok && json.package) {
      setPackages((prev) => prev.map((p) => (p.id === id ? json.package! : p)));
      setToast(field === "is_public" && value ? "Package published to profile" : "Package updated");
    } else {
      setToast(json.error ?? "Could not update package");
    }
    setMenuOpen(null);
  }

  const publicCount = packages.filter(isPackagePublic).length;

  const publicPackagesHref = profileSlug ? `/p/${profileSlug}/packages` : null;

  return (
    <>
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div>
          {publicPackagesHref && (
            <a
              href={publicPackagesHref}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-[12px] font-semibold text-[#666660] hover:text-[#0a0a0a] font-cloud-body"
            >
              View public pricing page
              <ExternalLink className="h-3.5 w-3.5" />
            </a>
          )}
        </div>
        <button
          type="button"
          onClick={openCreate}
          className="inline-flex items-center gap-1.5 rounded-xl bg-[#D4FF4F] px-4 py-2.5 text-[13px] font-bold text-black hover:bg-[#C8F244] transition-colors font-cloud-body"
        >
          <Plus className="h-3.5 w-3.5" />
          Add package
        </button>
      </div>

      {!loading && packages.length > 0 && publicCount === 0 && (
        <div className="mb-4 rounded-[16px] border border-[#F0D090]/50 bg-[#FFFAF0] px-4 py-3 text-[13px] leading-relaxed text-[#7A3800] font-cloud-body">
          These packages are saved but not on your public profile yet. Turn on{" "}
          <strong>Show on profile</strong> for each package you want visitors to see.
        </div>
      )}

      {loading ? (
        <SkeletonListRows count={3} />
      ) : packages.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-[20px] border border-black/[0.07] bg-white px-6 py-16 text-center">
          <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-[#F5F5F0]">
            <Tag className="h-6 w-6 text-[#6B7280]" strokeWidth={1.5} />
          </div>
          <p className="mb-1 font-cloud-display text-[18px] text-[#0a0a0a]">No pricing packages yet</p>
          <p className="mb-5 max-w-sm text-[13px] leading-relaxed text-[#6B7280] font-cloud-body">
            Create packages for your public profile and share them with prospects in one tap.
          </p>
          <button
            type="button"
            onClick={openCreate}
            className="rounded-xl bg-[#D4FF4F] px-5 py-3 text-[14px] font-bold text-black hover:bg-[#C8F244] font-cloud-body"
          >
            Create first package
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {packages.map((pkg) => {
            const publicUrl =
              profileSlug && pkg.is_public && pkg.slug
                ? `/p/${profileSlug}/p/${pkg.slug}`
                : null;
            return (
              <article
                key={pkg.id}
                className={`relative flex flex-col rounded-[18px] border px-[22px] py-[22px] transition-[border-color,transform] duration-200 ${
                  pkg.is_featured
                    ? "border-[#0F7A4F]/30 bg-[#F7FBF9]"
                    : "border-black/[0.08] bg-white"
                }`}
              >
                <div className="mb-3 flex items-start justify-between gap-3">
                  <div className="flex flex-wrap gap-2">
                    {pkg.is_featured && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-[#0F7A4F] px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.12em] text-white">
                        <Star className="h-3 w-3 fill-current" />
                        Featured
                      </span>
                    )}
                    <span
                      className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.12em] ${
                        pkg.is_public
                          ? "bg-[#E8F5EE] text-[#0F7A4F]"
                          : "bg-[#F5F5F0] text-[#6B7280]"
                      }`}
                    >
                      <Globe className="h-3 w-3" />
                      {pkg.is_public ? "Public" : "Private"}
                    </span>
                  </div>
                  <div className="relative">
                    <button
                      type="button"
                      onClick={() => setMenuOpen(menuOpen === pkg.id ? null : pkg.id)}
                      className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#F5F5F0] text-[#666660]"
                      aria-label="Package options"
                    >
                      <MoreVertical className="h-4 w-4" />
                    </button>
                    {menuOpen === pkg.id && (
                      <div className="absolute right-0 top-9 z-20 min-w-[148px] overflow-hidden rounded-xl border border-black/[0.08] bg-white py-1 shadow-lg">
                        <button
                          type="button"
                          onClick={() => openEdit(pkg)}
                          className="flex w-full items-center gap-2 px-3 py-2 text-left text-[13px] text-[#0a0a0a] hover:bg-[#F5F5F0] font-cloud-body"
                        >
                          <Pencil className="h-3.5 w-3.5" />
                          Edit
                        </button>
                        {publicUrl && (
                          <a
                            href={publicUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex w-full items-center gap-2 px-3 py-2 text-[13px] text-[#0a0a0a] hover:bg-[#F5F5F0] font-cloud-body"
                          >
                            <ExternalLink className="h-3.5 w-3.5" />
                            View live
                          </a>
                        )}
                        <button
                          type="button"
                          onClick={() => void deletePackage(pkg.id)}
                          className="flex w-full items-center gap-2 px-3 py-2 text-left text-[13px] text-[#E8602C] hover:bg-[#FFF5F0] font-cloud-body"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                          Remove
                        </button>
                      </div>
                    )}
                  </div>
                </div>

                <h3 className="mb-1 font-cloud-display text-[22px] leading-tight text-[#0a0a0a]">
                  {pkg.name}
                </h3>
                {(pkg.tagline || pkg.description) && (
                  <p className="mb-4 flex-1 text-[13px] leading-relaxed text-[#666660] font-cloud-body">
                    {pkg.tagline ?? pkg.description}
                  </p>
                )}
                <p className="mb-4 font-cloud-display text-[28px] font-bold tracking-[-0.02em] text-[#0F7A4F]">
                  {formatPrice(pkg)}
                </p>
                {pkg.price_note && (
                  <p className="-mt-2 mb-4 text-[12px] text-[#6B7280] font-cloud-body">{pkg.price_note}</p>
                )}

                <div className="mt-auto flex flex-wrap gap-2 border-t border-black/[0.06] pt-4">
                  <button
                    type="button"
                    onClick={() => void toggleField(pkg.id, "is_public", !pkg.is_public)}
                    className="rounded-lg border border-black/[0.08] px-3 py-1.5 text-[12px] font-semibold text-[#666660] hover:border-black/20 font-cloud-body"
                  >
                    {pkg.is_public ? "Hide from profile" : "Show on profile"}
                  </button>
                  <button
                    type="button"
                    onClick={() => void toggleField(pkg.id, "is_featured", !pkg.is_featured)}
                    className="rounded-lg border border-black/[0.08] px-3 py-1.5 text-[12px] font-semibold text-[#666660] hover:border-black/20 font-cloud-body"
                  >
                    {pkg.is_featured ? "Unfeature" : "Mark featured"}
                  </button>
                </div>
              </article>
            );
          })}
        </div>
      )}

      {toast && (
        <div className="fixed bottom-24 left-1/2 z-[90] -translate-x-1/2 rounded-xl bg-[#1C1410] px-4 py-2.5 text-[13px] font-medium text-white shadow-xl lg:bottom-6 font-cloud-body">
          {toast}
        </div>
      )}

      <PackageEditorSlideOver
        open={editorOpen}
        editing={editing}
        form={form}
        setForm={setForm}
        saving={saving}
        onClose={closeEditor}
        onSave={() => void savePackage()}
      />
    </>
  );
}
