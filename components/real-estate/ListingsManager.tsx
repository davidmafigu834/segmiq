"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Plus, Pencil, Trash2 } from "lucide-react";
import { Button } from "@/components/sales/ui";
import type { ListingRow, ListingStatus, ListingTransactionType } from "@/types";

type AgentOption = { id: string; name: string };
type DevelopmentOption = { id: string; name: string };

type ListingForm = {
  transaction_type: ListingTransactionType;
  status: ListingStatus;
  price: string;
  bedrooms: string;
  bathrooms: string;
  size_sqm: string;
  address: string;
  suburb: string;
  description: string;
  agent_id: string;
  development_id: string;
  mandate_type: "" | "sole" | "joint" | "open";
  mandate_expiry_date: string;
  lease_term_months: string;
  external_reference: string;
  photos: string;
};

const EMPTY: ListingForm = {
  transaction_type: "sale",
  status: "available",
  price: "",
  bedrooms: "",
  bathrooms: "",
  size_sqm: "",
  address: "",
  suburb: "",
  description: "",
  agent_id: "",
  development_id: "",
  mandate_type: "",
  mandate_expiry_date: "",
  lease_term_months: "",
  external_reference: "",
  photos: "",
};

function numOrNull(v: string): number | null {
  const t = v.trim();
  if (!t) return null;
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
}

export function ListingsManager({
  clientId,
  readOnly = false,
}: {
  clientId: string;
  readOnly?: boolean;
}) {
  const [listings, setListings] = useState<ListingRow[]>([]);
  const [agents, setAgents] = useState<AgentOption[]>([]);
  const [developments, setDevelopments] = useState<DevelopmentOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<ListingForm>(EMPTY);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 4000);
    return () => clearTimeout(t);
  }, [toast]);

  async function load() {
    setLoading(true);
    try {
      const [listRes, teamRes, devRes] = await Promise.all([
        fetch(`/api/clients/${clientId}/listings`),
        fetch(`/api/clients/${clientId}/users`),
        fetch(`/api/clients/${clientId}/developments`),
      ]);
      const listJson = (await listRes.json()) as { listings?: ListingRow[] };
      const teamJson = (await teamRes.json().catch(() => ({}))) as {
        users?: { id: string; name: string; role: string; also_sells?: boolean }[];
      };
      const members = teamJson.users ?? [];
      setAgents(
        members
          .filter((m) => m.role === "SALESPERSON" || m.also_sells)
          .map((m) => ({ id: m.id, name: m.name }))
      );
      const devJson = (await devRes.json()) as { developments?: DevelopmentOption[] };
      setDevelopments((devJson.developments ?? []).map((d) => ({ id: d.id, name: d.name })));
      setListings(listJson.listings ?? []);
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

  function openEdit(listing: ListingRow) {
    setEditingId(listing.id);
    setForm({
      transaction_type: listing.transaction_type,
      status: listing.status,
      price: listing.price != null ? String(listing.price) : "",
      bedrooms: listing.bedrooms != null ? String(listing.bedrooms) : "",
      bathrooms: listing.bathrooms != null ? String(listing.bathrooms) : "",
      size_sqm: listing.size_sqm != null ? String(listing.size_sqm) : "",
      address: listing.address ?? "",
      suburb: listing.suburb ?? "",
      description: listing.description ?? "",
      agent_id: listing.agent_id ?? "",
      development_id: listing.development_id ?? "",
      mandate_type: listing.mandate_type ?? "",
      mandate_expiry_date: listing.mandate_expiry_date ?? "",
      lease_term_months: listing.lease_term_months != null ? String(listing.lease_term_months) : "",
      external_reference: listing.external_reference ?? "",
      photos: Array.isArray(listing.photos) ? listing.photos.join("\n") : "",
    });
    setShowForm(true);
  }

  function buildPayload() {
    return {
      transaction_type: form.transaction_type,
      status: form.status,
      price: numOrNull(form.price),
      bedrooms: numOrNull(form.bedrooms),
      bathrooms: numOrNull(form.bathrooms),
      size_sqm: numOrNull(form.size_sqm),
      address: form.address.trim() || null,
      suburb: form.suburb.trim() || null,
      description: form.description.trim() || null,
      agent_id: form.agent_id || null,
      development_id: form.development_id || null,
      mandate_type: form.mandate_type || null,
      mandate_expiry_date: form.mandate_expiry_date || null,
      lease_term_months: numOrNull(form.lease_term_months),
      external_reference: form.external_reference.trim() || null,
      photos: form.photos
        .split("\n")
        .map((s) => s.trim())
        .filter(Boolean),
    };
  }

  async function save() {
    setSaving(true);
    try {
      const payload = buildPayload();
      if (editingId) {
        const res = await fetch(`/api/clients/${clientId}/listings/${editingId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        if (!res.ok) {
          const j = (await res.json().catch(() => ({}))) as { error?: string };
          setToast(j.error ?? "Save failed");
          return;
        }
        setToast("Listing updated");
      } else {
        const res = await fetch(`/api/clients/${clientId}/listings`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        if (!res.ok) {
          const j = (await res.json().catch(() => ({}))) as { error?: string };
          setToast(j.error ?? "Create failed");
          return;
        }
        setToast("Listing created");
      }
      setShowForm(false);
      await load();
    } finally {
      setSaving(false);
    }
  }

  async function remove(id: string) {
    if (!window.confirm("Delete this listing?")) return;
    await fetch(`/api/clients/${clientId}/listings/${id}`, { method: "DELETE" });
    setToast("Listing deleted");
    await load();
  }

  if (loading) {
    return <p className="text-[13px] text-sales-text-muted">Loading listings…</p>;
  }

  return (
    <div className="space-y-3">
      {toast ? (
        <p className="workspace-card rounded-[14px] border border-sales-border bg-sales-surface px-4 py-2 text-[13px] text-sales-text-primary">
          {toast}
        </p>
      ) : null}

      <div className="flex items-center justify-between gap-3">
        <p className="text-[13px] text-sales-text-secondary">{listings.length} properties</p>
        {!readOnly ? (
          <Button type="button" variant="primary" size="md" onClick={openCreate} leftIcon={<Plus className="h-4 w-4" />}>
            Add listing
          </Button>
        ) : null}
      </div>

      {showForm && !readOnly ? (
        <div className="workspace-card space-y-4 rounded-[14px] border border-sales-border bg-sales-surface p-5">
          <h3 className="text-[16px] font-semibold tracking-[-0.02em] text-sales-text-primary">{editingId ? "Edit listing" : "New listing"}</h3>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block text-sm">
              <span className="text-sales-text-secondary">Type</span>
              <select
                className="mt-1 w-full rounded-[10px] border border-sales-border bg-sales-surface-subtle px-3 py-2 text-sales-text-primary"
                value={form.transaction_type}
                onChange={(e) =>
                  setForm((f) => ({
                    ...f,
                    transaction_type: e.target.value as ListingTransactionType,
                  }))
                }
              >
                <option value="sale">Sale</option>
                <option value="rental">Rental</option>
                <option value="new_development">New development</option>
              </select>
            </label>
            <label className="block text-sm">
              <span className="text-sales-text-secondary">Status</span>
              <select
                className="mt-1 w-full rounded-[10px] border border-sales-border bg-sales-surface-subtle px-3 py-2 text-sales-text-primary"
                value={form.status}
                onChange={(e) => setForm((f) => ({ ...f, status: e.target.value as ListingStatus }))}
              >
                <option value="available">Available</option>
                <option value="under_offer">Under offer</option>
                <option value="reserved">Reserved</option>
                <option value="sold">Sold</option>
                <option value="let">Let</option>
              </select>
            </label>
            <label className="block text-sm">
              <span className="text-sales-text-secondary">Address</span>
              <input
                className="mt-1 w-full rounded-[10px] border border-sales-border bg-sales-surface-subtle px-3 py-2 text-sales-text-primary"
                value={form.address}
                onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))}
              />
            </label>
            <label className="block text-sm">
              <span className="text-sales-text-secondary">Suburb</span>
              <input
                className="mt-1 w-full rounded-[10px] border border-sales-border bg-sales-surface-subtle px-3 py-2 text-sales-text-primary"
                value={form.suburb}
                onChange={(e) => setForm((f) => ({ ...f, suburb: e.target.value }))}
              />
            </label>
            <label className="block text-sm">
              <span className="text-sales-text-secondary">Price</span>
              <input
                type="number"
                className="mt-1 w-full rounded-[10px] border border-sales-border bg-sales-surface-subtle px-3 py-2 text-sales-text-primary"
                value={form.price}
                onChange={(e) => setForm((f) => ({ ...f, price: e.target.value }))}
              />
            </label>
            <label className="block text-sm">
              <span className="text-sales-text-secondary">Beds / Baths / Size m²</span>
              <div className="mt-1 flex gap-2">
                <input
                  type="number"
                  placeholder="Beds"
                  className="w-full rounded-[10px] border border-sales-border bg-sales-surface-subtle px-3 py-2 text-sales-text-primary"
                  value={form.bedrooms}
                  onChange={(e) => setForm((f) => ({ ...f, bedrooms: e.target.value }))}
                />
                <input
                  type="number"
                  placeholder="Baths"
                  className="w-full rounded-[10px] border border-sales-border bg-sales-surface-subtle px-3 py-2 text-sales-text-primary"
                  value={form.bathrooms}
                  onChange={(e) => setForm((f) => ({ ...f, bathrooms: e.target.value }))}
                />
                <input
                  type="number"
                  placeholder="m²"
                  className="w-full rounded-[10px] border border-sales-border bg-sales-surface-subtle px-3 py-2 text-sales-text-primary"
                  value={form.size_sqm}
                  onChange={(e) => setForm((f) => ({ ...f, size_sqm: e.target.value }))}
                />
              </div>
            </label>
            <label className="block text-sm">
              <span className="text-sales-text-secondary">Agent</span>
              <select
                className="mt-1 w-full rounded-[10px] border border-sales-border bg-sales-surface-subtle px-3 py-2 text-sales-text-primary"
                value={form.agent_id}
                onChange={(e) => setForm((f) => ({ ...f, agent_id: e.target.value }))}
              >
                <option value="">Unassigned</option>
                {agents.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="block text-sm">
              <span className="text-sales-text-secondary">Development</span>
              <select
                className="mt-1 w-full rounded-[10px] border border-sales-border bg-sales-surface-subtle px-3 py-2 text-sales-text-primary"
                value={form.development_id}
                onChange={(e) => setForm((f) => ({ ...f, development_id: e.target.value }))}
              >
                <option value="">None</option>
                {developments.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="block text-sm">
              <span className="text-sales-text-secondary">Mandate</span>
              <select
                className="mt-1 w-full rounded-[10px] border border-sales-border bg-sales-surface-subtle px-3 py-2 text-sales-text-primary"
                value={form.mandate_type}
                onChange={(e) =>
                  setForm((f) => ({
                    ...f,
                    mandate_type: e.target.value as ListingForm["mandate_type"],
                  }))
                }
              >
                <option value="">—</option>
                <option value="sole">Sole</option>
                <option value="joint">Joint</option>
                <option value="open">Open</option>
              </select>
            </label>
            <label className="block text-sm">
              <span className="text-sales-text-secondary">Mandate expiry</span>
              <input
                type="date"
                className="mt-1 w-full rounded-[10px] border border-sales-border bg-sales-surface-subtle px-3 py-2 text-sales-text-primary"
                value={form.mandate_expiry_date}
                onChange={(e) => setForm((f) => ({ ...f, mandate_expiry_date: e.target.value }))}
              />
            </label>
            {form.transaction_type === "rental" ? (
              <label className="block text-sm">
                <span className="text-sales-text-secondary">Lease term (months)</span>
                <input
                  type="number"
                  className="mt-1 w-full rounded-[10px] border border-sales-border bg-sales-surface-subtle px-3 py-2 text-sales-text-primary"
                  value={form.lease_term_months}
                  onChange={(e) => setForm((f) => ({ ...f, lease_term_months: e.target.value }))}
                />
              </label>
            ) : null}
            <label className="block text-sm">
              <span className="text-sales-text-secondary">External reference</span>
              <input
                className="mt-1 w-full rounded-[10px] border border-sales-border bg-sales-surface-subtle px-3 py-2 text-sales-text-primary"
                value={form.external_reference}
                onChange={(e) => setForm((f) => ({ ...f, external_reference: e.target.value }))}
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
          <label className="block text-sm">
            <span className="text-sales-text-secondary">Photo URLs (one per line)</span>
            <textarea
              rows={3}
              className="mt-1 w-full rounded-[10px] border border-sales-border bg-sales-surface-subtle px-3 py-2 text-sales-text-primary font-mono text-xs"
              value={form.photos}
              onChange={(e) => setForm((f) => ({ ...f, photos: e.target.value }))}
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
        {listings.length === 0 ? (
          <p className="px-5 py-10 text-center text-[13px] text-sales-text-muted">
            No listings yet. Add your first property.
          </p>
        ) : (
          <>
            <div className="hidden md:block">
              <table className="w-full text-left text-[13px]">
                <thead className="border-b border-sales-border-subtle bg-sales-surface-subtle text-[11px] font-semibold uppercase tracking-wide text-sales-text-muted">
                  <tr>
                    <th className="px-5 py-2.5">Property</th>
                    <th className="px-3 py-2.5">Type</th>
                    <th className="px-3 py-2.5">Status</th>
                    <th className="px-3 py-2.5">Price</th>
                    <th className="px-3 py-2.5">Beds</th>
                    {!readOnly ? <th className="px-5 py-2.5 text-right"> </th> : null}
                  </tr>
                </thead>
                <tbody className="divide-y divide-sales-border-subtle">
                  {listings.map((listing) => (
                    <tr key={listing.id} className="hover:bg-sales-surface-hover">
                      <td className="px-5 py-3">
                        <Link
                          href={`/client/listings/${listing.id}`}
                          className="font-medium text-sales-text-primary hover:underline"
                        >
                          {listing.address || listing.external_reference || "Untitled listing"}
                        </Link>
                        {listing.suburb ? (
                          <p className="mt-0.5 text-[12px] text-sales-text-muted">{listing.suburb}</p>
                        ) : null}
                      </td>
                      <td className="px-3 py-3 text-sales-text-secondary">{listing.transaction_type}</td>
                      <td className="px-3 py-3 text-sales-text-secondary">{listing.status.replace("_", " ")}</td>
                      <td className="px-3 py-3 tabular-nums">
                        {listing.price != null ? `$${Number(listing.price).toLocaleString()}` : "—"}
                      </td>
                      <td className="px-3 py-3 tabular-nums">{listing.bedrooms ?? "—"}</td>
                      {!readOnly ? (
                        <td className="px-5 py-3">
                          <div className="flex justify-end gap-2">
                            <button
                              type="button"
                              className="rounded-[8px] border border-sales-border p-1.5 text-sales-text-secondary hover:bg-sales-surface-hover hover:text-sales-text-primary"
                              onClick={() => openEdit(listing)}
                              aria-label="Edit"
                            >
                              <Pencil className="h-4 w-4" />
                            </button>
                            <button
                              type="button"
                              className="rounded-[8px] border border-sales-border p-1.5 text-sales-text-secondary hover:bg-sales-surface-hover hover:text-sales-danger-fg"
                              onClick={() => void remove(listing.id)}
                              aria-label="Delete"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </div>
                        </td>
                      ) : null}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <ul className="divide-y divide-sales-border-subtle md:hidden">
              {listings.map((listing) => (
                <li key={listing.id} className="flex items-start justify-between gap-3 px-4 py-3">
                  <div className="min-w-0">
                    <Link
                      href={`/client/listings/${listing.id}`}
                      className="text-[13px] font-medium text-sales-text-primary hover:underline"
                    >
                      {listing.address || listing.external_reference || "Untitled listing"}
                    </Link>
                    <p className="mt-0.5 text-[12px] text-sales-text-secondary">
                      {[listing.suburb, listing.transaction_type, listing.status.replace("_", " ")]
                        .filter(Boolean)
                        .join(" · ")}
                      {listing.price != null ? ` · $${Number(listing.price).toLocaleString()}` : ""}
                    </p>
                  </div>
                  {!readOnly ? (
                    <div className="flex shrink-0 gap-1.5">
                      <button
                        type="button"
                        className="rounded-[8px] border border-sales-border p-1.5 text-sales-text-secondary"
                        onClick={() => openEdit(listing)}
                        aria-label="Edit"
                      >
                        <Pencil className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        className="rounded-[8px] border border-sales-border p-1.5 text-sales-text-secondary"
                        onClick={() => void remove(listing.id)}
                        aria-label="Delete"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  ) : null}
                </li>
              ))}
            </ul>
          </>
        )}
      </section>
    </div>
  );
}
