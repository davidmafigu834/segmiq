"use client";

import { useEffect, useState } from "react";
import { MarketingHubTabs } from "./MarketingHubTabs";

type Settings = {
  quiet_hours_start: string | null;
  quiet_hours_end: string | null;
  timezone: string;
  max_messages_per_contact_per_week: number;
  approval_threshold: number;
  duplicate_campaign_days: number;
  auto_pause_opt_out_rate: number;
  estimated_cost_per_message_usd: number | null;
};

export function MarketingSettingsPage({ clientId }: { clientId: string }) {
  const [settings, setSettings] = useState<Settings | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    fetch(`/api/clients/${clientId}/marketing/settings`)
      .then((r) => r.json())
      .then((d) => setSettings(d.settings ?? null));
  }, [clientId]);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!settings) return;
    setSaving(true);
    setSaved(false);

    const res = await fetch(`/api/clients/${clientId}/marketing/settings`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(settings),
    });

    const data = await res.json();
    if (data.settings) setSettings(data.settings);
    setSaving(false);
    setSaved(true);
  }

  if (!settings) return <div className="shimmer h-48 rounded-xl" />;

  return (
    <div>
      <MarketingHubTabs />

      <div className="mb-6">
        <h2 className="text-lg font-semibold text-[var(--text-primary)]">Marketing settings</h2>
        <p className="mt-1 text-sm text-[var(--text-secondary)]">
          Compliance rules applied to all WhatsApp campaigns.
        </p>
      </div>

      <form onSubmit={(e) => void handleSave(e)} className="max-w-lg space-y-5">
        <fieldset className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-5 space-y-4">
          <legend className="px-1 text-sm font-medium text-[var(--text-primary)]">Quiet hours</legend>
          <p className="text-xs text-[var(--text-tertiary)]">
            Campaigns pause during these hours (local timezone).
          </p>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="mb-1 block text-xs text-[var(--text-secondary)]">Start</label>
              <input
                type="time"
                value={(settings.quiet_hours_start ?? "20:00").slice(0, 5)}
                onChange={(e) =>
                  setSettings({ ...settings, quiet_hours_start: `${e.target.value}:00` })
                }
                className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs text-[var(--text-secondary)]">End</label>
              <input
                type="time"
                value={(settings.quiet_hours_end ?? "08:00").slice(0, 5)}
                onChange={(e) =>
                  setSettings({ ...settings, quiet_hours_end: `${e.target.value}:00` })
                }
                className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm"
              />
            </div>
          </div>
          <div>
            <label className="mb-1 block text-xs text-[var(--text-secondary)]">Timezone</label>
            <input
              value={settings.timezone}
              onChange={(e) => setSettings({ ...settings, timezone: e.target.value })}
              className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm"
            />
          </div>
        </fieldset>

        <fieldset className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-5 space-y-4">
          <legend className="px-1 text-sm font-medium text-[var(--text-primary)]">Limits</legend>
          <div>
            <label className="mb-1 block text-xs text-[var(--text-secondary)]">
              Max marketing messages per contact per week
            </label>
            <input
              type="number"
              min={1}
              max={7}
              value={settings.max_messages_per_contact_per_week}
              onChange={(e) =>
                setSettings({
                  ...settings,
                  max_messages_per_contact_per_week: Number(e.target.value),
                })
              }
              className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs text-[var(--text-secondary)]">
              Manager approval required above (recipients)
            </label>
            <input
              type="number"
              min={1}
              value={settings.approval_threshold}
              onChange={(e) =>
                setSettings({ ...settings, approval_threshold: Number(e.target.value) })
              }
              className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs text-[var(--text-secondary)]">
              Block duplicate campaigns within (days)
            </label>
            <input
              type="number"
              min={1}
              max={90}
              value={settings.duplicate_campaign_days}
              onChange={(e) =>
                setSettings({ ...settings, duplicate_campaign_days: Number(e.target.value) })
              }
              className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs text-[var(--text-secondary)]">
              Auto-pause if opt-out rate exceeds (%)
            </label>
            <input
              type="number"
              min={1}
              max={100}
              value={Math.round(settings.auto_pause_opt_out_rate * 100)}
              onChange={(e) =>
                setSettings({
                  ...settings,
                  auto_pause_opt_out_rate: Number(e.target.value) / 100,
                })
              }
              className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs text-[var(--text-secondary)]">
              Estimated cost per WhatsApp message (USD)
            </label>
            <input
              type="number"
              min={0}
              step={0.0001}
              value={settings.estimated_cost_per_message_usd ?? ""}
              onChange={(e) =>
                setSettings({
                  ...settings,
                  estimated_cost_per_message_usd: e.target.value
                    ? Number(e.target.value)
                    : null,
                })
              }
              placeholder="e.g. 0.05"
              className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm"
            />
            <p className="mt-1 text-xs text-[var(--text-tertiary)]">
              Used to calculate ROAS and cost per opportunity in Reports.
            </p>
          </div>
        </fieldset>

        <button
          type="submit"
          disabled={saving}
          className="rounded-lg bg-[var(--accent)] px-4 py-2 text-sm font-medium text-black disabled:opacity-50"
        >
          {saving ? "Saving…" : "Save settings"}
        </button>
        {saved && <p className="text-sm text-[var(--success)]">Settings saved.</p>}
      </form>
    </div>
  );
}
