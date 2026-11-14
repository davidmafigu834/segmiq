import { SalesLayout } from "@/components/layouts/SalesLayout";
import { SalesAppShell } from "@/components/sales/shell/SalesAppShell";
import { FunnelsHome } from "@/components/real-estate/funnels/agent/FunnelsHome";
import { getPublicBaseUrl } from "@/lib/constants";
import { funnelsPageContext } from "@/lib/real-estate/funnels/page-guard";
import { loadAgentFunnelsHome } from "@/lib/real-estate/funnels/service";

export const dynamic = "force-dynamic";

export default async function FunnelsPage() {
  const { db, actor, shell, me } = await funnelsPageContext();
  const data = await loadAgentFunnelsHome(db, actor);
  return (
    <SalesLayout breadcrumb="Sales / FUNNELS" pageTitle="Funnels" hideShellHeader hideShellSidebar contentFlush>
      <SalesAppShell {...shell} breadcrumb="Sales / Funnels" title="Funnels" description="Your links to every property page, with visits and enquiries.">
        <FunnelsHome baseUrl={getPublicBaseUrl()} me={me} {...data} />
      </SalesAppShell>
    </SalesLayout>
  );
}
