import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { AgencyLayout } from "@/components/layouts/AgencyLayout";
import { ProposalSettingsManager } from "@/components/proposals/ProposalSettingsManager";
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
      <ProposalSettingsManager initialSettings={settings} />
    </AgencyLayout>
  );
}
