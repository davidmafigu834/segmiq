import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { fetchSalesNavBadges } from "@/lib/sales/nav-badges";
import { ClientManagerLayout } from "@/components/layouts/ClientManagerLayout";
import { WeeklyReportDetailClient } from "@/components/dashboard/company/weekly-report/WeeklyReportDetailClient";
import type { UserRole } from "@/types";

export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";

export default async function WeeklyReportDetailPage({
  params,
}: {
  params: { reportId: string };
}) {
  const session = await getServerSession(authOptions);
  if (!session?.userId) redirect("/login");
  if (session.role === "SALESPERSON") redirect("/sales/reports");
  if (!(["CLIENT_MANAGER", "SUPER_ADMIN"] as string[]).includes(session.role)) redirect("/login");

  const clientId = session.clientId;
  const supabase = createAdminClient();
  const [unreadRes, userRes, clientRes, navBadges] = await Promise.all([
    supabase
      .from("notifications")
      .select("*", { count: "exact", head: true })
      .eq("user_id", session.userId)
      .eq("read", false),
    supabase.from("users").select("avatar_url").eq("id", session.userId).maybeSingle(),
    clientId
      ? supabase.from("clients").select("logo_url, name").eq("id", clientId).maybeSingle()
      : Promise.resolve({ data: null }),
    clientId && session.userId
      ? fetchSalesNavBadges(session.userId, clientId)
      : Promise.resolve({ hotLeads: 0, needsReply: 0, followUpDue: 0, followUpsToday: 0, callNow: 0 }),
  ]);
  const whatsappBadge =
    (navBadges.hotLeads || 0) + (navBadges.needsReply || 0) + (navBadges.followUpDue || 0);

  return (
    <ClientManagerLayout
      breadcrumbPage="WEEKLY REPORT"
      pageTitle="Weekly Sales Performance Report"
      hideShellHeader
      hideShellSidebar
      navClientId={clientId ?? undefined}
    >
      <WeeklyReportDetailClient
        reportId={params.reportId}
        unreadNotifications={unreadRes.count ?? 0}
        notificationRole={session.role as UserRole}
        userName={session.user?.name ?? "User"}
        avatarUrl={(userRes.data as { avatar_url?: string | null } | null)?.avatar_url ?? null}
        companyName={(clientRes.data as { name?: string | null } | null)?.name ?? undefined}
        companyLogoUrl={(clientRes.data as { logo_url?: string | null } | null)?.logo_url ?? null}
        whatsappBadge={whatsappBadge}
      />
    </ClientManagerLayout>
  );
}
