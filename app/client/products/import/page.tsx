import { CommercialRoute } from "@/components/dashboard/company/commercial/commercial-route";
import { CompanyProductsImportPage } from "@/components/dashboard/company/commercial/CompanyProductsImportPage";

export const dynamic = "force-dynamic";

export default async function Page({ searchParams }: { searchParams: { clientId?: string } }) {
  return (
    <CommercialRoute searchParams={searchParams} breadcrumbPage="PRODUCTS" pageTitle="Import">
      {(chrome) => <CompanyProductsImportPage clientId={chrome.clientId} chrome={chrome} />}
    </CommercialRoute>
  );
}
