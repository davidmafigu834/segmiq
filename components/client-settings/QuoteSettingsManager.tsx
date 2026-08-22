"use client";

import { useEffect, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { formatMoney } from "@/lib/quotations/totals";
import type { CatalogItemRow } from "@/types";
import { QuoteTemplatesManager } from "@/components/client-settings/QuoteTemplatesManager";
import { QuotationCommercialSettings } from "@/components/client-settings/QuotationCommercialSettings";
import { QuotationPackagesManager } from "@/components/client-settings/QuotationPackagesManager";
import { SettingsSectionCard } from "@/components/dashboard/company/settings/SettingsSectionCard";
import { Button, Input, Select, Skeleton, Tabs, TextArea, FieldLabel } from "@/components/sales/ui";

const CATEGORIES = ["inverter", "battery", "panel", "accessory", "labour", "other"];

const TABS = [
  { id: "general", label: "General" },
  { id: "catalog", label: "Catalog" },
  { id: "pricing", label: "Pricing" },
  { id: "discounts", label: "Discounts" },
  { id: "margin", label: "Margin" },
  { id: "approvals", label: "Approvals" },
  { id: "packages", label: "Packages" },
  { id: "templates", label: "Templates" },
  { id: "customer", label: "Customer" },
  { id: "terms", label: "Terms" },
] as const;

type QuoteSettingsTab = (typeof TABS)[number]["id"];

type Settings = {
  company_address: string | null;
  company_email: string | null;
  company_website: string | null;
  company_phone: string | null;
  default_terms: string | null;
  footer_note: string | null;
  quote_prefix: string;
  default_tax_rate: number;
};

const SECTION_COPY: Record<QuoteSettingsTab, { title: string; description: string }> = {
  general: {
    title: "General",
    description: "Company identity and defaults that appear on every quotation.",
  },
  catalog: {
    title: "Products & services",
    description: "Reusable priced items your team can add to a quotation.",
  },
  pricing: {
    title: "Pricing",
    description: "How salespeople may change catalogue prices and add custom items.",
  },
  discounts: {
    title: "Discounts",
    description: "Discount authority by role. Exceptions still go to approval.",
  },
  margin: {
    title: "Margin",
    description: "Company minimums and what salespeople can see.",
  },
  approvals: {
    title: "Approvals",
    description: "Rules that send a quotation to a manager before it can be sent.",
  },
  packages: {
    title: "Packages",
    description: "Reusable commercial assemblies salespeople can add in one step.",
  },
  templates: {
    title: "Templates",
    description: "Starting points for common offers. Preview Residential Premium Solar as a full populated quotation.",
  },
  customer: {
    title: "Customer experience",
    description: "What a customer can do on the secure quotation link.",
  },
  terms: {
    title: "Terms",
    description: "Default terms snapshotted when a quotation is sent.",
  },
};

export function QuoteSettingsManager({ clientId }: { clientId: string }) {
  const [tab, setTab] = useState<QuoteSettingsTab>("general");
  const [items, setItems] = useState<CatalogItemRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [settings, setSettings] = useState<Settings | null>(null);
  const [savingSettings, setSavingSettings] = useState(false);
  const [toast, setToast] = useState("");

  const [newItem, setNewItem] = useState({
    name: "",
    description: "",
    unit_price: 0,
    category: "inverter",
    sku: "",
    item_kind: "product",
    cost_price: "" as string | number,
    min_selling_price: "" as string | number,
    warranty: "",
  });
  const [adding, setAdding] = useState(false);

  useEffect(() => {
    Promise.all([
      fetch(`/api/clients/${clientId}/catalog?all=1`).then((r) => r.json()),
      fetch(`/api/clients/${clientId}/quotation-settings`).then((r) => r.json()),
    ])
      .then(([cat, set]: [{ items?: CatalogItemRow[] }, { settings?: Settings }]) => {
        setItems(cat.items ?? []);
        setSettings(set.settings ?? null);
      })
      .finally(() => setLoading(false));
  }, [clientId]);

  function flash(msg: string) {
    setToast(msg);
    window.setTimeout(() => setToast(""), 2000);
  }

  async function addItem() {
    if (!newItem.name.trim()) return;
    setAdding(true);
    try {
      const res = await fetch(`/api/clients/${clientId}/catalog`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...newItem,
          cost_price: newItem.cost_price === "" ? null : Number(newItem.cost_price),
          min_selling_price: newItem.min_selling_price === "" ? null : Number(newItem.min_selling_price),
          sku: newItem.sku || null,
          warranty: newItem.warranty || null,
        }),
      });
      const json = (await res.json()) as { item?: CatalogItemRow };
      if (json.item) {
        setItems((prev) => [...prev, json.item!]);
        setNewItem({
          name: "",
          description: "",
          unit_price: 0,
          category: newItem.category,
          sku: "",
          item_kind: newItem.item_kind,
          cost_price: "",
          min_selling_price: "",
          warranty: "",
        });
      }
    } finally {
      setAdding(false);
    }
  }

  async function updateItem(id: string, patch: Partial<CatalogItemRow>) {
    setItems((prev) => prev.map((it) => (it.id === id ? { ...it, ...patch } : it)));
    await fetch(`/api/clients/${clientId}/catalog/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    });
  }

  async function removeItem(id: string) {
    await fetch(`/api/clients/${clientId}/catalog/${id}`, { method: "DELETE" });
    setItems((prev) => prev.filter((it) => it.id !== id));
  }

  async function saveSettings() {
    if (!settings) return;
    setSavingSettings(true);
    try {
      await fetch(`/api/clients/${clientId}/quotation-settings`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(settings),
      });
      flash("Saved");
    } finally {
      setSavingSettings(false);
    }
  }

  const copy = SECTION_COPY[tab];

  return (
    <div className="min-w-0 space-y-4">
      <Tabs
        items={[...TABS]}
        value={tab}
        onChange={(id) => setTab(id as QuoteSettingsTab)}
      />

      {loading ? (
        <div className="rounded-[12px] border border-sales-border bg-sales-surface p-5">
          <Skeleton className="h-4 w-40" />
          <Skeleton className="mt-3 h-10 w-full" />
          <Skeleton className="mt-2 h-10 w-full" />
          <Skeleton className="mt-2 h-10 w-2/3" />
        </div>
      ) : (
        <SettingsSectionCard title={copy.title} description={copy.description}>
          {tab === "general" && settings ? (
            <div className="space-y-4">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <Field label="Company address">
                  <Input
                    compact
                    value={settings.company_address ?? ""}
                    onChange={(e) => setSettings({ ...settings, company_address: e.target.value })}
                  />
                </Field>
                <Field label="Phone">
                  <Input
                    compact
                    value={settings.company_phone ?? ""}
                    onChange={(e) => setSettings({ ...settings, company_phone: e.target.value })}
                  />
                </Field>
                <Field label="Email">
                  <Input
                    compact
                    value={settings.company_email ?? ""}
                    onChange={(e) => setSettings({ ...settings, company_email: e.target.value })}
                  />
                </Field>
                <Field label="Website">
                  <Input
                    compact
                    value={settings.company_website ?? ""}
                    onChange={(e) => setSettings({ ...settings, company_website: e.target.value })}
                  />
                </Field>
                <Field label="Quote number prefix">
                  <Input
                    compact
                    value={settings.quote_prefix}
                    onChange={(e) => setSettings({ ...settings, quote_prefix: e.target.value })}
                  />
                </Field>
                <Field label="Default tax rate (%)">
                  <Input
                    compact
                    type="number"
                    value={settings.default_tax_rate}
                    onChange={(e) => setSettings({ ...settings, default_tax_rate: Number(e.target.value) })}
                  />
                </Field>
              </div>
              <Field label="Footer note">
                <Input
                  compact
                  value={settings.footer_note ?? ""}
                  onChange={(e) => setSettings({ ...settings, footer_note: e.target.value })}
                />
              </Field>
              <SaveRow saving={savingSettings} label="Save general settings" toast={toast} onSave={() => void saveSettings()} />
              <QuotationCommercialSettings clientId={clientId} section="general" hideSave={false} />
            </div>
          ) : null}

          {tab === "catalog" ? (
            <CatalogEditor
              items={items}
              newItem={newItem}
              adding={adding}
              onNewItemChange={setNewItem}
              onAdd={() => void addItem()}
              onUpdate={updateItem}
              onRemove={(id) => void removeItem(id)}
            />
          ) : null}

          {tab === "pricing" || tab === "discounts" || tab === "margin" || tab === "approvals" || tab === "customer" ? (
            <QuotationCommercialSettings
              clientId={clientId}
              section={tab}
            />
          ) : null}

          {tab === "packages" ? <QuotationPackagesManager clientId={clientId} embedded /> : null}
          {tab === "templates" ? <QuoteTemplatesManager clientId={clientId} embedded /> : null}

          {tab === "terms" && settings ? (
            <div className="space-y-4">
              <Field label="Default terms & conditions">
                <TextArea
                  rows={8}
                  placeholder={"1. Guarantee period: 5 years battery, 1 year inverter, 20 years panels.\nNB: Extra materials are on client's cost."}
                  value={settings.default_terms ?? ""}
                  onChange={(e) => setSettings({ ...settings, default_terms: e.target.value })}
                />
              </Field>
              <SaveRow saving={savingSettings} label="Save terms" toast={toast} onSave={() => void saveSettings()} />
            </div>
          ) : null}
        </SettingsSectionCard>
      )}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="min-w-0">
      <FieldLabel>{label}</FieldLabel>
      {children}
    </div>
  );
}

function SaveRow({
  saving,
  label,
  toast,
  onSave,
}: {
  saving: boolean;
  label: string;
  toast: string;
  onSave: () => void;
}) {
  return (
    <div className="flex items-center gap-3">
      <Button variant="primary" size="sm" loading={saving} onClick={onSave}>
        {label}
      </Button>
      {toast ? <span className="text-[12px] text-sales-success-fg">{toast}</span> : null}
    </div>
  );
}

function CatalogEditor({
  items,
  newItem,
  adding,
  onNewItemChange,
  onAdd,
  onUpdate,
  onRemove,
}: {
  items: CatalogItemRow[];
  newItem: {
    name: string;
    description: string;
    unit_price: number;
    category: string;
    sku: string;
    item_kind: string;
    cost_price: string | number;
    min_selling_price: string | number;
    warranty: string;
  };
  adding: boolean;
  onNewItemChange: (next: typeof newItem) => void;
  onAdd: () => void;
  onUpdate: (id: string, patch: Partial<CatalogItemRow>) => void;
  onRemove: (id: string) => void;
}) {
  return (
    <div className="space-y-3">
      <div className="overflow-x-auto rounded-[10px] border border-sales-border">
        <div className="grid min-w-[720px] grid-cols-12 gap-2 border-b border-sales-border-subtle bg-sales-surface-subtle px-3 py-2 text-[10px] font-medium uppercase tracking-[0.04em] text-sales-text-muted">
          <span className="col-span-3">Item</span>
          <span className="col-span-2">SKU / kind</span>
          <span className="col-span-2">Category</span>
          <span className="col-span-2 text-right">Selling</span>
          <span className="col-span-2 text-right">Cost</span>
          <span className="col-span-1" />
        </div>

        {items.length === 0 ? (
          <p className="px-3 py-8 text-center text-[13px] text-sales-text-muted">No catalog items yet.</p>
        ) : (
          <ul className="divide-y divide-sales-border-subtle">
            {items.map((it) => (
              <li key={it.id} className={`min-w-[720px] space-y-2 px-3 py-2.5 ${it.is_active ? "" : "opacity-50"}`}>
                <div className="grid grid-cols-12 items-center gap-2">
                  <Input
                    compact
                    className="col-span-3"
                    defaultValue={it.name}
                    onBlur={(e) => e.target.value !== it.name && onUpdate(it.id, { name: e.target.value })}
                  />
                  <div className="col-span-2 space-y-1">
                    <Input
                      compact
                      defaultValue={it.sku ?? ""}
                      placeholder="SKU"
                      onBlur={(e) => onUpdate(it.id, { sku: e.target.value || null })}
                    />
                    <Select
                      className="!h-9"
                      value={it.item_kind ?? "product"}
                      onChange={(e) => onUpdate(it.id, { item_kind: e.target.value })}
                    >
                      <option value="product">Product</option>
                      <option value="service">Service</option>
                    </Select>
                  </div>
                  <Select
                    className="col-span-2 !h-9"
                    value={it.category ?? "other"}
                    onChange={(e) => onUpdate(it.id, { category: e.target.value })}
                  >
                    {CATEGORIES.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </Select>
                  <Input
                    compact
                    type="number"
                    className="col-span-2 text-right"
                    defaultValue={it.unit_price}
                    onBlur={(e) => onUpdate(it.id, { unit_price: Number(e.target.value) })}
                  />
                  <Input
                    compact
                    type="number"
                    className="col-span-2 text-right"
                    defaultValue={it.cost_price ?? ""}
                    placeholder="Cost"
                    onBlur={(e) =>
                      onUpdate(it.id, { cost_price: e.target.value === "" ? null : Number(e.target.value) })
                    }
                  />
                  <div className="col-span-1 text-right">
                    <button
                      type="button"
                      onClick={() => onRemove(it.id)}
                      className="inline-flex h-8 w-8 items-center justify-center rounded-[8px] text-sales-text-muted hover:bg-sales-surface-hover hover:text-sales-danger"
                      aria-label="Remove"
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                </div>
                <div className="grid grid-cols-12 gap-2">
                  <Input
                    compact
                    className="col-span-6"
                    defaultValue={it.description ?? ""}
                    placeholder="Description"
                    onBlur={(e) => onUpdate(it.id, { description: e.target.value })}
                  />
                  <Input
                    compact
                    type="number"
                    className="col-span-3"
                    defaultValue={it.min_selling_price ?? ""}
                    placeholder="Min selling"
                    onBlur={(e) =>
                      onUpdate(it.id, {
                        min_selling_price: e.target.value === "" ? null : Number(e.target.value),
                      })
                    }
                  />
                  <Input
                    compact
                    className="col-span-3"
                    defaultValue={it.warranty ?? ""}
                    placeholder="Warranty"
                    onBlur={(e) => onUpdate(it.id, { warranty: e.target.value || null })}
                  />
                </div>
              </li>
            ))}
          </ul>
        )}

        <div className="grid min-w-[720px] grid-cols-12 items-center gap-2 border-t border-sales-border-subtle bg-sales-surface-subtle px-3 py-2.5">
          <Input
            compact
            className="col-span-3"
            placeholder="New item name"
            value={newItem.name}
            onChange={(e) => onNewItemChange({ ...newItem, name: e.target.value })}
          />
          <Input
            compact
            className="col-span-2"
            placeholder="SKU"
            value={newItem.sku}
            onChange={(e) => onNewItemChange({ ...newItem, sku: e.target.value })}
          />
          <Select
            className="col-span-2 !h-9"
            value={newItem.category}
            onChange={(e) => onNewItemChange({ ...newItem, category: e.target.value })}
          >
            {CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </Select>
          <Input
            compact
            type="number"
            className="col-span-2 text-right"
            placeholder="Selling"
            value={newItem.unit_price || ""}
            onChange={(e) => onNewItemChange({ ...newItem, unit_price: Number(e.target.value) })}
          />
          <Input
            compact
            type="number"
            className="col-span-2 text-right"
            placeholder="Cost"
            value={newItem.cost_price || ""}
            onChange={(e) => onNewItemChange({ ...newItem, cost_price: e.target.value })}
          />
          <div className="col-span-1 text-right">
            <Button
              variant="primary"
              size="sm"
              className="h-8 w-8 !px-0"
              disabled={adding || !newItem.name.trim()}
              loading={adding}
              aria-label="Add item"
              onClick={onAdd}
            >
              <Plus size={14} />
            </Button>
          </div>
        </div>
      </div>
      {newItem.unit_price > 0 ? (
        <p className="text-[11px] text-sales-text-muted">Preview: {formatMoney(newItem.unit_price)}</p>
      ) : null}
    </div>
  );
}
