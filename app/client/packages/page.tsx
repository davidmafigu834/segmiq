import { CommercialRoute } from "@/components/dashboard/company/commercial/commercial-route";
import { CompanyPackagesPage } from "@/components/dashboard/company/commercial/CompanyPackagesPage";

export const dynamic = "force-dynamic";

export default async function Page({ searchParams }: { searchParams: { clientId?: string } }) {
  return (
    <CommercialRoute searchParams={searchParams} breadcrumbPage="PACKAGES" pageTitle="Packages">
      {(chrome) => <CompanyPackagesPage clientId={chrome.clientId} chrome={chrome} />}
    </CommercialRoute>
  );
}
