import { Suspense } from "react";
import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { ClientManagerLayout } from "@/components/layouts/ClientManagerLayout";
import { CompanyCompliancePage } from "@/components/real-estate/compliance/CompanyCompliancePage";
import { CompanyCompliancePageSkeleton } from "@/components/real-estate/compliance/CompanyCompliancePageSkeleton";
import { redirectIfNotRealEstate } from "@/lib/real-estate/gating";
import { loadCompanyPageChrome } from "@/lib/real-estate/company-page-chrome";

export const dynamic = "force-dynamic";

export default async function ClientComplianceReviewsPage() {
  const session = await getServerSession(authOptions);
  if (!session?.userId || session.role !== "CLIENT_MANAGER" || !session.clientId) {
    redirect("/login");
  }
  const supabase = createAdminClient();
  const { data: client } = await supabase
    .from("clients")
    .select("id, business_type")
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
    <ClientManagerLayout breadcrumbPage="REVIEWS" pageTitle="Reviews" hideShellHeader hideShellSidebar>
      <Suspense fallback={<CompanyCompliancePageSkeleton />}>
        <CompanyCompliancePage
          chrome={chrome}
          clientId={session.clientId}
          initialTab="under_review"
          title="Reviews"
          description="Cases waiting for compliance review."
          breadcrumb="Company / Reviews"
        />
      </Suspense>
    </ClientManagerLayout>
  );
}
