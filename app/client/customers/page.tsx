import { Suspense } from "react";
import { redirect } from "next/navigation";
import { getOperationalSession } from "@/lib/auth/operational-session";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCompanyCustomersPageData } from "@/lib/sales/get-company-customers-page-data";
import { fetchSalesNavBadges } from "@/lib/sales/nav-badges";
import { ClientManagerLayout } from "@/components/layouts/ClientManagerLayout";
import { CompanyCustomersPage } from "@/components/dashboard/company/customers/CompanyCustomersPage";
import { CompanyCustomersPageSkeleton } from "@/components/dashboard/company/customers/CompanyCustomersPageSkeleton";

export const dynamic = "force-dynamic";

export default async function ClientCustomersPage({
  searchParams,
}: {
  searchParams: { clientId?: string };
}) {
  const session = await getOperationalSession();
  if (!session?.userId) redirect("/login");

  const previewClientId = searchParams.clientId;
  if (session.role === "SUPER_ADMIN") {
    if (!previewClientId && !session.clientId) redirect("/dashboard");
  } else if (session.role === "CLIENT_MANAGER") {
    if (!session.clientId) redirect("/login");
  } else {
    redirect("/sales/customers");
  }

  const clientId =
    session.role === "SUPER_ADMIN" ? previewClientId || session.clientId! : session.clientId!;
  const supabase = session.demoGuest ? null : createAdminClient();
  const [data, unreadRes, userRes, clientRes, navBadges] = await Promise.all([
    getCompanyCustomersPageData({ clientId }),
    supabase
      ? supabase
          .from("notifications")
          .select("*", { count: "exact", head: true })
          .eq("user_id", session.userId)
          .eq("read", false)
      : Promise.resolve({ count: 0 }),
    supabase
      ? supabase.from("users").select("avatar_url").eq("id", session.userId).maybeSingle()
      : Promise.resolve({ data: null }),
    supabase
      ? supabase.from("clients").select("logo_url").eq("id", clientId).maybeSingle()
      : Promise.resolve({ data: null }),
    fetchSalesNavBadges(session.userId, clientId),
  ]);
  const whatsappBadge =
    (navBadges.hotLeads || 0) +
    (navBadges.needsReply || 0) +
    (navBadges.followUpDue || 0);

  return (
    <ClientManagerLayout
      breadcrumbPage="CUSTOMERS"
      pageTitle="Customers"
      hideShellHeader
      hideShellSidebar
      navClientId={clientId}
    >
      <Suspense fallback={<CompanyCustomersPageSkeleton />}>
        <CompanyCustomersPage
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
