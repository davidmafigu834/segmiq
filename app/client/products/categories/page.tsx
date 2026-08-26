import { CommercialRoute } from "@/components/dashboard/company/commercial/commercial-route";
import { CompanyProductCategoriesPage } from "@/components/dashboard/company/commercial/CompanyProductCategoriesPage";

export const dynamic = "force-dynamic";

export default async function Page({ searchParams }: { searchParams: { clientId?: string } }) {
  return (
    <CommercialRoute searchParams={searchParams} breadcrumbPage="PRODUCTS" pageTitle="Categories">
      {(chrome) => <CompanyProductCategoriesPage clientId={chrome.clientId} chrome={chrome} />}
    </CommercialRoute>
  );
}
