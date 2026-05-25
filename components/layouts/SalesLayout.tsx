import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { AppShell } from "@/components/shell/AppShell";
import { isToday } from "date-fns";

export async function SalesLayout({
  children,
  breadcrumb,
  pageTitle,
  actions,
  hideShellHeader = false,
}: {
  children: React.ReactNode;
  breadcrumb: string;
  pageTitle: string;
  actions?: React.ReactNode;
  hideShellHeader?: boolean;
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
  if (session?.userId) {
    const { data: fu } = await supabase
      .from("leads")
      .select("follow_up_date")
      .eq("assigned_to_id", session.userId)
      .not("follow_up_date", "is", null);
    followupBadge =
      fu?.filter((l) => l.follow_up_date && isToday(new Date(l.follow_up_date as string))).length ?? 0;
  }

  const primaryNav = [
    { href: "/sales/dashboard", label: "Dashboard", icon: "layout-dashboard" as const },
    { href: "/sales/leads", label: "My leads", icon: "layout-grid" as const },
    { href: "/sales/followups", label: "Follow-ups", icon: "calendar" as const, badge: followupBadge || undefined },
    { href: "/sales/won-lost", label: "Won / Lost", icon: "trophy" as const },
    { href: "/sales/profile", label: "Profile", icon: "user" as const },
  ];

  const secondaryNav = [
    { href: "/upload", label: "Upload Photos", icon: "camera" as const },
  ];

  return (
    <AppShell
      homeHref="/sales/dashboard"
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
    >
      {children}
    </AppShell>
  );
}
