"use client";

import { useState } from "react";
import type { PortalSettings } from "@/lib/portal/service";

const FIELDS: Array<{ key: keyof PortalSettings; label: string }> = [
  { key: "enabled", label: "Customer portal enabled" },
  { key: "showProjectFinancials", label: "Show project value and balance" },
  { key: "allowPaymentProofUpload", label: "Allow payment proof uploads" },
  { key: "showAssets", label: "Show installed equipment" },
  { key: "showSerialNumbers", label: "Show serial numbers" },
  { key: "showWarranties", label: "Show warranty information" },
  { key: "allowSupport", label: "Allow support requests" },
  { key: "allowUpgradeRequests", label: "Allow upgrade requests" },
  { key: "portalAiEnabled", label: "Allow customers to ask about their project" },
];

export function PortalSettingsForm({
  initial,
  usage,
}: {
  initial: PortalSettings;
  usage: { invited: number; activated: number; paymentProofs: number; supportRequests: number; upgradeEnquiries: number };
}) {
  const [settings, setSettings] = useState(initial);
  const [note, setNote] = useState("");

  return (
    <form
      className="max-w-xl space-y-4"
      onSubmit={async (event) => {
        event.preventDefault();
        setNote("");
        const res = await fetch("/api/portal-settings", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(settings),
        });
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        setNote(res.ok ? "Saved." : data.error || "Could not save.");
      }}
    >
      <div className="grid gap-2 text-[13px] text-sales-text-secondary sm:grid-cols-2">
        <p>Invited {usage.invited}</p>
        <p>Activated {usage.activated}</p>
        <p>Payment proofs {usage.paymentProofs}</p>
        <p>Support requests {usage.supportRequests}</p>
        <p>Upgrade enquiries {usage.upgradeEnquiries}</p>
      </div>
      {FIELDS.map((field) => (
        <label key={field.key} className="flex min-h-11 items-center justify-between gap-4 rounded-sales-md border border-sales-border px-3">
          <span className="text-[13px]">{field.label}</span>
          <input
            type="checkbox"
            checked={settings[field.key]}
            onChange={(event) => setSettings((current) => ({ ...current, [field.key]: event.target.checked }))}
          />
        </label>
      ))}
      {note ? <p className="text-[13px]">{note}</p> : null}
      <button type="submit" className="min-h-11 rounded-sales-md bg-sales-text-primary px-4 text-[13px] font-medium text-white">Save portal settings</button>
    </form>
  );
}

export function StaffIntelligenceForm({ initial }: { initial: { operations: boolean; actions: boolean } }) {
  const [settings, setSettings] = useState(initial);
  const [note, setNote] = useState("");
  return (
    <form
      className="max-w-xl space-y-3"
      onSubmit={async (event) => {
        event.preventDefault();
        const res = await fetch("/api/intelligence/settings", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(settings),
        });
        setNote(res.ok ? "Saved." : "Could not save.");
      }}
    >
      <label className="flex min-h-11 items-center justify-between gap-4 rounded-sales-md border border-sales-border px-3 text-[13px]">
        Operations intelligence
        <input type="checkbox" checked={settings.operations} onChange={(event) => setSettings((current) => ({ ...current, operations: event.target.checked }))} />
      </label>
      <label className="flex min-h-11 items-center justify-between gap-4 rounded-sales-md border border-sales-border px-3 text-[13px]">
        Allow approved agent actions
        <input type="checkbox" checked={settings.actions} onChange={(event) => setSettings((current) => ({ ...current, actions: event.target.checked }))} />
      </label>
      {note ? <p className="text-[13px]">{note}</p> : null}
      <button type="submit" className="min-h-11 rounded-sales-md bg-sales-text-primary px-4 text-[13px] font-medium text-white">Save intelligence</button>
    </form>
  );
}
