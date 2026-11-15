import { AgencyLayout } from "@/components/layouts/AgencyLayout";
import { AgencySettingsClient } from "@/components/agency-settings/AgencySettingsClient";
import { RecordFrame } from "@/components/platform/workbench";

export default function SettingsPage() {
  return (
    <AgencyLayout breadcrumb="Configuration / Settings" pageTitle="Platform Settings">
      <RecordFrame
        detail="Platform configuration and integrations. Account email and sign-in sit on the account tab."
        fact={{
          name: "Account is the decision when sign-in changes.",
          detail: "The form below is the platform record.",
          action: "Open account",
          href: "/dashboard/settings?tab=account",
        }}
      >
        <AgencySettingsClient />
      </RecordFrame>
    </AgencyLayout>
  );
}
