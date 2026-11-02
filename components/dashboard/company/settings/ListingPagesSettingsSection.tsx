"use client";

import { useEffect, useState, type FormEvent } from "react";
import { SettingsSectionCard } from "./SettingsSectionCard";

type Settings = {
  enabled: boolean;
  agentsMayGenerate: boolean;
  publicAgencyName: string | null;
  showAgentName: boolean;
  showAgentPhoto: boolean;
  showAgentPhone: boolean;
  publicContactPolicy: string;
  enquiryRouting: string;
  catalogueUrl: string | null;
  verifiedWebsite: string | null;
  attributionWindowDays: number;
  maxCampaignLinks: number;
};

export function ListingPagesSettingsSection({ clientId }: { clientId: string }) {
  const [settings, setSettings] = useState<Settings | null>(null);
  const [suggested, setSuggested] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    void fetch(`/api/clients/${clientId}/listing-pages/settings`)
      .then((response) => response.json())
      .then((json: { settings?: Settings; suggestedWebsite?: string | null; error?: string }) => {
        if (json.settings) setSettings(json.settings);
        setSuggested(json.suggestedWebsite ?? null);
        if (json.error) setMessage(json.error);
      });
  }, [clientId]);

  async function save(event: FormEvent) {
    event.preventDefault();
    if (!settings) return;
    const response = await fetch(`/api/clients/${clientId}/listing-pages/settings`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(settings),
    });
    const json = (await response.json().catch(() => ({}))) as { error?: string };
    setMessage(response.ok ? "Listing page settings saved" : json.error ?? "Could not save");
  }

  if (!settings) return <p className="text-[13px] text-sales-text-muted">Loading listing page settings…</p>;

  return (
    <SettingsSectionCard title="Agent listing pages" description="Agents market approved company listings with personal links. The agency still owns the inventory.">
      <form className="space-y-3" onSubmit={(event) => void save(event)}>
        <Toggle label="Enable agent listing pages" checked={settings.enabled} onChange={(enabled) => setSettings({ ...settings, enabled })} />
        <Toggle label="Allow agents to generate links" checked={settings.agentsMayGenerate} onChange={(agentsMayGenerate) => setSettings({ ...settings, agentsMayGenerate })} />
        <Field label="Public agency name" value={settings.publicAgencyName ?? ""} onChange={(publicAgencyName) => setSettings({ ...settings, publicAgencyName: publicAgencyName || null })} />
        <Field label="Verified website" value={settings.verifiedWebsite ?? ""} placeholder={suggested ?? "https://"} onChange={(verifiedWebsite) => setSettings({ ...settings, verifiedWebsite: verifiedWebsite || null })} />
        <Field label="Property catalogue URL" value={settings.catalogueUrl ?? ""} onChange={(catalogueUrl) => setSettings({ ...settings, catalogueUrl: catalogueUrl || null })} />
        <label className="block text-[13px]">Public contact
          <select className="mt-1 h-10 w-full rounded-[10px] border border-sales-border bg-transparent px-3" value={settings.publicContactPolicy} onChange={(event) => setSettings({ ...settings, publicContactPolicy: event.target.value })}>
            <option value="enquiry_form">Enquiry form only</option>
            <option value="agency_whatsapp">Agency WhatsApp number</option>
            <option value="agent_whatsapp_if_allowed">Agent WhatsApp when allowed</option>
          </select>
        </label>
        <label className="block text-[13px]">Enquiry routing
          <select className="mt-1 h-10 w-full rounded-[10px] border border-sales-border bg-transparent px-3" value={settings.enquiryRouting} onChange={(event) => setSettings({ ...settings, enquiryRouting: event.target.value })}>
            <option value="assign_marketing_agent">New enquiries go to the marketing agent</option>
            <option value="agency_assignment">Use the agency assignment rules</option>
          </select>
        </label>
        <Toggle label="Show agent name" checked={settings.showAgentName} onChange={(showAgentName) => setSettings({ ...settings, showAgentName })} />
        <Toggle label="Show agent photo" checked={settings.showAgentPhoto} onChange={(showAgentPhoto) => setSettings({ ...settings, showAgentPhoto })} />
        <Toggle label="Allow agent phone on the public page" checked={settings.showAgentPhone} onChange={(showAgentPhone) => setSettings({ ...settings, showAgentPhone })} />
        <p className="text-[12px] text-sales-text-muted">Logo and company profile stay in Branding. Existing customers are not reassigned. Attribution window: {settings.attributionWindowDays} days.</p>
        <button type="submit" className="h-10 rounded-[10px] bg-sales-brand px-4 text-[13px] font-semibold text-sales-brand-text">Save</button>
        {message ? <p className="text-[13px] text-sales-text-secondary">{message}</p> : null}
      </form>
    </SettingsSectionCard>
  );
}

function Field({ label, value, onChange, placeholder }: { label: string; value: string; onChange: (value: string) => void; placeholder?: string }) {
  return (
    <label className="block text-[13px]">{label}
      <input value={value} placeholder={placeholder} onChange={(event) => onChange(event.target.value)} className="mt-1 h-10 w-full rounded-[10px] border border-sales-border bg-transparent px-3" />
    </label>
  );
}

function Toggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (value: boolean) => void }) {
  return (
    <label className="flex items-center justify-between gap-3 text-[13px]">
      <span>{label}</span>
      <input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} />
    </label>
  );
}
