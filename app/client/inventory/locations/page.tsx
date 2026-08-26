import { CommercialRoute } from "@/components/dashboard/company/commercial/commercial-route";
import { CompanyInventoryLocationsPage } from "@/components/dashboard/company/commercial/CompanyInventoryLocationsPage";

export const dynamic = "force-dynamic";

export default async function Page({ searchParams }: { searchParams: { clientId?: string } }) {
  return (
    <CommercialRoute searchParams={searchParams} breadcrumbPage="INVENTORY" pageTitle="Locations">
      {(chrome) => <CompanyInventoryLocationsPage clientId={chrome.clientId} chrome={chrome} />}
    </CommercialRoute>
  );
}
