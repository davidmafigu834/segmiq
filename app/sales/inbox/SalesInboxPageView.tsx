import { Suspense } from "react";
import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { canActAsSalesperson } from "@/lib/auth/sales-capabilities";
import { SalesLayout } from "@/components/layouts/SalesLayout";
import { SoloLayout } from "@/components/layouts/SoloLayout";
import { TeamInbox } from "@/components/inbox/TeamInbox";
import { WhatsAppSalesHubShell } from "@/components/inbox/WhatsAppSalesHubShell";
import { fetchSalesNavBadges } from "@/lib/sales/nav-badges";
import type { InboxFilter } from "@/lib/inbox/types";

function InboxSuspenseFallback() {
  return (
    <div className="flex h-full min-h-0 flex-1 flex-col bg-sales-bg p-4" aria-busy aria-label="Loading inbox">
      <div className="mb-4 h-8 w-56 animate-pulse rounded-lg bg-sales-border/50" />
      <div className="mb-3 flex gap-2">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="h-8 w-24 animate-pulse rounded-full bg-sales-border/40" />
        ))}
      </div>
      <div className="flex min-h-0 flex-1 gap-0 overflow-hidden rounded-[12px] border border-sales-border bg-sales-surface">
        <div className="hidden w-[360px] shrink-0 border-r border-sales-border p-3 sm:block">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="mb-3 flex gap-3">
              <div className="h-10 w-10 animate-pulse rounded-full bg-[var(--sales-neutral-100)]" />
              <div className="min-w-0 flex-1 space-y-2">
                <div className="h-3 w-2/3 animate-pulse rounded bg-[var(--sales-neutral-100)]" />
                <div className="h-3 w-full animate-pulse rounded bg-sales-neutral-100" />
              </div>
            </div>
          ))}
        </div>
        <div className="flex flex-1 items-center justify-center text-sm text-sales-text-muted">
          Loading WhatsApp Sales Hub…
        </div>
      </div>
    </div>
  );
}

export async function SalesInboxPageView({
  pageTitle,
  breadcrumb,
  initialFilter = "all",
}: {
  pageTitle: string;
  breadcrumb: string;
  initialFilter?: InboxFilter;
  /** @deprecated Hub is always full-page. Kept so existing callers compile. */
  fullPage?: boolean;
}) {
  const session = await getServerSession(authOptions);
  if (!session?.userId || !canActAsSalesperson(session)) redirect("/login");
  if (!session.clientId) redirect("/login");

  const isSolo = session.clientMode === "solo";
  const dashboardHref = isSolo ? "/solo/dashboard" : "/sales/dashboard";
  const Layout = isSolo ? SoloLayout : SalesLayout;

  const [navBadges, userRes] = await Promise.all([
    fetchSalesNavBadges(session.userId, session.clientId),
    (async () => {
      const { createAdminClient } = await import("@/lib/supabase/admin");
      const supabase = createAdminClient();
      const [profile, unread] = await Promise.all([
        supabase.from("users").select("avatar_url").eq("id", session.userId).maybeSingle(),
        supabase
          .from("notifications")
          .select("*", { count: "exact", head: true })
          .eq("user_id", session.userId)
          .eq("read", false),
      ]);
      return { profile, unreadCount: unread.count ?? 0 };
    })(),
  ]);

  const whatsappBadge =
    (navBadges.hotLeads || 0) +
    (navBadges.needsReply || 0) +
    (navBadges.followUpDue || 0);
  const tasksBadge = navBadges.followUpsToday || navBadges.callNow || 0;
  const avatarUrl = (userRes.profile.data?.avatar_url as string | null) ?? null;
  const unreadNotifications = userRes.unreadCount;

  return (
    <Layout
      breadcrumb={breadcrumb}
      pageTitle={pageTitle}
      hideShellHeader
      hideShellSidebar
      contentFlush
    >
      <WhatsAppSalesHubShell
        userName={session.user?.name ?? "Sales"}
        userRoleLabel={isSolo ? "Owner" : "Sales Executive"}
        avatarUrl={avatarUrl}
        unreadNotifications={unreadNotifications}
        notificationRole={session.role}
        whatsappBadge={whatsappBadge}
        tasksBadge={tasksBadge}
        isSolo={isSolo}
      >
        <Suspense fallback={<InboxSuspenseFallback />}>
          <TeamInbox
            userName={session.user?.name ?? "User"}
            userId={session.userId}
            role={session.role === "CLIENT_MANAGER" ? "CLIENT_MANAGER" : "SALESPERSON"}
            alsoSells={session.alsoSells}
            clientId={session.clientId}
            roleSubtitle={isSolo ? "Owner" : "Sales Executive"}
            pipelineHref="/sales/pipeline"
            settingsHref="/sales/profile"
            inboxHref="/sales/inbox"
            teamHref={isSolo ? undefined : dashboardHref}
            initialFilter={initialFilter}
            backHref={dashboardHref}
            pageTitle={pageTitle}
            breadcrumb={breadcrumb}
            unreadNotifications={unreadNotifications}
            avatarUrl={avatarUrl}
          />
        </Suspense>
      </WhatsAppSalesHubShell>
    </Layout>
  );
}
