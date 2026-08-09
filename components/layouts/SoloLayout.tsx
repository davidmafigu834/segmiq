import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { AppShell } from "@/components/shell/AppShell";
import { ImpersonationBanner } from "@/components/agency/ImpersonationBanner";
import { fetchSalesNavBadges } from "@/lib/sales/nav-badges";
import { buildWhatsAppSalesHubNav } from "@/lib/sales/whatsapp-hub-nav";

export async function SoloLayout({
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

  const navBadges =
    session?.userId && session.clientId
      ? await fetchSalesNavBadges(session.userId, session.clientId)
      : null;

  let clientName: string | null = null;
  let logoUrl: string | null = null;
  if (session?.clientId) {
    const { data: c } = await supabase
      .from("clients")
      .select("name, logo_url")
      .eq("id", session.clientId)
      .maybeSingle();
    clientName = (c?.name as string) ?? null;
    logoUrl = (c?.logo_url as string | null) ?? null;
  }

  const primaryNav = [
    { href: "/solo/dashboard", label: "Dashboard", icon: "layout-dashboard" as const },
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
    { href: "/solo/billing", label: "Billing", icon: "receipt" as const },
    { href: "/upload", label: "Upload Photos", icon: "camera" as const },
  ];

  return (
    <AppShell
      homeHref="/solo/dashboard"
      roleLabel="Solo"
      primaryNav={primaryNav}
      secondaryNav={secondaryNav}
      userName={session?.user?.name ?? "User"}
      userRoleLabel={clientName ?? "Owner"}
      breadcrumb={breadcrumb}
      pageTitle={pageTitle}
      actions={actions}
      unreadNotifications={unread}
      notificationRole={session?.role ?? "SALESPERSON"}
      quickActionHref="/sales/leads"
      showQuickAction={false}
      sidebarBrand={clientName ? { name: clientName, logoUrl } : null}
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
