import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { canActAsSalesperson } from "@/lib/auth/sales-capabilities";
import { createAdminClient } from "@/lib/supabase/admin";
import { SalesLayout } from "@/components/layouts/SalesLayout";
import { SalesAppShell } from "@/components/sales/shell/SalesAppShell";
import { OffersWorkspace } from "@/components/real-estate/offers/OffersWorkspace";
import { loadSalesShellProps } from "@/lib/sales/sales-shell-props";
import { shouldRedirectFromRealEstateRoute } from "@/lib/real-estate/gating";

export const dynamic = "force-dynamic";

export default async function SalesOffersPage({
  searchParams,
}: {
  searchParams?: { listingId?: string; contactId?: string; offerId?: string };
}) {
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
      breadcrumb="Sales / OFFERS"
      pageTitle="Offers"
      hideShellHeader
      hideShellSidebar
      contentFlush
    >
      <SalesAppShell
        {...shell}
        breadcrumb="Sales / Offers"
        title="Offers"
        description="Generate an offer letter from the buyer. They fill it, then the seller reviews it."
      >
        <OffersWorkspace
          clientId={session.clientId}
          variant="agent"
          inquiriesHref="/sales/pipeline"
          complianceHref={null}
          initialListingId={typeof searchParams?.listingId === "string" ? searchParams.listingId : null}
          initialContactId={typeof searchParams?.contactId === "string" ? searchParams.contactId : null}
          initialOfferId={typeof searchParams?.offerId === "string" ? searchParams.offerId : null}
        />
      </SalesAppShell>
    </SalesLayout>
  );
}
