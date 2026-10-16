import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { canActAsSalesperson } from "@/lib/auth/sales-capabilities";
import { createAdminClient } from "@/lib/supabase/admin";
import { SalesLayout } from "@/components/layouts/SalesLayout";
import { SalesAppShell } from "@/components/sales/shell/SalesAppShell";
import { OwnerList } from "@/components/real-estate/acquisition/AcquisitionLists";
import { loadSalesShellProps } from "@/lib/sales/sales-shell-props";
import { shouldRedirectFromRealEstateRoute } from "@/lib/real-estate/gating";

export const dynamic = "force-dynamic";

export default async function Page() {
  const session = await getServerSession(authOptions);
  if (!session?.userId || !canActAsSalesperson(session) || !session.clientId) redirect("/login");
  const supabase = createAdminClient();
  const { data: client } = await supabase.from("clients").select("business_type").eq("id", session.clientId).maybeSingle();
  if (shouldRedirectFromRealEstateRoute(client?.business_type)) redirect("/sales/dashboard");
  const shell = await loadSalesShellProps(session);
  return (
    <SalesLayout breadcrumb="Sales / OWNERS" pageTitle="Property Owners" hideShellHeader hideShellSidebar contentFlush>
      <SalesAppShell {...shell} breadcrumb="Sales / Owners" title="Property Owners" description="Manage owner relationships and the properties they bring to your agency." showDefaultHeader={false}>
        <OwnerList clientId={session.clientId} basePath="/sales/owners" />
      </SalesAppShell>
    </SalesLayout>
  );
}
