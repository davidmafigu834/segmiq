import { Suspense } from "react";
import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { ClientManagerLayout } from "@/components/layouts/ClientManagerLayout";
import { CompanyRePageFrame } from "@/components/real-estate/company/CompanyRePageFrame";
import { CompanyListingsPageSkeleton } from "@/components/real-estate/listings/CompanyListingsPageSkeleton";
import { MandateLinkChooser } from "@/components/real-estate/workflow/MandateLinkChooser";
import { redirectIfNotRealEstate } from "@/lib/real-estate/gating";
import { loadCompanyPageChrome } from "@/lib/real-estate/company-page-chrome";

export const dynamic = "force-dynamic";

export default async function ClientMandateLinkPage() {
  const session = await getServerSession(authOptions);
  if (!session?.userId || session.role !== "CLIENT_MANAGER" || !session.clientId) {
    redirect("/login");
  }

  const supabase = createAdminClient();
  const { data: client } = await supabase
    .from("clients")
    .select("id, name, business_type")
    .eq("id", session.clientId)
    .single();

  if (!client) redirect("/login");
  redirectIfNotRealEstate(client.business_type);

  const chrome = await loadCompanyPageChrome({
    userId: session.userId,
    clientId: session.clientId,
    userName: session.user?.name ?? "User",
    role: session.role,
  });

  return (
    <ClientManagerLayout breadcrumbPage="MANDATE" pageTitle="Mandate link" hideShellHeader hideShellSidebar>
      <Suspense fallback={<CompanyListingsPageSkeleton />}>
        <CompanyRePageFrame chrome={chrome} breadcrumb="Company / Listings" title="Mandate link" description="Choose the mandate, then send the seller the link." hideTitleBlock>
          <MandateLinkChooser clientId={session.clientId} backHref="/client/listings" />
        </CompanyRePageFrame>
      </Suspense>
    </ClientManagerLayout>
  );
}
