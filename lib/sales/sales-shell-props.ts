import { createAdminClient } from "@/lib/supabase/admin";
import { fetchSalesNavBadges } from "@/lib/sales/nav-badges";
import type { UserRole } from "@/types";

export type SalesShellSession = {
  userId: string;
  clientId?: string | null;
  clientMode?: string | null;
  role?: UserRole | string | null;
  user?: { name?: string | null } | null;
};

export async function loadSalesShellProps(session: SalesShellSession) {
  const supabase = createAdminClient();
  const [navBadges, unreadRes, userRes] = await Promise.all([
    fetchSalesNavBadges(session.userId, session.clientId ?? null),
    supabase
      .from("notifications")
      .select("*", { count: "exact", head: true })
      .eq("user_id", session.userId)
      .eq("read", false),
    supabase.from("users").select("avatar_url").eq("id", session.userId).maybeSingle(),
  ]);

  return {
    userName: session.user?.name ?? "Sales",
    userRoleLabel: "Sales Executive",
    avatarUrl: (userRes.data?.avatar_url as string | null) ?? null,
    unreadNotifications: unreadRes.count ?? 0,
    notificationRole: (session.role ?? "SALESPERSON") as UserRole,
    whatsappBadge: navBadges.needsReply + navBadges.hotLeads,
    tasksBadge: navBadges.followUpsToday + navBadges.callNow,
    isSolo: session.clientMode === "solo",
  };
}
