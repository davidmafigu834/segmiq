import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { AppShell } from "@/components/shell/AppShell";
import { ImpersonationBanner } from "@/components/agency/ImpersonationBanner";

export async function ClientManagerLayout({
  children,
  breadcrumbPage,
  breadcrumbOverride,
  pageTitle,
  actions,
  hideShellHeader = false,
  hideShellSidebar = false,
  /** When agency admin previews a client, pass that client id for sidebar brand + breadcrumb data. */
  navClientId,
}: {
  children: React.ReactNode;
  breadcrumbPage?: string;
  breadcrumbOverride?: string | null;
  pageTitle: string;
  actions?: React.ReactNode;
  hideShellHeader?: boolean;
  hideShellSidebar?: boolean;
  navClientId?: string | null;
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
  if (cid) {
    const { data: c } = await supabase.from("clients").select("name, logo_url").eq("id", cid).maybeSingle();
    clientName = (c?.name as string) ?? null;
    logoUrl = (c?.logo_url as string | null) ?? null;
  }

  const breadcrumb =
    breadcrumbOverride ??
    (breadcrumbPage && clientName ? `${clientName} / ${breadcrumbPage}` : breadcrumbPage ?? clientName ?? "CLIENT");

  const primaryNav = [
    { href: "/client/dashboard", label: "Dashboard", icon: "home" as const },
    { href: "/client/inbox", label: "Team Inbox", icon: "inbox" as const },
    { href: "/client/leads", label: "Customer Hub", icon: "users" as const },
    { href: "/client/event-capture", label: "Event Capture", icon: "calendar" as const },
    { href: "/client/marketing", label: "Marketing", icon: "megaphone" as const },
    { href: "/client/team", label: "Team", icon: "users" as const },
    { href: "/client/reports", label: "Reports", icon: "bar-chart-3" as const },
    { href: "/client/billing", label: "Billing", icon: "receipt" as const },
    ...(session?.alsoSells ? [{ href: "/sales/dashboard", label: "My leads", icon: "phone" as const }] : []),
  ];

  const secondaryNav = [
    { href: "/upload", label: "Upload Photos", icon: "camera" as const },
    { href: "/client/company-profile", label: "Company", icon: "building2" as const },
    { href: "/client/quote-settings", label: "Quotations", icon: "file-text" as const },
    { href: "/client/account", label: "Account", icon: "settings" as const },
  ];

  return (
    <AppShell
      homeHref="/client/dashboard"
      roleLabel="Client"
      primaryNav={primaryNav}
      secondaryNav={secondaryNav}
      userName={session?.user?.name ?? "User"}
      userRoleLabel="Client manager"
      breadcrumb={breadcrumb}
      pageTitle={pageTitle}
      actions={actions}
      unreadNotifications={unread}
      notificationRole={session?.role ?? "CLIENT_MANAGER"}
      sidebarBrand={clientName ? { name: clientName, logoUrl } : null}
      hideHeader={hideShellHeader}
      hideSidebar={hideShellSidebar}
      profileHref="/client/account"
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
