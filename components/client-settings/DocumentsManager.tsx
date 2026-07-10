"use client";

import { useEffect, useState } from "react";

type Document = {
  id: string;
  name: string;
  description: string | null;
  file_url: string;
  file_type: string | null;
  file_size_bytes: number | null;
};

export function DocumentsManager({ clientId }: { clientId: string }) {
  const [documents, setDocuments] = useState<Document[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [showAddDoc, setShowAddDoc] = useState(false);
  const [docForm, setDocForm] = useState({ name: "", description: "", file_url: "" });

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 4000);
    return () => clearTimeout(t);
  }, [toast]);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/clients/${clientId}/documents`)
      .then((r) => r.json())
      .then((docData) => {
        if (cancelled) return;
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
    <div className="space-y-4">
      {toast ? (
        <div className="fixed bottom-6 right-6 z-50 rounded-md border border-border bg-surface-card px-4 py-3 text-sm shadow-xl">
          {toast}
        </div>
      ) : null}

      <div className="flex items-start justify-between gap-4">
        <div>
          <h3 className="font-display text-xl text-ink-primary">Documents</h3>
          <p className="mt-0.5 text-sm text-ink-secondary">
            Brochures or other files to send to prospects. Paste a public URL.
          </p>
        </div>
        <button type="button" className="btn-primary shrink-0 text-sm" onClick={() => setShowAddDoc(true)}>
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

      {showAddDoc ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-md rounded-2xl border border-border bg-surface-modal p-6 shadow-2xl">
            <h3 className="font-display text-xl text-ink-primary">Add document</h3>
            <div className="mt-4 space-y-3 text-sm">
              <label className="block">
                <span className="font-mono text-[10px] uppercase text-ink-tertiary">Document name *</span>
                <input
                  className="input-base mt-1 w-full"
                  value={docForm.name}
                  onChange={(e) => setDocForm((f) => ({ ...f, name: e.target.value }))}
                  placeholder="e.g. Company brochure 2025"
                />
              </label>
              <label className="block">
                <span className="font-mono text-[10px] uppercase text-ink-tertiary">Description</span>
                <input
                  className="input-base mt-1 w-full"
                  value={docForm.description}
                  onChange={(e) => setDocForm((f) => ({ ...f, description: e.target.value }))}
                  placeholder="Optional note"
                />
              </label>
              <label className="block">
                <span className="font-mono text-[10px] uppercase text-ink-tertiary">File URL *</span>
                <input
                  className="input-base mt-1 w-full font-mono text-xs"
                  value={docForm.file_url}
                  onChange={(e) => setDocForm((f) => ({ ...f, file_url: e.target.value }))}
                  placeholder="https://…/brochure.pdf"
                />
              </label>
            </div>
            <div className="mt-5 flex justify-end gap-3">
              <button type="button" className="btn-ghost px-4" onClick={() => setShowAddDoc(false)}>
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
