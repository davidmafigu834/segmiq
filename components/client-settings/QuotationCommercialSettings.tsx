"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui";

type Settings = Record<string, unknown> & {
  default_currency?: string;
  default_validity_days?: number;
  default_payment_terms?: string | null;
  default_tax_rate?: number;
  max_discount_percent?: number;
  min_margin_percent?: number | null;
  margin_warning_percent?: number | null;
  margin_visibility?: string;
  price_edit_policy?: string;
  approval_value_threshold?: number | null;
  salesperson_can_see_margin?: boolean;
  salesperson_can_see_cost?: boolean;
  salesperson_can_create_custom_item?: boolean;
  salesperson_can_create_package?: boolean;
  require_approval_for_custom_items?: boolean;
  customer_allow_accept?: boolean;
  customer_allow_request_changes?: boolean;
  customer_allow_ask_question?: boolean;
  customer_allow_decline?: boolean;
  customer_allow_option_selection?: boolean;
  require_acceptance_name?: boolean;
  require_acceptance_checkbox?: boolean;
  discount_authority?: { role: string; max_percent: number | null }[];
  default_terms?: string | null;
};

type Policy = {
  id: string;
  name: string;
  is_active: boolean;
  trigger_type: string;
  operator: string;
  threshold_numeric: number | null;
  approver_role: string | null;
  priority: number;
};

const FIELD = "w-full rounded-lg border border-border bg-surface px-3 py-2 text-[13px]";

export function QuotationCommercialSettings({ clientId }: { clientId: string }) {
  const [tab, setTab] = useState<"general" | "pricing" | "discounts" | "margin" | "approvals" | "customer" | "terms">(
    "general"
  );
  const [settings, setSettings] = useState<Settings | null>(null);
  const [policies, setPolicies] = useState<Policy[]>([]);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState("");
  const [newPolicy, setNewPolicy] = useState({
    name: "",
    trigger_type: "discount",
    operator: "gt",
    threshold_numeric: 5,
    approver_role: "CLIENT_MANAGER",
  });

  useEffect(() => {
    Promise.all([
      fetch(`/api/clients/${clientId}/quotation-settings`).then((r) => r.json()),
      fetch(`/api/clients/${clientId}/quotation-approval-policies`).then((r) => r.json()),
    ]).then(([s, p]: [{ settings?: Settings }, { policies?: Policy[] }]) => {
      setSettings(s.settings ?? {});
      setPolicies(p.policies ?? []);
    });
  }, [clientId]);

  async function save() {
    if (!settings) return;
    setSaving(true);
    try {
      await fetch(`/api/clients/${clientId}/quotation-settings`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(settings),
      });
      setToast("Saved");
      setTimeout(() => setToast(""), 2000);
    } finally {
      setSaving(false);
    }
  }

  async function addPolicy() {
    if (!newPolicy.name.trim()) return;
    const res = await fetch(`/api/clients/${clientId}/quotation-approval-policies`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(newPolicy),
    });
    const json = (await res.json()) as { policy?: Policy };
    if (json.policy) setPolicies((prev) => [...prev, json.policy!]);
    setNewPolicy({ ...newPolicy, name: "" });
  }

  async function deletePolicy(p: Policy) {
    await fetch(`/api/clients/${clientId}/quotation-approval-policies`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: p.id }),
    });
    setPolicies((prev) => prev.filter((x) => x.id !== p.id));
  }

  async function togglePolicy(p: Policy) {
    await fetch(`/api/clients/${clientId}/quotation-approval-policies`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: p.id, is_active: !p.is_active }),
    });
    setPolicies((prev) => prev.map((x) => (x.id === p.id ? { ...x, is_active: !x.is_active } : x)));
  }

  if (!settings) return <p className="text-sm text-ink-tertiary">Loading commercial settings…</p>;

  const tabs = [
    ["general", "General"],
    ["pricing", "Pricing"],
    ["discounts", "Discounts"],
    ["margin", "Margin"],
    ["approvals", "Approvals"],
    ["customer", "Customer experience"],
    ["terms", "Terms"],
  ] as const;

  return (
    <section className="space-y-4">
      <div>
        <h3 className="font-display text-lg">Commercial policy</h3>
        <p className="text-[13px] text-ink-secondary">
          Company rules for pricing, discount authority, margin, approvals, and the customer quotation page.
        </p>
      </div>
      <div className="flex flex-wrap gap-1 border-b border-border pb-2">
        {tabs.map(([id, label]) => (
          <button
            key={id}
            type="button"
            className={`rounded-full px-3 py-1 text-[12px] font-medium ${
              tab === id ? "bg-ink-primary text-white" : "text-ink-secondary"
            }`}
            onClick={() => setTab(id)}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === "general" ? (
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Default currency">
            <input className={FIELD} value={String(settings.default_currency ?? "USD")} onChange={(e) => setSettings({ ...settings, default_currency: e.target.value })} />
          </Field>
          <Field label="Default validity (days)">
            <input type="number" className={FIELD} value={Number(settings.default_validity_days) || 14} onChange={(e) => setSettings({ ...settings, default_validity_days: Number(e.target.value) })} />
          </Field>
          <Field label="Default payment terms">
            <input className={FIELD} value={settings.default_payment_terms ?? ""} onChange={(e) => setSettings({ ...settings, default_payment_terms: e.target.value })} />
          </Field>
          <Field label="Default tax rate %">
            <input type="number" className={FIELD} value={Number(settings.default_tax_rate) || 0} onChange={(e) => setSettings({ ...settings, default_tax_rate: Number(e.target.value) })} />
          </Field>
        </div>
      ) : null}

      {tab === "pricing" ? (
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Salesperson price editing">
            <select className={FIELD} value={String(settings.price_edit_policy ?? "discount_allowed")} onChange={(e) => setSettings({ ...settings, price_edit_policy: e.target.value })}>
              <option value="standard_only">Standard only — catalogue price locked</option>
              <option value="discount_allowed">Discount allowed within authority</option>
              <option value="price_override">Price override allowed</option>
              <option value="manager_controlled">Manager controlled — all deviations need approval</option>
            </select>
          </Field>
          <label className="flex items-center gap-2 text-[13px]">
            <input type="checkbox" checked={settings.salesperson_can_create_custom_item !== false} onChange={(e) => setSettings({ ...settings, salesperson_can_create_custom_item: e.target.checked })} />
            Salespeople can add custom items
          </label>
          <label className="flex items-center gap-2 text-[13px]">
            <input type="checkbox" checked={Boolean(settings.require_approval_for_custom_items)} onChange={(e) => setSettings({ ...settings, require_approval_for_custom_items: e.target.checked })} />
            Custom items require approval
          </label>
          <label className="flex items-center gap-2 text-[13px]">
            <input type="checkbox" checked={Boolean(settings.salesperson_can_create_package)} onChange={(e) => setSettings({ ...settings, salesperson_can_create_package: e.target.checked })} />
            Salespeople can create packages
          </label>
        </div>
      ) : null}

      {tab === "discounts" ? (
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Default max discount % (salesperson fallback)">
            <input type="number" className={FIELD} value={Number(settings.max_discount_percent) || 0} onChange={(e) => setSettings({ ...settings, max_discount_percent: Number(e.target.value) })} />
          </Field>
          <Field label="Salesperson max %">
            <input
              type="number"
              className={FIELD}
              value={settings.discount_authority?.find((r) => r.role === "SALESPERSON")?.max_percent ?? settings.max_discount_percent ?? 5}
              onChange={(e) => {
                const rest = (settings.discount_authority ?? []).filter((r) => r.role !== "SALESPERSON");
                setSettings({ ...settings, discount_authority: [...rest, { role: "SALESPERSON", max_percent: Number(e.target.value) }] });
              }}
            />
          </Field>
          <Field label="Manager max % (blank = unrestricted)">
            <input
              type="number"
              className={FIELD}
              value={settings.discount_authority?.find((r) => r.role === "CLIENT_MANAGER")?.max_percent ?? ""}
              onChange={(e) => {
                const rest = (settings.discount_authority ?? []).filter((r) => r.role !== "CLIENT_MANAGER");
                const v = e.target.value === "" ? null : Number(e.target.value);
                setSettings({ ...settings, discount_authority: [...rest, { role: "CLIENT_MANAGER", max_percent: v }] });
              }}
            />
          </Field>
        </div>
      ) : null}

      {tab === "margin" ? (
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Minimum acceptable margin %">
            <input type="number" className={FIELD} value={settings.min_margin_percent ?? ""} onChange={(e) => setSettings({ ...settings, min_margin_percent: e.target.value === "" ? null : Number(e.target.value) })} />
          </Field>
          <Field label="Warning threshold %">
            <input type="number" className={FIELD} value={settings.margin_warning_percent ?? ""} onChange={(e) => setSettings({ ...settings, margin_warning_percent: e.target.value === "" ? null : Number(e.target.value) })} />
          </Field>
          <Field label="What salespeople can see">
            <select className={FIELD} value={String(settings.margin_visibility ?? "none")} onChange={(e) => setSettings({ ...settings, margin_visibility: e.target.value })}>
              <option value="none">No margin information</option>
              <option value="health">Margin health only</option>
              <option value="percent">Margin %</option>
              <option value="full">Cost + gross profit + margin</option>
            </select>
          </Field>
        </div>
      ) : null}

      {tab === "approvals" ? (
        <div className="space-y-4">
          <Field label="Quotation value threshold (optional)">
            <input type="number" className={FIELD} value={settings.approval_value_threshold ?? ""} onChange={(e) => setSettings({ ...settings, approval_value_threshold: e.target.value === "" ? null : Number(e.target.value) })} />
          </Field>
          <div className="rounded-xl border border-border">
            <div className="grid grid-cols-12 gap-2 border-b border-border px-3 py-2 text-[10px] uppercase tracking-wider text-ink-tertiary">
              <span className="col-span-3">Name</span>
              <span className="col-span-3">When</span>
              <span className="col-span-3">Approver</span>
              <span className="col-span-3">Active</span>
            </div>
            {policies.length === 0 ? (
              <p className="px-3 py-4 text-[13px] text-ink-tertiary">No policies yet. Fallback discount and margin rules still apply.</p>
            ) : (
              policies.map((p) => (
                <div key={p.id} className="grid grid-cols-12 items-center gap-2 px-3 py-2 text-[13px]">
                  <span className="col-span-3">{p.name}</span>
                  <span className="col-span-3 text-ink-secondary">
                    {p.trigger_type} {p.operator} {p.threshold_numeric ?? ""}
                  </span>
                  <span className="col-span-3">{p.approver_role ?? "Manager"}</span>
                  <button type="button" className="col-span-2 text-left text-[12px] underline" onClick={() => void togglePolicy(p)}>
                    {p.is_active ? "Active" : "Disabled"}
                  </button>
                  <button type="button" className="col-span-1 text-left text-[12px] text-ink-tertiary" onClick={() => void deletePolicy(p)}>
                    Delete
                  </button>
                </div>
              ))
            )}
          </div>
          <div className="grid gap-2 sm:grid-cols-5">
            <input className={FIELD} placeholder="Policy name" value={newPolicy.name} onChange={(e) => setNewPolicy({ ...newPolicy, name: e.target.value })} />
            <select className={FIELD} value={newPolicy.trigger_type} onChange={(e) => setNewPolicy({ ...newPolicy, trigger_type: e.target.value })}>
              <option value="discount">Discount</option>
              <option value="margin">Margin</option>
              <option value="quotation_value">Quotation value</option>
              <option value="payment_terms">Payment terms</option>
              <option value="price_override">Price override</option>
              <option value="custom_item">Custom item</option>
            </select>
            <select className={FIELD} value={newPolicy.operator} onChange={(e) => setNewPolicy({ ...newPolicy, operator: e.target.value })}>
              <option value="gt">greater than</option>
              <option value="gte">at least</option>
              <option value="lt">less than</option>
              <option value="lte">at most</option>
            </select>
            <input type="number" className={FIELD} value={newPolicy.threshold_numeric} onChange={(e) => setNewPolicy({ ...newPolicy, threshold_numeric: Number(e.target.value) })} />
            <Button type="button" onClick={() => void addPolicy()}>Add policy</Button>
          </div>
        </div>
      ) : null}

      {tab === "customer" ? (
        <div className="space-y-2 text-[13px]">
          {[
            ["customer_allow_accept", "Allow Accept"],
            ["customer_allow_request_changes", "Allow Request changes"],
            ["customer_allow_ask_question", "Allow Ask a question"],
            ["customer_allow_decline", "Allow Decline"],
            ["customer_allow_option_selection", "Allow option selection"],
            ["require_acceptance_name", "Require acceptance name"],
            ["require_acceptance_checkbox", "Require confirmation checkbox"],
          ].map(([key, label]) => (
            <label key={key} className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={Boolean(settings[key as keyof Settings] ?? (key !== "require_acceptance_name"))}
                onChange={(e) => setSettings({ ...settings, [key]: e.target.checked })}
              />
              {label}
            </label>
          ))}
        </div>
      ) : null}

      {tab === "terms" ? (
        <Field label="Default terms (snapshotted when a quotation is sent)">
          <textarea className={FIELD} rows={6} value={settings.default_terms ?? ""} onChange={(e) => setSettings({ ...settings, default_terms: e.target.value })} />
        </Field>
      ) : null}

      <div className="flex items-center gap-3">
        <Button onClick={() => void save()} disabled={saving}>{saving ? "Saving…" : "Save commercial settings"}</Button>
        {toast ? <span className="text-[13px] text-ink-secondary">{toast}</span> : null}
      </div>
    </section>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block space-y-1">
      <span className="text-[12px] font-medium text-ink-secondary">{label}</span>
      {children}
    </label>
  );
}
