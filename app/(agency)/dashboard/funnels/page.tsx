import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { AgencyLayout } from "@/components/layouts/AgencyLayout";
import { RecordFrame } from "@/components/platform/workbench";
import { FunnelAdminList } from "@/components/agency/funnels/FunnelAdminList";
import { createAdminClient } from "@/lib/supabase/admin";
import { listFunnelsForAdmin, realEstateClientsForAdmin } from "@/lib/real-estate/funnels/service";

export const dynamic = "force-dynamic";

export default async function FunnelsAdminPage() {
  const session = await getServerSession(authOptions);
  if (!session?.userId) redirect("/login");
  if (session.role !== "SUPER_ADMIN") redirect("/dashboard");
  const db = createAdminClient();
  const [funnels, clients] = await Promise.all([listFunnelsForAdmin(db), realEstateClientsForAdmin(db)]);
  const first = funnels[0];
  return (
    <AgencyLayout breadcrumb="Operations / Funnels" pageTitle="Funnels">
      <RecordFrame
        detail="A funnel belongs to one organisation and one listing."
        fact={{
          name: first ? `${first.listingHeading} is the latest funnel.` : "No funnel is on the register.",
          detail: first ? `${first.clientName} · ${first.status}` : "Create one when a listing needs a public page.",
          action: first ? "Open" : "Open organisations",
          href: first ? `/dashboard/funnels/${first.id}` : "/dashboard/clients",
        }}
      >
      <FunnelAdminList
        funnels={funnels.map((row) => ({
          id: row.id,
          status: row.status,
          clientName: row.clientName,
          listingHeading: row.listingHeading,
          listingSuburb: row.listingSuburb,
          slug: row.slug,
          updatedAt: row.updatedAt,
          publishedAt: row.publishedAt,
        }))}
        clients={clients}
      />
      </RecordFrame>
    </AgencyLayout>
  );
}
