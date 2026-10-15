import { CommercialRoute } from "@/components/dashboard/company/commercial/commercial-route";
import { CompanyPackagesPage } from "@/components/dashboard/company/commercial/CompanyPackagesPage";
import { getOperationalSession } from "@/lib/auth/operational-session";

export const dynamic = "force-dynamic";

export default async function Page({ searchParams }: { searchParams: { clientId?: string } }) {
  const operational = await getOperationalSession();
  if (operational?.demoGuest && operational.clientId && operational.userId) {
    const { DemoManagerPage } = await import("@/components/demo/DemoManagerPage");
    return (
      <DemoManagerPage
        clientId={operational.clientId}
        userId={operational.userId}
        role={operational.role}
        userName={operational.user?.name ?? "Manager"}
        page="packages"
      />
    );
  }
  return (
    <CommercialRoute searchParams={searchParams} breadcrumbPage="PACKAGES" pageTitle="Packages">
      {(chrome) => <CompanyPackagesPage clientId={chrome.clientId} chrome={chrome} />}
    </CommercialRoute>
  );
}
