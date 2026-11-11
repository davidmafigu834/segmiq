import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { canActAsSalesperson } from "@/lib/auth/sales-capabilities";
import { createAdminClient } from "@/lib/supabase/admin";
import { SalesLayout } from "@/components/layouts/SalesLayout";
import { SalesAppShell } from "@/components/sales/shell/SalesAppShell";
import { DueDiligenceReport } from "@/components/real-estate/due-diligence/ReportView";
import { loadSalesShellProps } from "@/lib/sales/sales-shell-props";
import { shouldRedirectFromRealEstateRoute } from "@/lib/real-estate/gating";

export const dynamic = "force-dynamic";

export default async function Page({ params }: { params: { mandateId: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.userId || !canActAsSalesperson(session) || !session.clientId) redirect("/login");
  const supabase = createAdminClient();
  const { data: client } = await supabase.from("clients").select("business_type").eq("id", session.clientId).maybeSingle();
  if (shouldRedirectFromRealEstateRoute(client?.business_type)) redirect("/sales/dashboard");
  const shell = await loadSalesShellProps(session);
  return (
    <SalesLayout breadcrumb="Sales / DUE DILIGENCE" pageTitle="Due diligence" hideShellHeader hideShellSidebar contentFlush>
      <SalesAppShell {...shell} breadcrumb="Sales / Due diligence" title="Due diligence" description="Review the check before the property is marketed." showDefaultHeader={false}>
        <DueDiligenceReport clientId={session.clientId} mandateId={params.mandateId} basePath="/sales/due-diligence" />
      </SalesAppShell>
    </SalesLayout>
  );
}
