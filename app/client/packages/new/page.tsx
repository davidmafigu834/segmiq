import { CommercialRoute } from "@/components/dashboard/company/commercial/commercial-route";
import { CompanyPackageEditorPage } from "@/components/dashboard/company/commercial/CompanyPackageEditorPage";

export const dynamic = "force-dynamic";

export default async function Page({ searchParams }: { searchParams: { clientId?: string } }) {
  return (
    <CommercialRoute searchParams={searchParams} breadcrumbPage="PACKAGES" pageTitle="New Package">
      {(chrome) => <CompanyPackageEditorPage clientId={chrome.clientId} chrome={chrome} />}
    </CommercialRoute>
  );
}
