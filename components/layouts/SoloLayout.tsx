import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { AppShell } from "@/components/shell/AppShell";
import { isToday } from "date-fns";
import { buildWhatsAppSalesHubNav } from "@/lib/sales/whatsapp-hub-nav";

export async function SoloLayout({
  children,
  breadcrumb,
  pageTitle,
  actions,
  hideShellHeader = false,
  hideShellSidebar = false,
}: {
  children: React.ReactNode;
  breadcrumb: string;
  pageTitle: string;
  actions?: React.ReactNode;
  hideShellHeader?: boolean;
  hideShellSidebar?: boolean;
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

  let followupBadge = 0;
  let clientName: string | null = null;
  let logoUrl: string | null = null;
  if (session?.userId && session.clientId) {
    const [{ data: fu }, { data: c }] = await Promise.all([
      supabase
        .from("leads")
        .select("follow_up_date")
        .eq("assigned_to_id", session.userId)
        .not("follow_up_date", "is", null),
      supabase.from("clients").select("name, logo_url").eq("id", session.clientId).maybeSingle(),
    ]);
    followupBadge =
      fu?.filter((l) => l.follow_up_date && isToday(new Date(l.follow_up_date as string))).length ?? 0;
    clientName = (c?.name as string) ?? null;
    logoUrl = (c?.logo_url as string | null) ?? null;
  }

  const primaryNav = [
    { href: "/solo/dashboard", label: "Dashboard", icon: "layout-dashboard" as const },
    buildWhatsAppSalesHubNav(followupBadge || undefined),
    { href: "/sales/leads", label: "My leads", icon: "layout-grid" as const },
    { href: "/sales/quotes", label: "Quotes", icon: "file-text" as const },
    { href: "/sales/won-lost", label: "Won / Lost", icon: "trophy" as const },
    { href: "/sales/profile", label: "Profile", icon: "user" as const },
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
    >
      {children}
    </AppShell>
  );
}
