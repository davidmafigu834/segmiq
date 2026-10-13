import { createAdminClient } from "@/lib/supabase/admin";
import { fetchSalesNavBadges } from "@/lib/sales/nav-badges";
import type { UserRole } from "@/types";

export type SalesShellSession = {
  userId: string;
  clientId?: string | null;
  clientMode?: string | null;
  role?: UserRole | string | null;
  user?: { name?: string | null } | null;
  demoGuest?: boolean;
};

export async function loadSalesShellProps(session: SalesShellSession) {
  const navBadges = await fetchSalesNavBadges(session.userId, session.clientId ?? null);
  let unreadNotifications = 0;
  let avatarUrl: string | null = null;
  if (!session.demoGuest) {
    const supabase = createAdminClient();
    const [unreadRes, userRes] = await Promise.all([
      supabase
        .from("notifications")
        .select("*", { count: "exact", head: true })
        .eq("user_id", session.userId)
        .eq("read", false),
      supabase.from("users").select("avatar_url").eq("id", session.userId).maybeSingle(),
    ]);
    unreadNotifications = unreadRes.count ?? 0;
    avatarUrl = (userRes.data?.avatar_url as string | null) ?? null;
  }

  return {
    userName: session.user?.name ?? "Sales",
    userRoleLabel: "Sales Executive",
    avatarUrl,
    unreadNotifications,
    notificationRole: (session.role ?? "SALESPERSON") as UserRole,
    whatsappBadge: navBadges.needsReply + navBadges.hotLeads,
    tasksBadge: navBadges.followUpsToday + navBadges.callNow,
    isSolo: session.demoGuest ? false : session.clientMode === "solo",
    demoGuest: Boolean(session.demoGuest),
  };
}
