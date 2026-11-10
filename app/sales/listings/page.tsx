import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { canActAsSalesperson } from "@/lib/auth/sales-capabilities";
import { createAdminClient } from "@/lib/supabase/admin";
import { SalesLayout } from "@/components/layouts/SalesLayout";
import { SalesAppShell } from "@/components/sales/shell/SalesAppShell";
import { ListingWorkList } from "@/components/real-estate/listings/ListingWorkList";
import { RePageHeader } from "@/components/real-estate/ui";
import { salesMenuTriggerClass } from "@/components/sales/ui/Button";
import { cn } from "@/lib/ui/cn";
import Link from "next/link";
import { loadSalesShellProps } from "@/lib/sales/sales-shell-props";
import { shouldRedirectFromRealEstateRoute } from "@/lib/real-estate/gating";

export const dynamic = "force-dynamic";

export default async function SalesListingsPage() {
  const session = await getServerSession(authOptions);
  if (!session?.userId || !canActAsSalesperson(session) || !session.clientId) {
    redirect("/login");
  }

  const supabase = createAdminClient();
  const { data: client } = await supabase
    .from("clients")
    .select("business_type")
    .eq("id", session.clientId)
    .maybeSingle();
  if (shouldRedirectFromRealEstateRoute(client?.business_type)) {
    redirect("/sales/dashboard");
  }

  const shell = await loadSalesShellProps(session);

  return (
    <SalesLayout
      breadcrumb="Sales / PROPERTIES"
      pageTitle="Properties"
      hideShellHeader
      hideShellSidebar
      contentFlush
    >
      <SalesAppShell
        {...shell}
        breadcrumb="Sales / Properties"
        title="Properties"
        toolbar
        showQuickActions={false}
      >
        <div className="space-y-5">
          <RePageHeader
            mobileTitle
            title="Properties"
            description="In preparation, on the market, and under offer."
            actions={
              <Link href="/sales/mandates" className={cn(salesMenuTriggerClass({ variant: "primary", size: "md" }), "min-h-11 text-[14px] sm:h-11")}>
                + New seller form
              </Link>
            }
          />
          <ListingWorkList clientId={session.clientId} surface="sales" />
        </div>
      </SalesAppShell>
    </SalesLayout>
  );
}
