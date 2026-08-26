import { CommercialRoute } from "@/components/dashboard/company/commercial/commercial-route";
import { CompanyProductsPage } from "@/components/dashboard/company/commercial/CompanyProductsPage";

export const dynamic = "force-dynamic";

export default async function Page({ searchParams }: { searchParams: { clientId?: string } }) {
  return (
    <CommercialRoute searchParams={searchParams} breadcrumbPage="PRODUCTS" pageTitle="Products">
      {(chrome) => <CompanyProductsPage clientId={chrome.clientId} chrome={chrome} />}
    </CommercialRoute>
  );
}
