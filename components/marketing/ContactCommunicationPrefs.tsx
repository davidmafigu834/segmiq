"use client";

import { useEffect, useState } from "react";
import { MarketingHubTabs } from "./MarketingHubTabs";
import type { ConsentStatus } from "@/lib/marketing/types";

type Prefs = {
  whatsapp_marketing: ConsentStatus;
  service_updates: ConsentStatus;
  consent_source: string | null;
  consent_date: string | null;
  suppressed: boolean;
};

export function ContactCommunicationPrefs({
  clientId,
  contactId,
}: {
  clientId: string;
  contactId: string;
}) {
  const [prefs, setPrefs] = useState<Prefs | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetch(`/api/clients/${clientId}/contacts/${contactId}/communication-prefs`)
      .then((r) => r.json())
      .then((data) => setPrefs(data.prefs ?? null));
  }, [clientId, contactId]);

  async function update(field: keyof Prefs, value: string | boolean) {
    if (!prefs) return;
    setSaving(true);
    const res = await fetch(
      `/api/clients/${clientId}/contacts/${contactId}/communication-prefs`,
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ [field]: value }),
      }
    );
    const data = await res.json();
    if (data.prefs) setPrefs(data.prefs);
    setSaving(false);
  }

  if (!prefs) return null;

  return (
    <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4">
      <h3 className="mb-3 text-sm font-medium text-[var(--text-primary)]">Communication preferences</h3>
      <div className="space-y-3 text-sm">
        <PrefRow
          label="WhatsApp marketing"
          value={prefs.whatsapp_marketing}
          options={["opted_in", "opted_out", "unknown"]}
          disabled={saving}
          onChange={(v) => update("whatsapp_marketing", v)}
        />
        <PrefRow
          label="Service updates"
          value={prefs.service_updates}
          options={["opted_in", "opted_out", "unknown"]}
          disabled={saving}
          onChange={(v) => update("service_updates", v)}
        />
        {prefs.consent_date && (
          <p className="text-xs text-[var(--text-tertiary)]">
            Consent recorded {new Date(prefs.consent_date).toLocaleDateString()}
            {prefs.consent_source ? ` via ${prefs.consent_source}` : ""}
          </p>
        )}
      </div>
    </div>
  );
}

function PrefRow({
  label,
  value,
  options,
  disabled,
  onChange,
}: {
  label: string;
  value: string;
  options: string[];
  disabled: boolean;
  onChange: (v: string) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-[var(--text-secondary)]">{label}</span>
      <select
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value)}
        className="rounded-lg border border-[var(--border)] bg-[var(--background)] px-2 py-1 text-xs capitalize"
      >
        {options.map((o) => (
          <option key={o} value={o}>
            {o.replace(/_/g, " ")}
          </option>
        ))}
      </select>
    </div>
  );
}

export function CommunicationPreferencesPage({ clientId: _clientId }: { clientId: string }) {
  return (
    <div>
      <MarketingHubTabs />
      <div className="mb-6">
        <h2 className="text-lg font-semibold text-[var(--text-primary)]">Communication preferences</h2>
        <p className="mt-1 max-w-xl text-sm text-[var(--text-secondary)]">
          Marketing campaigns only send to contacts with explicit WhatsApp marketing consent.
          Update consent on individual contact profiles in Customer Hub.
        </p>
      </div>
      <div className="rounded-xl border border-dashed border-[var(--border)] px-6 py-10 text-center text-sm text-[var(--text-tertiary)]">
        Open any contact in{" "}
        <a href="/client/contacts" className="text-[var(--accent)] hover:underline">
          Customer Hub
        </a>{" "}
        to manage their WhatsApp marketing consent.
      </div>
    </div>
  );
}
