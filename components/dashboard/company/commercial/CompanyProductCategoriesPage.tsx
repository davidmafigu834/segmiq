"use client";

import { useEffect, useMemo, useState } from "react";
import { Plus } from "lucide-react";
import { CommercialModulePage } from "./CommercialModulePage";
import { Button, Input, SearchInput, useSalesToast } from "@/components/sales/ui";
import type { UserRole } from "@/types";

type Cat = { id: string; name: string; parent_id: string | null; status: string; product_count: number };

export function CompanyProductCategoriesPage({
  clientId,
  chrome,
}: {
  clientId: string;
  chrome: Parameters<typeof CommercialModulePage>[0]["chrome"] & { notificationRole: UserRole };
}) {
  const { toast } = useSalesToast();
  const [items, setItems] = useState<Cat[]>([]);
  const [name, setName] = useState("");
  const [q, setQ] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState("");

  async function reload() {
    const res = await fetch(`/api/clients/${clientId}/products/categories`);
    const json = (await res.json()) as { categories?: Cat[] };
    setItems(json.categories ?? []);
  }
  useEffect(() => {
    void reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clientId]);

  const visible = useMemo(() => {
    const term = q.trim().toLowerCase();
    if (!term) return items;
    return items.filter((c) => c.name.toLowerCase().includes(term));
  }, [items, q]);

  async function create() {
    const res = await fetch(`/api/clients/${clientId}/products/categories`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    });
    if (!res.ok) {
      toast({ title: "Could not create category", tone: "error" });
      return;
    }
    setName("");
    await reload();
  }

  async function rename(id: string) {
    const res = await fetch(`/api/clients/${clientId}/products/categories`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, name: editingName }),
    });
    if (!res.ok) {
      toast({ title: "Could not rename", tone: "error" });
      return;
    }
    setEditingId(null);
    await reload();
  }

  async function deactivate(id: string) {
    const res = await fetch(`/api/clients/${clientId}/products/categories`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, deactivate: true }),
    });
    const json = (await res.json()) as { error?: string };
    if (!res.ok) {
      toast({ title: json.error || "Could not deactivate", tone: "error" });
      return;
    }
    await reload();
  }

  return (
    <CommercialModulePage
      chrome={chrome}
      breadcrumb="Company / Products / Categories"
      title="Categories"
      description="Hierarchical categories for products and services."
      primaryAction={
        <div className="flex max-w-xl items-center gap-2">
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="New category" />
          <Button size="md" leftIcon={<Plus size={15} />} onClick={() => void create()} disabled={!name.trim()}>
            Category
          </Button>
        </div>
      }
    >
      <div className="mt-4 max-w-2xl space-y-3">
        <SearchInput value={q} onChange={setQ} placeholder="Search categories…" />
        <div className="overflow-hidden rounded-[12px] border border-sales-border">
          {visible.length === 0 ? (
            <p className="px-4 py-8 text-center text-[13px] text-sales-text-muted">No categories yet.</p>
          ) : (
            <ul className="divide-y divide-sales-border-subtle">
              {visible.map((c) => (
                <li key={c.id} className="flex items-center justify-between gap-3 px-4 py-3">
                  <div className="min-w-0">
                    {editingId === c.id ? (
                      <Input value={editingName} onChange={(e) => setEditingName(e.target.value)} />
                    ) : (
                      <div className="truncate text-[13px] font-medium text-sales-text-primary">{c.name}</div>
                    )}
                    <div className="mt-0.5 text-[12px] text-sales-text-muted">
                      {c.product_count} products · {c.status === "ACTIVE" ? "Active" : "Inactive"}
                    </div>
                  </div>
                  <div className="flex shrink-0 gap-2">
                    {editingId === c.id ? (
                      <Button size="sm" onClick={() => void rename(c.id)} disabled={!editingName.trim()}>
                        Save
                      </Button>
                    ) : (
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => {
                          setEditingId(c.id);
                          setEditingName(c.name);
                        }}
                      >
                        Rename
                      </Button>
                    )}
                    {c.status === "ACTIVE" ? (
                      <Button variant="ghost" size="sm" onClick={() => void deactivate(c.id)}>
                        Deactivate
                      </Button>
                    ) : null}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </CommercialModulePage>
  );
}
