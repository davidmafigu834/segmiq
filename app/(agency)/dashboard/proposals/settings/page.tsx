import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { AgencyLayout } from "@/components/layouts/AgencyLayout";
import { ProposalSettingsManager } from "@/components/proposals/ProposalSettingsManager";
import { RecordFrame } from "@/components/platform/workbench";
import { createAdminClient } from "@/lib/supabase/admin";
import { ensureProposalSettings } from "@/lib/proposals/proposal-number";
import type { ProposalSettingsRow } from "@/types";

export const dynamic = "force-dynamic";

export default async function ProposalSettingsPage() {
  const session = await getServerSession(authOptions);
  if (!session || session.role !== "SUPER_ADMIN") {
    redirect("/login");
  }

  const supabase = createAdminClient();
  const settings = (await ensureProposalSettings(supabase)) as unknown as ProposalSettingsRow;

  return (
    <AgencyLayout breadcrumb="PLATFORM / PROPOSALS / SETTINGS" pageTitle="Proposal settings">
      <RecordFrame
        detail="The number sequence is the record. A proposal does not invent its own number."
        fact={{
          name: "Change the sequence here, then return to the register.",
          detail: "Existing proposal numbers stay as they were issued.",
          action: "Back to proposals",
          href: "/dashboard/proposals",
        }}
      >
        <ProposalSettingsManager initialSettings={settings} />
      </RecordFrame>
    </AgencyLayout>
  );
}
