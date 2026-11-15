import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { AppShell } from "@/components/shell/AppShell";
import { AgencyLeadDrawerHost } from "@/components/agency/AgencyLeadDrawerHost";
import { SupportAccessBanner } from "@/components/agency/support-access/SupportAccessBanner";
import { PLATFORM_NAV_GROUPS } from "@/components/platform/nav";

export async function AgencyLayout({
  children,
  breadcrumb,
  pageTitle,
  actions,
  hideShellHeader = false,
  titleSize = "standard",
}: {
  children: React.ReactNode;
  breadcrumb: string;
  pageTitle: string;
  actions?: React.ReactNode;
  /** Hide AppShell breadcrumb/title row (custom page header in children). */
  hideShellHeader?: boolean;
  titleSize?: "hero" | "standard";
}) {
  const session = await getServerSession(authOptions);

  let unread = 0;
  let platformClients: { id: string; name: string; leadCount: number }[] = [];

  try {
    if (session?.userId) {
      const supabase = createAdminClient();
      const [{ count }, { data: clientRows }] = await Promise.all([
        supabase
          .from("notifications")
          .select("*", { count: "exact", head: true })
          .eq("user_id", session.userId)
          .eq("read", false),
        supabase
          .from("clients")
          .select("id, name")
          .or("is_archived.is.null,is_archived.eq.false")
          .order("name"),
      ]);
      unread = count ?? 0;
      platformClients = (clientRows ?? [])
        .filter((row) => row.id && row.name)
        .map((row) => ({ id: row.id as string, name: row.name as string, leadCount: 0 }));
    }
  } catch (e) {
    console.error("[AgencyLayout] data load failed:", e);
  }

  const primaryNav = PLATFORM_NAV_GROUPS.flatMap((g) => g.items);

  return (
    <AppShell
      homeHref="/dashboard"
      roleLabel="Platform Admin"
      primarySectionLabel="Overview"
      secondarySectionLabel="Platform"
      primaryNav={primaryNav}
      secondaryNav={[]}
      navGroups={PLATFORM_NAV_GROUPS}
      clients={platformClients}
      platformConsole
      showQuickAction={false}
      userName={session?.user?.name ?? "User"}
      userRoleLabel="Super Admin"
      breadcrumb={breadcrumb}
      pageTitle={pageTitle}
      titleSize={titleSize}
      actions={actions}
      unreadNotifications={unread}
      notificationRole={session?.role ?? "SUPER_ADMIN"}
      hideHeader={hideShellHeader}
      profileHref="/dashboard/settings?tab=account"
    >
      <SupportAccessBanner />
      {children}
      <AgencyLeadDrawerHost />
    </AppShell>
  );
}
