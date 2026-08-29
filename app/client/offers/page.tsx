import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { ClientManagerLayout } from "@/components/layouts/ClientManagerLayout";
import { OffersWorkspace } from "@/components/real-estate/offers/OffersWorkspace";
import { redirectIfNotRealEstate } from "@/lib/real-estate/gating";

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

  return (
    <ClientManagerLayout breadcrumbPage="OFFERS" pageTitle="Offers" workspaceShell>
      <OffersWorkspace
        clientId={session.clientId}
        variant="manager"
        inquiriesHref="/client/leads"
        complianceHref="/client/compliance"
      />
    </ClientManagerLayout>
  );
}
