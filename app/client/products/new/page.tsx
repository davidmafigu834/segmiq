import { CommercialRoute } from "@/components/dashboard/company/commercial/commercial-route";
import { CompanyProductEditorPage } from "@/components/dashboard/company/commercial/CompanyProductEditorPage";

export const dynamic = "force-dynamic";

export default async function Page({ searchParams }: { searchParams: { clientId?: string } }) {
  return (
    <CommercialRoute searchParams={searchParams} breadcrumbPage="PRODUCTS" pageTitle="New Product">
      {(chrome) => <CompanyProductEditorPage clientId={chrome.clientId} chrome={chrome} />}
    </CommercialRoute>
  );
}
