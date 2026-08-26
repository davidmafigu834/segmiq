"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { CommercialModulePage } from "./CommercialModulePage";
import { Button, FieldLabel, Input, SearchInput, Select, TextArea, useSalesToast } from "@/components/sales/ui";
import type { UserRole } from "@/types";
import type { CommercialSearchResult } from "@/lib/commercial/types";

export function CompanyPackageEditorPage({
  clientId,
  chrome,
  packageId,
}: {
  clientId: string;
  chrome: Parameters<typeof CommercialModulePage>[0]["chrome"] & { notificationRole: UserRole };
  packageId?: string;
}) {
  const router = useRouter();
  const { toast } = useSalesToast();
  const [form, setForm] = useState({
    name: "",
    code: "",
    description: "",
    customer_facing_description: "",
    pricing_mode: "SUM_OF_ITEMS",
    fixed_price: "",
    currency: "USD",
    status: "DRAFT",
  });
  const [items, setItems] = useState<Array<Record<string, unknown>>>([]);
  const [q, setQ] = useState("");
  const [hits, setHits] = useState<CommercialSearchResult[]>([]);
  const [id, setId] = useState(packageId ?? "");

  useEffect(() => {
    if (!packageId) return;
    fetch(`/api/clients/${clientId}/commercial-packages/${packageId}`)
      .then((r) => r.json())
      .then((j: { package?: Record<string, unknown> }) => {
        const p = j.package;
        if (!p) return;
        setForm({
          name: String(p.name ?? ""),
          code: String(p.code ?? ""),
          description: String(p.description ?? ""),
          customer_facing_description: String(p.customer_facing_description ?? ""),
          pricing_mode: String(p.pricing_mode ?? "SUM_OF_ITEMS"),
          fixed_price: p.fixed_price == null ? "" : String(p.fixed_price),
          currency: String(p.currency ?? "USD"),
          status: String(p.status ?? "DRAFT"),
        });
        setItems((p.items as Array<Record<string, unknown>>) ?? []);
      });
  }, [clientId, packageId]);

  useEffect(() => {
    if (q.trim().length < 2) {
      setHits([]);
      return;
    }
    const t = window.setTimeout(() => {
      fetch(`/api/clients/${clientId}/commercial-search?q=${encodeURIComponent(q)}`)
        .then((r) => r.json())
        .then((j: { results?: CommercialSearchResult[] }) =>
          setHits((j.results ?? []).filter((h) => h.type !== "PACKAGE"))
        );
    }, 250);
    return () => window.clearTimeout(t);
  }, [clientId, q]);

  async function saveHeader() {
    const payload = {
      ...form,
      fixed_price: form.fixed_price === "" ? null : Number(form.fixed_price),
    };
    const res = await fetch(
      id ? `/api/clients/${clientId}/commercial-packages/${id}` : `/api/clients/${clientId}/commercial-packages`,
      {
        method: id ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      }
    );
    const json = (await res.json()) as { package?: { id: string }; error?: string };
    if (!res.ok) {
      toast({ title: json.error || "Could not save", tone: "error" });
      return null;
    }
    const nextId = json.package?.id ?? id;
    setId(nextId);
    return nextId;
  }

  async function saveAll() {
    const nextId = await saveHeader();
    if (!nextId) return;
    await fetch(`/api/clients/${clientId}/commercial-packages/${nextId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ items }),
    });
    toast({ title: "Package saved", tone: "success" });
    router.push(`/client/packages/${nextId}`);
  }

  function addHit(hit: CommercialSearchResult) {
    setItems((prev) => [
      ...prev,
      {
        item_type: hit.type === "SERVICE" ? "SERVICE" : "PRODUCT",
        product_id: hit.id,
        quantity: 1,
        optional: false,
        snapshot_name: hit.name,
        snapshot_sku: hit.sku,
        snapshot_unit_price: hit.price,
      },
    ]);
    setQ("");
    setHits([]);
  }

  return (
    <CommercialModulePage
      chrome={chrome}
      breadcrumb="Company / Packages / Builder"
      title={form.name || "New Package"}
      description="Reusable commercial combination of Products and Services."
      primaryAction={
        <Button size="md" onClick={() => void saveAll()}>
          Save package
        </Button>
      }
    >
      <div className="mt-4 grid gap-8 lg:grid-cols-2">
        <div className="space-y-3">
          <div>
            <FieldLabel>Package name</FieldLabel>
            <Input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
          </div>
          <div>
            <FieldLabel>Code</FieldLabel>
            <Input value={form.code} onChange={(e) => setForm((f) => ({ ...f, code: e.target.value }))} />
          </div>
          <div>
            <FieldLabel>Customer-facing description</FieldLabel>
            <TextArea
              value={form.customer_facing_description}
              onChange={(e) => setForm((f) => ({ ...f, customer_facing_description: e.target.value }))}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <FieldLabel>Pricing</FieldLabel>
              <Select value={form.pricing_mode} onChange={(e) => setForm((f) => ({ ...f, pricing_mode: e.target.value }))}>
                <option value="SUM_OF_ITEMS">Sum of items</option>
                <option value="FIXED_PRICE">Fixed price</option>
              </Select>
            </div>
            <div>
              <FieldLabel>Status</FieldLabel>
              <Select value={form.status} onChange={(e) => setForm((f) => ({ ...f, status: e.target.value }))}>
                <option value="DRAFT">Draft</option>
                <option value="ACTIVE">Active</option>
                <option value="INACTIVE">Inactive</option>
                <option value="ARCHIVED">Archived</option>
              </Select>
            </div>
          </div>
          {form.pricing_mode === "FIXED_PRICE" ? (
            <div>
              <FieldLabel>Fixed price</FieldLabel>
              <Input value={form.fixed_price} onChange={(e) => setForm((f) => ({ ...f, fixed_price: e.target.value }))} />
            </div>
          ) : null}
        </div>
        <div>
          <h2 className="text-[14px] font-semibold">Package contents</h2>
          <div className="relative mt-2">
            <SearchInput value={q} onChange={setQ} placeholder="Search Products & Services…" />
            {hits.length ? (
              <div className="absolute z-10 mt-1 w-full rounded-[8px] border border-sales-border bg-sales-surface p-1">
                {hits.map((h) => (
                  <button
                    key={h.id}
                    type="button"
                    className="flex w-full items-center justify-between rounded-[6px] px-2 py-2 text-left text-[13px] hover:bg-sales-surface-subtle"
                    onClick={() => addHit(h)}
                  >
                    <span>{h.name}</span>
                    <span className="text-sales-text-muted">{h.sku}</span>
                  </button>
                ))}
              </div>
            ) : null}
          </div>
          <div className="mt-3 space-y-2">
            {items.map((it, i) => (
              <div key={i} className="flex items-center justify-between rounded-[8px] border border-sales-border px-3 py-2 text-[13px]">
                <span>{String(it.snapshot_name ?? it.product_id)}</span>
                <div className="flex items-center gap-2">
                  <Input
                    className="w-16"
                    value={String(it.quantity ?? 1)}
                    onChange={(e) =>
                      setItems((prev) => prev.map((row, idx) => (idx === i ? { ...row, quantity: Number(e.target.value) || 1 } : row)))
                    }
                  />
                  <button type="button" className="text-sales-text-muted" onClick={() => setItems((prev) => prev.filter((_, idx) => idx !== i))}>
                    Remove
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </CommercialModulePage>
  );
}
