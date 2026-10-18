import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { canActAsSalesperson } from "@/lib/auth/sales-capabilities";
import { createAdminClient } from "@/lib/supabase/admin";
import { SalesLayout } from "@/components/layouts/SalesLayout";
import { SalesAppShell } from "@/components/sales/shell/SalesAppShell";
import { IntroductionQueue } from "@/components/real-estate/buyers/IntroductionQueue";
import { loadSalesShellProps } from "@/lib/sales/sales-shell-props";
import { shouldRedirectFromRealEstateRoute } from "@/lib/real-estate/gating";

export const dynamic = "force-dynamic";

export default async function Page({ searchParams }: { searchParams?: { open?: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.userId || !canActAsSalesperson(session) || !session.clientId) redirect("/login");
  const supabase = createAdminClient();
  const { data: client } = await supabase.from("clients").select("business_type").eq("id", session.clientId).maybeSingle();
  if (shouldRedirectFromRealEstateRoute(client?.business_type)) redirect("/sales/dashboard");
  const shell = await loadSalesShellProps(session);
  return (
    <SalesLayout breadcrumb="Sales / INTRODUCTIONS" pageTitle="Introductions" hideShellHeader hideShellSidebar contentFlush>
      <SalesAppShell {...shell} breadcrumb="Sales / Introductions" title="Introductions" description="Review buyer introduction requests and see the status of your own." showDefaultHeader={false}>
        <IntroductionQueue clientId={session.clientId} basePath="/sales" initialOpen={searchParams?.open ?? null} />
      </SalesAppShell>
    </SalesLayout>
  );
}
