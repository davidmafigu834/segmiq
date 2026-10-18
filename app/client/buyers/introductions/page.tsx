import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { ClientManagerLayout } from "@/components/layouts/ClientManagerLayout";
import { IntroductionQueue } from "@/components/real-estate/buyers/IntroductionQueue";
import { CompanyReShell } from "@/components/real-estate/company/CompanyReShell";
import { redirectIfNotRealEstate } from "@/lib/real-estate/gating";

export const dynamic = "force-dynamic";

export default async function Page({ searchParams }: { searchParams?: { open?: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.userId || session.role !== "CLIENT_MANAGER" || !session.clientId) redirect("/login");
  const supabase = createAdminClient();
  const { data: client } = await supabase.from("clients").select("business_type").eq("id", session.clientId).single();
  if (!client) redirect("/login");
  redirectIfNotRealEstate(client.business_type);
  return (
    <ClientManagerLayout breadcrumbPage="INTRODUCTIONS" pageTitle="Introductions" hideShellHeader hideShellSidebar>
      <CompanyReShell
        userId={session.userId}
        clientId={session.clientId}
        userName={session.user?.name ?? "User"}
        role={session.role}
        breadcrumb="Company / Introductions"
        title="Introductions"
        description="Review buyer introduction requests, including buyers who have no assigned agent."
      >
        <IntroductionQueue clientId={session.clientId} basePath="/client" initialOpen={searchParams?.open ?? null} />
      </CompanyReShell>
    </ClientManagerLayout>
  );
}
