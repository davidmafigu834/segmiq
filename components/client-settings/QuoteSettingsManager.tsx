"use client";

import { useEffect, useState } from "react";
import { QuoteTemplatesManager } from "@/components/client-settings/QuoteTemplatesManager";
import { QuotationCommercialSettings } from "@/components/client-settings/QuotationCommercialSettings";
import { SignatureDrawPad } from "@/components/quotations/SignatureDrawPad";
import { SettingsSectionCard } from "@/components/dashboard/company/settings/SettingsSectionCard";
import { Button, Field, Input, Skeleton, Tabs, TextArea } from "@/components/sales/ui";

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
  authorised_signatory_name?: string | null;
  authorised_signatory_role?: string | null;
  authorised_signature_url?: string | null;
};

const SECTION_COPY: Record<QuoteSettingsTab, { title: string; description: string }> = {
  general: {
    title: "General",
    description: "Company identity, authorised signature, and defaults that appear on every quotation.",
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
  const [loading, setLoading] = useState(true);
  const [settings, setSettings] = useState<Settings | null>(null);
  const [savingSettings, setSavingSettings] = useState(false);
  const [savingSignature, setSavingSignature] = useState(false);
  const [toast, setToast] = useState("");

  useEffect(() => {
    fetch(`/api/clients/${clientId}/quotation-settings`)
      .then((r) => r.json())
      .then((set: { settings?: Settings }) => {
        setSettings(set.settings ?? null);
      })
      .finally(() => setLoading(false));
  }, [clientId]);

  function flash(msg: string) {
    setToast(msg);
    window.setTimeout(() => setToast(""), 2000);
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

  async function saveDrawnSignature(blob: Blob) {
    setSavingSignature(true);
    try {
      const body = new FormData();
      body.append("file", blob, "authorised-signature.png");
      const res = await fetch(`/api/clients/${clientId}/quotation-settings/signature`, {
        method: "POST",
        body,
      });
      const json = (await res.json().catch(() => ({}))) as { settings?: Settings; error?: string };
      if (!res.ok) throw new Error(json.error ?? "Could not save signature");
      const next = json.settings;
      if (next) setSettings((prev) => ({ ...(prev ?? next), ...next }));
      flash("Signature saved");
    } finally {
      setSavingSignature(false);
    }
  }

  async function clearSavedSignature() {
    setSavingSignature(true);
    try {
      const res = await fetch(`/api/clients/${clientId}/quotation-settings/signature`, { method: "DELETE" });
      const json = (await res.json().catch(() => ({}))) as { settings?: Settings; error?: string };
      if (!res.ok) throw new Error(json.error ?? "Could not remove signature");
      const next = json.settings;
      if (next) setSettings((prev) => ({ ...(prev ?? next), ...next }));
      else setSettings((prev) => (prev ? { ...prev, authorised_signature_url: null } : prev));
      flash("Signature removed");
    } finally {
      setSavingSignature(false);
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
              <div className="space-y-3 rounded-[10px] border border-sales-border bg-sales-surface-subtle/60 p-4">
                <div>
                  <h3 className="text-[14px] font-semibold text-sales-text-primary">Authorised signature</h3>
                  <p className="mt-0.5 text-[12.5px] text-sales-text-secondary">
                    Draw the company authorised signature. It appears on every quotation this company sends.
                  </p>
                </div>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <Field label="Signatory name">
                    <Input
                      compact
                      value={settings.authorised_signatory_name ?? ""}
                      onChange={(e) => setSettings({ ...settings, authorised_signatory_name: e.target.value })}
                      placeholder="e.g. Maya Petersen"
                    />
                  </Field>
                  <Field label="Signatory role">
                    <Input
                      compact
                      value={settings.authorised_signatory_role ?? ""}
                      onChange={(e) => setSettings({ ...settings, authorised_signatory_role: e.target.value })}
                      placeholder="e.g. Director"
                    />
                  </Field>
                </div>
                <SignatureDrawPad
                  savedUrl={settings.authorised_signature_url ?? null}
                  busy={savingSignature}
                  onSave={saveDrawnSignature}
                  onClearSaved={clearSavedSignature}
                />
              </div>
              <SaveRow saving={savingSettings} label="Save general settings" toast={toast} onSave={() => void saveSettings()} />
              <QuotationCommercialSettings clientId={clientId} section="general" hideSave={false} />
            </div>
          ) : null}

          {tab === "catalog" ? (
            <div className="space-y-3">
              <p className="text-[13px] text-sales-text-secondary">
                Products and services now live in the Products module. Quotation settings keep pricing, discounts, margin and approval rules.
              </p>
              <Button size="sm" onClick={() => (window.location.href = "/client/products")}>
                Open Products
              </Button>
            </div>
          ) : null}

          {tab === "pricing" || tab === "discounts" || tab === "margin" || tab === "approvals" || tab === "customer" ? (
            <QuotationCommercialSettings
              clientId={clientId}
              section={tab}
            />
          ) : null}

          {tab === "packages" ? (
            <div className="space-y-3">
              <p className="text-[13px] text-sales-text-secondary">
                Selling packages are managed as first-class Packages. This is separate from marketing send packages.
              </p>
              <Button size="sm" onClick={() => (window.location.href = "/client/packages")}>
                Open Packages
              </Button>
            </div>
          ) : null}
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

