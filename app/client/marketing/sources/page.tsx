import { Suspense } from "react";
import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { fetchSalesNavBadges } from "@/lib/sales/nav-badges";
import { ClientManagerLayout } from "@/components/layouts/ClientManagerLayout";
import { CompanyLeadSourcesPage } from "@/components/real-estate/lead-sources/CompanyLeadSourcesPage";
import { CompanyLeadSourcesPageSkeleton } from "@/components/real-estate/lead-sources/CompanyLeadSourcesPageSkeleton";
import { redirectIfNotRealEstate } from "@/lib/real-estate/gating";
import { getMarketingDashboard } from "@/lib/real-estate/marketing-service";
import {
  leadSourceCompanyKpis,
  leadSourceTabCounts,
  parseLeadSourceDatePreset,
} from "@/lib/real-estate/lead-sources";

export const dynamic = "force-dynamic";

export default async function ClientLeadSourcesPage({
  searchParams,
}: {
  searchParams: { preset?: string };
}) {
  const session = await getServerSession(authOptions);
  if (!session?.userId || session.role !== "CLIENT_MANAGER" || !session.clientId) {
    redirect("/login");
  }

  const supabase = createAdminClient();
  const { data: client } = await supabase
    .from("clients")
    .select("id, name, business_type, logo_url")
    .eq("id", session.clientId)
    .maybeSingle();
  if (!client) redirect("/login");
  redirectIfNotRealEstate(client.business_type);

  const preset = parseLeadSourceDatePreset(searchParams.preset);
  const dash = await getMarketingDashboard({
    clientId: session.clientId,
    filters: { preset },
  });

  const funnel = {
    inquiries: dash.kpis.inquiries,
    qualified: dash.kpis.qualified,
    viewings: dash.kpis.viewings,
    offers: dash.kpis.offers,
    accepted: dash.kpis.accepted,
    conversion: dash.rates.inquiryToAccepted,
  };

  const [unreadRes, userRes, navBadges] = await Promise.all([
    supabase
      .from("notifications")
      .select("*", { count: "exact", head: true })
      .eq("user_id", session.userId)
      .eq("read", false),
    supabase.from("users").select("avatar_url").eq("id", session.userId).maybeSingle(),
    fetchSalesNavBadges(session.userId, session.clientId),
  ]);
  const whatsappBadge =
    (navBadges.hotLeads || 0) + (navBadges.needsReply || 0) + (navBadges.followUpDue || 0);

  return (
    <ClientManagerLayout
      breadcrumbPage="LEAD SOURCES"
      pageTitle="Lead Sources"
      hideShellHeader
      hideShellSidebar
    >
      <Suspense fallback={<CompanyLeadSourcesPageSkeleton />}>
        <CompanyLeadSourcesPage
          data={{
            clientId: session.clientId,
            clientName: (client.name as string) ?? "Company",
            rangeLabel: dash.range.label,
            preset,
            kpis: leadSourceCompanyKpis(funnel),
            rows: dash.sources,
            tabCounts: leadSourceTabCounts(dash.sources),
            funnel,
          }}
          unreadNotifications={unreadRes.count ?? 0}
          notificationRole={session.role}
          userName={session.user?.name ?? "User"}
          avatarUrl={(userRes.data as { avatar_url?: string | null } | null)?.avatar_url ?? null}
          companyLogoUrl={(client.logo_url as string | null) ?? null}
          whatsappBadge={whatsappBadge}
        />
      </Suspense>
    </ClientManagerLayout>
  );
}
