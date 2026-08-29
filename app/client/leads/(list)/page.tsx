import { Suspense } from "react";
import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCompanyLeadsPageData } from "@/lib/sales/get-company-leads-page-data";
import { fetchSalesNavBadges } from "@/lib/sales/nav-badges";
import { ClientManagerLayout } from "@/components/layouts/ClientManagerLayout";
import { CompanyLeadsPage } from "@/components/dashboard/company/leads/CompanyLeadsPage";
import { CompanyLeadsPageSkeleton } from "@/components/dashboard/company/leads/CompanyLeadsPageSkeleton";
import { getTerminology } from "@/lib/terminology";

export const dynamic = "force-dynamic";

export default async function ClientLeadsPage({
  searchParams,
}: {
  searchParams: { clientId?: string };
}) {
  const session = await getServerSession(authOptions);
  if (!session?.userId) redirect("/login");

  const role = session.role;
  const previewClientId = searchParams.clientId;

  if (role === "SUPER_ADMIN") {
    if (!previewClientId && !session.clientId) redirect("/dashboard");
  } else if (role === "CLIENT_MANAGER") {
    if (!session.clientId) redirect("/login");
  } else {
    redirect("/sales/leads");
  }

  const clientId =
    role === "SUPER_ADMIN" ? previewClientId || session.clientId! : session.clientId!;

  const supabase = createAdminClient();
  const [data, unreadRes, userRes, clientRes, navBadges] = await Promise.all([
    getCompanyLeadsPageData({
      clientId,
      actor: {
        userId: session.userId,
        role: session.role,
        clientId: session.clientId,
        alsoSells: Boolean(session.alsoSells),
      },
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
  const terms = getTerminology(data.businessType);

  return (
    <ClientManagerLayout
      breadcrumbPage={terms.lead.plural.toUpperCase()}
      pageTitle={terms.lead.plural}
      hideShellHeader
      hideShellSidebar
      navClientId={clientId}
    >
      <Suspense fallback={<CompanyLeadsPageSkeleton />}>
        <CompanyLeadsPage
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
