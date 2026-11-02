import { Suspense } from "react";
import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { ClientManagerLayout } from "@/components/layouts/ClientManagerLayout";
import { CompanyRePageFrame } from "@/components/real-estate/company/CompanyRePageFrame";
import { SharedListingsDashboard } from "@/components/real-estate/listing-pages/SharedListingsDashboard";
import { loadCompanyPageChrome } from "@/lib/real-estate/company-page-chrome";
import { redirectIfNotRealEstate } from "@/lib/real-estate/gating";

export const dynamic = "force-dynamic";

export default async function ManagerListingPages() {
  const session = await getServerSession(authOptions);
  if (!session?.userId || session.role !== "CLIENT_MANAGER" || !session.clientId) redirect("/login");
  const { data: client } = await createAdminClient().from("clients").select("id, name, business_type").eq("id", session.clientId).maybeSingle();
  if (!client) redirect("/login");
  redirectIfNotRealEstate(client.business_type);
  const chrome = await loadCompanyPageChrome({ userId: session.userId, clientId: session.clientId, userName: session.user?.name ?? "User", role: session.role });
  return (
    <ClientManagerLayout breadcrumbPage="LISTING PAGES" pageTitle="Listing pages" hideShellHeader hideShellSidebar>
      <Suspense>
        <CompanyRePageFrame chrome={chrome} breadcrumb="Company / Listing pages" title="Listing pages" description="Agency marketing links, visits, and attributed enquiries.">
          <SharedListingsDashboard clientId={session.clientId} mode="manager" />
        </CompanyRePageFrame>
      </Suspense>
    </ClientManagerLayout>
  );
}
