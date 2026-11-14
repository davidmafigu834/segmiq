import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { AgencyLayout } from "@/components/layouts/AgencyLayout";
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
  return (
    <AgencyLayout breadcrumb="Operations / Funnels" pageTitle="Funnels">
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
    </AgencyLayout>
  );
}
