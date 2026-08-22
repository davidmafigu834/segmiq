"use client";

import { useEffect, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { Button, Input, Select } from "@/components/sales/ui";
import type { CatalogItemRow } from "@/types";

type Component = {
  catalog_item_id: string | null;
  item_name: string;
  quantity: number;
  unit: string;
  unit_price: number;
  cost_price: number | null;
  sku: string | null;
  is_optional: boolean;
};

type Pkg = {
  id: string;
  name: string;
  description: string | null;
  pricing_model: string;
  flexibility: string;
  fixed_price: number | null;
  discount_percent: number;
  is_active: boolean;
  components: Component[];
};

export function QuotationPackagesManager({
  clientId,
  embedded = false,
}: {
  clientId: string;
  embedded?: boolean;
}) {
  const [packages, setPackages] = useState<Pkg[]>([]);
  const [catalog, setCatalog] = useState<CatalogItemRow[]>([]);
  const [openId, setOpenId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  async function reload() {
    const [pkg, cat] = await Promise.all([
      fetch(`/api/clients/${clientId}/quotation-packages?all=1`).then((r) => r.json()),
      fetch(`/api/clients/${clientId}/catalog?all=1`).then((r) => r.json()),
    ]);
    setPackages((pkg.packages ?? []) as Pkg[]);
    setCatalog((cat.items ?? []) as CatalogItemRow[]);
  }

  useEffect(() => {
    void reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clientId]);

  async function createPackage() {
    setCreating(true);
    try {
      const res = await fetch(`/api/clients/${clientId}/quotation-packages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "New package", pricing_model: "component_total", flexibility: "flexible" }),
      });
      const json = (await res.json()) as { package?: Pkg };
      if (json.package) {
        setPackages((prev) => [...prev, { ...json.package!, components: [] }]);
        setOpenId(json.package.id);
      }
    } finally {
      setCreating(false);
    }
  }

  async function save(pkg: Pkg) {
    await fetch(`/api/clients/${clientId}/quotation-packages/${pkg.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(pkg),
    });
    setPackages((prev) => prev.map((p) => (p.id === pkg.id ? pkg : p)));
  }

  async function remove(id: string) {
    await fetch(`/api/clients/${clientId}/quotation-packages/${id}`, { method: "DELETE" });
    setPackages((prev) => prev.filter((p) => p.id !== id));
  }

  return (
    <section className="space-y-3">
      <div className={embedded ? "flex justify-end" : "flex items-start justify-between gap-3"}>
        {embedded ? null : (
          <div>
            <h3 className="text-[15px] font-semibold text-sales-text-primary">Packages</h3>
            <p className="mt-0.5 text-[13px] text-sales-text-secondary">
              Reusable commercial assemblies salespeople can add to a quotation.
            </p>
          </div>
        )}
        <Button variant="secondary" size="sm" leftIcon={<Plus size={14} />} onClick={() => void createPackage()} loading={creating}>
          New package
        </Button>
      </div>
      {packages.length === 0 ? (
        <p className="rounded-[10px] border border-dashed border-sales-border px-4 py-8 text-center text-[13px] text-sales-text-muted">
          No packages created yet.
        </p>
      ) : (
        <ul className="space-y-2">
          {packages.map((pkg) => {
            const open = openId === pkg.id;
            return (
              <li key={pkg.id} className="rounded-[10px] border border-sales-border">
                <button
                  type="button"
                  className="flex w-full items-center justify-between px-4 py-3 text-left hover:bg-sales-surface-hover"
                  onClick={() => setOpenId(open ? null : pkg.id)}
                >
                  <span>
                    <span className="block text-[13px] font-semibold text-sales-text-primary">{pkg.name}</span>
                    <span className="text-[12px] text-sales-text-muted">
                      {(pkg.components ?? []).length} items · {pkg.pricing_model.replace("_", " ")} ·{" "}
                      {pkg.is_active ? "Active" : "Inactive"}
                    </span>
                  </span>
                </button>
                {open ? (
                  <PackageEditor
                    pkg={pkg}
                    catalog={catalog}
                    onChange={(next) => void save(next)}
                    onDelete={() => void remove(pkg.id)}
                  />
                ) : null}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

function PackageEditor({
  pkg,
  catalog,
  onChange,
  onDelete,
}: {
  pkg: Pkg;
  catalog: CatalogItemRow[];
  onChange: (pkg: Pkg) => void;
  onDelete: () => void;
}) {
  const [draft, setDraft] = useState(pkg);
  useEffect(() => setDraft(pkg), [pkg]);

  function addFromCatalog(item: CatalogItemRow) {
    setDraft((d) => ({
      ...d,
      components: [
        ...d.components,
        {
          catalog_item_id: item.id,
          item_name: item.name,
          quantity: 1,
          unit: item.unit || "Each",
          unit_price: Number(item.unit_price) || 0,
          cost_price: item.cost_price ?? null,
          sku: item.sku ?? null,
          is_optional: false,
        },
      ],
    }));
  }

  return (
    <div className="space-y-3 border-t border-sales-border-subtle px-4 py-4">
      <div className="grid gap-2 sm:grid-cols-2">
        <Input compact value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} />
        <Input
          compact
          placeholder="Description"
          value={draft.description ?? ""}
          onChange={(e) => setDraft({ ...draft, description: e.target.value })}
        />
        <Select
          value={draft.pricing_model}
          onChange={(e) => setDraft({ ...draft, pricing_model: e.target.value })}
        >
          <option value="component_total">Component total</option>
          <option value="fixed">Fixed package price</option>
          <option value="discounted_bundle">Discounted bundle</option>
        </Select>
        <Select
          value={draft.flexibility}
          onChange={(e) => setDraft({ ...draft, flexibility: e.target.value })}
        >
          <option value="locked">Locked composition</option>
          <option value="flexible">Flexible</option>
          <option value="quantity_adjustable">Quantity-adjustable</option>
        </Select>
        {draft.pricing_model === "fixed" ? (
          <Input
            compact
            type="number"
            placeholder="Fixed price"
            value={draft.fixed_price ?? ""}
            onChange={(e) => setDraft({ ...draft, fixed_price: e.target.value === "" ? null : Number(e.target.value) })}
          />
        ) : null}
        {draft.pricing_model === "discounted_bundle" ? (
          <Input
            compact
            type="number"
            placeholder="Bundle discount %"
            value={draft.discount_percent}
            onChange={(e) => setDraft({ ...draft, discount_percent: Number(e.target.value) || 0 })}
          />
        ) : null}
      </div>
      <label className="flex items-center gap-2 text-[13px] text-sales-text-primary">
        <input
          type="checkbox"
          checked={draft.is_active}
          onChange={(e) => setDraft({ ...draft, is_active: e.target.checked })}
        />
        Active
      </label>
      <div>
        <p className="mb-1 text-[12px] font-medium text-sales-text-secondary">Components</p>
        <ul className="space-y-1">
          {draft.components.map((c, idx) => (
            <li key={`${c.item_name}-${idx}`} className="grid grid-cols-12 items-center gap-1">
              <span className="col-span-5 truncate text-[13px] text-sales-text-primary">{c.item_name}</span>
              <Input
                compact
                type="number"
                className="col-span-2"
                value={c.quantity}
                onChange={(e) => {
                  const next = [...draft.components];
                  next[idx] = { ...c, quantity: Number(e.target.value) || 1 };
                  setDraft({ ...draft, components: next });
                }}
              />
              <Input
                compact
                type="number"
                className="col-span-3"
                value={c.unit_price}
                onChange={(e) => {
                  const next = [...draft.components];
                  next[idx] = { ...c, unit_price: Number(e.target.value) || 0 };
                  setDraft({ ...draft, components: next });
                }}
              />
              <button
                type="button"
                className="col-span-2 text-sales-text-muted hover:text-sales-danger"
                onClick={() => setDraft({ ...draft, components: draft.components.filter((_, i) => i !== idx) })}
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </li>
          ))}
        </ul>
        <Select
          className="mt-2"
          defaultValue=""
          onChange={(e) => {
            const item = catalog.find((c) => c.id === e.target.value);
            if (item) addFromCatalog(item);
            e.target.value = "";
          }}
        >
          <option value="">Add catalogue item…</option>
          {catalog.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </Select>
      </div>
      <div className="flex gap-2">
        <Button variant="primary" size="sm" onClick={() => onChange(draft)}>
          Save package
        </Button>
        <Button variant="ghost" size="sm" onClick={onDelete}>
          Delete
        </Button>
      </div>
    </div>
  );
}
