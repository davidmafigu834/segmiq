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

  let clientRows: AppShellClientRow[] = [];
  let unread = 0;
  let newLeadsCount: number | undefined;

  try {
    const supabase = createAdminClient();
    let clientsResult = await supabase
      .from("clients")
      .select("id, name, agency_managed")
      .eq("is_active", true)
      .eq("is_archived", false)
      .eq("agency_managed", true)
      .order("name");

    if (clientsResult.error?.message?.includes("is_archived") || clientsResult.error?.message?.includes("agency_managed")) {
      clientsResult = await supabase
        .from("clients")
        .select("id, name")
        .eq("is_active", true)
        .order("name");
    }

    const clients = clientsResult.data;
    const clientIds = (clients ?? []).map((c) => c.id);
    const counts: Record<string, number> = {};
    if (clientIds.length) {
      const { data: leads } = await supabase.from("leads").select("client_id").in("client_id", clientIds);
      for (const l of leads ?? []) {
        const id = l.client_id as string;
        counts[id] = (counts[id] ?? 0) + 1;
      }
    }
    if (session?.userId) {
      const { count } = await supabase
        .from("notifications")
        .select("*", { count: "exact", head: true })
        .eq("user_id", session.userId)
        .eq("read", false);
      unread = count ?? 0;
    }

    const { count } = await supabase
      .from("leads")
      .select("*", { count: "exact", head: true })
      .eq("status", "NEW");
    newLeadsCount = count ?? undefined;

    clientRows =
      clients?.map((c) => ({
        id: c.id as string,
        name: c.name as string,
        leadCount: counts[c.id as string] ?? 0,
      })) ?? [];
  } catch (e) {
    console.error("[AgencyLayout] data load failed:", e);
  }

  // Portfolio: day-to-day client ops
  const primaryNav = [
    { href: "/dashboard", label: "Dashboard", icon: "home" as const },
    { href: "/dashboard/leads", label: "All Leads", icon: "inbox" as const, badge: newLeadsCount },
    { href: "/dashboard/clients", label: "Clients", icon: "building2" as const },
    { href: "/dashboard/campaigns", label: "Campaigns", icon: "megaphone" as const },
    { href: "/dashboard/reports", label: "Reports", icon: "bar-chart-3" as const },
  ];

  // Platform + Ops
  const secondaryNav = [
    { href: "/dashboard/billing", label: "Billing", icon: "receipt" as const },
    { href: "/dashboard/cloud-clients", label: "Cloud Clients", icon: "cloud" as const },
    { href: "/dashboard/proposals", label: "Proposals", icon: "file-text" as const },
    { href: "/dashboard/blog", label: "Blog", icon: "file-text" as const },
    { href: "/dashboard/submissions", label: "Submissions", icon: "inbox" as const },
    { href: "/dashboard/status-incidents", label: "Status", icon: "globe" as const },
    { href: "/upload", label: "Upload", icon: "camera" as const },
    { href: "/dashboard/whatsapp-templates", label: "WhatsApp", icon: "message-circle" as const },
    { href: "/dashboard/follow-up-reminders", label: "Follow-ups", icon: "bell" as const },
    { href: "/dashboard/settings", label: "Settings", icon: "settings" as const },
  ];

  return (
    <AppShell
      homeHref="/dashboard"
      roleLabel="Platform"
      primarySectionLabel="Portfolio"
      secondarySectionLabel="Platform"
      primaryNav={primaryNav}
      secondaryNav={secondaryNav}
      clients={clientRows}
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
      {children}
      <AgencyLeadDrawerHost />
    </AppShell>
  );
}
