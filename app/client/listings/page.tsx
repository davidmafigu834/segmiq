import { Suspense } from "react";
import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { ClientManagerLayout } from "@/components/layouts/ClientManagerLayout";
import { CompanyListingsPage } from "@/components/real-estate/listings/CompanyListingsPage";
import { CompanyListingsPageSkeleton } from "@/components/real-estate/listings/CompanyListingsPageSkeleton";
import { redirectIfNotRealEstate } from "@/lib/real-estate/gating";
import { loadCompanyPageChrome } from "@/lib/real-estate/company-page-chrome";

export default async function ClientListingsPage() {
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
    <ClientManagerLayout breadcrumbPage="LISTINGS" pageTitle="Listings" hideShellHeader hideShellSidebar>
      <Suspense fallback={<CompanyListingsPageSkeleton />}>
        <CompanyListingsPage chrome={chrome} clientId={session.clientId} />
      </Suspense>
    </ClientManagerLayout>
  );
}
