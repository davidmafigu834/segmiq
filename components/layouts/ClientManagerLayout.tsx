import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { fetchSalesNavBadges } from "@/lib/sales/nav-badges";
import { AppShell } from "@/components/shell/AppShell";
import { CompanyWorkspaceShell } from "@/components/dashboard/company/CompanyWorkspaceShell";
import { CompanyDashboardHeader } from "@/components/dashboard/company/CompanyDashboardHeader";
import { CompanyWorkspaceProvider } from "@/components/company/CompanyWorkspaceContext";
import { getTerminology, isRealEstate, normalizeBusinessType } from "@/lib/terminology";

export async function ClientManagerLayout({
  children,
  breadcrumbPage,
  breadcrumbOverride,
  pageTitle,
  actions,
  hideShellHeader = false,
  hideShellSidebar = false,
  contentFlush,
  /** Wrap content in the premium company workspace (sidebar, dot-wave canvas, mobile chrome). */
  workspaceShell = false,
  immersive = false,
  /** When agency admin previews a client, pass that client id for sidebar brand + breadcrumb data. */
  navClientId,
  workspaceTitle,
  workspaceDescription,
  workspaceCanAddLead = false,
}: {
  children: React.ReactNode;
  breadcrumbPage?: string;
  breadcrumbOverride?: string | null;
  pageTitle: string;
  actions?: React.ReactNode;
  hideShellHeader?: boolean;
  hideShellSidebar?: boolean;
  contentFlush?: boolean;
  workspaceShell?: boolean;
  immersive?: boolean;
  navClientId?: string | null;
  /** Company dashboard title block (same chrome as Team / Leads). */
  workspaceTitle?: string;
  workspaceDescription?: string;
  workspaceCanAddLead?: boolean;
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

  const cid = navClientId ?? session?.clientId ?? null;
  let clientName: string | null = null;
  let logoUrl: string | null = null;
  let businessType: string = "trades";
  if (cid) {
    const { data: c } = await supabase
      .from("clients")
      .select("name, logo_url, business_type")
      .eq("id", cid)
      .maybeSingle();
    clientName = (c?.name as string) ?? null;
    logoUrl = (c?.logo_url as string | null) ?? null;
    businessType = (c?.business_type as string) ?? "trades";
  }

    const breadcrumb =
    breadcrumbOverride ??
    (breadcrumbPage
      ? `COMPANY / ${breadcrumbPage}`
      : clientName
        ? `COMPANY / ${clientName}`
        : "COMPANY");

  const isRE = isRealEstate(businessType);
  const terms = getTerminology(businessType);

  const resolvedHideHeader = workspaceShell || hideShellHeader;
  const resolvedHideSidebar = workspaceShell || hideShellSidebar;
  const resolvedContentFlush = contentFlush ?? (workspaceShell || resolvedHideSidebar);

  let avatarUrl: string | null = null;
  let whatsappBadge = 0;

  if (workspaceShell && session?.userId && cid) {
    const [userRes, navBadges] = await Promise.all([
      supabase.from("users").select("avatar_url").eq("id", session.userId).maybeSingle(),
      fetchSalesNavBadges(session.userId, cid),
    ]);
    avatarUrl = (userRes.data?.avatar_url as string | null) ?? null;
    whatsappBadge =
      (navBadges.hotLeads || 0) + (navBadges.needsReply || 0) + (navBadges.followUpDue || 0);
  }

  const primaryNav = isRE
    ? [
        { href: "/client/dashboard", label: "Overview", icon: "home" as const },
        { href: "/client/leads", label: terms.lead.plural, icon: "users" as const },
        { href: "/client/leads/pipeline", label: "Pipeline", icon: "bar-chart-3" as const },
        { href: "/client/offers", label: "Offers", icon: "file-text" as const },
        { href: "/client/viewings", label: terms.siteVisit.plural, icon: "calendar" as const },
        { href: "/client/inbox", label: "WhatsApp", icon: "inbox" as const },
        { href: "/client/listings", label: "Listings", icon: "building2" as const },
        { href: "/client/developments", label: "Developments", icon: "building2" as const },
        { href: "/client/team", label: terms.salesperson.plural, icon: "users" as const },
        { href: "/client/calendar", label: "Calendar", icon: "calendar" as const },
        { href: "/client/marketing", label: "Marketing", icon: "megaphone" as const },
        { href: "/client/reports", label: "Reports", icon: "bar-chart-3" as const },
        { href: "/client/billing", label: "Billing", icon: "receipt" as const },
      ]
    : [
        { href: "/client/dashboard", label: "Dashboard", icon: "home" as const },
        { href: "/client/team", label: "Team", icon: "users" as const },
        { href: "/client/leads/pipeline", label: "Pipeline", icon: "bar-chart-3" as const },
        { href: "/client/leads", label: "Leads", icon: "users" as const },
        { href: "/client/inbox", label: "WhatsApp Sales Hub", icon: "inbox" as const },
        { href: "/client/quotations", label: "Quotations", icon: "file-text" as const },
        { href: "/client/calendar", label: "Calendar", icon: "calendar" as const },
        { href: "/client/customers", label: "Customers", icon: "users" as const },
        { href: "/client/event-capture", label: "Event Capture", icon: "calendar" as const },
        { href: "/client/marketing", label: "Marketing", icon: "megaphone" as const },
        { href: "/client/reports", label: "Reports", icon: "bar-chart-3" as const },
        { href: "/client/billing", label: "Billing", icon: "receipt" as const },
        ...(session?.alsoSells
          ? [{ href: "/sales/dashboard", label: "My sales", icon: "phone" as const }]
          : []),
      ];

  const secondaryNav = [
    { href: "/upload", label: "Upload Photos", icon: "camera" as const },
    { href: "/client/settings/company", label: "Company", icon: "building2" as const },
    { href: "/client/settings", label: "Settings", icon: "settings" as const },
  ];

  const pageContent = workspaceShell ? (
    <CompanyWorkspaceProvider businessType={normalizeBusinessType(businessType)}>
      <CompanyWorkspaceShell
      companyName={clientName ?? undefined}
      companyLogoUrl={logoUrl}
      userName={session?.user?.name ?? "User"}
      avatarUrl={avatarUrl}
      unreadNotifications={unread}
      notificationRole={session?.role ?? "CLIENT_MANAGER"}
      whatsappBadge={whatsappBadge}
      immersive={immersive}
    >
      {workspaceTitle ? (
        <CompanyDashboardHeader
          unreadNotifications={unread}
          notificationRole={session?.role ?? "CLIENT_MANAGER"}
          userName={session?.user?.name ?? "User"}
          avatarUrl={avatarUrl}
          canAddLead={workspaceCanAddLead}
          breadcrumb={`Company / ${workspaceTitle}`}
          title={workspaceTitle}
          description={workspaceDescription}
          primaryAction={null}
        />
      ) : null}
      {children}
    </CompanyWorkspaceShell>
    </CompanyWorkspaceProvider>
  ) : (
    children
  );

  return (
    <AppShell
      homeHref="/client/dashboard"
      roleLabel="Company"
      primaryNav={primaryNav}
      secondaryNav={secondaryNav}
      userName={session?.user?.name ?? "User"}
      userRoleLabel="Company Manager"
      breadcrumb={breadcrumb}
      pageTitle={pageTitle}
      actions={actions}
      unreadNotifications={unread}
      notificationRole={session?.role ?? "CLIENT_MANAGER"}
      sidebarBrand={clientName ? { name: clientName, logoUrl } : null}
      hideHeader={resolvedHideHeader}
      hideSidebar={resolvedHideSidebar}
      contentFlush={resolvedContentFlush}
      profileHref="/client/settings/profile"
    >
      {pageContent}
    </AppShell>
  );
}
