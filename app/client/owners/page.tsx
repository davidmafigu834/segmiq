import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { ClientManagerLayout } from "@/components/layouts/ClientManagerLayout";
import { OwnerList } from "@/components/real-estate/acquisition/AcquisitionLists";
import { redirectIfNotRealEstate } from "@/lib/real-estate/gating";

export default async function Page() {
  const session = await getServerSession(authOptions);
  if (!session?.userId || session.role !== "CLIENT_MANAGER" || !session.clientId) redirect("/login");
  const supabase = createAdminClient();
  const { data: client } = await supabase.from("clients").select("business_type").eq("id", session.clientId).single();
  if (!client) redirect("/login");
  redirectIfNotRealEstate(client.business_type);
  return (
    <ClientManagerLayout breadcrumbPage="OWNERS" pageTitle="Property Owners" hideShellHeader hideShellSidebar>
      <OwnerList clientId={session.clientId} basePath="/client/owners" />
    </ClientManagerLayout>
  );
}
