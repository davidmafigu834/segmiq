import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { ClientManagerLayout } from "@/components/layouts/ClientManagerLayout";
import { ListingsManager } from "@/components/real-estate/ListingsManager";
import { PageHeader } from "@/components/ui";
import { isRealEstate } from "@/lib/terminology";

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
  if (!isRealEstate(client.business_type)) {
    redirect("/client/dashboard");
  }

  return (
    <ClientManagerLayout breadcrumbPage="LISTINGS" pageTitle="Listings" workspaceShell>
      <div className="min-w-0 w-full max-w-full pb-16">
        <PageHeader
          className="mb-8"
          eyebrow={`${client.name as string} / Listings`}
          title="Listings"
          description="Manage sale, rental, and new-development inventory."
        />
        <ListingsManager clientId={session.clientId} />
      </div>
    </ClientManagerLayout>
  );
}
