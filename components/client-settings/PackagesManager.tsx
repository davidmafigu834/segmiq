"use client";

import { useState, useEffect } from "react";

type Package = {
  id: string;
  name: string;
  description: string | null;
  price_from: number | null;
  price_to: number | null;
  price_label: string | null;
  currency: string;
  includes: string[] | null;
  is_featured: boolean;
  display_order: number;
  valid_until: string | null;
};

type Document = {
  id: string;
  name: string;
  description: string | null;
  file_url: string;
  file_type: string | null;
  file_size_bytes: number | null;
};

type PackageForm = {
  name: string;
  description: string;
  price_from: string;
  price_to: string;
  price_label: string;
  currency: string;
  includes: string;
  valid_until: string;
};

const emptyPkgForm = (): PackageForm => ({
  name: "",
  description: "",
  price_from: "",
  price_to: "",
  price_label: "",
  currency: "USD",
  includes: "",
  valid_until: "",
});

function pkgToForm(p: Package): PackageForm {
  return {
    name: p.name,
    description: p.description ?? "",
    price_from: p.price_from != null ? String(p.price_from) : "",
    price_to: p.price_to != null ? String(p.price_to) : "",
    price_label: p.price_label ?? "",
    currency: p.currency,
    includes: (p.includes ?? []).join("\n"),
    valid_until: p.valid_until ?? "",
  };
}

export function PackagesManager({ clientId }: { clientId: string }) {
  const [packages, setPackages] = useState<Package[]>([]);
  const [documents, setDocuments] = useState<Document[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  const [showAddPkg, setShowAddPkg] = useState(false);
  const [editingPkg, setEditingPkg] = useState<Package | null>(null);
  const [pkgForm, setPkgForm] = useState<PackageForm>(emptyPkgForm());

  const [showAddDoc, setShowAddDoc] = useState(false);
  const [docForm, setDocForm] = useState({ name: "", description: "", file_url: "" });

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 4000);
    return () => clearTimeout(t);
  }, [toast]);

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      fetch(`/api/clients/${clientId}/packages`).then((r) => r.json()),
      fetch(`/api/clients/${clientId}/documents`).then((r) => r.json()),
    ])
      .then(([pkgData, docData]) => {
        if (cancelled) return;
        setPackages((pkgData as { packages?: Package[] }).packages ?? []);
        setDocuments((docData as { documents?: Document[] }).documents ?? []);
        setLoading(false);
      })
      .catch(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [clientId]);

  function openAddPkg() {
    setPkgForm(emptyPkgForm());
    setEditingPkg(null);
    setShowAddPkg(true);
  }

  function openEditPkg(pkg: Package) {
    setPkgForm(pkgToForm(pkg));
    setEditingPkg(pkg);
    setShowAddPkg(true);
  }

  async function savePkg() {
    if (!pkgForm.name.trim()) return;
    setSaving(true);
    try {
      const body = {
        name: pkgForm.name.trim(),
        description: pkgForm.description.trim() || null,
        price_from: pkgForm.price_from ? Number(pkgForm.price_from) : null,
        price_to: pkgForm.price_to ? Number(pkgForm.price_to) : null,
        price_label: pkgForm.price_label.trim() || null,
        currency: pkgForm.currency.trim() || "USD",
        includes: pkgForm.includes.trim()
          ? pkgForm.includes.split("\n").map((s) => s.trim()).filter(Boolean)
          : [],
        valid_until: pkgForm.valid_until || null,
      };

      if (editingPkg) {
        const res = await fetch(`/api/clients/${clientId}/packages/${editingPkg.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        const json = (await res.json()) as { package?: Package };
        if (res.ok && json.package) {
          setPackages((prev) => prev.map((p) => (p.id === editingPkg.id ? json.package! : p)));
          setToast("Package updated");
        }
      } else {
        const res = await fetch(`/api/clients/${clientId}/packages`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        const json = (await res.json()) as { package?: Package };
        if (res.ok && json.package) {
          setPackages((prev) => [...prev, json.package!]);
          setToast("Package added");
        }
      }
      setShowAddPkg(false);
    } finally {
      setSaving(false);
    }
  }

  async function deletePkg(id: string) {
    if (!window.confirm("Remove this package?")) return;
    await fetch(`/api/clients/${clientId}/packages/${id}`, { method: "DELETE" });
    setPackages((prev) => prev.filter((p) => p.id !== id));
    setToast("Package removed");
  }

  async function saveDoc() {
    if (!docForm.name.trim() || !docForm.file_url.trim()) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/clients/${clientId}/documents`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: docForm.name.trim(),
          description: docForm.description.trim() || null,
          file_url: docForm.file_url.trim(),
        }),
      });
      const json = (await res.json()) as { document?: Document };
      if (res.ok && json.document) {
        setDocuments((prev) => [json.document!, ...prev]);
        setDocForm({ name: "", description: "", file_url: "" });
        setShowAddDoc(false);
        setToast("Document added");
      }
    } finally {
      setSaving(false);
    }
  }

  async function deleteDoc(id: string) {
    if (!window.confirm("Remove this document?")) return;
    await fetch(`/api/clients/${clientId}/documents/${id}`, { method: "DELETE" });
    setDocuments((prev) => prev.filter((d) => d.id !== id));
    setToast("Document removed");
  }

  if (loading) {
    return <p className="text-sm text-ink-tertiary">Loading…</p>;
  }

  return (
    <div className="space-y-10">
      {toast ? (
        <div className="fixed bottom-6 right-6 z-50 rounded-lg border border-border bg-surface-card px-4 py-3 text-sm shadow-xl">
          {toast}
        </div>
      ) : null}

      {/* ── Pricing packages ── */}
      <section className="space-y-4">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h3 className="font-display text-xl text-ink-primary">Pricing packages</h3>
            <p className="mt-0.5 text-sm text-ink-secondary">
              Salespeople can send these to prospects in one tap from the lead detail view.
            </p>
          </div>
          <button type="button" className="btn-primary shrink-0 text-sm" onClick={openAddPkg}>
            + Add package
          </button>
        </div>

        {packages.length === 0 ? (
          <div className="rounded-xl border border-border bg-surface-card p-6 text-center text-sm text-ink-tertiary">
            No packages yet. Add your first pricing package.
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {packages.map((pkg) => (
              <div
                key={pkg.id}
                className="flex items-center justify-between gap-4 rounded-xl border border-border bg-surface-card px-4 py-3"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-ink-primary">{pkg.name}</p>
                  <p className="mt-0.5 text-[12px] text-ink-tertiary">
                    {pkg.price_label ??
                      (pkg.price_from
                        ? `${pkg.currency} ${pkg.price_from.toLocaleString()}${
                            pkg.price_to ? ` – ${pkg.price_to.toLocaleString()}` : "+"
                          }`
                        : "No price set")}
                  </p>
                </div>
                <div className="flex shrink-0 gap-2">
                  <button
                    type="button"
                    className="btn-ghost h-8 px-3 text-xs"
                    onClick={() => openEditPkg(pkg)}
                  >
                    Edit
                  </button>
                  <button
                    type="button"
                    className="h-8 rounded-md border border-border px-3 text-xs text-[var(--danger)]"
                    onClick={() => void deletePkg(pkg.id)}
                  >
                    Remove
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* ── Documents ── */}
      <section className="space-y-4">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h3 className="font-display text-xl text-ink-primary">Documents</h3>
            <p className="mt-0.5 text-sm text-ink-secondary">
              Brochures or other files to send to prospects. Paste a public URL.
            </p>
          </div>
          <button
            type="button"
            className="btn-primary shrink-0 text-sm"
            onClick={() => setShowAddDoc(true)}
          >
            + Add document
          </button>
        </div>

        {documents.length === 0 ? (
          <div className="rounded-xl border border-border bg-surface-card p-6 text-center text-sm text-ink-tertiary">
            No documents yet. Add a brochure or PDF link.
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {documents.map((doc) => (
              <div
                key={doc.id}
                className="flex items-center justify-between gap-4 rounded-xl border border-border bg-surface-card px-4 py-3"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-ink-primary">{doc.name}</p>
                  <a
                    href={doc.file_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-0.5 block truncate font-mono text-[11px] text-[var(--info)] underline-offset-2 hover:underline"
                  >
                    {doc.file_url}
                  </a>
                </div>
                <button
                  type="button"
                  className="h-8 shrink-0 rounded-md border border-border px-3 text-xs text-[var(--danger)]"
                  onClick={() => void deleteDoc(doc.id)}
                >
                  Remove
                </button>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* ── Package modal ── */}
      {showAddPkg ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-lg rounded-2xl border border-border bg-surface-modal p-6 shadow-2xl">
            <h3 className="font-display text-xl text-ink-primary">
              {editingPkg ? "Edit package" : "Add package"}
            </h3>
            <div className="mt-4 space-y-3 text-sm">
              <label className="block">
                <span className="font-mono text-[10px] uppercase text-ink-tertiary">
                  Package name *
                </span>
                <input
                  className="input-base mt-1 w-full"
                  value={pkgForm.name}
                  onChange={(e) => setPkgForm((f) => ({ ...f, name: e.target.value }))}
                  placeholder="e.g. Standard solar installation"
                />
              </label>
              <label className="block">
                <span className="font-mono text-[10px] uppercase text-ink-tertiary">
                  Description
                </span>
                <input
                  className="input-base mt-1 w-full"
                  value={pkgForm.description}
                  onChange={(e) => setPkgForm((f) => ({ ...f, description: e.target.value }))}
                  placeholder="Short description (optional)"
                />
              </label>
              <div className="grid grid-cols-3 gap-3">
                <label className="block">
                  <span className="font-mono text-[10px] uppercase text-ink-tertiary">
                    Price from
                  </span>
                  <input
                    type="number"
                    className="input-base mt-1 w-full"
                    value={pkgForm.price_from}
                    onChange={(e) => setPkgForm((f) => ({ ...f, price_from: e.target.value }))}
                    placeholder="0"
                  />
                </label>
                <label className="block">
                  <span className="font-mono text-[10px] uppercase text-ink-tertiary">
                    Price to
                  </span>
                  <input
                    type="number"
                    className="input-base mt-1 w-full"
                    value={pkgForm.price_to}
                    onChange={(e) => setPkgForm((f) => ({ ...f, price_to: e.target.value }))}
                    placeholder="0"
                  />
                </label>
                <label className="block">
                  <span className="font-mono text-[10px] uppercase text-ink-tertiary">
                    Currency
                  </span>
                  <input
                    className="input-base mt-1 w-full"
                    value={pkgForm.currency}
                    onChange={(e) => setPkgForm((f) => ({ ...f, currency: e.target.value }))}
                    placeholder="USD"
                  />
                </label>
              </div>
              <label className="block">
                <span className="font-mono text-[10px] uppercase text-ink-tertiary">
                  Price label
                </span>
                <input
                  className="input-base mt-1 w-full"
                  value={pkgForm.price_label}
                  onChange={(e) => setPkgForm((f) => ({ ...f, price_label: e.target.value }))}
                  placeholder='e.g. "Get a quote" — overrides price_from/to display'
                />
              </label>
              <label className="block">
                <span className="font-mono text-[10px] uppercase text-ink-tertiary">
                  What is included
                </span>
                <span className="ml-1 text-[10px] text-ink-tertiary">(one item per line)</span>
                <textarea
                  className="input-base mt-1 h-24 w-full resize-none"
                  value={pkgForm.includes}
                  onChange={(e) => setPkgForm((f) => ({ ...f, includes: e.target.value }))}
                  placeholder={"Site assessment\nInstallation\n10 year warranty"}
                />
              </label>
              <label className="block">
                <span className="font-mono text-[10px] uppercase text-ink-tertiary">
                  Valid until
                </span>
                <input
                  type="date"
                  className="input-base mt-1 w-full"
                  value={pkgForm.valid_until}
                  onChange={(e) => setPkgForm((f) => ({ ...f, valid_until: e.target.value }))}
                />
              </label>
            </div>
            <div className="mt-5 flex justify-end gap-3">
              <button
                type="button"
                className="btn-ghost px-4"
                onClick={() => setShowAddPkg(false)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn-primary px-4"
                disabled={saving || !pkgForm.name.trim()}
                onClick={() => void savePkg()}
              >
                {saving ? "Saving…" : editingPkg ? "Update" : "Add package"}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {/* ── Document modal ── */}
      {showAddDoc ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-md rounded-2xl border border-border bg-surface-modal p-6 shadow-2xl">
            <h3 className="font-display text-xl text-ink-primary">Add document</h3>
            <div className="mt-4 space-y-3 text-sm">
              <label className="block">
                <span className="font-mono text-[10px] uppercase text-ink-tertiary">
                  Document name *
                </span>
                <input
                  className="input-base mt-1 w-full"
                  value={docForm.name}
                  onChange={(e) => setDocForm((f) => ({ ...f, name: e.target.value }))}
                  placeholder="e.g. Company brochure 2025"
                />
              </label>
              <label className="block">
                <span className="font-mono text-[10px] uppercase text-ink-tertiary">
                  Description
                </span>
                <input
                  className="input-base mt-1 w-full"
                  value={docForm.description}
                  onChange={(e) => setDocForm((f) => ({ ...f, description: e.target.value }))}
                  placeholder="Optional note"
                />
              </label>
              <label className="block">
                <span className="font-mono text-[10px] uppercase text-ink-tertiary">
                  File URL *
                </span>
                <input
                  className="input-base mt-1 w-full font-mono text-xs"
                  value={docForm.file_url}
                  onChange={(e) => setDocForm((f) => ({ ...f, file_url: e.target.value }))}
                  placeholder="https://…/brochure.pdf"
                />
              </label>
            </div>
            <div className="mt-5 flex justify-end gap-3">
              <button
                type="button"
                className="btn-ghost px-4"
                onClick={() => setShowAddDoc(false)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn-primary px-4"
                disabled={saving || !docForm.name.trim() || !docForm.file_url.trim()}
                onClick={() => void saveDoc()}
              >
                {saving ? "Saving…" : "Add document"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
