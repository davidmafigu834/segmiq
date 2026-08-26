import { CommercialRoute } from "@/components/dashboard/company/commercial/commercial-route";
import { CompanyPackageEditorPage } from "@/components/dashboard/company/commercial/CompanyPackageEditorPage";

export const dynamic = "force-dynamic";

export default async function Page({
  params,
  searchParams,
}: {
  params: { packageId: string };
  searchParams: { clientId?: string };
}) {
  return (
    <CommercialRoute searchParams={searchParams} breadcrumbPage="PACKAGES" pageTitle="Package">
      {(chrome) => (
        <CompanyPackageEditorPage clientId={chrome.clientId} chrome={chrome} packageId={params.packageId} />
      )}
    </CommercialRoute>
  );
}
