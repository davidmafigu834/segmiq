import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { ClientManagerLayout } from "@/components/layouts/ClientManagerLayout";
import { DevelopmentsManager } from "@/components/real-estate/DevelopmentsManager";
import { PageHeader } from "@/components/ui";
import { redirectIfNotRealEstate } from "@/lib/real-estate/gating";

export default async function ClientDevelopmentsPage() {
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
    <ClientManagerLayout breadcrumbPage="DEVELOPMENTS" pageTitle="Developments" workspaceShell>
      <div className="min-w-0 w-full max-w-full pb-16">
        <PageHeader
          className="mb-8"
          eyebrow={`${client.name as string} / Developments`}
          title="Developments"
          description="New-development inventory: sold, available, and reserved units."
        />
        <DevelopmentsManager clientId={session.clientId} />
      </div>
    </ClientManagerLayout>
  );
}
