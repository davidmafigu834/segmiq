import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { SalesLayout } from "@/components/layouts/SalesLayout";
import { SoloLayout } from "@/components/layouts/SoloLayout";
import { fetchLatestScheduledCallbacksByLeadId } from "@/lib/convert-later-picks";
import { FollowUpsView } from "@/components/sales/FollowUpsView";
import type { FollowUpLead } from "@/lib/follow-ups-view";

type DbFollowUpLead = {
  id: string;
  name: string | null;
  phone: string | null;
  follow_up_date: string | null;
  clients?: { name?: string } | null;
};

export default async function SalesFollowupsPage() {
  const session = await getServerSession(authOptions);
  if (!session?.userId) redirect("/login");
  const Layout = session.clientMode === "solo" ? SoloLayout : SalesLayout;
  const supabase = createAdminClient();
  const { data: leads } = await supabase
    .from("leads")
    .select("*, clients ( name )")
    .eq("assigned_to_id", session.userId)
    .not("follow_up_date", "is", null)
    .order("follow_up_date", { ascending: true });

  const list = (leads ?? []) as DbFollowUpLead[];
  const callbackAtByLeadId = await fetchLatestScheduledCallbacksByLeadId(
    supabase,
    list.map((l) => l.id)
  );

  const followUpLeads: FollowUpLead[] = list.map((lead) => ({
    id: lead.id,
    name: lead.name,
    phone: lead.phone,
    follow_up_date: lead.follow_up_date,
    clientName: lead.clients?.name ?? "—",
  }));

  return (
    <Layout breadcrumb="SALES / WHATSAPP SALES HUB / FOLLOW-UPS" pageTitle="Follow-ups">
      <FollowUpsView leads={followUpLeads} callbackAtByLeadId={callbackAtByLeadId} />
    </Layout>
  );
}
