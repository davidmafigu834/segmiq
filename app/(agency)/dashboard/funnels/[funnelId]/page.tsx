import { notFound, redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { AgencyLayout } from "@/components/layouts/AgencyLayout";
import { FunnelEditor } from "@/components/agency/funnels/FunnelEditor";
import { createAdminClient } from "@/lib/supabase/admin";
import { getPublicBaseUrl } from "@/lib/constants";
import { getFunnelForAdmin } from "@/lib/real-estate/funnels/service";

export const dynamic = "force-dynamic";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function FunnelEditorPage({ params }: { params: { funnelId: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.userId) redirect("/login");
  if (session.role !== "SUPER_ADMIN") redirect("/dashboard");
  if (!UUID.test(params.funnelId)) notFound();
  const data = await getFunnelForAdmin(createAdminClient(), params.funnelId);
  if (!data) notFound();
  return (
    <AgencyLayout breadcrumb="Operations / Funnels" pageTitle={data.listing.heading}>
      <FunnelEditor
        funnel={data.funnel}
        clientName={data.clientName}
        listing={data.listing}
        handles={data.handles}
        publicBase={getPublicBaseUrl().replace(/\/$/, "")}
      />
    </AgencyLayout>
  );
}
