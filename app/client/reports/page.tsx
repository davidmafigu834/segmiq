import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { fetchSalesNavBadges } from "@/lib/sales/nav-badges";
import { ClientManagerLayout } from "@/components/layouts/ClientManagerLayout";
import { CompanyReportsPage } from "@/components/dashboard/company/reports/CompanyReportsPage";
import { CompanyReReportsPage } from "@/components/real-estate/reports/CompanyReReportsPage";
import { isRealEstate } from "@/lib/terminology";
import type { UserRole } from "@/types";

export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";

export default async function ClientReportsPage({
  searchParams,
}: {
  searchParams: { clientId?: string };
}) {
  const session = await getServerSession(authOptions);
  if (!session?.userId) redirect("/login");
  if (session.role === "SALESPERSON") redirect("/sales/reports");
  if (!(["CLIENT_MANAGER", "SUPER_ADMIN"] as string[]).includes(session.role)) {
    redirect("/login");
  }

  const previewClientId = searchParams.clientId;
  const clientId =
    session.role === "SUPER_ADMIN" ? previewClientId || session.clientId : session.clientId;
  if (!clientId) redirect(session.role === "SUPER_ADMIN" ? "/dashboard" : "/login");

  const supabase = createAdminClient();
  const [unreadRes, userRes, clientRes, navBadges] = await Promise.all([
    supabase
      .from("notifications")
      .select("*", { count: "exact", head: true })
      .eq("user_id", session.userId)
      .eq("read", false),
    supabase.from("users").select("avatar_url").eq("id", session.userId).maybeSingle(),
    supabase.from("clients").select("logo_url, name, business_type").eq("id", clientId).maybeSingle(),
    fetchSalesNavBadges(session.userId, clientId),
  ]);

  const whatsappBadge =
    (navBadges.hotLeads || 0) + (navBadges.needsReply || 0) + (navBadges.followUpDue || 0);
  const reClient = isRealEstate((clientRes.data as { business_type?: string } | null)?.business_type);

  if (reClient) {
    return (
      <ClientManagerLayout
        breadcrumbPage="REPORTS"
        pageTitle="Reports"
        hideShellHeader
        hideShellSidebar
        navClientId={clientId}
      >
        <CompanyReReportsPage
          chrome={{
            unreadNotifications: unreadRes.count ?? 0,
            notificationRole: session.role as UserRole,
            userName: session.user?.name ?? "User",
            avatarUrl: (userRes.data as { avatar_url?: string | null } | null)?.avatar_url ?? null,
            companyName: (clientRes.data as { name?: string | null } | null)?.name ?? "Company",
            companyLogoUrl: (clientRes.data as { logo_url?: string | null } | null)?.logo_url ?? null,
            whatsappBadge,
          }}
          clientId={clientId}
        />
      </ClientManagerLayout>
    );
  }

  return (
    <ClientManagerLayout
      breadcrumbPage="REPORTS"
      pageTitle="Reports"
      hideShellHeader
      hideShellSidebar
      navClientId={clientId}
    >
      <CompanyReportsPage
        unreadNotifications={unreadRes.count ?? 0}
        notificationRole={session.role}
        userName={session.user?.name ?? "User"}
        avatarUrl={(userRes.data as { avatar_url?: string | null } | null)?.avatar_url ?? null}
        companyName={(clientRes.data as { name?: string | null } | null)?.name ?? undefined}
        companyLogoUrl={(clientRes.data as { logo_url?: string | null } | null)?.logo_url ?? null}
        whatsappBadge={whatsappBadge}
        clientId={session.role === "SUPER_ADMIN" ? clientId : undefined}
      />
    </ClientManagerLayout>
  );
}
