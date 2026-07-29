"use client";

import { useEffect, useState } from "react";
import { Plus, Pencil, Trash2 } from "lucide-react";

type Inventory = {
  total_listed: number;
  available: number;
  reserved: number;
  sold: number;
  under_offer: number;
  let: number;
};

type Development = {
  id: string;
  name: string;
  description: string | null;
  total_units: number | null;
  completion_date: string | null;
  location: string | null;
  inventory: Inventory;
};

type FormState = {
  name: string;
  description: string;
  total_units: string;
  completion_date: string;
  location: string;
};

const EMPTY: FormState = {
  name: "",
  description: "",
  total_units: "",
  completion_date: "",
  location: "",
};

export function DevelopmentsManager({ clientId }: { clientId: string }) {
  const [rows, setRows] = useState<Development[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 4000);
    return () => clearTimeout(t);
  }, [toast]);

  async function load() {
    setLoading(true);
    try {
      const res = await fetch(`/api/clients/${clientId}/developments`);
      const json = (await res.json()) as { developments?: Development[] };
      setRows(json.developments ?? []);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, [clientId]);

  function openCreate() {
    setEditingId(null);
    setForm(EMPTY);
    setShowForm(true);
  }

  function openEdit(d: Development) {
    setEditingId(d.id);
    setForm({
      name: d.name,
      description: d.description ?? "",
      total_units: d.total_units != null ? String(d.total_units) : "",
      completion_date: d.completion_date ?? "",
      location: d.location ?? "",
    });
    setShowForm(true);
  }

  async function save() {
    if (!form.name.trim()) return;
    setSaving(true);
    try {
      const payload = {
        name: form.name.trim(),
        description: form.description.trim() || null,
        total_units: form.total_units.trim() ? Number(form.total_units) : null,
        completion_date: form.completion_date || null,
        location: form.location.trim() || null,
      };
      const url = editingId
        ? `/api/clients/${clientId}/developments/${editingId}`
        : `/api/clients/${clientId}/developments`;
      const res = await fetch(url, {
        method: editingId ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const j = (await res.json().catch(() => ({}))) as { error?: string };
        setToast(j.error ?? "Save failed");
        return;
      }
      setShowForm(false);
      setToast(editingId ? "Development updated" : "Development created");
      await load();
    } finally {
      setSaving(false);
    }
  }

  async function remove(id: string) {
    if (!window.confirm("Delete this development?")) return;
    await fetch(`/api/clients/${clientId}/developments/${id}`, { method: "DELETE" });
    setToast("Development deleted");
    await load();
  }

  if (loading) return <p className="text-sm text-ink-tertiary">Loading…</p>;

  return (
    <div className="space-y-6">
      {toast ? (
        <p className="rounded-lg border border-[var(--border)] bg-[var(--surface-card)] px-4 py-2 text-sm">
          {toast}
        </p>
      ) : null}

      <div className="flex items-center justify-between">
        <p className="text-sm text-ink-secondary">Inventory by development</p>
        <button type="button" className="btn-primary inline-flex items-center gap-2" onClick={openCreate}>
          <Plus className="h-4 w-4" />
          Add development
        </button>
      </div>

      {showForm ? (
        <div className="rounded-xl border border-[var(--border)] bg-[var(--surface-card)] p-5 space-y-3">
          <h3 className="font-display text-xl">{editingId ? "Edit development" : "New development"}</h3>
          <label className="block text-sm">
            <span className="text-ink-secondary">Name</span>
            <input
              className="mt-1 w-full rounded-lg border border-[var(--border)] bg-[var(--bg-primary)] px-3 py-2"
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            />
          </label>
          <label className="block text-sm">
            <span className="text-ink-secondary">Location</span>
            <input
              className="mt-1 w-full rounded-lg border border-[var(--border)] bg-[var(--bg-primary)] px-3 py-2"
              value={form.location}
              onChange={(e) => setForm((f) => ({ ...f, location: e.target.value }))}
            />
          </label>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block text-sm">
              <span className="text-ink-secondary">Total units</span>
              <input
                type="number"
                className="mt-1 w-full rounded-lg border border-[var(--border)] bg-[var(--bg-primary)] px-3 py-2"
                value={form.total_units}
                onChange={(e) => setForm((f) => ({ ...f, total_units: e.target.value }))}
              />
            </label>
            <label className="block text-sm">
              <span className="text-ink-secondary">Completion date</span>
              <input
                type="date"
                className="mt-1 w-full rounded-lg border border-[var(--border)] bg-[var(--bg-primary)] px-3 py-2"
                value={form.completion_date}
                onChange={(e) => setForm((f) => ({ ...f, completion_date: e.target.value }))}
              />
            </label>
          </div>
          <label className="block text-sm">
            <span className="text-ink-secondary">Description</span>
            <textarea
              rows={3}
              className="mt-1 w-full rounded-lg border border-[var(--border)] bg-[var(--bg-primary)] px-3 py-2"
              value={form.description}
              onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
            />
          </label>
          <div className="flex gap-2">
            <button type="button" className="btn-primary" disabled={saving} onClick={() => void save()}>
              {saving ? "Saving…" : "Save"}
            </button>
            <button
              type="button"
              className="btn-ghost border border-[var(--border)]"
              onClick={() => setShowForm(false)}
            >
              Cancel
            </button>
          </div>
        </div>
      ) : null}

      <div className="space-y-3">
        {rows.length === 0 ? (
          <p className="text-sm text-ink-tertiary">No developments yet.</p>
        ) : (
          rows.map((d) => (
            <div
              key={d.id}
              className="rounded-xl border border-[var(--border)] bg-[var(--surface-card)] p-5"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h3 className="font-display text-xl">{d.name}</h3>
                  <p className="mt-1 text-sm text-ink-secondary">
                    {[d.location, d.completion_date].filter(Boolean).join(" · ")}
                    {d.total_units != null ? ` · ${d.total_units} units planned` : ""}
                  </p>
                </div>
                <div className="flex gap-2">
                  <button
                    type="button"
                    className="rounded-lg border border-[var(--border)] p-2"
                    onClick={() => openEdit(d)}
                  >
                    <Pencil className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    className="rounded-lg border border-[var(--border)] p-2"
                    onClick={() => void remove(d.id)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
              <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-5">
                {(
                  [
                    ["Listed", d.inventory.total_listed],
                    ["Available", d.inventory.available],
                    ["Reserved", d.inventory.reserved],
                    ["Sold", d.inventory.sold],
                    ["Under offer", d.inventory.under_offer],
                  ] as const
                ).map(([label, value]) => (
                  <div key={label} className="rounded-lg border border-[var(--border)] px-3 py-2">
                    <p className="font-mono text-[10px] uppercase tracking-wider text-ink-tertiary">
                      {label}
                    </p>
                    <p className="font-display text-2xl">{value}</p>
                  </div>
                ))}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
