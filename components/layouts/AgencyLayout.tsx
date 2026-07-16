import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { AppShell, type AppShellClientRow } from "@/components/shell/AppShell";
import { AgencyLeadDrawerHost } from "@/components/agency/AgencyLeadDrawerHost";

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
  const supabase = createAdminClient();
  const { data: clients } = await supabase
    .from("clients")
    .select("id, name")
    .eq("is_active", true)
    .eq("is_archived", false)
    .order("name");
  const clientIds = (clients ?? []).map((c) => c.id);
  const counts: Record<string, number> = {};
  if (clientIds.length) {
    const { data: leads } = await supabase.from("leads").select("client_id").in("client_id", clientIds);
    for (const l of leads ?? []) {
      const id = l.client_id as string;
      counts[id] = (counts[id] ?? 0) + 1;
    }
  }
  let unread = 0;
  if (session?.userId) {
    const { count } = await supabase
      .from("notifications")
      .select("*", { count: "exact", head: true })
      .eq("user_id", session.userId)
      .eq("read", false);
    unread = count ?? 0;
  }

  const { count: newLeadsCount } = await supabase
    .from("leads")
    .select("*", { count: "exact", head: true })
    .eq("status", "NEW");

  const clientRows: AppShellClientRow[] =
    clients?.map((c) => ({
      id: c.id as string,
      name: c.name as string,
      leadCount: counts[c.id as string] ?? 0,
    })) ?? [];

  const primaryNav = [
    { href: "/dashboard", label: "Dashboard", icon: "home" as const },
    { href: "/dashboard/leads", label: "All Leads", icon: "inbox" as const, badge: newLeadsCount ?? undefined },
    { href: "/dashboard/clients", label: "Clients", icon: "building2" as const },
    { href: "/dashboard/campaigns", label: "Campaigns", icon: "megaphone" as const },
    { href: "/dashboard/reports", label: "Reports", icon: "bar-chart-3" as const },
    { href: "/dashboard/billing", label: "Billing", icon: "receipt" as const },
    { href: "/dashboard/cloud-clients", label: "Cloud Clients", icon: "cloud" as const },
    { href: "/dashboard/proposals", label: "Proposals", icon: "file-text" as const },
    { href: "/dashboard/blog", label: "Blog", icon: "file-text" as const },
    { href: "/dashboard/submissions", label: "Submissions", icon: "inbox" as const },
    { href: "/dashboard/status-incidents", label: "Status", icon: "globe" as const },
  ];

  const secondaryNav = [
    { href: "/upload", label: "Upload", icon: "camera" as const },
    { href: "/dashboard/whatsapp-templates", label: "WhatsApp", icon: "message-circle" as const },
    { href: "/dashboard/settings", label: "Settings", icon: "settings" as const },
  ];

  return (
    <AppShell
      homeHref="/dashboard"
      roleLabel="Agency"
      primaryNav={primaryNav}
      secondaryNav={secondaryNav}
      clients={clientRows}
      userName={session?.user?.name ?? "User"}
      userRoleLabel="Agency admin"
      breadcrumb={breadcrumb}
      pageTitle={pageTitle}
      titleSize={titleSize}
      actions={actions}
      unreadNotifications={unread}
      notificationRole={session?.role ?? "AGENCY_ADMIN"}
      hideHeader={hideShellHeader}
      profileHref="/dashboard/settings?tab=account"
    >
      {children}
      <AgencyLeadDrawerHost />
    </AppShell>
  );
}
