import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { ClientManagerLayout } from "@/components/layouts/ClientManagerLayout";
import { BuyerSearchDetail } from "@/components/real-estate/buyers/BuyerSearchDetail";
import { redirectIfNotRealEstate } from "@/lib/real-estate/gating";

export const dynamic = "force-dynamic";

export default async function Page({ params }: { params: { searchId: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.userId || session.role !== "CLIENT_MANAGER" || !session.clientId) redirect("/login");
  const supabase = createAdminClient();
  const { data: client } = await supabase.from("clients").select("business_type").eq("id", session.clientId).single();
  if (!client) redirect("/login");
  redirectIfNotRealEstate(client.business_type);
  return (
    <ClientManagerLayout breadcrumbPage="BUYERS" pageTitle="Buyer search" hideShellHeader hideShellSidebar>
      <BuyerSearchDetail clientId={session.clientId} searchId={params.searchId} offersHref="/client/offers" />
    </ClientManagerLayout>
  );
}
