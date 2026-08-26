import { CommercialRoute } from "@/components/dashboard/company/commercial/commercial-route";
import { CompanyInventorySettingsPage } from "@/components/dashboard/company/commercial/CompanyInventorySettingsPage";

export const dynamic = "force-dynamic";

export default async function Page({ searchParams }: { searchParams: { clientId?: string } }) {
  return (
    <CommercialRoute searchParams={searchParams} breadcrumbPage="INVENTORY" pageTitle="Inventory settings">
      {(chrome) => <CompanyInventorySettingsPage clientId={chrome.clientId} chrome={chrome} />}
    </CommercialRoute>
  );
}
