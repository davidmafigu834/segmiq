import { AgencyLayout } from "@/components/layouts/AgencyLayout";
import { createAdminClient } from "@/lib/supabase/admin";
import { ReportsPageClient } from "./ReportsPageClient";
import { RecordFrame } from "@/components/platform/workbench";

export default async function ReportsPage() {
  const supabase = createAdminClient();
  const { data: clients } = await supabase
    .from("clients")
    .select("id, name")
    .eq("is_active", true)
    .order("name");

  return (
    <AgencyLayout breadcrumb="Operations / Reports" pageTitle="Reports">
      <RecordFrame
        detail="Pick an organisation, then read the report. The numbers belong to that record."
        fact={{
          name: clients?.length ? "Choose the organisation first." : "No active organisation is available.",
          detail: "Portfolio totals sit under the organisation you select.",
          action: "Open organisations",
          href: "/dashboard/clients",
        }}
      >
        <ReportsPageClient clients={clients ?? []} />
      </RecordFrame>
    </AgencyLayout>
  );
}
