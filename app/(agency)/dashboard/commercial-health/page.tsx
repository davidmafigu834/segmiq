import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { AgencyLayout } from "@/components/layouts/AgencyLayout";
import { CommercialHealthDashboard } from "@/components/commercial-launch/CommercialHealthDashboard";
import { loadCommercialHealth } from "@/lib/commercial-launch/read-model";

export const dynamic = "force-dynamic";

export default async function CommercialHealthPage() {
  const session = await getServerSession(authOptions);
  if (
    !session?.userId ||
    session.role !== "SUPER_ADMIN" ||
    session.isImpersonating
  )
    redirect("/login");
  const snapshot = await loadCommercialHealth();
  return (
    <AgencyLayout breadcrumb="COMMERCIAL" pageTitle="Commercial Health">
      <CommercialHealthDashboard data={snapshot} />
    </AgencyLayout>
  );
}
