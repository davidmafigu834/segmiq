import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { AppShell } from "@/components/shell/AppShell";
import { ImpersonationBanner } from "@/components/agency/ImpersonationBanner";
import { fetchSalesNavBadges } from "@/lib/sales/nav-badges";
import { buildWhatsAppSalesHubNav } from "@/lib/sales/whatsapp-hub-nav";

export async function SalesLayout({
  children,
  breadcrumb,
  pageTitle,
  actions,
  hideShellHeader = false,
  hideShellSidebar = false,
  contentFlush = false,
}: {
  children: React.ReactNode;
  breadcrumb: string;
  pageTitle: string;
  actions?: React.ReactNode;
  hideShellHeader?: boolean;
  hideShellSidebar?: boolean;
  /** Edge-to-edge main content (WhatsApp Sales Hub). Keeps sidebar; removes shell padding/header. */
  contentFlush?: boolean;
}) {
  const session = await getServerSession(authOptions);
  const supabase = createAdminClient();
  let unread = 0;
  if (session?.userId) {
    const { count } = await supabase
      .from("notifications")
      .select("*", { count: "exact", head: true })
      .eq("user_id", session.userId)
      .eq("read", false);
    unread = count ?? 0;
  }

  const navBadges = session?.userId
    ? await fetchSalesNavBadges(session.userId, session.clientId ?? null)
    : null;

  const isSolo = session?.clientMode === "solo";
  const dashboardHref = isSolo ? "/solo/dashboard" : "/sales/dashboard";

  const primaryNav = [
    { href: dashboardHref, label: "Dashboard", icon: "layout-dashboard" as const },
    {
      href: "/sales/call-now",
      label: "Call now",
      icon: "phone" as const,
      badge: navBadges?.callNow || undefined,
    },
    buildWhatsAppSalesHubNav(
      navBadges
        ? {
            hotLeads: navBadges.hotLeads || undefined,
            needsReply: navBadges.needsReply || undefined,
            followUpDue: navBadges.followUpDue || undefined,
            followUpsToday: navBadges.followUpsToday || undefined,
          }
        : undefined
    ),
    { href: "/sales/leads", label: "My pipeline", icon: "layout-grid" as const },
    { href: "/sales/event-capture", label: "Event Capture", icon: "calendar" as const },
    { href: "/sales/quotes", label: "Quotations", icon: "file-text" as const },
    { href: "/sales/won-lost", label: "Won & Lost", icon: "trophy" as const },
  ];

  const secondaryNav = [
    ...(session?.role === "CLIENT_MANAGER" && session.alsoSells
      ? [{ href: "/client/dashboard", label: "Manager portal", icon: "home" as const }]
      : []),
    { href: "/upload", label: "Upload Photos", icon: "camera" as const },
  ];

  return (
    <AppShell
      homeHref={dashboardHref}
      roleLabel="Sales"
      primaryNav={primaryNav}
      secondaryNav={secondaryNav}
      userName={session?.user?.name ?? "User"}
      userRoleLabel="Sales"
      breadcrumb={breadcrumb}
      pageTitle={pageTitle}
      actions={actions}
      unreadNotifications={unread}
      notificationRole={session?.role ?? "SALESPERSON"}
      quickActionHref="/sales/leads"
      showQuickAction={false}
      hideHeader={hideShellHeader}
      hideSidebar={hideShellSidebar}
      contentFlush={contentFlush}
      showWorkspaceSearch={!contentFlush}
      profileHref="/sales/profile"
    >
      {session?.isImpersonating ? (
        <ImpersonationBanner
          userName={session.user?.name ?? "User"}
          userRole={session.role}
          realUserName={session.realUserName}
        />
      ) : null}
      {children}
    </AppShell>
  );
}
