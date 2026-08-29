import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { ClientManagerLayout } from "@/components/layouts/ClientManagerLayout";
import { ListingsManager } from "@/components/real-estate/ListingsManager";
import { redirectIfNotRealEstate } from "@/lib/real-estate/gating";

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

  return (
    <ClientManagerLayout
      breadcrumbPage="LISTINGS"
      pageTitle="Listings"
      workspaceShell
      workspaceTitle="Listings"
      workspaceDescription="Sale, rental, and new-development inventory."
    >
      <ListingsManager clientId={session.clientId} />
    </ClientManagerLayout>
  );
}
