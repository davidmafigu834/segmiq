"use client";

import { useEffect, useState } from "react";
import { CommercialModulePage } from "./CommercialModulePage";
import { Button, Input, useSalesToast } from "@/components/sales/ui";
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

  async function reload() {
    const res = await fetch(`/api/clients/${clientId}/products/categories?q=${encodeURIComponent(q)}`);
    const json = (await res.json()) as { categories?: Cat[] };
    setItems(json.categories ?? []);
  }
  useEffect(() => {
    void reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clientId, q]);

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

  return (
    <CommercialModulePage
      chrome={chrome}
      breadcrumb="Company / Products / Categories"
      title="Categories"
      description="Hierarchical categories for products and services."
    >
      <div className="mt-4 flex max-w-xl gap-2">
        <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="New category" />
        <Button size="md" onClick={() => void create()} disabled={!name.trim()}>
          Create
        </Button>
      </div>
      <div className="mt-4 max-w-xl space-y-1">
        {items.map((c) => (
          <div key={c.id} className="flex items-center justify-between rounded-[8px] border border-sales-border px-3 py-2 text-[13px]">
            <span>
              {c.name}
              <span className="ml-2 text-sales-text-muted">{c.product_count} products</span>
            </span>
            <span className="text-sales-text-muted">{c.status}</span>
          </div>
        ))}
      </div>
    </CommercialModulePage>
  );
}
