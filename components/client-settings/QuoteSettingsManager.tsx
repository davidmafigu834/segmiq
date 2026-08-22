"use client";

import { useEffect, useState } from "react";
import { Plus, Trash2, Loader2 } from "lucide-react";
import { formatMoney } from "@/lib/quotations/totals";
import type { CatalogItemRow } from "@/types";
import { QuoteTemplatesManager } from "@/components/client-settings/QuoteTemplatesManager";
import { QuotationCommercialSettings } from "@/components/client-settings/QuotationCommercialSettings";
import { QuotationPackagesManager } from "@/components/client-settings/QuotationPackagesManager";

const CATEGORIES = ["inverter", "battery", "panel", "accessory", "labour", "other"];

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

export function QuoteSettingsManager({ clientId }: { clientId: string }) {
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
    setTimeout(() => setToast(""), 2000);
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

  if (loading) return <p className="text-sm text-ink-tertiary">Loading…</p>;

  return (
    <div className="space-y-8">
      {/* Catalog */}
      <section className="space-y-3">
        <div>
          <h3 className="font-display text-lg">Product catalog</h3>
          <p className="text-[13px] text-ink-secondary">
            Reusable priced items your team can drop into a quotation. Reps can still add one-off rows.
          </p>
        </div>

        <div className="rounded-xl border border-border">
          <div className="grid grid-cols-12 gap-2 border-b border-border px-3 py-2 font-mono text-[10px] uppercase tracking-wider text-ink-tertiary">
            <span className="col-span-3">Item</span>
            <span className="col-span-2">SKU / kind</span>
            <span className="col-span-2">Category</span>
            <span className="col-span-2 text-right">Selling</span>
            <span className="col-span-2 text-right">Cost</span>
            <span className="col-span-1" />
          </div>

          {items.length === 0 ? (
            <p className="px-3 py-6 text-center text-[13px] text-ink-tertiary">No catalog items yet.</p>
          ) : (
            <ul className="divide-y divide-border">
              {items.map((it) => (
                <li key={it.id} className={`space-y-2 px-3 py-2 ${it.is_active ? "" : "opacity-50"}`}>
                  <div className="grid grid-cols-12 items-center gap-2">
                    <input
                      className="input-base col-span-3 h-8 text-[13px]"
                      defaultValue={it.name}
                      onBlur={(e) => e.target.value !== it.name && updateItem(it.id, { name: e.target.value })}
                    />
                    <div className="col-span-2 grid grid-cols-1 gap-1">
                      <input
                        className="input-base h-8 text-[12px]"
                        defaultValue={it.sku ?? ""}
                        placeholder="SKU"
                        onBlur={(e) => updateItem(it.id, { sku: e.target.value || null })}
                      />
                      <select
                        className="input-base h-8 text-[12px]"
                        value={it.item_kind ?? "product"}
                        onChange={(e) => updateItem(it.id, { item_kind: e.target.value })}
                      >
                        <option value="product">Product</option>
                        <option value="service">Service</option>
                      </select>
                    </div>
                    <select
                      className="input-base col-span-2 h-8 text-[12px]"
                      value={it.category ?? "other"}
                      onChange={(e) => updateItem(it.id, { category: e.target.value })}
                    >
                      {CATEGORIES.map((c) => (
                        <option key={c} value={c}>
                          {c}
                        </option>
                      ))}
                    </select>
                    <input
                      type="number"
                      className="input-base col-span-2 h-8 text-right text-[13px]"
                      defaultValue={it.unit_price}
                      onBlur={(e) => updateItem(it.id, { unit_price: Number(e.target.value) })}
                    />
                    <input
                      type="number"
                      className="input-base col-span-2 h-8 text-right text-[13px]"
                      defaultValue={it.cost_price ?? ""}
                      placeholder="Cost"
                      onBlur={(e) =>
                        updateItem(it.id, { cost_price: e.target.value === "" ? null : Number(e.target.value) })
                      }
                    />
                    <div className="col-span-1 text-right">
                      <button
                        type="button"
                        onClick={() => void removeItem(it.id)}
                        className="text-ink-tertiary hover:text-[var(--danger)]"
                        aria-label="Remove"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                  <div className="grid grid-cols-12 gap-2">
                    <input
                      className="input-base col-span-6 h-8 text-[12px]"
                      defaultValue={it.description ?? ""}
                      placeholder="Description"
                      onBlur={(e) => updateItem(it.id, { description: e.target.value })}
                    />
                    <input
                      type="number"
                      className="input-base col-span-3 h-8 text-[12px]"
                      defaultValue={it.min_selling_price ?? ""}
                      placeholder="Min selling"
                      onBlur={(e) =>
                        updateItem(it.id, {
                          min_selling_price: e.target.value === "" ? null : Number(e.target.value),
                        })
                      }
                    />
                    <input
                      className="input-base col-span-3 h-8 text-[12px]"
                      defaultValue={it.warranty ?? ""}
                      placeholder="Warranty"
                      onBlur={(e) => updateItem(it.id, { warranty: e.target.value || null })}
                    />
                  </div>
                </li>
              ))}
            </ul>
          )}

          {/* Add row */}
          <div className="grid grid-cols-12 items-center gap-2 border-t border-border bg-surface-card-alt px-3 py-2">
            <input
              className="input-base col-span-3 h-8 text-[13px]"
              placeholder="New item name"
              value={newItem.name}
              onChange={(e) => setNewItem((n) => ({ ...n, name: e.target.value }))}
            />
            <input
              className="input-base col-span-2 h-8 text-[13px]"
              placeholder="SKU"
              value={newItem.sku}
              onChange={(e) => setNewItem((n) => ({ ...n, sku: e.target.value }))}
            />
            <select
              className="input-base col-span-2 h-8 text-[12px]"
              value={newItem.category}
              onChange={(e) => setNewItem((n) => ({ ...n, category: e.target.value }))}
            >
              {CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
            <input
              type="number"
              className="input-base col-span-2 h-8 text-right text-[13px]"
              placeholder="Selling"
              value={newItem.unit_price || ""}
              onChange={(e) => setNewItem((n) => ({ ...n, unit_price: Number(e.target.value) }))}
            />
            <input
              type="number"
              className="input-base col-span-2 h-8 text-right text-[13px]"
              placeholder="Cost"
              value={newItem.cost_price || ""}
              onChange={(e) => setNewItem((n) => ({ ...n, cost_price: e.target.value }))}
            />
            <div className="col-span-1 text-right">
              <button
                type="button"
                onClick={() => void addItem()}
                disabled={adding || !newItem.name.trim()}
                className="text-[var(--accent)] disabled:opacity-40"
                aria-label="Add item"
              >
                {adding ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
              </button>
            </div>
          </div>
        </div>
        {newItem.unit_price > 0 ? (
          <p className="text-[11px] text-ink-tertiary">Preview: {formatMoney(newItem.unit_price)}</p>
        ) : null}
      </section>

      <QuotationCommercialSettings clientId={clientId} />

      <QuotationPackagesManager clientId={clientId} />

      <QuoteTemplatesManager clientId={clientId} />

      {/* Quote settings */}
      {settings ? (
        <section className="max-w-xl space-y-3">
          <div>
            <h3 className="font-display text-lg">Quotation details</h3>
            <p className="text-[13px] text-ink-secondary">
              Company info and terms that appear on every generated quote PDF.
            </p>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Field label="Company address" value={settings.company_address ?? ""} onChange={(v) => setSettings({ ...settings, company_address: v })} />
            <Field label="Phone" value={settings.company_phone ?? ""} onChange={(v) => setSettings({ ...settings, company_phone: v })} />
            <Field label="Email" value={settings.company_email ?? ""} onChange={(v) => setSettings({ ...settings, company_email: v })} />
            <Field label="Website" value={settings.company_website ?? ""} onChange={(v) => setSettings({ ...settings, company_website: v })} />
            <Field label="Quote number prefix" value={settings.quote_prefix} onChange={(v) => setSettings({ ...settings, quote_prefix: v })} />
            <div>
              <label className="mb-1 block font-mono text-[10px] uppercase tracking-wider text-ink-tertiary">Default tax rate (%)</label>
              <input
                type="number"
                className="input-base w-full"
                value={settings.default_tax_rate}
                onChange={(e) => setSettings({ ...settings, default_tax_rate: Number(e.target.value) })}
              />
            </div>
          </div>

          <div>
            <label className="mb-1 block font-mono text-[10px] uppercase tracking-wider text-ink-tertiary">Default terms &amp; conditions</label>
            <textarea
              className="textarea-base min-h-[12rem]"
              rows={8}
              placeholder={"1. Guarantee period: 5 years battery, 1 year inverter, 20 years panels.\nNB: Extra materials are on client's cost.\nInstallations outside the city are charged transport."}
              value={settings.default_terms ?? ""}
              onChange={(e) => setSettings({ ...settings, default_terms: e.target.value })}
            />
          </div>

          <Field label="Footer note" value={settings.footer_note ?? ""} onChange={(v) => setSettings({ ...settings, footer_note: v })} />

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => void saveSettings()}
              disabled={savingSettings}
              className="rounded-xl bg-[var(--accent)] px-4 py-2 text-[13px] font-bold text-[var(--accent-ink)] hover:bg-[var(--accent-hover)] disabled:opacity-50"
            >
              {savingSettings ? "Saving…" : "Save quotation details"}
            </button>
            {toast ? <span className="text-[13px] text-[var(--success-fg)]">{toast}</span> : null}
          </div>
        </section>
      ) : null}
    </div>
  );
}

function Field({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div>
      <label className="mb-1 block font-mono text-[10px] uppercase tracking-wider text-ink-tertiary">{label}</label>
      <input className="input-base w-full" value={value} onChange={(e) => onChange(e.target.value)} />
    </div>
  );
}
