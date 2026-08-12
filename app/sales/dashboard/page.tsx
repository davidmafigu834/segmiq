import { Suspense } from "react";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { canActAsSalesperson } from "@/lib/auth/sales-capabilities";
import { redirect } from "next/navigation";
import { getSalesDashboardData } from "@/lib/sales/get-sales-dashboard-data";
import { SalesLayout } from "@/components/layouts/SalesLayout";
import { fetchSalesNavBadges } from "@/lib/sales/nav-badges";
import SalesDashboardMain from "./SalesDashboardMain";
import SalesDashboardSkeleton from "./SalesDashboardSkeleton";

export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";

export default async function SalesDashboardPage() {
  const session = await getServerSession(authOptions);

  if (!session || !canActAsSalesperson(session)) {
    redirect("/login");
  }

  const [data, navBadges] = await Promise.all([
    getSalesDashboardData({
      userId: session.userId,
      clientId: session.clientId ?? null,
    }),
    fetchSalesNavBadges(session.userId, session.clientId ?? null),
  ]);

  let unread = 0;
  let avatarUrl: string | null = null;
  try {
    const { createAdminClient } = await import("@/lib/supabase/admin");
    const supabase = createAdminClient();
    const [unreadRes, userRes] = await Promise.all([
      supabase
        .from("notifications")
        .select("*", { count: "exact", head: true })
        .eq("user_id", session.userId)
        .eq("read", false),
      supabase.from("users").select("avatar_url").eq("id", session.userId).maybeSingle(),
    ]);
    unread = unreadRes.count ?? 0;
    avatarUrl = (userRes.data?.avatar_url as string | null) ?? null;
  } catch {
    unread = 0;
  }

  const whatsappBadge =
    (navBadges.hotLeads || 0) +
    (navBadges.needsReply || 0) +
    (navBadges.followUpDue || 0);
  const tasksBadge = navBadges.followUpsToday || navBadges.callNow || 0;

  return (
    <SalesLayout
      breadcrumb="SALES / DASHBOARD"
      pageTitle="Dashboard"
      hideShellHeader
      hideShellSidebar
      contentFlush
    >
      <Suspense fallback={<SalesDashboardSkeleton />}>
        <SalesDashboardMain
          data={data}
          session={session}
          unreadNotifications={unread}
          whatsappBadge={whatsappBadge}
          tasksBadge={tasksBadge}
          isSolo={session.clientMode === "solo"}
          avatarUrl={avatarUrl}
        />
      </Suspense>
    </SalesLayout>
  );
}
