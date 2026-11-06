import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { canActAsSalesperson } from "@/lib/auth/sales-capabilities";
import { createAdminClient } from "@/lib/supabase/admin";
import { SalesLayout } from "@/components/layouts/SalesLayout";
import { SalesAppShell } from "@/components/sales/shell/SalesAppShell";
import { RealEstateLinkDirectory } from "@/components/real-estate/navigation/RealEstateLinkDirectory";
import { loadSalesShellProps } from "@/lib/sales/sales-shell-props";
import { shouldRedirectFromRealEstateRoute } from "@/lib/real-estate/gating";
import { AGENT_PEOPLE_LINKS } from "@/lib/real-estate/workspace-links";

export const dynamic = "force-dynamic";

export default async function Page() {
  const session = await getServerSession(authOptions);
  if (!session?.userId || !canActAsSalesperson(session) || !session.clientId) redirect("/login");
  const supabase = createAdminClient();
  const { data: client } = await supabase.from("clients").select("business_type").eq("id", session.clientId).maybeSingle();
  if (shouldRedirectFromRealEstateRoute(client?.business_type)) redirect("/sales/dashboard");
  const shell = await loadSalesShellProps(session);
  return (
    <SalesLayout breadcrumb="Sales / PEOPLE" pageTitle="People" hideShellHeader hideShellSidebar contentFlush>
      <SalesAppShell {...shell} breadcrumb="Sales / People" title="People" description="Sellers, buyers, and introductions." showDefaultHeader={false}>
        <RealEstateLinkDirectory
          title="People"
          description="Sellers, buyers and tenants, and the introduction flow."
          links={AGENT_PEOPLE_LINKS}
        />
      </SalesAppShell>
    </SalesLayout>
  );
}
