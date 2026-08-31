import { Suspense } from "react";
import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { ClientManagerLayout } from "@/components/layouts/ClientManagerLayout";
import { CompanyOffersPage } from "@/components/real-estate/offers/CompanyOffersPage";
import { CompanyOffersPageSkeleton } from "@/components/real-estate/offers/CompanyOffersPageSkeleton";
import { redirectIfNotRealEstate } from "@/lib/real-estate/gating";
import { loadCompanyPageChrome } from "@/lib/real-estate/company-page-chrome";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

export default async function ClientOffersPage() {
  const session = await getServerSession(authOptions);
  if (!session?.userId || session.role !== "CLIENT_MANAGER" || !session.clientId) {
    redirect("/login");
  }

  const supabase = createAdminClient();
  const { data: client } = await supabase
    .from("clients")
    .select("id, name, business_type")
    .eq("id", session.clientId)
    .maybeSingle();
  if (!client) redirect("/login");
  redirectIfNotRealEstate(client.business_type);

  const chrome = await loadCompanyPageChrome({
    userId: session.userId,
    clientId: session.clientId,
    userName: session.user?.name ?? "User",
    role: session.role,
  });

  return (
    <ClientManagerLayout breadcrumbPage="OFFERS" pageTitle="Offers" hideShellHeader hideShellSidebar>
      <Suspense fallback={<CompanyOffersPageSkeleton />}>
        <CompanyOffersPage chrome={chrome} clientId={session.clientId} />
      </Suspense>
    </ClientManagerLayout>
  );
}
