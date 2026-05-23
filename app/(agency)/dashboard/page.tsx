import { AgencyLayout } from "@/components/layouts/AgencyLayout";
import { AgencyDashboardClient } from "./AgencyDashboardClient";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  return (
    <AgencyLayout breadcrumb="AGENCY" pageTitle="Overview" titleSize="hero" hideShellHeader>
      <AgencyDashboardClient />
    </AgencyLayout>
  );
}
