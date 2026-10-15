import { Suspense } from "react";
import { redirect } from "next/navigation";
import { getOperationalSession } from "@/lib/auth/operational-session";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCompanyTeamPageData } from "@/lib/sales/get-company-team-page-data";
import { fetchSalesNavBadges } from "@/lib/sales/nav-badges";
import { ClientManagerLayout } from "@/components/layouts/ClientManagerLayout";
import { CompanyTeamPage } from "@/components/dashboard/company/team/CompanyTeamPage";
import { CompanyTeamPageSkeleton } from "@/components/dashboard/company/team/CompanyTeamPageSkeleton";

export default async function ClientTeamPage({
  searchParams,
}: {
  searchParams: { clientId?: string };
}) {
  const operational = await getOperationalSession();
  if (operational?.demoGuest && operational.clientId && operational.userId) {
    const { loadDemoDatasetForClient } = await import("@/lib/demo/provider");
    const { buildDemoCompanyTeam } = await import("@/lib/demo/adapters/manager-tour");
    const demo = await loadDemoDatasetForClient(operational.clientId);
    if (!demo) redirect("/demo/unavailable");
    return (
      <ClientManagerLayout breadcrumbPage="TEAM" pageTitle="Team" hideShellHeader hideShellSidebar>
        <Suspense fallback={<CompanyTeamPageSkeleton />}>
          <CompanyTeamPage
            data={buildDemoCompanyTeam(demo)}
            unreadNotifications={0}
            notificationRole={operational.role}
            userName={operational.user?.name ?? "Manager"}
            avatarUrl={null}
            companyLogoUrl={null}
            whatsappBadge={0}
          />
        </Suspense>
      </ClientManagerLayout>
    );
  }

  const session = await getServerSession(authOptions);
  if (!session?.userId) redirect("/login");

  const role = session.role;
  const previewClientId = searchParams.clientId;

  if (role === "SUPER_ADMIN") {
    if (!previewClientId && !session.clientId) redirect("/dashboard");
  } else if (role === "CLIENT_MANAGER") {
    if (!session.clientId) redirect("/login");
  } else {
    redirect("/sales/pipeline");
  }

  const clientId =
    role === "SUPER_ADMIN" ? previewClientId || session.clientId! : session.clientId!;

  const supabase = createAdminClient();
  const [data, unreadRes, userRes, clientRes, navBadges] = await Promise.all([
    getCompanyTeamPageData({
      clientId,
      actor: {
        userId: session.userId,
        role: session.role,
        clientId: session.clientId,
      },
      alsoSells: Boolean(session.alsoSells),
    }),
    session.userId
      ? supabase
          .from("notifications")
          .select("*", { count: "exact", head: true })
          .eq("user_id", session.userId)
          .eq("read", false)
      : Promise.resolve({ count: 0 }),
    session.userId
      ? supabase.from("users").select("avatar_url").eq("id", session.userId).maybeSingle()
      : Promise.resolve({ data: null }),
    supabase.from("clients").select("logo_url").eq("id", clientId).maybeSingle(),
    session.userId
      ? fetchSalesNavBadges(session.userId, clientId)
      : Promise.resolve({
          hotLeads: 0,
          needsReply: 0,
          followUpDue: 0,
          followUpsToday: 0,
          callNow: 0,
        }),
  ]);

  const whatsappBadge =
    (navBadges.hotLeads || 0) + (navBadges.needsReply || 0) + (navBadges.followUpDue || 0);

  return (
    <ClientManagerLayout
      breadcrumbPage={data.businessType === "real_estate" ? "AGENTS" : "TEAM"}
      pageTitle={data.businessType === "real_estate" ? "Agents" : "Team"}
      hideShellHeader
      hideShellSidebar
      navClientId={clientId}
    >
      <Suspense fallback={<CompanyTeamPageSkeleton />}>
        <CompanyTeamPage
          data={data}
          unreadNotifications={unreadRes.count ?? 0}
          notificationRole={session.role}
          userName={session.user?.name ?? "User"}
          avatarUrl={(userRes.data as { avatar_url?: string | null } | null)?.avatar_url ?? null}
          companyLogoUrl={(clientRes.data as { logo_url?: string | null } | null)?.logo_url ?? null}
          whatsappBadge={whatsappBadge}
        />
      </Suspense>
    </ClientManagerLayout>
  );
}
