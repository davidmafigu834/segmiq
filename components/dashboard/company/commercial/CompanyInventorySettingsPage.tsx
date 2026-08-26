"use client";

import { useEffect, useState } from "react";
import { CommercialModulePage } from "./CommercialModulePage";
import { Button, FieldLabel, Select, Switch, useSalesToast } from "@/components/sales/ui";
import type { UserRole } from "@/types";

type Settings = {
  provider: "SEGMIQ" | "EXTERNAL";
  allowNegativeStock: boolean;
  defaultLocationId: string | null;
  staleAfterMinutes: number;
  agentDisclosure: "EXACT" | "GENERAL" | "HIDDEN";
  warnInsufficientStock: boolean;
  blockInsufficientStock: boolean;
  lowStockNotifications: boolean;
};

type Loc = { id: string; name: string };

export function CompanyInventorySettingsPage({
  clientId,
  chrome,
}: {
  clientId: string;
  chrome: Parameters<typeof CommercialModulePage>[0]["chrome"] & { notificationRole: UserRole };
}) {
  const { toast } = useSalesToast();
  const [settings, setSettings] = useState<Settings | null>(null);
  const [locations, setLocations] = useState<Loc[]>([]);

  useEffect(() => {
    fetch(`/api/clients/${clientId}/inventory`)
      .then((r) => r.json())
      .then((j: { settings?: Settings; locations?: Loc[] }) => {
        setSettings(j.settings ?? null);
        setLocations(j.locations ?? []);
      });
  }, [clientId]);

  async function save() {
    if (!settings) return;
    const res = await fetch(`/api/clients/${clientId}/inventory`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(settings),
    });
    if (!res.ok) {
      toast({ title: "Could not save settings", tone: "error" });
      return;
    }
    toast({ title: "Inventory settings saved", tone: "success" });
  }

  if (!settings) {
    return (
      <CommercialModulePage chrome={chrome} breadcrumb="Company / Inventory / Settings" title="Inventory settings" description="How stock is tracked, disclosed, and warned on quotations.">
        <p className="mt-6 text-[13px] text-sales-text-muted">Loading…</p>
      </CommercialModulePage>
    );
  }

  return (
    <CommercialModulePage
      chrome={chrome}
      breadcrumb="Company / Inventory / Settings"
      title="Inventory settings"
      description="How stock is tracked, disclosed, and warned on quotations."
      primaryAction={
        <Button size="md" onClick={() => void save()}>
          Save
        </Button>
      }
    >
      <div className="mt-4 max-w-xl space-y-4">
        <div>
          <FieldLabel>Provider</FieldLabel>
          <Select
            value={settings.provider}
            onChange={(e) => setSettings({ ...settings, provider: e.target.value as Settings["provider"] })}
          >
            <option value="SEGMIQ">SEGMIQ</option>
            <option value="EXTERNAL">External (read-only stub)</option>
          </Select>
        </div>
        <div>
          <FieldLabel>Default location</FieldLabel>
          <Select
            value={settings.defaultLocationId ?? ""}
            onChange={(e) => setSettings({ ...settings, defaultLocationId: e.target.value || null })}
          >
            <option value="">None</option>
            {locations.map((l) => (
              <option key={l.id} value={l.id}>
                {l.name}
              </option>
            ))}
          </Select>
        </div>
        <div>
          <FieldLabel>Agent stock disclosure</FieldLabel>
          <Select
            value={settings.agentDisclosure}
            onChange={(e) => setSettings({ ...settings, agentDisclosure: e.target.value as Settings["agentDisclosure"] })}
          >
            <option value="EXACT">Exact quantity</option>
            <option value="GENERAL">In stock / limited / unavailable</option>
            <option value="HIDDEN">Hidden</option>
          </Select>
        </div>
        <label className="flex items-center justify-between gap-3 text-[13px]">
          Allow negative stock
          <Switch
            checked={settings.allowNegativeStock}
            onCheckedChange={(v) => setSettings({ ...settings, allowNegativeStock: v })}
          />
        </label>
        <label className="flex items-center justify-between gap-3 text-[13px]">
          Warn when quotation exceeds available stock
          <Switch
            checked={settings.warnInsufficientStock}
            onCheckedChange={(v) => setSettings({ ...settings, warnInsufficientStock: v })}
          />
        </label>
        <label className="flex items-center justify-between gap-3 text-[13px]">
          Block send when quotation exceeds available stock
          <Switch
            checked={settings.blockInsufficientStock}
            onCheckedChange={(v) => setSettings({ ...settings, blockInsufficientStock: v })}
          />
        </label>
        <label className="flex items-center justify-between gap-3 text-[13px]">
          Notify managers on low stock
          <Switch
            checked={settings.lowStockNotifications}
            onCheckedChange={(v) => setSettings({ ...settings, lowStockNotifications: v })}
          />
        </label>
      </div>
    </CommercialModulePage>
  );
}
