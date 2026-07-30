import { AgencyLayout } from "@/components/layouts/AgencyLayout";
import { AgencySettingsClient } from "@/components/agency-settings/AgencySettingsClient";

export default function SettingsPage() {
  return (
    <AgencyLayout hideShellHeader breadcrumb="PLATFORM / SETTINGS" pageTitle="Settings">
      <div className="mb-10">
        <p className="font-mono text-[11px] uppercase tracking-wide text-ink-tertiary">PLATFORM / SETTINGS</p>
        <h1 className="font-display text-[28px] leading-none tracking-display text-ink-primary md:text-[40px]">Agency settings</h1>
        <p className="mt-2 text-[14px] text-[var(--text-secondary)]">Platform-wide configuration and integrations.</p>
      </div>
      <AgencySettingsClient />
    </AgencyLayout>
  );
}
