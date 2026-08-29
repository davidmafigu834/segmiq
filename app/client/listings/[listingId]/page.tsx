import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { ClientManagerLayout } from "@/components/layouts/ClientManagerLayout";
import { ListingDetailView } from "@/components/real-estate/ListingDetailView";
import { redirectIfNotRealEstate } from "@/lib/real-estate/gating";

export default async function ClientListingDetailPage({
  params,
}: {
  params: { listingId: string };
}) {
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
      breadcrumbPage="LISTING"
      pageTitle="Listing"
      workspaceShell
      workspaceTitle="Listing"
      workspaceDescription="Property details, marketing, offers, and buyer matches."
    >
      <ListingDetailView clientId={session.clientId} listingId={params.listingId} />
    </ClientManagerLayout>
  );
}
