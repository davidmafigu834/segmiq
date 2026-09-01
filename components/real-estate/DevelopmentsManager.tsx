"use client";

import { useEffect, useState } from "react";
import { Plus, Pencil, Trash2 } from "lucide-react";
import { Button, ConfirmDialog } from "@/components/sales/ui";
import { CompanyKpiCard } from "@/components/dashboard/company/CompanyKpiCard";

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

export function DevelopmentsManager({
  clientId,
  hideAddButton = false,
  headerCreateNonce = 0,
}: {
  clientId: string;
  hideAddButton?: boolean;
  headerCreateNonce?: number;
}) {
  const [rows, setRows] = useState<Development[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);
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

  useEffect(() => {
    if (headerCreateNonce > 0) openCreate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [headerCreateNonce]);

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

  async function confirmDelete() {
    if (!deleteTargetId) return;
    setDeleteLoading(true);
    try {
      await fetch(`/api/clients/${clientId}/developments/${deleteTargetId}`, { method: "DELETE" });
      setToast("Development deleted");
      setDeleteTargetId(null);
      await load();
    } finally {
      setDeleteLoading(false);
    }
  }

  if (loading) {
    return (
      <div className="space-y-4" aria-busy>
        <div className="grid w-full grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="shimmer h-[118px] rounded-[14px]" />
          ))}
        </div>
        <div className="shimmer h-[280px] rounded-[14px]" />
      </div>
    );
  }

  const totals = rows.reduce(
    (acc, d) => ({
      listed: acc.listed + d.inventory.total_listed,
      available: acc.available + d.inventory.available,
      reserved: acc.reserved + d.inventory.reserved,
      sold: acc.sold + d.inventory.sold,
    }),
    { listed: 0, available: 0, reserved: 0, sold: 0 }
  );

  return (
    <div className="space-y-4 sm:space-y-5">
      {toast ? (
        <p className="workspace-card rounded-[14px] border border-sales-border bg-sales-surface px-4 py-2 text-[13px] text-sales-text-primary">
          {toast}
        </p>
      ) : null}

      <div className="grid w-full grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
        <CompanyKpiCard item={{ id: "developments", label: "Developments", value: String(rows.length), supporting: "Projects", icon: "companies" }} />
        <CompanyKpiCard item={{ id: "listed", label: "Listed units", value: String(totals.listed), supporting: "On inventory", icon: "pipeline" }} />
        <CompanyKpiCard item={{ id: "available", label: "Available", value: String(totals.available), supporting: "Ready to sell", icon: "customers" }} />
        <CompanyKpiCard item={{ id: "reserved", label: "Reserved", value: String(totals.reserved), supporting: "Held", icon: "followups" }} />
        <CompanyKpiCard item={{ id: "sold", label: "Sold", value: String(totals.sold), supporting: "Closed", icon: "won" }} />
      </div>

      {!hideAddButton ? (
        <div className="flex items-center justify-end">
          <Button type="button" variant="primary" size="md" onClick={openCreate} leftIcon={<Plus className="h-4 w-4" />}>
            Add development
          </Button>
        </div>
      ) : null}

      {showForm ? (
        <div className="workspace-card rounded-[14px] border border-sales-border bg-sales-surface p-5 space-y-3">
          <h3 className="text-[16px] font-semibold text-sales-text-primary">{editingId ? "Edit development" : "New development"}</h3>
          <label className="block text-sm">
            <span className="text-sales-text-secondary">Name</span>
            <input
              className="mt-1 w-full rounded-[10px] border border-sales-border bg-sales-surface-subtle px-3 py-2 text-sales-text-primary"
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            />
          </label>
          <label className="block text-sm">
            <span className="text-sales-text-secondary">Location</span>
            <input
              className="mt-1 w-full rounded-[10px] border border-sales-border bg-sales-surface-subtle px-3 py-2 text-sales-text-primary"
              value={form.location}
              onChange={(e) => setForm((f) => ({ ...f, location: e.target.value }))}
            />
          </label>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block text-sm">
              <span className="text-sales-text-secondary">Total units</span>
              <input
                type="number"
                className="mt-1 w-full rounded-[10px] border border-sales-border bg-sales-surface-subtle px-3 py-2 text-sales-text-primary"
                value={form.total_units}
                onChange={(e) => setForm((f) => ({ ...f, total_units: e.target.value }))}
              />
            </label>
            <label className="block text-sm">
              <span className="text-sales-text-secondary">Completion date</span>
              <input
                type="date"
                className="mt-1 w-full rounded-[10px] border border-sales-border bg-sales-surface-subtle px-3 py-2 text-sales-text-primary"
                value={form.completion_date}
                onChange={(e) => setForm((f) => ({ ...f, completion_date: e.target.value }))}
              />
            </label>
          </div>
          <label className="block text-sm">
            <span className="text-sales-text-secondary">Description</span>
            <textarea
              rows={3}
              className="mt-1 w-full rounded-[10px] border border-sales-border bg-sales-surface-subtle px-3 py-2 text-sales-text-primary"
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
              className="rounded-[10px] border border-sales-border px-3 py-2 text-[13px] text-sales-text-secondary"
              onClick={() => setShowForm(false)}
            >
              Cancel
            </button>
          </div>
        </div>
      ) : null}

      <section className="overflow-hidden workspace-card rounded-[14px] border border-sales-border bg-sales-surface shadow-sales-card">
        {rows.length === 0 ? (
          <p className="px-5 py-10 text-center text-[13px] text-sales-text-muted">No developments yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-left text-[13px]">
              <thead className="border-b border-sales-border-subtle bg-sales-surface-subtle text-[11px] font-semibold uppercase tracking-wide text-sales-text-muted">
                <tr>
                  <th className="px-5 py-2.5">Development</th>
                  <th className="px-3 py-2.5">Location</th>
                  <th className="px-3 py-2.5 text-right">Units</th>
                  <th className="px-3 py-2.5 text-right">Listed</th>
                  <th className="px-3 py-2.5 text-right">Available</th>
                  <th className="px-3 py-2.5 text-right">Reserved</th>
                  <th className="px-3 py-2.5 text-right">Sold</th>
                  <th className="px-3 py-2.5 text-right">Under offer</th>
                  <th className="px-5 py-2.5"> </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-sales-border-subtle">
                {rows.map((d) => (
                  <tr key={d.id} className="hover:bg-sales-surface-hover">
                    <td className="px-5 py-3">
                      <p className="font-medium text-sales-text-primary">{d.name}</p>
                      {d.completion_date ? (
                        <p className="mt-0.5 text-[12px] text-sales-text-muted">{d.completion_date}</p>
                      ) : null}
                    </td>
                    <td className="px-3 py-3 text-sales-text-secondary">{d.location ?? "—"}</td>
                    <td className="px-3 py-3 text-right tabular-nums">{d.total_units ?? "—"}</td>
                    <td className="px-3 py-3 text-right tabular-nums">{d.inventory.total_listed}</td>
                    <td className="px-3 py-3 text-right tabular-nums">{d.inventory.available}</td>
                    <td className="px-3 py-3 text-right tabular-nums">{d.inventory.reserved}</td>
                    <td className="px-3 py-3 text-right tabular-nums">{d.inventory.sold}</td>
                    <td className="px-3 py-3 text-right tabular-nums">{d.inventory.under_offer}</td>
                    <td className="px-5 py-3">
                      <div className="flex justify-end gap-2">
                        <button
                          type="button"
                          className="rounded-[8px] border border-sales-border p-1.5 text-sales-text-secondary hover:bg-sales-surface-hover"
                          onClick={() => openEdit(d)}
                          aria-label="Edit"
                        >
                          <Pencil className="h-4 w-4" />
                        </button>
                        <button
                          type="button"
                          className="rounded-[8px] border border-sales-border p-1.5 text-sales-text-secondary hover:bg-sales-surface-hover hover:text-sales-danger-fg"
                          onClick={() => setDeleteTargetId(d.id)}
                          aria-label="Delete"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <ConfirmDialog
        open={Boolean(deleteTargetId)}
        onOpenChange={(open) => {
          if (!open && !deleteLoading) setDeleteTargetId(null);
        }}
        title="Delete development"
        description="This removes the development and its inventory summary from your workspace."
        confirmLabel="Delete"
        destructive
        loading={deleteLoading}
        onConfirm={() => void confirmDelete()}
      />
    </div>
  );
}
