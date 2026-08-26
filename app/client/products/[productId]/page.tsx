import { CommercialRoute } from "@/components/dashboard/company/commercial/commercial-route";
import { CompanyProductEditorPage } from "@/components/dashboard/company/commercial/CompanyProductEditorPage";

export const dynamic = "force-dynamic";

export default async function Page({
  params,
  searchParams,
}: {
  params: { productId: string };
  searchParams: { clientId?: string };
}) {
  return (
    <CommercialRoute searchParams={searchParams} breadcrumbPage="PRODUCTS" pageTitle="Product">
      {(chrome) => (
        <CompanyProductEditorPage clientId={chrome.clientId} chrome={chrome} productId={params.productId} />
      )}
    </CommercialRoute>
  );
}
