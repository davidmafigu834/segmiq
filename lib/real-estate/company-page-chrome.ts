import { createAdminClient } from "@/lib/supabase/admin";
import { fetchSalesNavBadges } from "@/lib/sales/nav-badges";
import type { UserRole } from "@/types";

export type CompanyPageChrome = {
  unreadNotifications: number;
  notificationRole: UserRole;
  userName: string;
  avatarUrl: string | null;
  companyName: string;
  companyLogoUrl: string | null;
  whatsappBadge: number;
};

export async function loadCompanyPageChrome(opts: {
  userId: string;
  clientId: string;
  userName: string;
  role: UserRole;
}): Promise<CompanyPageChrome> {
  const supabase = createAdminClient();
  const [unreadRes, userRes, clientRes, navBadges] = await Promise.all([
    supabase
      .from("notifications")
      .select("*", { count: "exact", head: true })
      .eq("user_id", opts.userId)
      .eq("read", false),
    supabase.from("users").select("avatar_url").eq("id", opts.userId).maybeSingle(),
    supabase.from("clients").select("name, logo_url").eq("id", opts.clientId).maybeSingle(),
    fetchSalesNavBadges(opts.userId, opts.clientId),
  ]);

  const whatsappBadge =
    (navBadges.hotLeads || 0) + (navBadges.needsReply || 0) + (navBadges.followUpDue || 0);

  return {
    unreadNotifications: unreadRes.count ?? 0,
    notificationRole: opts.role,
    userName: opts.userName,
    avatarUrl: (userRes.data as { avatar_url?: string | null } | null)?.avatar_url ?? null,
    companyName: (clientRes.data as { name?: string | null } | null)?.name ?? "Company",
    companyLogoUrl: (clientRes.data as { logo_url?: string | null } | null)?.logo_url ?? null,
    whatsappBadge,
  };
}
