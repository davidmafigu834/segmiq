import { AgencyLayout } from "@/components/layouts/AgencyLayout";
import { createAdminClient } from "@/lib/supabase/admin";
import { CampaignsDashboard } from "@/components/campaigns/CampaignsDashboard";
import { RecordFrame } from "@/components/platform/workbench";

export default async function CampaignsPage() {
  const supabase = createAdminClient();
  const { data: clients } = await supabase
    .from("clients")
    .select("id, name")
    .eq("is_active", true)
    .order("name");

  return (
    <AgencyLayout breadcrumb="Operations / Campaigns" pageTitle="Campaigns">
      <RecordFrame
        detail="A campaign belongs to one organisation."
        fact={{
          name: clients?.length ? "Pick the organisation before you read the campaign." : "No active organisation is available.",
          detail: "The register below is the record. The organisation is where the campaign is changed.",
          action: "Open organisations",
          href: "/dashboard/clients",
        }}
      >
        <CampaignsDashboard allClients={(clients ?? []) as { id: string; name: string }[]} />
      </RecordFrame>
    </AgencyLayout>
  );
}
