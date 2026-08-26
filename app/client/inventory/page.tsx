import { CommercialRoute } from "@/components/dashboard/company/commercial/commercial-route";
import { CompanyInventoryPage } from "@/components/dashboard/company/commercial/CompanyInventoryPage";

export const dynamic = "force-dynamic";

export default async function Page({ searchParams }: { searchParams: { clientId?: string } }) {
  return (
    <CommercialRoute searchParams={searchParams} breadcrumbPage="INVENTORY" pageTitle="Inventory">
      {(chrome) => <CompanyInventoryPage clientId={chrome.clientId} chrome={chrome} />}
    </CommercialRoute>
  );
}
