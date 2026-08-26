import { CommercialRoute } from "@/components/dashboard/company/commercial/commercial-route";
import { CompanyInventoryMovementsPage } from "@/components/dashboard/company/commercial/CompanyInventoryLocationsPage";

export const dynamic = "force-dynamic";

export default async function Page({ searchParams }: { searchParams: { clientId?: string } }) {
  return (
    <CommercialRoute searchParams={searchParams} breadcrumbPage="INVENTORY" pageTitle="Movements">
      {(chrome) => <CompanyInventoryMovementsPage clientId={chrome.clientId} chrome={chrome} />}
    </CommercialRoute>
  );
}
