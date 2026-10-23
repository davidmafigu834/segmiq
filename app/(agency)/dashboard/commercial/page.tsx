import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { AgencyLayout } from "@/components/layouts/AgencyLayout";
import { CommercialAdminDashboard } from "@/components/commercial/CommercialAdminDashboard";
import { authOptions } from "@/lib/auth";
import { loadCommercialHealth } from "@/lib/commercial-launch/read-model";
import { platformSalesEnabled } from "@/lib/platform-sales/flags";
import { listPlatformProspects, listPlatformQuotes } from "@/lib/platform-sales/repository";

export const dynamic = "force-dynamic";

export default async function CommercialPage() {
  const session = await getServerSession(authOptions);
  if (!session?.userId || session.role !== "SUPER_ADMIN" || session.isImpersonating) redirect("/login");

  const salesEnabled = platformSalesEnabled("quotes");
  const [healthResult, prospectsResult, quotesResult] = await Promise.allSettled([
    loadCommercialHealth(),
    salesEnabled ? listPlatformProspects() : Promise.resolve([]),
    salesEnabled ? listPlatformQuotes() : Promise.resolve([]),
  ]);

  return (
    <AgencyLayout breadcrumb="PLATFORM / COMMERCIAL" pageTitle="Commercial Overview">
      <CommercialAdminDashboard
        health={healthResult.status === "fulfilled" ? healthResult.value : null}
        prospects={prospectsResult.status === "fulfilled" ? (prospectsResult.value as never[]) : []}
        quotes={quotesResult.status === "fulfilled" ? (quotesResult.value as never[]) : []}
        salesAvailable={salesEnabled && prospectsResult.status === "fulfilled" && quotesResult.status === "fulfilled"}
      />
    </AgencyLayout>
  );
}
