"use client";

import { useEffect, useState } from "react";
import { Button, Checkbox, Field, Input, Select, Skeleton, Switch, TextArea } from "@/components/sales/ui";
import { humanReadablePolicy } from "@/lib/quotations/approval-engine";

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

export type CommercialSection =
  | "general"
  | "pricing"
  | "discounts"
  | "margin"
  | "approvals"
  | "customer"
  | "terms";

export function QuotationCommercialSettings({
  clientId,
  section,
  hideSave = false,
}: {
  clientId: string;
  section: CommercialSection;
  hideSave?: boolean;
}) {
  const [settings, setSettings] = useState<Settings | null>(null);
  const [policies, setPolicies] = useState<Policy[]>([]);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState("");
  const [error, setError] = useState(false);
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
    ])
      .then(([s, p]: [{ settings?: Settings }, { policies?: Policy[] }]) => {
        setSettings(s.settings ?? {});
        setPolicies(p.policies ?? []);
        setError(false);
      })
      .catch(() => setError(true));
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
      window.setTimeout(() => setToast(""), 2000);
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
    setPolicies((prev) => prev.map((x) => (x.id === p.id ? { ...x, is_active: false } : x)));
  }

  async function togglePolicy(p: Policy) {
    await fetch(`/api/clients/${clientId}/quotation-approval-policies`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: p.id, is_active: !p.is_active }),
    });
    setPolicies((prev) => prev.map((x) => (x.id === p.id ? { ...x, is_active: !x.is_active } : x)));
  }

  if (error) {
    return <p className="text-[13px] text-sales-text-muted">Commercial settings could not be loaded.</p>;
  }
  if (!settings) {
    return (
      <div className="space-y-2">
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-10 w-2/3" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {section === "general" ? (
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Default currency">
            <Input compact value={String(settings.default_currency ?? "USD")} onChange={(e) => setSettings({ ...settings, default_currency: e.target.value })} />
          </Field>
          <Field label="Default validity (days)">
            <Input compact type="number" value={Number(settings.default_validity_days) || 14} onChange={(e) => setSettings({ ...settings, default_validity_days: Number(e.target.value) })} />
          </Field>
          <Field label="Default payment terms">
            <Input compact value={settings.default_payment_terms ?? ""} onChange={(e) => setSettings({ ...settings, default_payment_terms: e.target.value })} />
          </Field>
        </div>
      ) : null}

      {section === "pricing" ? (
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Salesperson price editing">
            <Select value={String(settings.price_edit_policy ?? "discount_allowed")} onChange={(e) => setSettings({ ...settings, price_edit_policy: e.target.value })}>
              <option value="standard_only">Standard only — catalogue price locked</option>
              <option value="discount_allowed">Discount allowed within authority</option>
              <option value="price_override">Price override allowed</option>
              <option value="manager_controlled">Manager controlled — all deviations need approval</option>
            </Select>
          </Field>
          <div className="space-y-2 sm:col-span-2">
            <ToggleRow
              label="Salespeople can add custom items"
              checked={settings.salesperson_can_create_custom_item !== false}
              onChange={(checked) => setSettings({ ...settings, salesperson_can_create_custom_item: checked })}
            />
            <ToggleRow
              label="Custom items require approval"
              checked={Boolean(settings.require_approval_for_custom_items)}
              onChange={(checked) => setSettings({ ...settings, require_approval_for_custom_items: checked })}
            />
            <ToggleRow
              label="Salespeople can create packages"
              checked={Boolean(settings.salesperson_can_create_package)}
              onChange={(checked) => setSettings({ ...settings, salesperson_can_create_package: checked })}
            />
          </div>
        </div>
      ) : null}

      {section === "discounts" ? (
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Default max discount % (salesperson fallback)">
            <Input compact type="number" value={Number(settings.max_discount_percent) || 0} onChange={(e) => setSettings({ ...settings, max_discount_percent: Number(e.target.value) })} />
          </Field>
          <Field label="Salesperson max %">
            <Input
              compact
              type="number"
              value={settings.discount_authority?.find((r) => r.role === "SALESPERSON")?.max_percent ?? settings.max_discount_percent ?? 5}
              onChange={(e) => {
                const rest = (settings.discount_authority ?? []).filter((r) => r.role !== "SALESPERSON");
                setSettings({ ...settings, discount_authority: [...rest, { role: "SALESPERSON", max_percent: Number(e.target.value) }] });
              }}
            />
          </Field>
          <Field label="Manager max % (blank = unrestricted)">
            <Input
              compact
              type="number"
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

      {section === "margin" ? (
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Minimum acceptable margin %">
            <Input compact type="number" value={settings.min_margin_percent ?? ""} onChange={(e) => setSettings({ ...settings, min_margin_percent: e.target.value === "" ? null : Number(e.target.value) })} />
          </Field>
          <Field label="Warning threshold %">
            <Input compact type="number" value={settings.margin_warning_percent ?? ""} onChange={(e) => setSettings({ ...settings, margin_warning_percent: e.target.value === "" ? null : Number(e.target.value) })} />
          </Field>
          <Field label="What salespeople can see">
            <Select value={String(settings.margin_visibility ?? "none")} onChange={(e) => setSettings({ ...settings, margin_visibility: e.target.value })}>
              <option value="none">No margin information</option>
              <option value="health">Margin health only</option>
              <option value="percent">Margin %</option>
              <option value="full">Cost + gross profit + margin</option>
            </Select>
          </Field>
        </div>
      ) : null}

      {section === "approvals" ? (
        <div className="space-y-4">
          <Field label="Quotation value threshold (optional)">
            <Input compact type="number" value={settings.approval_value_threshold ?? ""} onChange={(e) => setSettings({ ...settings, approval_value_threshold: e.target.value === "" ? null : Number(e.target.value) })} />
          </Field>
          <div className="overflow-hidden rounded-[10px] border border-sales-border">
            <div className="grid grid-cols-12 gap-2 border-b border-sales-border-subtle bg-sales-surface-subtle px-3 py-2 text-[10px] font-medium uppercase tracking-[0.04em] text-sales-text-muted">
              <span className="col-span-3">Name</span>
              <span className="col-span-3">When</span>
              <span className="col-span-3">Approver</span>
              <span className="col-span-3">Status</span>
            </div>
            {policies.length === 0 ? (
              <p className="px-3 py-5 text-[13px] text-sales-text-muted">
                No policies yet. Fallback discount and margin rules still apply.
              </p>
            ) : (
              policies.map((p) => (
                <div key={p.id} className="grid grid-cols-12 items-center gap-2 border-t border-sales-border-subtle px-3 py-2.5 text-[13px]">
                  <span className="col-span-3 font-medium text-sales-text-primary">{p.name}</span>
                  <span className="col-span-3 text-sales-text-secondary">
                    {humanReadablePolicy(p)}
                  </span>
                  <span className="col-span-3 text-sales-text-secondary">{p.approver_role === "SUPER_ADMIN" ? "Admin" : "Sales Manager"}</span>
                  <div className="col-span-3 flex items-center gap-3">
                    <Switch checked={p.is_active} onCheckedChange={() => void togglePolicy(p)} aria-label={`${p.name} active`} />
                    <button
                      type="button"
                      className="text-[12px] text-sales-text-muted hover:text-sales-danger"
                      onClick={() => void deletePolicy(p)}
                    >
                      Deactivate
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
          <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-5">
            <Input compact placeholder="Policy name" value={newPolicy.name} onChange={(e) => setNewPolicy({ ...newPolicy, name: e.target.value })} />
            <Select value={newPolicy.trigger_type} onChange={(e) => setNewPolicy({ ...newPolicy, trigger_type: e.target.value })}>
              <option value="discount">When discount</option>
              <option value="margin">When margin</option>
              <option value="quotation_value">When quotation value</option>
              <option value="payment_terms">When payment terms</option>
              <option value="price_override">When price override</option>
              <option value="custom_item">When custom item</option>
              <option value="special_product">When restricted product</option>
              <option value="special_package">When restricted package</option>
            </Select>
            <Select value={newPolicy.operator} onChange={(e) => setNewPolicy({ ...newPolicy, operator: e.target.value })}>
              <option value="gt">is greater than</option>
              <option value="gte">is at least</option>
              <option value="lt">is less than</option>
              <option value="lte">is at most</option>
            </Select>
            <Input compact type="number" value={newPolicy.threshold_numeric} onChange={(e) => setNewPolicy({ ...newPolicy, threshold_numeric: Number(e.target.value) })} />
            <Button variant="secondary" size="sm" onClick={() => void addPolicy()}>
              Add policy
            </Button>
          </div>
          <p className="text-[12px] text-sales-text-secondary">
            {humanReadablePolicy(newPolicy)}
          </p>
        </div>
      ) : null}

      {section === "customer" ? (
        <div className="space-y-1">
          {[
            ["customer_allow_accept", "Allow Accept"],
            ["customer_allow_request_changes", "Allow Request changes"],
            ["customer_allow_ask_question", "Allow Ask a question"],
            ["customer_allow_decline", "Allow Decline"],
            ["customer_allow_option_selection", "Allow option selection"],
            ["require_acceptance_name", "Require acceptance name"],
            ["require_acceptance_checkbox", "Require confirmation checkbox"],
          ].map(([key, label]) => (
            <Checkbox
              key={key}
              label={label}
              checked={Boolean(settings[key as keyof Settings] ?? (key !== "require_acceptance_name"))}
              onCheckedChange={(checked) => setSettings({ ...settings, [key]: checked })}
            />
          ))}
        </div>
      ) : null}

      {section === "terms" ? (
        <Field label="Default terms (snapshotted when a quotation is sent)">
          <TextArea rows={6} value={settings.default_terms ?? ""} onChange={(e) => setSettings({ ...settings, default_terms: e.target.value })} />
        </Field>
      ) : null}

      {hideSave ? null : (
        <div className="flex items-center gap-3 border-t border-sales-border-subtle pt-4">
          <Button variant="primary" size="sm" loading={saving} onClick={() => void save()}>
            Save
          </Button>
          {toast ? <span className="text-[12px] text-sales-success-fg">{toast}</span> : null}
        </div>
      )}
    </div>
  );
}

function ToggleRow({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-[8px] border border-sales-border-subtle px-3 py-2.5">
      <span className="text-[13px] text-sales-text-primary">{label}</span>
      <Switch checked={checked} onCheckedChange={onChange} aria-label={label} />
    </div>
  );
}
