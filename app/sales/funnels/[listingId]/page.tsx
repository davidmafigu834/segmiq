import { notFound } from "next/navigation";
import { SalesLayout } from "@/components/layouts/SalesLayout";
import { SalesAppShell } from "@/components/sales/shell/SalesAppShell";
import { FunnelDetail } from "@/components/real-estate/funnels/agent/FunnelDetail";
import { getPublicBaseUrl } from "@/lib/constants";
import { funnelsPageContext } from "@/lib/real-estate/funnels/page-guard";
import { loadAgentFunnelDetail } from "@/lib/real-estate/funnels/service";

export const dynamic = "force-dynamic";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function FunnelDetailPage({ params }: { params: { listingId: string } }) {
  if (!UUID.test(params.listingId)) notFound();
  const { db, actor, shell, me } = await funnelsPageContext();
  const data = await loadAgentFunnelDetail(db, actor, params.listingId);
  if (!data) notFound();
  return (
    <SalesLayout breadcrumb="Sales / FUNNELS" pageTitle={data.listing.heading} hideShellHeader hideShellSidebar contentFlush>
      <SalesAppShell {...shell} breadcrumb="Sales / Funnels" title={data.listing.heading} description="Your link, results and leads for this property.">
        <FunnelDetail
          baseUrl={getPublicBaseUrl()}
          me={me}
          agencyName={data.agencyName}
          listing={data.listing}
          available={data.available}
          profile={data.profile}
          channels={data.channels}
          leads={data.leads}
        />
      </SalesAppShell>
    </SalesLayout>
  );
}
