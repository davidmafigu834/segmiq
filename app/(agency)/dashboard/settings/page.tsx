import { AgencyLayout } from "@/components/layouts/AgencyLayout";
import { AgencySettingsClient } from "@/components/agency-settings/AgencySettingsClient";

export default function SettingsPage() {
  return (
    <AgencyLayout breadcrumb="Configuration / Settings" pageTitle="Platform Settings">
      <p className="mb-6 max-w-2xl text-[13px] text-[var(--text-secondary)]">
        Platform-wide configuration and integrations.
      </p>
      <AgencySettingsClient />
    </AgencyLayout>
  );
}
