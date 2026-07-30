import { notFound } from "next/navigation";
import { AgencyLayout } from "@/components/layouts/AgencyLayout";
import { loadClientHeroContext } from "@/lib/client-hero";
import { ClientDetailView } from "../ClientDetailView";
import { getPublicLandingPageUrl } from "@/lib/public-url";
import { CampaignsClientTab } from "@/components/campaigns/CampaignsClientTab";

export default async function ClientCampaignsPage({ params }: { params: { clientId: string } }) {
  const ctx = await loadClientHeroContext(params.clientId);
  if (!ctx) notFound();
  const { client, hero } = ctx;

  return (
    <AgencyLayout breadcrumb="PLATFORM / CAMPAIGNS" pageTitle={client.name as string}>
      <ClientDetailView
        clientId={params.clientId}
        name={client.name as string}
        industry={client.industry as string}
        agencyManaged={Boolean((client as { agency_managed?: boolean | null }).agency_managed ?? true)}
        publicProfileUrl={hero.profileSlug ? getPublicLandingPageUrl(hero.profileSlug) : null}
        hero={hero}
      >
        <CampaignsClientTab clientId={params.clientId} clientName={client.name as string} />
      </ClientDetailView>
    </AgencyLayout>
  );
}
