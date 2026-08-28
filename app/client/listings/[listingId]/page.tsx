import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { ClientManagerLayout } from "@/components/layouts/ClientManagerLayout";
import { ListingDetailView } from "@/components/real-estate/ListingDetailView";
import { PageHeader } from "@/components/ui";
import { isRealEstate } from "@/lib/terminology";

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
  if (!isRealEstate(client.business_type)) {
    redirect("/client/dashboard");
  }

  return (
    <ClientManagerLayout breadcrumbPage="LISTING" pageTitle="Listing" workspaceShell>
      <div className="min-w-0 w-full max-w-full pb-16">
        <PageHeader
          className="mb-8"
          eyebrow={`${client.name as string} / Listings`}
          title="Listing detail"
          description="Property details and buyer matches."
        />
        <ListingDetailView clientId={session.clientId} listingId={params.listingId} />
      </div>
    </ClientManagerLayout>
  );
}
